/**
 * Regression check for the green-pin replacement (src/core/pinPhoto.ts) on every photo in photos/.
 * Per photo: pins found, pins whose rim could not be measured, measured grow range, and key-green pixels left after the replacement.
 * Compared with scripts/pin-photo-baseline.json (what was visually checked as good). Exit 1 on a regression.
 *   npx tsx scripts/pin-photo-regress.mts            compare
 *   npx tsx scripts/pin-photo-regress.mts --update   accept the current numbers as the new baseline
 * Look at the images too: numbers do not see a halo. Results are written to $OUT (default: a temp folder) as <photo>.png.
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { replacePins } from "../src/core/pinPhoto.ts";

const ROOT = join(import.meta.dirname, "..");
const PHOTOS = join(ROOT, "photos");
const BASE = join(import.meta.dirname, "pin-photo-baseline.json");
const OUT = process.env.OUT ?? join(tmpdir(), "pin-photo-regress");
const FACE = join(ROOT, "projects/nadi-billing-pin/assets/logo-icon.png"); // any design; the logo has transparency, which the engine must tolerate

type Row = { pins: number; noRim: number; growMin: number; growMax: number; green: number };

/** Pixels that still look like the key green (same rule as the detector), counted inside Chromium's canvas. */
async function keyGreen(png: Buffer): Promise<number> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    return await page.evaluate(async (b64) => {
      const img = new Image();
      img.src = "data:image/png;base64," + b64;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      const g = c.getContext("2d")!;
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 1] > 100 && d[i] < 0.3 * d[i + 1] && d[i + 1] - Math.max(d[i], d[i + 2]) > 0.58 * d[i + 1]) n++;
      return n;
    }, png.toString("base64"));
  } finally {
    await browser.close();
  }
}

const face = await readFile(FACE);
await mkdir(OUT, { recursive: true });
const files = (await readdir(PHOTOS)).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).sort();
const now: Record<string, Row> = {};
for (const f of files) {
  const r = await replacePins(await readFile(join(PHOTOS, f)), [face]);
  await writeFile(join(OUT, f.replace(/\.\w+$/, "") + ".png"), r.png);
  const grows = r.pins.map((p) => p.grow ?? 0);
  now[f] = {
    pins: r.pins.length,
    noRim: r.pins.filter((p) => !p.rim).length,
    growMin: +Math.min(...grows).toFixed(3),
    growMax: +Math.max(...grows).toFixed(3),
    green: await keyGreen(r.png),
  };
  console.log(f.padEnd(24), JSON.stringify(now[f]));
}

if (process.argv.includes("--update")) {
  await writeFile(BASE, JSON.stringify(now, null, 2) + "\n");
  console.log(`baseline written: ${BASE}`);
} else {
  const base: Record<string, Row> = JSON.parse(await readFile(BASE, "utf8").catch(() => "{}"));
  const bad: string[] = [];
  for (const [f, n] of Object.entries(now)) {
    const b = base[f];
    if (!b) { bad.push(`${f}: no baseline (run with --update after checking the image)`); continue; }
    if (n.pins !== b.pins) bad.push(`${f}: pins ${b.pins} -> ${n.pins}`);
    if (n.noRim > b.noRim) bad.push(`${f}: rim not measured on ${n.noRim} pin(s) (was ${b.noRim})`);
    if (Math.abs(n.growMin - b.growMin) > 0.02 || Math.abs(n.growMax - b.growMax) > 0.02) bad.push(`${f}: grow ${b.growMin}-${b.growMax} -> ${n.growMin}-${n.growMax}`);
    if (n.green > b.green * 1.5 + 50) bad.push(`${f}: key-green pixels left ${b.green} -> ${n.green}`);
  }
  for (const f of Object.keys(base)) if (!(f in now)) bad.push(`${f}: photo missing`);
  if (bad.length) {
    console.error("\nREGRESSION\n" + bad.map((x) => "  " + x).join("\n"));
    process.exit(1);
  }
  console.log(`\nok (${files.length} photos). images in ${OUT}`);
}
