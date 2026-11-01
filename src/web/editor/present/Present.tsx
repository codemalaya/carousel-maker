import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize, Minimize, MousePointer2, StickyNote, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";
import { FORMATS, type Carousel } from "../../../core/schema";
import { maxStep } from "../../../core/render";
import { SlideView } from "@/shared/SlideView";

const HIDE_MS = 2500; // controls and cursor fade out after this much mouse idle
const SWIPE = 60; // px

const IN = `@keyframes cm-present-in{from{opacity:0;translate:var(--dir,1) 0}}`;

const clock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * Presentation mode: browser fullscreen, slide fills the screen, controls hide when idle.
 * Keys: arrows/space/Enter/PageUp/PageDown, Home/End, B blackout, N speaker notes, L laser, T reset timer, F fullscreen.
 * Stepped elements (`step`) are revealed one at a time before the next slide, same as Preview and the HTML export.
 */
export function Present({ doc, project, start, onClose }: {
  doc: Carousel;
  project: string;
  start: number;
  onClose: (index: number) => void;
}) {
  const n = doc.slides.length;
  const { width: W, height: H } = FORMATS[doc.format];
  const [rawIndex, setIndex] = useState(start);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const index = Math.min(rawIndex, n - 1); // the file can change underneath us (agent edits)
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [idle, setIdle] = useState(false);
  const [black, setBlack] = useState(false);
  const [notes, setNotes] = useState(false);
  const [laser, setLaser] = useState(false);
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null);
  const [full, setFull] = useState(!!document.fullscreenElement);
  const [t0, setT0] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const idleTimer = useRef<number | undefined>(undefined);
  const down = useRef<{ x: number; y: number } | null>(null);
  const entered = useRef(false); // closing because fullscreen ended must not fire before it began

  const onCloseRef = useRef(onClose);
  const indexRef = useRef(index);
  useEffect(() => {
    onCloseRef.current = onClose;
    indexRef.current = index;
  });

  const steps = doc.slides.map(maxStep);
  const curMax = steps[index] ?? 0;
  const curStep = Math.min(step, curMax);
  const slide = doc.slides[index];

  const go = useCallback((i: number, atEnd = false) => {
    const to = Math.max(0, Math.min(n - 1, i));
    setDir(to < index ? -1 : 1);
    setIndex(to);
    setStep(atEnd ? steps[to] ?? 0 : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, index, doc]);
  const next = () => (curStep < curMax ? setStep(curStep + 1) : go(index + 1));
  const prev = () => (curStep > 0 ? setStep(curStep - 1) : go(index - 1, true));

  const toggleFull = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => {}); // refused: stay windowed
  }, []);

  useEffect(() => {
    // started from a click or key, so the browser allows this
    void document.documentElement.requestFullscreen?.().catch(() => {});
    const onFs = () => {
      const on = !!document.fullscreenElement;
      setFull(on);
      if (on) entered.current = true;
      else if (entered.current) onCloseRef.current(indexRef.current); // Esc in fullscreen is eaten by the browser: leaving fullscreen = leaving the mode
    };
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    document.addEventListener("fullscreenchange", onFs);
    window.addEventListener("resize", onResize);
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      window.removeEventListener("resize", onResize);
      window.clearInterval(tick);
      window.clearTimeout(idleTimer.current);
      entered.current = false;
      if (document.fullscreenElement) void document.exitFullscreen();
    };
  }, []);

  const wake = () => {
    setIdle(false);
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setIdle(true), HIDE_MS);
  };
  useEffect(wake, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (k === "ArrowRight" || k === "ArrowDown" || k === "PageDown" || k === " " || k === "Enter") next();
    else if (k === "ArrowLeft" || k === "ArrowUp" || k === "PageUp" || k === "Backspace") prev();
    else if (k === "Home") go(0);
    else if (k === "End") go(n - 1);
    else if (k === "b" || k === "B" || k === ".") setBlack((b) => !b);
    else if (k === "n" || k === "N") setNotes((v) => !v);
    else if (k === "l" || k === "L") setLaser((v) => !v);
    else if (k === "t" || k === "T") setT0(Date.now());
    else if (k === "f" || k === "F") toggleFull();
    else return;
    e.preventDefault();
    wake();
  };

  const onPointerDown = (e: React.PointerEvent) => {
    down.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = down.current;
    down.current = null;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > SWIPE && Math.abs(dx) > Math.abs(e.clientY - d.y)) dx < 0 ? next() : prev();
    else if (Math.abs(dx) < 10 && Math.abs(e.clientY - d.y) < 10) e.clientX < vp.w * 0.3 ? prev() : next();
  };
  const onPointerMove = (e: React.PointerEvent) => {
    wake();
    if (laser) setMouse({ x: e.clientX, y: e.clientY });
  };

  // notes panel takes the bottom of the screen, so the slide shrinks instead of being covered
  const notesH = notes ? Math.min(220, vp.h * 0.28) : 0;
  const scale = Math.max(0.05, Math.min(vp.w / W, (vp.h - notesH) / H));
  const swipeIn = (slide?.transition ?? "slide") === "slide"; // fade/zoom animate inside SlideView
  const hidden = idle && !notes;
  const btn = "grid size-9 place-items-center rounded-full text-white/80 transition hover:bg-white/15 hover:text-white focus-visible:ring-2 focus-visible:ring-white/70 outline-none disabled:pointer-events-none disabled:opacity-25";
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose(index)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerMove={onPointerMove}
          onOpenAutoFocus={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).focus(); }}
          tabIndex={-1}
          className={cn("fixed inset-0 z-50 touch-pan-y overflow-hidden bg-black text-white outline-none select-none", (idle || laser) && "cursor-none")}
        >
          <DialogPrimitive.Title className="sr-only">Mode presentasi</DialogPrimitive.Title>
          <style>{IN}</style>

          <div className="absolute inset-x-0 top-0 grid place-items-center" style={{ height: vp.h - notesH }}>
            <div
              key={`${index}`}
              style={swipeIn && index !== start ? { animation: "cm-present-in 320ms cubic-bezier(.22,.8,.3,1) both", ["--dir" as string]: `${dir * 6}%` } : undefined}
            >
              {slide && <SlideView doc={doc} project={project} index={index} scale={scale} animate active step={curStep} />}
            </div>
          </div>

          {notes && (
            <div className="absolute inset-x-0 bottom-0 flex gap-4 border-t border-white/10 bg-neutral-950 p-4" style={{ height: notesH }} onPointerDown={stop} onPointerUp={stop}>
              <div className="min-w-0 flex-1 overflow-y-auto text-base leading-relaxed whitespace-pre-wrap text-white/90">
                {slide?.notes?.trim() || <span className="text-white/40">Tidak ada catatan untuk slide ini.</span>}
              </div>
              {doc.slides[index + 1] && (
                <div className="shrink-0 text-right">
                  <div className="mb-1 text-[10px] tracking-wider text-white/40 uppercase">Berikutnya</div>
                  <div className="overflow-hidden rounded ring-1 ring-white/15">
                    <SlideView doc={doc} project={project} index={index + 1} scale={Math.min((notesH - 44) / H, 220 / W)} />
                  </div>
                </div>
              )}
            </div>
          )}

          {laser && mouse && <span className="pointer-events-none fixed size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500 shadow-[0_0_14px_6px_rgba(239,68,68,.55)]" style={{ left: mouse.x, top: mouse.y }} />}

          {black && <div className="absolute inset-0 z-10 bg-black" />}

          <div
            className={cn("absolute inset-x-0 z-20 flex items-center gap-1 bg-gradient-to-t from-black/70 to-transparent px-4 pt-8 pb-3 transition-opacity", hidden ? "pointer-events-none opacity-0" : "opacity-100")}
            style={{ bottom: notesH }}
            onPointerDown={stop}
            onPointerUp={stop}
          >
            <button type="button" className={btn} aria-label="Sebelumnya" disabled={index === 0 && curStep === 0} onClick={prev}><ChevronLeft className="size-5" /></button>
            <button type="button" className={btn} aria-label="Berikutnya" disabled={index === n - 1 && curStep >= curMax} onClick={next}><ChevronRight className="size-5" /></button>
            <span className="mx-2 text-sm text-white/80 tabular-nums">
              {index + 1}/{n}
              {curMax > 0 && <span className="ml-2 text-white/50">langkah {curStep}/{curMax}</span>}
            </span>
            <button type="button" className="rounded-full px-2 py-1 text-sm text-white/60 tabular-nums hover:bg-white/15 hover:text-white" title="Klik untuk mengulang timer (T)" onClick={() => setT0(Date.now())}>
              {clock(now - t0)}
            </button>
            <span className="flex-1" />
            <button type="button" className={cn(btn, notes && "bg-white/20 text-white")} aria-label="Catatan pembicara (N)" aria-pressed={notes} title="Catatan pembicara (N)" onClick={() => setNotes((v) => !v)}><StickyNote className="size-4" /></button>
            <button type="button" className={cn(btn, laser && "bg-white/20 text-white")} aria-label="Laser (L)" aria-pressed={laser} title="Laser (L)" onClick={() => setLaser((v) => !v)}><MousePointer2 className="size-4" /></button>
            <button type="button" className={btn} aria-label={full ? "Keluar layar penuh (F)" : "Layar penuh (F)"} title="Layar penuh (F)" onClick={toggleFull}>{full ? <Minimize className="size-4" /> : <Maximize className="size-4" />}</button>
            <DialogPrimitive.Close className={btn} aria-label="Selesai presentasi" title="Selesai (Esc)"><X className="size-5" /></DialogPrimitive.Close>
          </div>

          <div className="absolute inset-x-0 top-0 z-20 h-0.5 bg-white/10">
            <div className="h-full bg-white/60 transition-[width]" style={{ width: `${((index + 1) / n) * 100}%` }} />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
