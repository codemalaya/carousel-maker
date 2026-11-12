import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium, type Page } from "playwright";

/**
 * Replace the green "placeholder" pins in a photo with other designs, keeping the photo's own light, shadow and gloss.
 * The pixel work lives in `pinPhoto.browser.js` and runs in a Chromium page (Playwright is already a dependency); this file only feeds it
 * images and collects the PNG. See todo.md section 9 and scripts/pin-photo-prototype.py (the reference the port was checked against).
 */

export type Pin = {
  /** centre, px of the photo */
  cx: number;
  cy: number;
  /** semi-axes of the green area, px (a >= b); the design is squashed to this ellipse, never sheared */
  a: number;
  b: number;
  /** radians, orientation of the `a` axis (0 for near-circles) */
  theta: number;
  /** key-green pixels in the (gloss-filled) component */
  area: number;
  /** Measured or chosen for this pin (see `PinPhotoOpts.grow`): new-disc size relative to the green area */
  grow?: number;
  /** ...and the move of the new disc, as a fraction of the pin radius */
  shift?: [number, number];
  /** Unit vector TOWARD the light in image coordinates (+x right, +y down), measured from the photo (or given in `PinPhotoOpts.light`) */
  light?: [number, number];
  /** How the automatic rim measurement went: `null` = it failed and `grow` fell back to 1.1 */
  rim?: { n: number; rmse: number } | null;
};

export type PinPhotoOpts = {
  /**
   * Size of the new disc relative to the green area. A bit above 1 covers the photo's own rim and the key-green spill
   * (measured: 1.04 leaves ghost rims, 1.08+ is clean, wide rims need ~1.12).
   * `"auto"` (default): measured per pin from the outer edge of its rim; falls back to 1.1 when the edge cannot be found.
   */
  grow?: number | "auto";
  /** Move the new disc, as a fraction of the pin radius: the rim is thicker on the side the camera looks from. Default: measured with `grow: "auto"`, else [0, 0]. */
  shift?: [number, number];
  /** Direction toward the light for every pin, instead of measuring it (unit vector, +x right, +y down). Example: from the upper left [-0.62, -0.78] */
  light?: [number, number];
  /** Grain seed (same seed = same pixels) */
  seed?: number;
  /** Detect only components at least this big (px). Default 1200 (about a 40 px pin) */
  minArea?: number;
  /** Use these pins instead of detecting (e.g. after the user edited them) */
  pins?: Pin[];
};

export type PinPhotoResult = {
  width: number;
  height: number;
  pins: Pin[];
  /** The photo with the pins replaced */
  png: Buffer;
};

const SCRIPT = join(import.meta.dirname, "pinPhoto.browser.js");

declare global {
  interface Window {
    __pinPhoto: {
      detect(photo: string, minArea?: number): Promise<{ width: number; height: number; pins: Pin[]; small: number }>;
      measure(photo: string, minArea?: number): Promise<{ width: number; height: number; pins: Pin[]; small: number }>;
      run(photo: string, faces: string[], opts: PinPhotoOpts): Promise<{ width: number; height: number; pins: Pin[]; png: string | null; small: number }>;
    };
  }
}

/** One Chromium page with the browser script loaded. The pixel work runs there; Node only passes base64 images in and out. */
async function withPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent("<!doctype html><html><body></body></html>");
    await page.addScriptTag({ content: await readFile(SCRIPT, "utf8") });
    return await fn(page);
  } finally {
    await browser.close();
  }
}

const b64 = (b: Buffer) => b.toString("base64");

/** PNG, JPEG, WebP or GIF by magic bytes. Anything else would only fail deep inside the page with an unreadable message. */
function checkImage(b: Buffer, what: string) {
  const ok =
    (b.length > 8 && b[0] === 0x89 && b.toString("latin1", 1, 4) === "PNG") ||
    (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) ||
    (b.length > 12 && b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP") ||
    (b.length > 6 && b.toString("latin1", 0, 3) === "GIF");
  if (!ok) throw new Error(`${what} is not a PNG, JPEG, WebP or GIF image`);
}

const NO_PINS = "no green pins found in the photo (the key colour must be a clearly green, flat disc of at least ~40 px)";
const tooSmall = (n: number) => `${n} green disc${n > 1 ? "s" : ""} found but too small (under ~40 px across): use a photo where the pins are bigger`;

/** Finds the green pins (reading order: rows top to bottom, left to right inside a row). */
export async function detectPins(photo: Buffer, minArea?: number): Promise<{ width: number; height: number; pins: Pin[]; small: number }> {
  checkImage(photo, "the photo");
  return withPage((page) => page.evaluate(([p, m]) => window.__pinPhoto.detect(p as string, m as number | undefined), [b64(photo), minArea] as const));
}

/** `detectPins` plus the automatic rim measurement per pin (`pin.rim`: points used and fit error; `null` when it failed). */
export async function measurePins(photo: Buffer, minArea?: number): Promise<{ width: number; height: number; pins: (Pin & { rim: { grow: number; shift: [number, number]; n: number; rmse: number } | null })[] }> {
  checkImage(photo, "the photo");
  return withPage((page) => page.evaluate(([p, m]) => window.__pinPhoto.measure(p as string, m as number | undefined), [b64(photo), minArea] as const)) as never;
}

/**
 * Replaces every detected pin. `faces` are images of any size (cropped to a centred square): pin i gets `faces[i % faces.length]`,
 * so one face = the same design on every pin.
 */
export async function replacePins(photo: Buffer, faces: Buffer[], opts: PinPhotoOpts = {}): Promise<PinPhotoResult> {
  if (!faces.length) throw new Error("need at least one face image");
  checkImage(photo, "the photo");
  faces.forEach((f, i) => checkImage(f, `face ${i + 1}`));
  const res = await withPage((page) =>
    page.evaluate(([p, f, o]) => window.__pinPhoto.run(p as string, f as string[], o as PinPhotoOpts), [b64(photo), faces.map(b64), { grow: "auto", ...opts }] as const),
  );
  if (!res.png || !res.pins.length) {
    throw new Error(res.small ? tooSmall(res.small) : NO_PINS);
  }
  return { width: res.width, height: res.height, pins: res.pins, png: Buffer.from(res.png, "base64") };
}
