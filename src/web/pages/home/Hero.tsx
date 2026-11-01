import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FORMATS } from "../../../core/schema";
import type { ProjectInfo } from "@/shared/api";
import { ago } from "@/shared/format";
import { SlideView } from "@/shared/SlideView";
import { useLazyDoc } from "@/shared/useLazyDoc";
import { useRunning } from "@/editor/ai/agentRuns";
import { FRESH_MS, label, type OpenFn } from "@/pages/home/homeData";

const HERO_H = 220; // px height of the slides in the hero strip
const HERO_MAX = 12;

/** Big "continue where you left off" card: every slide of the project in a scrollable strip. */
export function Hero({ p, onOpen }: { p: ProjectInfo; onOpen: OpenFn }) {
  const ai = useRunning().has(p.id);
  const { box, doc, width } = useLazyDoc(`/api/projects/${encodeURIComponent(p.id)}`, p.updated);
  const scale = HERO_H / FORMATS[p.format].height;
  const fresh = Date.now() - p.updated < FRESH_MS;
  return (
    <section className="bg-card flex flex-col gap-4 overflow-hidden rounded-xl border p-5 sm:flex-row sm:items-center">
      <div className="flex shrink-0 flex-col gap-3 sm:w-56">
        <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Lanjutkan</span>
        <div>
          <h2 className="truncate text-lg font-semibold" title={p.id}>{label(p)}</h2>
          <p className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
            {ai ? <Loader2 className="text-brand size-3 animate-spin" /> : fresh && <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />}
            {p.slides} slide · {p.format} · {ai ? "AI bekerja…" : ago(p.updated)}
          </p>
        </div>
        <Button className="w-fit gap-1.5" onClick={() => onOpen(p.id)}>
          Buka editor <ArrowRight className="size-4" />
        </Button>
      </div>
      <div ref={box} className="no-scrollbar -mr-5 flex min-w-0 flex-1 gap-3 overflow-x-auto py-2 pr-5" style={{ minHeight: HERO_H + 16 }}>
        {doc && width > 0
          ? doc.slides.length === 0
            ? <p className="text-muted-foreground m-auto text-sm">Belum ada slide</p>
            : (
              <>
                {doc.slides.slice(0, HERO_MAX).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onOpen(p.id)}
                    aria-label={`Buka ${p.id}, slide ${i + 1}`}
                    className="bg-canvas shrink-0 overflow-hidden rounded-md border transition-transform hover:-translate-y-0.5"
                  >
                    <SlideView doc={doc} project={p.id} index={i} scale={scale} />
                  </button>
                ))}
                {doc.slides.length > HERO_MAX && (
                  <button
                    type="button"
                    onClick={() => onOpen(p.id)}
                    className="bg-muted text-muted-foreground grid shrink-0 place-items-center rounded-md px-6 text-sm"
                    style={{ height: HERO_H }}
                  >
                    +{doc.slides.length - HERO_MAX}
                  </button>
                )}
              </>
            )
          : [0, 1, 2].map((i) => <Skeleton key={i} className="shrink-0 rounded-md" style={{ height: HERO_H, width: HERO_H * 0.8 }} />)}
      </div>
    </section>
  );
}
