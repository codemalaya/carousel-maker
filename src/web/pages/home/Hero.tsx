import { ArrowRight, Loader2 } from "lucide-react";
import { NoSlidesArt } from "@/pages/home/HomeEmptyArt";
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
    <section className="bg-card flex flex-col gap-4 overflow-hidden rounded-xl border p-5 md:flex-row md:items-center">
      <div className="flex shrink-0 flex-col gap-3 md:w-56">
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
            ? (
              <button
                type="button"
                onClick={() => onOpen(p.id)}
                className="bg-muted/50 hover:border-brand/50 hover:bg-muted/70 @container group flex w-full min-w-[17rem] flex-1 items-center justify-center gap-6 rounded-lg border border-dashed px-6 text-left transition-colors"
                style={{ height: HERO_H }}
              >
                <NoSlidesArt className="hidden w-40 shrink-0 @lg:block" />
                <span className="min-w-0 max-w-sm">
                  <span className="block text-base font-semibold">Belum ada slide</span>
                  <span className="text-muted-foreground mt-1 block text-sm leading-relaxed">Project ini masih kosong. Buka editor, lalu tambah slide sendiri atau minta AI menyusunnya.</span>
                  <span className="text-brand mt-3 inline-flex items-center gap-1 text-sm font-medium">
                    Mulai di editor <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </span>
              </button>
            )
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
