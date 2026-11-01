import type { Dispatch, SetStateAction } from "react";
import type { Carousel } from "../../../core/schema";
import type { Editor } from "@/editor/useEditor";
import { extentOf, type Rect } from "@/editor/canvas/geometry";
import { NO_SNAP, alignedTargets, bestSnap, snapTargets, type SnapLines } from "@/editor/canvas/snap";

const SNAP_PX = 6; // snap distance in screen px, so it feels the same at every zoom level

type Ctx = {
  ed: Editor;
  doc: Carousel;
  cur: number;
  rects: Rect[];
  scale: number;
  snap: boolean;
  width: number;
  height: number;
  setSel: (i: number | null) => void;
  setSnapLines: Dispatch<SetStateAction<SnapLines>>;
};

/** Drag an element (move) or its corner grip (resize); snaps to guides, slide edges and center. One undo step per drag. */
export function startElementDrag(ctx: Ctx, e: React.PointerEvent, i: number, mode: "move" | "resize") {
  const { ed, doc, cur, rects, scale, snap, width, height, setSel, setSnapLines } = ctx;
  const slide = doc.slides[cur];
    e.stopPropagation();
    e.preventDefault();
    setSel(i);
    const el = slide.elements[i];
    const r = rects[i];
    const start = { x: e.clientX, y: e.clientY, ex: el.x, ey: el.y, w: r.w, h: r.h };
    const rad = (el.rotate * Math.PI) / 180;
    const ext0 = extentOf(el.rotate, r);
    const targets = snapTargets(doc.guides, width, height);
    let moved = false;

    const onMove = (m: PointerEvent) => {
      const dx = (m.clientX - start.x) / scale;
      const dy = (m.clientY - start.y) / scale;
      if (!moved) {
        if (Math.abs(dx) + Math.abs(dy) < 2 / scale) return;
        moved = true;
        ed.checkpoint();
      }
      // snapping: Cmd/Ctrl held = free movement
      const tol = SNAP_PX / scale;
      const on = snap && !m.metaKey && !m.ctrlKey;
      let sx = 0, sy = 0; // corrections added to the raw movement
      const lines: SnapLines = { x: [], y: [] };

      if (on && mode === "move") {
        // left / center / right and top / middle / bottom of the (rotated) element's bounding box
        const ax = [ext0.x0 + dx, (ext0.x0 + ext0.x1) / 2 + dx, ext0.x1 + dx];
        const ay = [ext0.y0 + dy, (ext0.y0 + ext0.y1) / 2 + dy, ext0.y1 + dy];
        sx = bestSnap(ax, targets.x, tol) ?? 0;
        sy = bestSnap(ay, targets.y, tol) ?? 0;
        lines.x = alignedTargets(ax, targets.x, sx);
        lines.y = alignedTargets(ay, targets.y, sy);
      } else if (on && mode === "resize" && el.rotate === 0) {
        // unrotated only: right edge, and bottom edge when the height is explicit (text height is automatic)
        const ar = [start.ex + start.w + dx];
        sx = bestSnap(ar, targets.x, tol) ?? 0;
        lines.x = alignedTargets(ar, targets.x, sx);
        if (el.type !== "text") {
          const ab = [start.ey + start.h + dy];
          sy = bestSnap(ab, targets.y, tol) ?? 0;
          lines.y = alignedTargets(ab, targets.y, sy);
        }
      }
      setSnapLines((prev) => (JSON.stringify(prev) === JSON.stringify(lines) ? prev : lines));

      ed.live((d) => {
        const t = d.slides[cur].elements[i];
        if (mode === "move") {
          t.x = Math.round(start.ex + dx + sx);
          t.y = Math.round(start.ey + dy + sy);
        } else {
          // project screen delta onto the element's rotated axes
          const lx = (dx + sx) * Math.cos(rad) + (dy + sy) * Math.sin(rad);
          const ly = -(dx + sx) * Math.sin(rad) + (dy + sy) * Math.cos(rad);
          t.w = Math.max(10, Math.round(start.w + lx));
          if (t.type !== "text") t.h = Math.max(10, Math.round(start.h + ly));
        }
      });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setSnapLines(NO_SNAP);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }
