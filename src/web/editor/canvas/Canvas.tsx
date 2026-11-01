import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { FORMATS } from "../../../core/schema";
import type { Editor } from "@/editor/useEditor";
import { SlideView } from "@/shared/SlideView";
import { GuidesLayer, SnapLayer, type GuideDrag } from "@/editor/canvas/GuidesLayer";
import { RULER, Rulers, type Extent, type Origin } from "@/editor/canvas/Rulers";
import { extentOf, type Rect } from "@/editor/canvas/geometry";
import { startElementDrag } from "@/editor/canvas/dragElement";
import { startGuideDrag } from "@/editor/canvas/guideDrag";
import { useInlineEdit } from "@/editor/canvas/useInlineEdit";
import { NO_SNAP, type SnapLines } from "@/editor/canvas/snap";
import { ZoomControl } from "@/editor/canvas/ZoomControl";


const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
const STEPS = [0.1, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4];
const PAD_X = 24;
const PAD_TOP = 24;
const PAD_BOTTOM = 88; // room for the floating toolbar so a zoomed slide can scroll clear of it
const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

export function Canvas({ ed, project, cur, sel, setSel }: {
  ed: Editor;
  project: string;
  cur: number;
  sel: number | null;
  setSel: (i: number | null) => void;
}) {
  const doc = ed.doc!;
  const slide = doc.slides[cur];
  const { width, height } = FORMATS[doc.format];

  const wrap = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const canvasEl = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(0.5);
  const [zoom, setZoom] = useState<number | null>(null); // null = fit
  const [space, setSpace] = useState(false); // Space held: drag to pan
  const [rects, setRects] = useState<Rect[]>([]);
  const scale = zoom ?? fitScale;
  const anchor = useRef<{ sx: number; sy: number; cx: number; cy: number } | null>(null);

  // view options (persisted): rulers and guide lines
  const [rulers, setRulers] = useState(() => localStorage.getItem("carousel-rulers") !== "0");
  const [showGuides, setShowGuides] = useState(() => localStorage.getItem("carousel-guides") !== "0");
  useEffect(() => localStorage.setItem("carousel-rulers", rulers ? "1" : "0"), [rulers]);
  useEffect(() => localStorage.setItem("carousel-guides", showGuides ? "1" : "0"), [showGuides]);
  const inset = rulers ? RULER : 0;
  const [view, setView] = useState({ w: 0, h: 0 }); // viewport size, for the rulers
  const [origin, setOrigin] = useState<Origin>({ x: 0, y: 0 }); // slide (0,0) in viewport px; moves with scroll and zoom
  const [guideDrag, setGuideDrag] = useState<GuideDrag | null>(null);
  const [snap, setSnap] = useState(() => localStorage.getItem("carousel-snap") !== "0");
  useEffect(() => localStorage.setItem("carousel-snap", snap ? "1" : "0"), [snap]);
  const [snapLines, setSnapLines] = useState<SnapLines>(NO_SNAP); // lines shown while dragging

  // fit canvas into the available area
  useLayoutEffect(() => {
    const fit = () => {
      const el = wrap.current;
      if (!el) return;
      setView((v) => (v.w === el.clientWidth && v.h === el.clientHeight ? v : { w: el.clientWidth, h: el.clientHeight }));
      setFitScale(Math.max(0.05, Math.min((el.clientWidth - 2 * PAD_X) / width, (el.clientHeight - PAD_TOP - PAD_BOTTOM) / height)));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap.current!);
    return () => ro.disconnect();
  }, [width, height]);

  // a different slide starts at Fit
  useEffect(() => {
    setZoom(null);
    wrap.current?.scrollTo(0, 0);
  }, [cur]);

  /** Zoom to `next` (null = fit), keeping the slide point under (cx, cy) fixed on screen. */
  const zoomTo = useCallback(
    (next: number | null, at?: { cx: number; cy: number }) => {
      if (next === null) return setZoom(null);
      const z = clampZoom(next);
      if (Math.abs(z - scale) < 1e-4) return;
      const c = canvasEl.current!.getBoundingClientRect();
      const w = wrap.current!.getBoundingClientRect();
      const cx = at?.cx ?? w.left + w.width / 2;
      const cy = at?.cy ?? w.top + (w.height - PAD_BOTTOM + PAD_TOP) / 2;
      anchor.current = { sx: (cx - c.left) / scale, sy: (cy - c.top) / scale, cx, cy };
      setZoom(z);
    },
    [scale],
  );
  const step = useCallback(
    (dir: 1 | -1) => {
      const eps = 1e-3;
      const next = dir > 0 ? STEPS.find((z) => z > scale + eps) : [...STEPS].reverse().find((z) => z < scale - eps);
      if (next) zoomTo(next);
    },
    [scale, zoomTo],
  );

  // after the new scale is laid out, scroll so the anchored point is back under the cursor
  useLayoutEffect(() => {
    const a = anchor.current;
    anchor.current = null;
    if (!a || !wrap.current || !canvasEl.current) return;
    const c = canvasEl.current.getBoundingClientRect();
    wrap.current.scrollLeft += c.left + a.sx * scale - a.cx;
    wrap.current.scrollTop += c.top + a.sy * scale - a.cy;
  }, [scale]);

  // where is slide (0,0) inside the viewport? rulers and guides are drawn from this
  const syncOrigin = useCallback(() => {
    const w = wrap.current, c = canvasEl.current;
    if (!w || !c) return;
    const wr = w.getBoundingClientRect(), cr = c.getBoundingClientRect();
    const x = cr.left - wr.left, y = cr.top - wr.top;
    setOrigin((o) => (Math.abs(o.x - x) < 0.01 && Math.abs(o.y - y) < 0.01 ? o : { x, y }));
  }, []);
  useLayoutEffect(syncOrigin, [syncOrigin, scale, width, height, cur, view.w, view.h, inset]);
  useEffect(() => {
    const el = wrap.current!;
    let raf = 0;
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; syncOrigin(); });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("scroll", onScroll);
    };
  }, [syncOrigin]);

  // ctrl/cmd + wheel (also trackpad pinch) zooms at the cursor; must be non-passive to cancel browser zoom
  useEffect(() => {
    const el = wrap.current!;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoomTo(scale * Math.exp(-e.deltaY * 0.003), { cx: e.clientX, cy: e.clientY });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [scale, zoomTo]);

  // shortcuts: mod +/-/0/1, hold Space to pan
  useEffect(() => {
    const typing = (t: HTMLElement) => /INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('[role="dialog"],[role="alertdialog"]')) return;
      if (e.metaKey || e.ctrlKey) {
        if (e.key === "=" || e.key === "+") { e.preventDefault(); step(1); }
        else if (e.key === "-" || e.key === "_") { e.preventDefault(); step(-1); }
        else if (e.key === "0") { e.preventDefault(); zoomTo(null); }
        else if (e.key === "1") { e.preventDefault(); zoomTo(1); }
      } else if (e.shiftKey && !e.altKey && e.key.toLowerCase() === "r" && !typing(t)) {
        e.preventDefault();
        setRulers((v) => !v);
      } else if ((e.key === "Enter" || e.key === "F2") && !e.shiftKey && !e.altKey && !typing(t) && selRef.current != null && !t.closest('button,[role="button"],[role="menuitem"],a')) {
        e.preventDefault();
        startEditRef.current(selRef.current);
      } else if (e.code === "Space" && !typing(t) && !t.closest('button,[role="button"],[role="slider"],[role="radio"],[role="menuitem"]')) {
        e.preventDefault();
        setSpace(true);
      }
    };
    const onUp = (e: KeyboardEvent) => e.code === "Space" && setSpace(false);
    const onBlur = () => setSpace(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [step, zoomTo]);

  // Space+drag or middle mouse drag pans. Capture phase so elements underneath don't start a drag/selection.
  const onPanStart = (e: React.PointerEvent) => {
    if (edit.current && !edit.current.node.contains(e.target as Node)) stopEdit(true);
    if (!space && e.button !== 1) return;
    e.preventDefault();
    e.stopPropagation();
    const el = wrap.current!;
    const start = { x: e.clientX, y: e.clientY, l: el.scrollLeft, t: el.scrollTop };
    const move = (m: PointerEvent) => {
      el.scrollLeft = start.l - (m.clientX - start.x);
      el.scrollTop = start.t - (m.clientY - start.y);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // overlay boxes come from real DOM geometry (handles auto-height text, rotation-safe via offset*)
  const measure = useCallback(() => {
    const kids = stage.current?.querySelector(".slide")?.children;
    if (!kids) return setRects([]);
    setRects(
      Array.from(kids).map((k) => {
        const e = k as HTMLElement;
        return { l: e.offsetLeft, t: e.offsetTop, w: e.offsetWidth, h: e.offsetHeight };
      }),
    );
  }, []);
  useLayoutEffect(measure, [measure, slide, doc.tokens, doc.format, cur]);
  useEffect(() => {
    const s = stage.current;
    s?.addEventListener("load", measure, true); // images
    document.fonts.ready.then(measure);
    return () => s?.removeEventListener("load", measure, true);
  }, [measure, cur]);


  const { editing, edit, stopEdit, startEdit, startEditRef, selRef } = useInlineEdit({ ed, stage, slide, cur, sel, setSel, measure });

  /** selected element, for the ruler highlight */
  const extent: Extent | null = sel != null && slide.elements[sel] && rects[sel] ? extentOf(slide.elements[sel].rotate, rects[sel]) : null;

  const startGuide = (axis: "x" | "y", index: number | undefined, e: React.PointerEvent) =>
    startGuideDrag({ ed, doc, scale, canvasEl, wrap, setShowGuides, setGuideDrag }, axis, index, e);
  const removeGuide = (axis: "x" | "y", index: number) => ed.mutate((d) => { d.guides[axis].splice(index, 1); });

  const startDrag = (e: React.PointerEvent, i: number, mode: "move" | "resize") =>
    startElementDrag({ ed, doc, cur, rects, scale, snap, width, height, setSel, setSnapLines }, e, i, mode);

  const handle = 18 / scale;

  const guideCount = doc.guides.x.length + doc.guides.y.length;

  return (
    <div className="relative min-h-0 min-w-0 flex-1">
      {rulers && view.w > 0 && (
        <Rulers
          wrap={wrap}
          origin={origin}
          scale={scale}
          view={view}
          slideW={width}
          slideH={height}
          extent={extent}
          onStartGuide={(axis, e) => startGuide(axis, undefined, e)}
        />
      )}
      <div
        ref={wrap}
        className={"canvas-wrap no-scrollbar" + (space ? " pan" : "")}
        style={{ inset: `${inset}px 0 0 ${inset}px` }}
        onPointerDownCapture={onPanStart}
        onPointerDown={() => setSel(null)}
      >
        <div className="canvas-inner">
          <div ref={canvasEl} className="canvas" onPointerDown={(e) => e.stopPropagation()}>
            <SlideView doc={doc} project={project} index={cur} scale={scale} stageRef={stage}>
              <div
                className="overlay"
                style={{ "--ow": `${2 / scale}px`, pointerEvents: editing != null ? "none" : undefined } as React.CSSProperties}
                onPointerDown={() => setSel(null)}
              >
                {slide.elements.map((el, i) => {
                  const r = rects[i];
                  if (!r) return null;
                  const on = sel === i;
                  return (
                    <div
                      key={i}
                      className={"box" + (on ? " on" : "")}
                      style={{
                        left: r.l, top: r.t, width: r.w, height: r.h, zIndex: el.z,
                        transform: el.rotate ? `rotate(${el.rotate}deg)` : undefined,
                        // while typing, clicks must reach the text; every other box stays grabbable (and ends the edit)
                        pointerEvents: editing === i ? "none" : "auto",
                      }}
                      onPointerDown={(e) => startDrag(e, i, "move")}
                      onDoubleClick={() => startEdit(i)}
                    >
                      {on && (
                        <div
                          className="grip"
                          style={{ width: handle, height: handle, right: -handle / 2, bottom: -handle / 2 }}
                          onPointerDown={(e) => startDrag(e, i, "resize")}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </SlideView>
          </div>
        </div>
      </div>
      <SnapLayer lines={snapLines} origin={origin} scale={scale} inset={inset} />
      {showGuides && (
        <GuidesLayer
          guides={doc.guides}
          drag={guideDrag}
          origin={origin}
          scale={scale}
          inset={inset}
          onGrab={(axis, index, e) => startGuide(axis, index, e)}
          onRemove={removeGuide}
        />
      )}
      <ZoomControl
        scale={scale}
        fit={zoom === null}
        onStep={step}
        onSet={(z) => zoomTo(z)}
        rulers={rulers}
        onRulers={setRulers}
        guides={showGuides}
        onGuides={setShowGuides}
        guideCount={guideCount}
        onClearGuides={() => ed.mutate((d) => { d.guides = { x: [], y: [] }; })}
        snap={snap}
        onSnap={setSnap}
      />
    </div>
  );
}

