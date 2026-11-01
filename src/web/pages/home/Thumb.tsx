import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { FORMATS, type Carousel } from "../../../core/schema";
import { SlideView } from "@/shared/SlideView";
import { useLazyDoc } from "@/shared/useLazyDoc";
import { FRESH_MS } from "@/pages/home/homeData";

const GRID_FRAME = 4 / 5; // every grid card shows its slide inside this frame, so mixed formats keep rows even

/** Slide preview; moving the mouse across it scrubs through the slides. Grid cards letterbox into a fixed frame; `compact` (list rows) uses the slide's own ratio. */
export function Thumb({ id, updated, format, compact, ai }: { id: string; updated: number; format: Carousel["format"]; compact?: boolean; ai?: boolean }) {
  const { box, doc, width } = useLazyDoc(`/api/projects/${encodeURIComponent(id)}`, updated);
  const [at, setAt] = useState(0);

  const fmt = FORMATS[format];
  const n = doc?.slides.length ?? 0;
  const index = Math.min(at, Math.max(0, n - 1));
  const scrub = (e: React.PointerEvent<HTMLDivElement>) => {
    if (n < 2 || e.pointerType === "touch") return;
    const r = e.currentTarget.getBoundingClientRect();
    setAt(Math.min(n - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * n))));
  };
  return (
    <div
      ref={box}
      className="bg-canvas relative w-full overflow-hidden"
      style={{ aspectRatio: compact ? `${fmt.width} / ${fmt.height}` : GRID_FRAME }}
      onPointerMove={scrub}
      onPointerLeave={() => setAt(0)}
    >
      {doc && n > 0 && width > 0 ? (
        <>
          <div className="absolute inset-0 grid place-items-center">
            <div className="ring-1 ring-black/10 dark:ring-white/15">
              <SlideView doc={doc} project={id} index={index} scale={Math.min(width / fmt.width, width / GRID_FRAME / fmt.height)} />
            </div>
          </div>
          {!compact && <>
          <span className="pointer-events-none absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white tabular-nums backdrop-blur transition-opacity group-hover:opacity-0 group-data-[selecting=true]:opacity-0">
            {format}
          </span>
          {ai ? (
            <span className="bg-brand pointer-events-none absolute top-2 right-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-white">
              <Loader2 className="size-3 animate-spin" /> AI bekerja
            </span>
          ) : Date.now() - updated < FRESH_MS && (
            <span className="pointer-events-none absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" /> baru diedit
            </span>
          )}
          {n > 1 && (
            <div className="pointer-events-none absolute inset-x-2 bottom-2 flex gap-0.5">
              {doc.slides.map((_, i) => (
                <span key={i} className={`h-0.5 flex-1 rounded-full ${i === index ? "bg-white" : "bg-white/35"}`} />
              ))}
            </div>
          )}
          </>}
        </>
      ) : doc ? (
        <div className="text-muted-foreground grid h-full place-items-center text-xs">Belum ada slide</div>
      ) : (
        <Skeleton className="size-full rounded-none" />
      )}
    </div>
  );
}
