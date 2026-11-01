import { useEffect, useState } from "react";

export const RULER = 22; // px thickness

export type Origin = { x: number; y: number };
export type Extent = { x0: number; x1: number; y0: number; y1: number };

/** Smallest "nice" step (1/2/5 x 10^k, in slide px) that keeps labelled ticks at least `minPx` apart on screen. */
function majorStep(scale: number, minPx = 64): number {
  const raw = minPx / scale;
  const pow = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 5, 10]) if (m * pow * scale >= minPx) return m * pow;
  return 10 * pow;
}

type AxisProps = {
  axis: "x" | "y";
  length: number; // visible px along the axis
  origin: number; // screen px (relative to the viewport edge) of slide coordinate 0
  scale: number;
  size: number; // slide size along this axis, px
  cursor: number | null; // screen px along the axis
  extent: [number, number] | null; // selected element, slide px
};

function Axis({ axis, length, origin, scale, size, cursor, extent }: AxisProps) {
  const major = majorStep(scale);
  const mant = Math.round(major / 10 ** Math.floor(Math.log10(major)));
  const minor = major / (mant === 2 ? 4 : 5);
  const lo = Math.floor((0 - origin) / scale / minor);
  const hi = Math.ceil((length - origin) / scale / minor);
  const horizontal = axis === "x";
  const at = (u: number) => Math.round(origin + u * scale) + 0.5; // +0.5 = crisp 1px lines

  const ticks: React.ReactNode[] = [];
  for (let k = lo; k <= hi && ticks.length < 600; k++) {
    const u = k * minor;
    const p = at(u);
    const isMajor = Math.abs(u % major) < 1e-6;
    ticks.push(
      <g key={k}>
        {horizontal ? (
          <line x1={p} x2={p} y1={isMajor ? 8 : RULER - 6} y2={RULER} />
        ) : (
          <line y1={p} y2={p} x1={isMajor ? 8 : RULER - 6} x2={RULER} />
        )}
        {isMajor &&
          (horizontal ? (
            <text x={p + 3} y={11} stroke="none">{Math.round(u)}</text>
          ) : (
            <text transform={`translate(11 ${p - 3}) rotate(-90)`} stroke="none">{Math.round(u)}</text>
          ))}
      </g>,
    );
  }

  const band = (a: number, b: number, opacity: number, key: string) => {
    const p0 = at(a), p1 = at(b);
    return horizontal
      ? <rect key={key} x={p0} y={0} width={Math.max(1, p1 - p0)} height={RULER} fill="var(--brand)" fillOpacity={opacity} stroke="none" />
      : <rect key={key} x={0} y={p0} width={RULER} height={Math.max(1, p1 - p0)} fill="var(--brand)" fillOpacity={opacity} stroke="none" />;
  };

  const w = horizontal ? length : RULER;
  const h = horizontal ? RULER : length;
  return (
    <svg width={w} height={h} className="text-muted-foreground block" fontSize={9} fill="currentColor" stroke="currentColor" strokeOpacity={0.55} shapeRendering="crispEdges">
      {band(0, size, 0.08, "slide")}
      {extent && band(extent[0], extent[1], 0.3, "sel")}
      {ticks}
      {cursor !== null && (
        <g stroke="var(--brand)" strokeOpacity={1}>
          {horizontal ? <line x1={cursor} x2={cursor} y1={0} y2={RULER} /> : <line y1={cursor} y2={cursor} x1={0} x2={RULER} />}
        </g>
      )}
    </svg>
  );
}

/** Top and left rulers in slide pixels. Pointer-down on one starts a guide (handled by the canvas). */
export function Rulers({ wrap, origin, scale, view, slideW, slideH, extent, onStartGuide }: {
  wrap: React.RefObject<HTMLDivElement | null>;
  origin: Origin;
  scale: number;
  view: { w: number; h: number };
  slideW: number;
  slideH: number;
  extent: Extent | null;
  onStartGuide: (axis: "x" | "y", e: React.PointerEvent) => void;
}) {
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  // mouse position over the canvas viewport, as ruler indicator lines (rAF-throttled)
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    let raf = 0;
    let next: { x: number; y: number } | null = null;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      next = { x: e.clientX - r.left, y: e.clientY - r.top };
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; setCursor(next); });
    };
    const leave = () => { next = null; setCursor(null); };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, [wrap]);

  return (
    <>
      <div className="bg-card absolute top-0 left-0 z-20 border-r border-b" style={{ width: RULER, height: RULER }} />
      <div
        data-ruler="top"
        title="Tarik ke bawah untuk membuat guide horizontal"
        className="bg-card absolute top-0 right-0 z-20 cursor-row-resize overflow-hidden border-b select-none"
        style={{ left: RULER, height: RULER }}
        onPointerDown={(e) => onStartGuide("y", e)}
      >
        <Axis axis="x" length={view.w} origin={origin.x} scale={scale} size={slideW} cursor={cursor?.x ?? null} extent={extent ? [extent.x0, extent.x1] : null} />
      </div>
      <div
        data-ruler="left"
        title="Tarik ke kanan untuk membuat guide vertikal"
        className="bg-card absolute bottom-0 left-0 z-20 cursor-col-resize overflow-hidden border-r select-none"
        style={{ top: RULER, width: RULER }}
        onPointerDown={(e) => onStartGuide("x", e)}
      >
        <Axis axis="y" length={view.h} origin={origin.y} scale={scale} size={slideH} cursor={cursor?.y ?? null} extent={extent ? [extent.y0, extent.y1] : null} />
      </div>
    </>
  );
}
