import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, Keyboard, Link2, Play, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type Slide = { key: string; title: string; text: string; cta?: string; onClick?: () => void; bg: string; art: ReactNode };

const AUTO_MS = 6000;

/** Mini calendar made of dots: a few days are highlighted. */
const CalendarArt = () => (
  <div className="grid grid-cols-7 gap-1.5" aria-hidden>
    {Array.from({ length: 28 }, (_, i) => (
      <span key={i} className={cn("size-3.5 rounded-full bg-white/25", [3, 9, 10, 16, 23].includes(i) && "bg-white", i === 16 && "ring-4 ring-white/40")} />
    ))}
  </div>
);

/** Palette swatches stacked like paint chips. */
const PaletteArt = () => (
  <div className="flex items-end gap-2" aria-hidden>
    {["bg-white", "bg-white/70", "bg-white/45", "bg-white/25"].map((c, i) => (
      <span key={i} className={cn("w-10 rounded-2xl", c)} style={{ height: 56 + i * 22 }} />
    ))}
  </div>
);

/** A link turning into slides. */
const ArticleArt = () => (
  <div className="flex items-center gap-3" aria-hidden>
    <div className="flex h-24 w-20 flex-col gap-1.5 rounded-xl bg-white/90 p-3">
      <span className="h-1.5 w-full rounded-full bg-black/25" />
      <span className="h-1.5 w-4/5 rounded-full bg-black/15" />
      <span className="h-1.5 w-full rounded-full bg-black/15" />
      <span className="h-1.5 w-3/5 rounded-full bg-black/15" />
    </div>
    <ArrowRight className="size-5 text-white/80" />
    <div className="relative h-24 w-[4.5rem]">
      <span className="absolute inset-0 translate-x-3 -rotate-6 rounded-xl bg-white/30" />
      <span className="absolute inset-0 translate-x-1.5 -rotate-3 rounded-xl bg-white/55" />
      <span className="absolute inset-0 grid place-items-center rounded-xl bg-white"><Link2 className="size-5 text-black/40" /></span>
    </div>
  </div>
);

/** A slide with a play button and a progress bar. */
const PresentArt = () => (
  <div className="w-44" aria-hidden>
    <div className="grid aspect-video place-items-center rounded-xl bg-white/90 shadow-lg">
      <span className="grid size-10 place-items-center rounded-full bg-black/80"><Play className="size-4 translate-x-px fill-white text-white" /></span>
    </div>
    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/25"><span className="block h-full w-2/5 rounded-full bg-white" /></div>
  </div>
);

/** File types as chips. */
const ExportArt = () => (
  <div className="flex max-w-[13rem] flex-wrap justify-center gap-2" aria-hidden>
    {["PNG", "PDF", "HTML", "MP4", "GIF", "ZIP"].map((t, i) => (
      <span key={t} className={cn("rounded-full px-3.5 py-1.5 text-xs font-semibold", i % 2 ? "bg-white/25 text-white" : "bg-white text-black/75")}>{t}</span>
    ))}
  </div>
);

/** The five formats as outlines at their real proportions. */
const FormatArt = () => (
  <div className="flex items-end gap-2.5" aria-hidden>
    {[[1, 1], [4, 5], [9, 16], [16, 9], [4, 3]].map(([w, h]) => (
      <span key={`${w}:${h}`} className="rounded-md border-2 border-white/90 bg-white/15" style={{ width: 26, aspectRatio: `${w} / ${h}`, ...(w > h ? { width: 40 } : {}) }} />
    ))}
  </div>
);

const KEYS: [string, string][] = [["N", "Project baru"], ["/", "Cari project"], ["P", "Preview (di editor)"], ["⇧ P", "Presentasi (di editor)"], ["?", "Semua pintasan (di editor)"]];
const PROMPTS = ["6 slide tips hemat listrik, gaya bold oranye", "5 kesalahan pemula saat belajar React, tone lucu", "Rangkuman buku Atomic Habits jadi 7 slide minimalis"];

function Panel({ icon: Icon, title, children }: { icon: typeof Keyboard; title: string; children: ReactNode }) {
  return (
    <section className="bg-card rounded-2xl border p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-medium"><Icon className="text-muted-foreground size-4" /> {title}</h3>
      {children}
    </section>
  );
}

/** Right panel of the home page: decorative carousel plus two plain reference cards. No data: it only points at features. */
export function HomeCards(props: { onPlan: () => void; onBrands: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <FeatureCarousel {...props} />
      <Panel icon={Sparkles} title="Ide prompt">
        <ul className="text-muted-foreground flex flex-col gap-2 text-xs leading-relaxed">
          {PROMPTS.map((t) => <li key={t} className="bg-muted/60 rounded-lg px-3 py-2">{t}</li>)}
        </ul>
      </Panel>
      <Panel icon={Keyboard} title="Pintasan">
        <ul className="flex flex-col gap-2 text-xs">
          {KEYS.map(([k, l]) => (
            <li key={k} className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{l}</span>
              <kbd className="text-muted-foreground rounded border px-1.5 py-0.5 text-[10px]">{k}</kbd>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

/** Decorative feature carousel (scroll-snap, dots, auto-advance). */
function FeatureCarousel({ onPlan, onBrands }: { onPlan: () => void; onBrands: () => void }) {
  const slides: Slide[] = [
    { key: "plan", title: "Rencana konten", text: "Atur kapan tiap carousel tayang di kalender.", cta: "Buka kalender", onClick: onPlan, bg: "from-sky-500 via-blue-600 to-indigo-700", art: <CalendarArt /> },
    { key: "brand", title: "Brand kit", text: "Simpan warna, font, dan logo sekali. Pakai di project mana pun.", cta: "Atur brand", onClick: onBrands, bg: "from-orange-500 via-rose-500 to-fuchsia-600", art: <PaletteArt /> },
    { key: "article", title: "Dari artikel jadi carousel", text: "Tempel link atau teks di kotak AI, sisanya biar dikerjakan.", bg: "from-emerald-500 via-teal-600 to-cyan-700", art: <ArticleArt /> },
    { key: "present", title: "Mode presentasi", text: "Layar penuh dengan animasi, catatan pembicara, dan timer. Tekan Shift+P di editor.", bg: "from-violet-500 via-purple-600 to-indigo-800", art: <PresentArt /> },
    { key: "export", title: "Ekspor ke mana saja", text: "PNG, PDF, HTML interaktif, sampai video MP4 dan GIF.", bg: "from-amber-400 via-orange-500 to-red-600", art: <ExportArt /> },
    { key: "format", title: "Lima format", text: "Dari feed 1:1 dan story 9:16 sampai slide presentasi 16:9.", bg: "from-slate-600 via-slate-700 to-zinc-900", art: <FormatArt /> },
  ];
  const [i, setI] = useState(0);
  const [hold, setHold] = useState(false);
  const track = useRef<HTMLDivElement>(null);

  const go = (n: number) => {
    const el = track.current;
    if (!el) return;
    const next = (n + slides.length) % slides.length;
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  };

  const onScroll = () => {
    const el = track.current;
    if (el) setI(Math.round(el.scrollLeft / el.clientWidth));
  };

  useEffect(() => {
    if (hold || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setTimeout(() => go(i + 1), AUTO_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, hold]);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Fitur"
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      onFocus={() => setHold(true)}
      onBlur={() => setHold(false)}
    >
      <div className="relative">
      <div ref={track} onScroll={onScroll} className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto rounded-2xl">
        {slides.map((s, n) => (
          <div
            key={s.key}
            role="group"
            aria-roledescription="slide"
            aria-label={`${n + 1} dari ${slides.length}`}
            className={cn("relative flex aspect-[4/5] w-full shrink-0 snap-center flex-col justify-between overflow-hidden bg-gradient-to-br p-6 pb-10 text-white", s.bg)}
          >
            <span className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-white/10" aria-hidden />
            <span className="pointer-events-none absolute -bottom-20 -left-12 size-56 rounded-full bg-black/10" aria-hidden />
            <div className="relative grid flex-1 place-items-center">{s.art}</div>
            <div className="relative">
              <h3 className="text-xl leading-tight font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-white/85">{s.text}</p>
              {s.onClick && (
                <button type="button" onClick={s.onClick} className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-medium text-black transition hover:bg-white/90 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent focus-visible:outline-none">
                  {s.cta} <ArrowRight className="size-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="absolute bottom-3.5 left-6 flex items-center gap-1.5">
        {slides.map((s, n) => (
          <button
            key={s.key}
            type="button"
            aria-label={`Slide ${n + 1}: ${s.title}`}
            aria-current={n === i}
            onClick={() => go(n)}
            className={cn("h-1.5 rounded-full transition-all", n === i ? "w-5 bg-white" : "w-1.5 bg-white/45 hover:bg-white/70")}
          />
        ))}
      </div>
      </div>
    </section>
  );
}

