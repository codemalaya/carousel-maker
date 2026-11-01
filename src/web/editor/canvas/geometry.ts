import type { Extent } from "@/editor/canvas/Rulers";

export type Rect = { l: number; t: number; w: number; h: number };

/** element box in slide px, rotation-aware (bounding box of the rotated rectangle) */
export const extentOf = (rotate: number, r: Rect): Extent => {
  const a = (rotate * Math.PI) / 180;
  const hw = (Math.abs(r.w * Math.cos(a)) + Math.abs(r.h * Math.sin(a))) / 2;
  const hh = (Math.abs(r.w * Math.sin(a)) + Math.abs(r.h * Math.cos(a))) / 2;
  const cx = r.l + r.w / 2, cy = r.t + r.h / 2;
  return { x0: cx - hw, x1: cx + hw, y0: cy - hh, y1: cy + hh };
};
