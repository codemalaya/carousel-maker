import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { z } from "zod";
import type { Carousel } from "./schema.ts";
import { renderPng } from "./headless.ts";
import { assetsDir, checkId, saveAsset } from "./projects.ts";

/**
 * Button-pin mockups: the slide is rendered to PNG here, then `mockup-maker` (a separate app, R3F + Playwright)
 * puts it on a 3D pin and renders the final image. That image is saved into the project's assets
 * (`mockup-<hash>.png`), so it can be used as a normal `image` element.
 *
 * Only the pin parameters we care about are typed. `design`, `scene`, `camera`, `layout` and `output` are passed
 * through as a patch over the spec and validated by mockup-maker itself (strict schema, clear errors).
 */

/** Folder of the mockup-maker app. Override with `MOCKUP_MAKER_DIR`. */
export const MOCKUP_DIR = resolve(process.env.MOCKUP_MAKER_DIR ?? resolve(import.meta.dirname, "../../../mockup-maker"));

/** Lighting environments in `mockup-maker/hdri/` (name = value for `scene.environment.src`). Empty when the folder does not exist. */
export async function listEnvironments(): Promise<string[]> {
  try {
    return (await readdir(join(MOCKUP_DIR, "hdri"))).filter((f) => /\.(hdr|exr|jpe?g|png|webp)$/i.test(f)).sort();
  } catch {
    return [];
  }
}

const Obj = z.record(z.string(), z.unknown());

export const MockupOpts = z.object({
  diameterMm: z.union([z.literal(32), z.literal(44)]).default(44),
  finish: z.enum(["glossy", "matte"]).default("glossy"),
  /** Slide is cropped to the pin circle. `cover` fills it (a 4:5 slide loses top and bottom), `contain` shows the whole slide. */
  fit: z.enum(["cover", "contain"]).default("cover"),
  /** Slide pixel ratio before it becomes the pin texture; 2 keeps text crisp */
  textureScale: z.number().min(1).max(3).default(2),
  /** Merged over the matching spec section (mockup-maker validates the result) */
  design: Obj.optional(),
  scene: Obj.optional(),
  camera: Obj.optional(),
  layout: Obj.optional(),
  output: Obj.optional(),
  /** Per-run timeout of the mockup-maker CLI */
  timeoutSec: z.number().min(10).max(600).default(120),
});
export type MockupOpts = z.input<typeof MockupOpts>;

export type MockupResult = {
  slide: number;
  /** File name inside `projects/<id>/assets/` */
  file: string;
  /** True when an identical render already existed (nothing was rendered) */
  cached: boolean;
};

const exists = (p: string) => stat(p).then(() => true, () => false);

/** `design`, `scene`, ... patch: objects merge key by key, everything else replaces. */
function merge(base: Record<string, unknown>, patch?: Record<string, unknown>): Record<string, unknown> {
  if (!patch) return base;
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    const cur = out[k];
    out[k] =
      v && typeof v === "object" && !Array.isArray(v) && cur && typeof cur === "object" && !Array.isArray(cur)
        ? merge(cur as Record<string, unknown>, v as Record<string, unknown>)
        : v;
  }
  return out;
}

type RunReport = { log?: string; results: { id: string; ok: boolean; path?: string; error?: string }[] };

/** Runs mockup-maker's own render CLI. It starts its dev server itself when none is running. */
function runRender(specDir: string, outDir: string, timeoutSec: number): Promise<RunReport> {
  const tsx = join(MOCKUP_DIR, "node_modules", ".bin", "tsx");
  return new Promise((res, rej) => {
    const child = spawn(tsx, ["src/server/render-cli.ts", specDir, "--out", outDir, "--json", "--timeout", String(timeoutSec)], {
      cwd: MOCKUP_DIR,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err = (err + d).slice(-4000)));
    const timer = setTimeout(() => child.kill("SIGKILL"), (timeoutSec + 60) * 1000);
    child.on("error", (e) =>
      rej(
        new Error(
          (e as NodeJS.ErrnoException).code === "ENOENT"
            ? `mockup-maker not found at ${MOCKUP_DIR} (run npm install there, or set MOCKUP_MAKER_DIR)`
            : String(e),
        ),
      ),
    );
    child.on("close", () => {
      clearTimeout(timer);
      // exit code is 1 when some item failed; the JSON report still says which and why
      try {
        res({ ...(JSON.parse(out) as RunReport), log: err.trim() });
      } catch {
        rej(new Error(`mockup-maker render failed: ${err.trim().split("\n").slice(-3).join(" ") || "no output"}`));
      }
    });
  });
}

/**
 * Renders the given slides as button-pin mockups and saves them into the project's assets.
 * One mockup-maker run for all slides. Identical input (slide pixels + options) is served from assets without rendering.
 */
export async function renderMockups(project: string, c: Carousel, slides: number[], optsIn: MockupOpts = {}): Promise<MockupResult[]> {
  checkId(project);
  const o = MockupOpts.parse(optsIn);
  for (const i of slides) if (!Number.isInteger(i) || i < 0 || i >= c.slides.length) throw new Error(`no slide ${i}`);
  if (!slides.length) return [];
  if (!(await exists(join(MOCKUP_DIR, "package.json")))) {
    throw new Error(`mockup-maker not found at ${MOCKUP_DIR} (set MOCKUP_MAKER_DIR)`);
  }

  // a missing environment file would otherwise only show up as a timeout after minutes
  const envSrc = (o.scene?.environment as { src?: unknown } | undefined)?.src;
  if (typeof envSrc === "string" && !(await listEnvironments()).includes(envSrc)) {
    const have = await listEnvironments();
    throw new Error(`HDRI "${envSrc}" not found in ${join(MOCKUP_DIR, "hdri")}${have.length ? ` (have: ${have.join(", ")})` : ""}`);
  }

  const pngs = await renderPng(c, slides, project, o.textureScale);
  const settings = JSON.stringify({ ...o, timeoutSec: undefined });

  type Job = { slide: number; png: Buffer; file: string; id: string; design: string };
  const results: MockupResult[] = [];
  const jobs: Job[] = [];
  slides.forEach((slide, n) => {
    const png = pngs[n];
    const hash = createHash("sha256").update(png).update(settings).digest("hex").slice(0, 10);
    jobs.push({ slide, png, file: `mockup-${hash}.png`, id: `cm-${hash}`, design: `cm-${hash}.png` });
  });

  const todo: Job[] = [];
  const seen = new Set<string>();
  for (const j of jobs) {
    if (await exists(join(assetsDir(project), j.file))) results.push({ slide: j.slide, file: j.file, cached: true });
    else if (!seen.has(j.file)) (seen.add(j.file), todo.push(j));
  }

  if (todo.length) {
    const tmp = await mkdtemp(join(tmpdir(), "carousel-mockup-"));
    const specDir = join(tmp, "specs");
    const outDir = join(tmp, "out");
    const designsDir = join(MOCKUP_DIR, "designs");
    const written: string[] = [];
    try {
      await mkdir(specDir, { recursive: true });
      await mkdir(designsDir, { recursive: true });
      for (const j of todo) {
        // the slide must live in mockup-maker's designs/ (spec paths are relative to it); removed again after the run
        await writeFile(join(designsDir, j.design), j.png);
        written.push(join(designsDir, j.design));
        const spec = {
          schemaVersion: 1,
          id: j.id,
          product: { type: "button-pin", diameterMm: o.diameterMm, finish: o.finish },
          design: merge({ src: j.design, fit: o.fit }, o.design),
          scene: o.scene ?? {},
          camera: o.camera ?? {},
          layout: o.layout ?? {},
          output: o.output ?? {},
        };
        await writeFile(join(specDir, `${j.id}.json`), JSON.stringify(spec, null, 2));
      }
      let report = await runRender(specDir, outDir, o.timeoutSec);
      // the dev server mockup-maker starts itself can drop right after "ready" on a cold start (seen once: ERR_CONNECTION_REFUSED); one retry
      if (report.results.some((r) => !r.ok && /ERR_CONNECTION_REFUSED/.test(r.error ?? ""))) report = await runRender(specDir, outDir, o.timeoutSec);
      for (const j of todo) {
        const r = report.results.find((x) => x.id === j.id);
        if (!r?.ok || !r.path) throw new Error(`mockup of slide ${j.slide + 1} failed: ${r?.error ?? "no result"}${report.log ? `\n--- mockup-maker log ---\n${report.log}` : ""}`);
        await saveAsset(project, j.file, await readFile(resolve(MOCKUP_DIR, r.path)));
      }
    } finally {
      await Promise.all(written.map((f) => rm(f, { force: true })));
      await rm(tmp, { recursive: true, force: true });
    }
  }

  for (const j of jobs) {
    if (!results.some((r) => r.slide === j.slide)) results.push({ slide: j.slide, file: j.file, cached: false });
  }
  return results.sort((a, b) => a.slide - b.slide);
}
