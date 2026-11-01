import type { Carousel } from "../../../core/schema";
import type { Origin } from "@/editor/canvas/Rulers";
import type { SnapLines } from "@/editor/canvas/snap";

export type GuideDrag = { axis: "x" | "y"; value: number; index?: number; del: boolean };

/**
 * Guide lines across the whole viewport. Lives outside the scrolling area (so lines span past the slide),
 * ignores pointer events except on a thin hit strip around each line.
 */
export function GuidesLayer({ guides, drag, origin, scale, inset, onGrab, onRemove }: {
  guides: Carousel["guides"];
  drag: GuideDrag | null;
  origin: Origin;
  scale: number;
  inset: number; // ruler thickness: layer starts where the viewport starts
  onGrab: (axis: "x" | "y", index: number, e: React.PointerEvent) => void;
  onRemove: (axis: "x" | "y", index: number) => void;
}) {
  type Line = { axis: "x" | "y"; index: number; value: number; active: boolean; del: boolean };
  const lines: Line[] = [];
  for (const axis of ["x", "y"] as const) {
    guides[axis].forEach((value, index) => {
      const d = drag && drag.axis === axis && drag.index === index ? drag : null;
      lines.push({ axis, index, value: d ? d.value : value, active: !!d, del: !!d?.del });
    });
  }
  if (drag && drag.index === undefined) lines.push({ axis: drag.axis, index: -1, value: drag.value, active: true, del: drag.del });

  return (
    <div className="pointer-events-none absolute right-0 bottom-0 z-10 overflow-hidden" style={{ left: inset, top: inset }}>
      {lines.map((l) => {
        const vertical = l.axis === "x";
        const pos = (vertical ? origin.x : origin.y) + l.value * scale;
        return (
          <div
            key={`${l.axis}${l.index}`}
            className={"pointer-events-auto absolute flex items-center justify-center " + (vertical ? "top-0 bottom-0 cursor-col-resize" : "right-0 left-0 cursor-row-resize")}
            style={vertical ? { left: pos - 4, width: 9, opacity: l.del ? 0.25 : 1 } : { top: pos - 4, height: 9, opacity: l.del ? 0.25 : 1 }}
            data-guide={l.axis}
            onPointerDown={(e) => l.index >= 0 && onGrab(l.axis, l.index, e)}
            onDoubleClick={() => l.index >= 0 && onRemove(l.axis, l.index)}
            title="Tarik untuk memindah, tarik ke penggaris atau klik ganda untuk menghapus"
          >
            <div className={vertical ? "h-full w-px" : "h-px w-full"} style={{ background: "var(--guide)" }} />
            {l.active && !l.del && (
              <span className="absolute rounded px-1 text-[10px] leading-4 text-white tabular-nums" style={{ background: "var(--guide)", ...(vertical ? { top: 6, left: 8 } : { left: 6, top: 8 }) }}>
                {l.value}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Thin lines drawn while an element is snapped to a guide, slide edge or slide center. Visual only. */
export function SnapLayer({ lines, origin, scale, inset }: { lines: SnapLines; origin: Origin; scale: number; inset: number }) {
  if (!lines.x.length && !lines.y.length) return null;
  return (
    <div className="pointer-events-none absolute right-0 bottom-0 z-10 overflow-hidden" style={{ left: inset, top: inset }}>
      {lines.x.map((v) => (
        <div key={`x${v}`} data-snap="x" className="absolute top-0 bottom-0 w-px" style={{ left: Math.round(origin.x + v * scale), background: "var(--guide)" }} />
      ))}
      {lines.y.map((v) => (
        <div key={`y${v}`} data-snap="y" className="absolute right-0 left-0 h-px" style={{ top: Math.round(origin.y + v * scale), background: "var(--guide)" }} />
      ))}
    </div>
  );
}
