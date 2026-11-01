import type { Carousel } from "../../../core/schema";

export type SnapLines = { x: number[]; y: number[] };
export const NO_SNAP: SnapLines = { x: [], y: [] };

/** Where things can stick: guides, slide edges, slide center. */
export function snapTargets(guides: Carousel["guides"], W: number, H: number): SnapLines {
  const uniq = (a: number[]) => [...new Set(a)];
  return { x: uniq([0, W / 2, W, ...guides.x]), y: uniq([0, H / 2, H, ...guides.y]) };
}

/** Smallest correction (target - anchor) over all pairs closer than `tol`, or null when nothing is near. */
export function bestSnap(anchors: number[], targets: number[], tol: number): number | null {
  let best: number | null = null;
  for (const a of anchors)
    for (const t of targets) {
      const d = t - a;
      if (Math.abs(d) <= tol && (best === null || Math.abs(d) < Math.abs(best))) best = d;
    }
  return best;
}

/** Targets that line up with some anchor once `delta` is applied (for drawing the snap lines). */
export function alignedTargets(anchors: number[], targets: number[], delta: number): number[] {
  return targets.filter((t) => anchors.some((a) => Math.abs(a + delta - t) < 0.75));
}
