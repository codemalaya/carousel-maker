import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";
import { FORMATS, type Carousel } from "../../../core/schema";
import { maxStep } from "../../../core/render";
import { SlideView } from "@/shared/SlideView";
import { slideTitle } from "@/shared/slideTitle";

const GAP = 12; // between slides while dragging
const SIDE = 104; // room for the arrow buttons on each side
const VERTICAL = 168; // room for the top bar and dots

/** Full-screen swipe preview: how the carousel feels on a phone, without editor chrome. */
export function Preview({ doc, project, start, onClose }: {
  doc: Carousel;
  project: string;
  start: number;
  /** receives the slide that was showing, so the editor can open it */
  onClose: (index: number) => void;
}) {
  const n = doc.slides.length;
  const { width: W, height: H } = FORMATS[doc.format];
  const [rawIndex, setIndex] = useState(start);
  const [step, setStep] = useState(0); // reveals done on the current slide
  const index = Math.min(rawIndex, n - 1); // the file can change underneath us (agent edits)
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; t: number; dx: number } | null>(null);
  const lastWheel = useRef(0);

  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    // trackpad two-finger swipe must not trigger the browser's history navigation
    const root = document.documentElement;
    const prev = root.style.overscrollBehaviorX;
    root.style.overscrollBehaviorX = "none";
    return () => {
      window.removeEventListener("resize", onResize);
      root.style.overscrollBehaviorX = prev;
    };
  }, []);

  const scale = Math.max(0.05, Math.min((vp.w - 2 * SIDE) / W, (vp.h - VERTICAL) / H));
  const sw = W * scale;
  const sh = H * scale;
  const steps = doc.slides.map(maxStep);
  const curMax = steps[index] ?? 0;
  const curStep = Math.min(step, curMax);
  const go = (i: number, atEnd = false) => {
    const to = Math.max(0, Math.min(n - 1, i));
    setIndex(to);
    setStep(atEnd ? steps[to] : 0);
  };
  // forward/back reveal the slide's stepped elements one at a time before changing slide
  const next = () => (curStep < curMax ? setStep(curStep + 1) : go(index + 1));
  const prev = () => (curStep > 0 ? setStep(curStep - 1) : go(index - 1, true));
  const hasNext = index < n - 1 || curStep < curMax;
  const hasPrev = index > 0 || curStep > 0;
  const instant = (doc.slides[index]?.transition ?? "slide") !== "slide"; // fade/zoom replace the swipe

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") next();
    else if (e.key === "ArrowLeft" || e.key === "PageUp") prev();
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(n - 1);
    else return;
    e.preventDefault();
  };

  const onPointerDown = (e: React.PointerEvent) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId); // keeps the drag alive outside the box; can throw for stale pointers
    } catch {
      /* dragging still works while the pointer stays over the box */
    }
    drag.current = { x: e.clientX, t: performance.now(), dx: 0 };
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    let delta = e.clientX - d.x;
    if ((index === 0 && delta > 0) || (index === n - 1 && delta < 0)) delta *= 0.3; // rubber band at the ends
    d.dx = delta;
    setDx(delta);
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    setDx(0);
    if (!d) return;
    const velocity = d.dx / Math.max(1, performance.now() - d.t); // px/ms, flicks count even when short
    const flick = Math.abs(d.dx) > 24 && Math.abs(velocity) > 0.5; // ignore click jitter
    if (d.dx < -sw * 0.2 || (flick && velocity < 0)) go(index + 1);
    else if (d.dx > sw * 0.2 || (flick && velocity > 0)) go(index - 1);
  };
  const onWheel = (e: React.WheelEvent) => {
    if (Math.abs(e.deltaX) < Math.abs(e.deltaY) || Math.abs(e.deltaX) < 20) return;
    const now = performance.now();
    if (now - lastWheel.current < 450) return; // one slide per swipe gesture
    lastWheel.current = now;
    go(index + (e.deltaX > 0 ? 1 : -1));
  };

  const arrow = "absolute top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:pointer-events-none disabled:opacity-25 focus-visible:ring-2 focus-visible:ring-white/70 outline-none";

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose(index)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/92 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onKeyDown={onKeyDown}
          onWheel={onWheel}
          onClick={(e) => e.target === e.currentTarget && onClose(index)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 outline-none"
        >
          <DialogPrimitive.Title className="sr-only">Preview carousel</DialogPrimitive.Title>

          <div className="absolute top-0 flex w-full items-center justify-between px-5 py-4 text-sm text-white/80">
            <span>
              <span className="font-medium text-white">{project}</span>
              <span className="mx-2 text-white/40">·</span>
              <span className="tabular-nums">Slide {index + 1}/{n}</span>
              {slideTitle(doc.slides[index], index).named && (
                <>
                  <span className="mx-2 text-white/40">·</span>
                  <span>{slideTitle(doc.slides[index], index).title}</span>
                </>
              )}
            </span>
            <DialogPrimitive.Close className="grid size-9 place-items-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/70 outline-none" aria-label="Tutup preview">
              <X className="size-5" />
            </DialogPrimitive.Close>
          </div>

          <div className="relative" style={{ width: sw, height: sh }}>
            {/* clip box: exactly one slide visible, like a post in a feed */}
            <div
              className="h-full w-full cursor-grab touch-pan-y overflow-hidden rounded-lg shadow-2xl ring-1 ring-white/10 select-none active:cursor-grabbing"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <div
                className="flex motion-reduce:transition-none"
                style={{
                  gap: GAP,
                  width: n * sw + (n - 1) * GAP,
                  transform: `translateX(${-index * (sw + GAP) + dx}px)`,
                  transition: dragging || instant ? "none" : "transform 320ms cubic-bezier(0.22, 0.8, 0.3, 1)",
                }}
              >
                {doc.slides.map((_, i) => (
                  <div key={i} className="shrink-0" aria-hidden={i !== index} style={{ width: sw, height: sh }}>
                    <SlideView doc={doc} project={project} index={i} scale={scale} animate active={i === index} step={i < index ? steps[i] : i === index ? curStep : 0} />
                  </div>
                ))}
              </div>
            </div>

            <button type="button" aria-label="Slide sebelumnya" disabled={!hasPrev} onClick={prev} className={arrow} style={{ left: -(SIDE - 16) }}>
              <ChevronLeft className="size-6" />
            </button>
            <button type="button" aria-label="Slide berikutnya" disabled={!hasNext} onClick={next} className={arrow} style={{ right: -(SIDE - 16) }}>
              <ChevronRight className="size-6" />
            </button>
          </div>

          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-1.5" role="tablist" aria-label="Slide">
              {doc.slides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`Ke slide ${i + 1}`}
                  onClick={() => go(i)}
                  className={cn("h-1.5 rounded-full transition-all outline-none focus-visible:ring-2 focus-visible:ring-white/70", i === index ? "w-5 bg-white" : "w-1.5 bg-white/35 hover:bg-white/60")}
                />
              ))}
            </div>
            <p className="text-xs text-white/40">{curMax > 0 ? `Langkah ${curStep}/${curMax} · ` : ""}← → atau swipe · Esc untuk keluar</p>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
