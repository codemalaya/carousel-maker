import { chromium, type Browser, type Page } from "playwright";
import { FORMATS, type Carousel } from "./schema.ts";
import { ANIM_CSS, renderDeckHtml, renderSlideHtml, renderSlideBody, stepCss, maxStep, type RenderOpts } from "./render.ts";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { IMAGE_TYPES, readAsset } from "./projects.ts";

const ASSET_HOST = "http://carousel.local";
const OPTS: RenderOpts = { assetBase: `${ASSET_HOST}/assets` };

export type LintIssue = { slide: number; element: number; kind: string; message: string };

async function withBrowser<T>(fn: (b: Browser) => Promise<T>): Promise<T> {
  const browser = await chromium.launch();
  try {
    return await fn(browser);
  } finally {
    await browser.close();
  }
}

/** Serve project assets to the page via request interception (about:blank can't load file://). */
async function serveAssets(page: Page, project?: string) {
  await page.route(`${ASSET_HOST}/assets/**`, async (route) => {
    try {
      const name = decodeURIComponent(new URL(route.request().url()).pathname.replace("/assets/", ""));
      const ext = name.split(".").pop()!.toLowerCase();
      if (!project) throw new Error("no project");
      await route.fulfill({ body: await readAsset(project, name), contentType: IMAGE_TYPES[ext] });
    } catch {
      await route.fulfill({ status: 404, body: "missing asset" });
    }
  });
}

export async function renderPng(c: Carousel, indices: number[], project?: string, scale = 1): Promise<Buffer[]> {
  const { width, height } = FORMATS[c.format];
  return withBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale });
    await serveAssets(page, project);
    const out: Buffer[] = [];
    for (const i of indices) {
      await page.setContent(renderSlideHtml(c, i, OPTS), { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      out.push(await page.screenshot({ type: "png", clip: { x: 0, y: 0, width, height } }));
    }
    return out;
  });
}

export async function renderPdf(c: Carousel, project?: string): Promise<Buffer> {
  if (!c.slides.length) throw new Error("no slides to export");
  const { width, height } = FORMATS[c.format];
  return withBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: { width, height } });
    await serveAssets(page, project);
    await page.setContent(renderDeckHtml(c, OPTS), { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    return page.pdf({ width: `${width}px`, height: `${height}px`, printBackground: true, preferCSSPageSize: true });
  });
}

export async function lint(c: Carousel, indices: number[], project?: string): Promise<LintIssue[]> {
  const { width, height } = FORMATS[c.format];
  return withBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: { width, height } });
    await serveAssets(page, project);
    const issues: LintIssue[] = [];
    for (const i of indices) {
      await page.setContent(renderSlideHtml(c, i, OPTS), { waitUntil: "networkidle" });
      const found = await page.evaluate(
        ({ W, H }) => {
          const res: { element: number; kind: string; message: string }[] = [];
          const kids = Array.from(document.querySelector(".slide")!.children) as HTMLElement[];
          kids.forEach((el, idx) => {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0)
              res.push({ element: idx, kind: "empty", message: "zero-size element" });
            else if (r.right < 0 || r.bottom < 0 || r.left > W || r.top > H)
              res.push({ element: idx, kind: "offcanvas", message: "fully outside canvas" });
            else if (r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1)
              res.push({ element: idx, kind: "bleed", message: "partly outside canvas (ok if intentional)" });
            if (el.scrollHeight > el.clientHeight + 1 && el.style.height)
              res.push({ element: idx, kind: "overflow", message: "content taller than box" });
            if (el.scrollWidth > el.clientWidth + 1 && el.style.width)
              res.push({ element: idx, kind: "overflow", message: "content wider than box" });
          });
          return res;
        },
        { W: width, H: height },
      );
      for (const f of found) issues.push({ slide: i, ...f });
    }
    return issues;
  });
}

export type VideoOpts = {
  /** "gif" is scaled down to 720 px wide and 15 fps by default */
  kind?: "mp4" | "gif";
  fps?: number;
  /** ms a slide stays after its last animation ends */
  hold?: number;
  /** ms between automatic reveals of `step` elements */
  stepGap?: number;
};

const TRANSITION_MS = { fade: 400, zoom: 450 } as const;

/** Entrance of a slide in the video: "zoom" zooms, everything else (incl. the default swipe) fades. */
const videoTransition = (t?: string) => (t === "zoom" ? "zoom" : "fade");

function runFfmpeg(args: string[], frames: AsyncIterable<Buffer>): Promise<void> {
  return new Promise((resolve, reject) => {
    const ff = spawn("ffmpeg", args, { stdio: ["pipe", "ignore", "pipe"] });
    let err = "";
    ff.stderr.on("data", (d) => (err = (err + d).slice(-2000)));
    ff.on("error", (e) =>
      reject(new Error((e as NodeJS.ErrnoException).code === "ENOENT" ? "ffmpeg not found: install it (brew install ffmpeg) to export video/GIF" : String(e))),
    );
    ff.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg failed (${code}): ${err.trim().split("\n").slice(-3).join(" ")}`))));
    ff.stdin.on("error", () => {}); // ffmpeg died early; the close handler reports why
    (async () => {
      for await (const f of frames) if (!ff.stdin.write(f)) await new Promise((r) => ff.stdin.once("drain", r));
      ff.stdin.end();
    })().catch(reject);
  });
}

/**
 * Plays the deck as a video: slides in order, `step` elements revealed automatically, entrance animations and transitions as in Preview.
 * Time is driven through the Web Animations API (paused + currentTime per frame), so output is deterministic and independent of machine speed.
 */
export async function renderVideo(c: Carousel, project?: string, o: VideoOpts = {}): Promise<Buffer> {
  if (!c.slides.length) throw new Error("no slides to export");
  const gif = o.kind === "gif";
  const fps = o.fps ?? (gif ? 15 : 30);
  const hold = o.hold ?? 1500;
  const stepGap = o.stepGap ?? 1000;
  const { width, height } = FORMATS[c.format];
  const dir = await mkdtemp(join(tmpdir(), "carousel-video-"));
  const file = join(dir, gif ? "out.gif" : "out.mp4");

  async function* frames(): AsyncGenerator<Buffer> {
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({ viewport: { width, height } });
      await serveAssets(page, project);
      for (const slide of c.slides) {
        const trans = videoTransition(slide.transition);
        const max = maxStep(slide);
        const stepAt = (k: number) => k * stepGap;
        const ends = slide.elements.map((e) => stepAt(e.step) + (e.anim ? e.anim.delay + e.anim.duration : 0));
        const animEnd = Math.max(TRANSITION_MS[trans], stepAt(max), ...ends);
        const total = animEnd + hold;
        await page.setContent(
          `<!doctype html><html><head><meta charset="utf-8"><style>${c.tokens.css}
*{box-sizing:border-box;margin:0}body{margin:0;background:#000}svg{display:block}
${ANIM_CSS}${stepCss(max)}</style></head><body>
<div id="w" data-active="true" data-cur="0" data-t="${trans}" style="width:${width}px;height:${height}px">${renderSlideBody(slide, c, { ...OPTS, animate: true })}</div></body></html>`,
          { waitUntil: "networkidle" },
        );
        await page.evaluate(() => document.fonts.ready);
        const frameCount = Math.ceil((total / 1000) * fps);
        let still: Buffer | null = null;
        for (let f = 0; f < frameCount; f++) {
          const t = (f * 1000) / fps;
          if (t >= animEnd && still) {
            yield still; // nothing moves any more: reuse the last real frame
            continue;
          }
          await page.evaluate(
            ({ t, stepGap }) => {
              const w = document.getElementById("w")!;
              w.dataset.cur = String(Math.floor(t / stepGap));
              void document.body.offsetHeight; // flush: newly revealed elements create their animations now
              for (const a of document.getAnimations()) {
                const el = (a.effect as KeyframeEffect).target as HTMLElement;
                const step = el === w ? 0 : Number(el.dataset.step ?? 0);
                a.pause();
                a.currentTime = Math.max(0, t - step * stepGap);
              }
            },
            { t, stepGap },
          );
          const buf = await page.screenshot({ type: "jpeg", quality: 92, clip: { x: 0, y: 0, width, height } });
          if (t >= animEnd) still = buf;
          yield buf;
        }
      }
    } finally {
      await browser.close();
    }
  }

  try {
    const input = ["-y", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "mjpeg", "-i", "-"];
    const output = gif
      ? ["-vf", `scale=${Math.min(width, 720)}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=4`, "-loop", "0", file]
      : ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "medium", "-movflags", "+faststart", file];
    await runFfmpeg([...input, ...output], frames());
    return await readFile(file);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
