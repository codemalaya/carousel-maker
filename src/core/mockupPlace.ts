import { Element } from "./schema.ts";

/**
 * Pin over a photo (bag, jacket, board...): the pin is rendered as a transparent PNG (no floor shadow) and placed as an
 * ordinary `image` element on top of the photo. Pure helpers shared by the editor dialog and scripts.
 *
 * The rendered PNG is a square canvas; the pin fills only part of it and, for tilted cameras, is not centred in it.
 * Measured on real 1600 px renders (shadow off, default fov, 32 mm): `fill` = width of the pin's bounding box / canvas,
 * `cx`/`cy` = centre of that box / canvas. The box includes the pin's rim, so for tilted views it is the visible silhouette.
 */
export const PIN_BOX: Record<string, { fill: number; cx: number; cy: number }> = {
  front: { fill: 0.734, cx: 0.5, cy: 0.5 },
  "top-down": { fill: 0.734, cx: 0.5, cy: 0.506 },
  back: { fill: 0.745, cx: 0.5, cy: 0.498 },
  "three-quarter": { fill: 0.672, cx: 0.53, cy: 0.496 },
  angled: { fill: 0.632, cx: 0.536, cy: 0.487 },
};

export type PlaceOpts = {
  /** slide size in px */
  W: number;
  H: number;
  /** pin centre as a fraction of the slide (0..1) */
  cx: number;
  cy: number;
  /** pin disc width as a fraction of the slide WIDTH */
  size: number;
  /** degrees */
  rotate?: number;
  /** 0.4..1: squash the disc along its own vertical axis (then rotated), for a surface seen at an angle. 1 = facing the camera */
  squash?: number;
  /** camera preset the PNG was rendered with */
  camera?: string;
  /** asset file name of the pin PNG */
  file: string;
  /** contact shadow strength 0..1 (0 = none) */
  shadow?: number;
};

/** Soft contact shadow for a flat pin: close, slightly below, low opacity. Scales with the pin so it looks the same at any size. */
export function pinShadow(discPx: number, strength = 0.35): string {
  if (strength <= 0) return "none";
  const y = Math.round(discPx * 0.025);
  const blur = Math.round(discPx * 0.04);
  return `drop-shadow(0 ${y}px ${blur}px rgba(0,0,0,${strength})) drop-shadow(0 ${Math.max(1, Math.round(discPx * 0.006))}px ${Math.max(1, Math.round(discPx * 0.01))}px rgba(0,0,0,${Math.min(0.6, strength * 1.2)}))`;
}

/** The `image` element that puts the pin PNG at the wanted place. */
export function placePin(o: PlaceOpts) {
  const m = PIN_BOX[o.camera ?? "front"] ?? PIN_BOX.front;
  const disc = o.size * o.W; // pin disc width in px
  const box = Math.round(disc / m.fill); // PNG canvas width in px
  const style: Record<string, string> = {};
  const f = pinShadow(disc, o.shadow ?? 0.35);
  if (f !== "none") style.filter = f;
  const squash = o.squash ?? 1;
  // style comes after the renderer's own `transform:rotate()`, so a combined transform here replaces it
  if (squash < 1) style.transform = `rotate(${o.rotate ?? 0}deg) scale(1,${squash})`;
  return Element.parse({
    type: "image",
    src: `assets/${o.file}`,
    // the pin's own centre (not the canvas centre) lands on (cx, cy)
    x: Math.round(o.cx * o.W - box * m.cx),
    y: Math.round(o.cy * o.H - box * m.cy),
    w: box,
    h: box,
    fit: "contain",
    rotate: squash < 1 ? 0 : (o.rotate ?? 0),
    style,
  });
}

/** Full-bleed photo element (cropped to the slide). */
export function photoElement(file: string, W: number, H: number) {
  return Element.parse({ type: "image", src: `assets/${file}`, x: 0, y: 0, w: W, h: H, fit: "cover" });
}
