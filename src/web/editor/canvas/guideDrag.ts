import type { Dispatch, SetStateAction, RefObject } from "react";
import type { Carousel } from "../../../core/schema";
import type { Editor } from "@/editor/useEditor";
import type { GuideDrag } from "@/editor/canvas/GuidesLayer";

type Ctx = {
  ed: Editor;
  doc: Carousel;
  scale: number;
  canvasEl: RefObject<HTMLDivElement | null>;
  wrap: RefObject<HTMLDivElement | null>;
  setShowGuides: (v: boolean) => void;
  setGuideDrag: Dispatch<SetStateAction<GuideDrag | null>>;
};

/**
 * Create (index undefined) or move/remove a guide. The drag is local state; the document changes once on release,
 * so it is a single undo step and does not trigger a save per pointer move.
 * Dropping back on the ruler removes the guide.
 */
export function startGuideDrag(ctx: Ctx, axis: "x" | "y", index: number | undefined, e: React.PointerEvent) {
  const { ed, doc, scale, canvasEl, wrap, setShowGuides, setGuideDrag } = ctx;
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setShowGuides(true);
    const pos = (cx: number, cy: number) => {
      const c = canvasEl.current!.getBoundingClientRect();
      return Math.round(axis === "x" ? (cx - c.left) / scale : (cy - c.top) / scale);
    };
    const onRuler = (cx: number, cy: number) => {
      const w = wrap.current!.getBoundingClientRect();
      return axis === "x" ? cx < w.left : cy < w.top;
    };
    const before = index === undefined ? null : doc.guides[axis][index];
    let last = { value: before ?? pos(e.clientX, e.clientY), del: index === undefined };
    setGuideDrag({ axis, index, ...last });

    const onMove = (m: PointerEvent) => {
      last = { value: pos(m.clientX, m.clientY), del: onRuler(m.clientX, m.clientY) };
      setGuideDrag({ axis, index, ...last });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setGuideDrag(null);
      if (index === undefined) {
        if (last.del || doc.guides[axis].includes(last.value)) return; // dropped on the ruler, or already there
        ed.mutate((d) => { d.guides[axis] = [...d.guides[axis], last.value].sort((a, b) => a - b); });
      } else if (last.del) {
        ed.mutate((d) => { d.guides[axis].splice(index, 1); });
      } else if (last.value !== before) {
        ed.mutate((d) => { d.guides[axis][index] = last.value; d.guides[axis].sort((a, b) => a - b); });
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }
