import { createHash } from "node:crypto";
import { renderPng } from "./headless.ts";
import { detectPins, replacePins, type Pin, type PinPhotoOpts } from "./pinPhoto.ts";
import { readAsset, saveAsset, loadProject } from "./projects.ts";

/** Glue between a project (photo in assets, slides as pin faces) and the pixel engine in `pinPhoto.ts`. */

export type PinsDetected = { width: number; height: number; pins: Pin[]; small: number };
export type PinsReplaced = { file: string; width: number; height: number; pins: Pin[] };

/** Green pins of a photo in the project's assets. */
export async function detectProjectPins(project: string, photo: string): Promise<PinsDetected> {
  return detectPins(await readAsset(project, photo));
}

/**
 * Replaces the green pins of `photo` with the given slides (pin i gets `slides[i % slides.length]`), saves
 * `assets/pinphoto-<hash>.png` (same input = same file, served from assets without rendering) and returns its name.
 */
export async function replaceProjectPins(
  project: string,
  photo: string,
  slides: number[],
  opts: Pick<PinPhotoOpts, "grow" | "shift" | "light" | "seed" | "pins"> = {},
): Promise<PinsReplaced> {
  if (!slides.length) throw new Error("pick at least one slide to use as the pin design");
  const c = await loadProject(project);
  for (const s of slides) if (s < 0 || s >= c.slides.length) throw new Error(`slide ${s + 1} does not exist (project has ${c.slides.length})`);
  const photoBuf = await readAsset(project, photo);
  const faces = await renderPng(c, slides, project, 1);
  const hash = createHash("sha256").update(photoBuf).update(JSON.stringify(opts)).update(Buffer.concat(faces)).digest("hex").slice(0, 10);
  const r = await replacePins(photoBuf, faces, opts);
  const file = `pinphoto-${hash}.png`;
  await saveAsset(project, file, r.png);
  return { file, width: r.width, height: r.height, pins: r.pins };
}
