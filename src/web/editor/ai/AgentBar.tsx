import { useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowUp, Check, History, Loader2, OctagonX, Sparkles, Square, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { clearRuns, startRun, stopRun, useRuns, type Run } from "@/editor/ai/agentRuns";
import { ago } from "@/shared/format";

const STATUS_ICON: Record<Run["status"], React.ReactNode> = {
  running: <Loader2 className="size-3.5 animate-spin" />,
  done: <Check className="size-3.5 text-emerald-500" />,
  error: <AlertCircle className="text-destructive size-3.5" />,
  stopped: <Square className="size-3.5" />,
  interrupted: <OctagonX className="size-3.5 text-amber-500" />,
};
const STATUS_TEXT: Record<Run["status"], string> = {
  running: "Berjalan",
  done: "Selesai",
  error: "Gagal",
  stopped: "Dihentikan",
  interrupted: "Terputus (halaman di-refresh)",
};

/** What the editor is showing right now; the AI can be scoped to it. */
export type EditorContext = {
  cur: number;
  count: number;
  /** slide name or auto title */
  title: string;
  sel: { index: number; type: string; text?: string } | null;
};
type Scope = "project" | "slide" | "element";

const CHIPS: Record<Scope | "text", string[]> = {
  project: ["Samakan gaya semua slide", "Tambah slide penutup dengan CTA", "Perbaiki teks yang terpotong di semua slide"],
  slide: ["Bikin 3 variasi slide ini, sisipkan tepat setelahnya", "Rapikan layout slide ini", "Perkuat kontras dan keterbacaan"],
  element: ["Ganti warna agar serasi dengan slide", "Perbesar sedikit", "Pindahkan ke tengah slide"],
  text: ["Persingkat", "Buat lebih menarik", "Terjemahkan ke Inggris", "Perbesar dan tebalkan"],
};

const clip = (s: string, n = 120) => (s.length > n ? `${s.slice(0, n)}…` : s).replace(/\s+/g, " ");

/** Extra instructions for the agent so it edits only what the user is looking at. */
function scopeBlock(scope: Scope, c: EditorContext): string {
  const where = `slide ke-${c.cur + 1} dari ${c.count} (index ${c.cur}, "${clip(c.title, 60)}")`;
  if (scope === "slide") {
    return (
      `Konteks editor: user sedang melihat ${where}. Batasi perubahan pada slide ini saja (set_slide / set_element dengan slide ${c.cur}); ` +
      `jangan ubah slide lain kecuali diminta eksplisit. Kalau diminta variasi atau slide baru: tambahkan lewat set_slide di index ${c.count} (akhir deck), ` +
      `lalu pindahkan ke posisi yang diminta dengan reorder_slides.`
    );
  }
  if (scope === "element" && c.sel) {
    return (
      `Konteks editor: user memilih satu elemen, index ${c.sel.index} pada ${where}, tipe ${c.sel.type}` +
      `${c.sel.text ? `, isi "${clip(c.sel.text)}"` : ""}. Ubah elemen ini saja: baca dulu get_carousel supaya properti lain tidak hilang, lalu set_element ` +
      `(slide ${c.cur}, elementIndex ${c.sel.index}). Jangan ubah elemen atau slide lain kecuali diminta eksplisit.`
    );
  }
  return `Konteks editor: user sedang berada di ${where}, tapi permintaan berlaku untuk seluruh project.`;
}

/**
 * AI prompt that opens above the bottom toolbar (the sparkles button lives there). Runs are owned by `agentRuns`,
 * not this component, so they keep going and stay visible when you switch projects or close the bar.
 */
export function AgentBar({ project, flush, open, onOpenChange, ctx }: {
  project: string;
  ctx: EditorContext;
  flush: () => Promise<unknown>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [pinned, setPinned] = useState<Scope | null>(null); // null = follow the selection
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (!open) setPinned(null); }, [open]);
  const scope: Scope = pinned === "element" && !ctx.sel ? "project" : (pinned ?? (ctx.sel ? "element" : "project"));
  const chips = CHIPS[scope === "element" && ctx.sel?.type === "text" ? "text" : scope];
  const runs = useRuns(project);
  const last = runs[0];
  const busy = last?.status === "running";

  const run = () => {
    const text = prompt.trim();
    if (!text || busy) return;
    setPrompt("");
    const tag = scope === "slide" ? `[Slide ${ctx.cur + 1}] ` : scope === "element" && ctx.sel ? `[Elemen ${ctx.sel.index + 1}] ` : "";
    startRun(project, tag + text, flush, { send: `${scopeBlock(scope, ctx)}\n\nPermintaan user: ${text}` });
  };

  if (!open) return null;

  return (
    <div className="bg-card/95 absolute bottom-[4.75rem] left-1/2 z-30 flex w-[min(560px,90%)] -translate-x-1/2 flex-col gap-2 rounded-2xl border p-2 shadow-lg backdrop-blur">
      {/* what the AI may touch */}
      <div className="flex flex-wrap items-center gap-1 px-1 pt-0.5" role="radiogroup" aria-label="Cakupan AI">
        {([
          ["project", "Seluruh project"],
          ["slide", `Slide ${ctx.cur + 1}`],
          ["element", ctx.sel ? `Elemen ${ctx.sel.index + 1} (${ctx.sel.type})` : "Elemen"],
        ] as [Scope, string][]).map(([s, label]) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={scope === s}
            disabled={busy || (s === "element" && !ctx.sel)}
            title={s === "element" && !ctx.sel ? "Pilih elemen di kanvas dulu" : undefined}
            onClick={() => setPinned(s)}
            className={cn(
              "h-6 rounded-full border px-2.5 text-[11px] transition-colors disabled:opacity-40",
              scope === s ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex items-start gap-2">
        <Sparkles className="text-muted-foreground mt-2.5 ml-1.5 size-4 shrink-0" />
        <Textarea
          ref={input}
          autoFocus
          rows={2}
          value={prompt}
          placeholder={busy ? "AI sedang bekerja, tunggu selesai atau hentikan dulu" : "Contoh: bikin 6 slide tips hemat listrik, gaya bold oranye"}
          disabled={busy}
          className="max-h-40 min-h-0 resize-none overflow-y-auto border-0 shadow-none focus-visible:ring-0"
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              run();
            }
            if (e.key === "Escape") onOpenChange(false);
          }}
        />
        {busy ? (
          <Button size="icon" variant="secondary" className="size-8 rounded-full" aria-label="Stop" onClick={() => stopRun(project)}>
            <Square />
          </Button>
        ) : (
          <Button size="icon" className="size-8 rounded-full" aria-label="Kirim" disabled={!prompt.trim()} onClick={run}>
            <ArrowUp />
          </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          className={`size-8 rounded-full ${showHistory ? "bg-accent" : ""}`}
          aria-label="Riwayat"
          aria-pressed={showHistory}
          title={`Riwayat (${runs.length})`}
          disabled={runs.length === 0}
          onClick={() => setShowHistory((v) => !v)}
        >
          <History />
        </Button>
        <Button size="icon" variant="ghost" className="size-8 rounded-full" aria-label="Sembunyikan" onClick={() => onOpenChange(false)}>
          <X />
        </Button>
      </div>

      {/* one-click starting points for the current scope */}
      {!busy && !prompt && !showHistory && (
        <div className="flex flex-wrap gap-1 px-1 pb-0.5">
          {chips.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => { setPrompt(c); input.current?.focus(); }}
              className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-full border border-dashed px-2.5 py-0.5 text-[11px] transition-colors"
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {/* status of the latest run */}
      {last && !showHistory && (
        <div className="text-muted-foreground flex items-start gap-2 px-2 pb-1 text-xs">
          <span className="mt-0.5 shrink-0">{STATUS_ICON[last.status]}</span>
          <div className="min-w-0">
            <p className="truncate" title={last.prompt}>"{last.prompt}"</p>
            <p className={`max-h-24 overflow-y-auto whitespace-pre-wrap ${last.status === "error" ? "text-destructive" : ""}`}>
              {last.status === "running"
                ? `Jalan: ${last.step}`
                : last.error || last.reply || STATUS_TEXT[last.status]}
            </p>
          </div>
        </div>
      )}

      {showHistory && (
        <div className="flex flex-col gap-1 px-1 pb-1">
          <div className="max-h-56 overflow-y-auto">
            {runs.map((r) => (
              <button
                key={r.id}
                type="button"
                disabled={busy}
                title="Pakai prompt ini lagi"
                onClick={() => { setPrompt(r.prompt); setShowHistory(false); }}
                className="hover:bg-accent flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs disabled:pointer-events-none"
              >
                <span className="mt-0.5 shrink-0">{STATUS_ICON[r.status]}</span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2">{r.prompt}</span>
                  <span className="text-muted-foreground block truncate">
                    {STATUS_TEXT[r.status]} · {ago(r.startedAt)}
                    {r.status === "done" && r.reply ? ` · ${r.reply}` : ""}
                    {r.status === "error" && r.error ? ` · ${r.error}` : ""}
                  </span>
                </span>
              </button>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-7 w-fit gap-1.5 self-end text-xs"
            disabled={busy}
            onClick={() => { clearRuns(project); setShowHistory(false); }}
          >
            <Trash2 className="size-3.5" /> Hapus riwayat
          </Button>
        </div>
      )}
    </div>
  );
}
