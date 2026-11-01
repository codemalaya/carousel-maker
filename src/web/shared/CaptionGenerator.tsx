import { useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2, Sparkles, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { PLATFORMS } from "../../core/schema";
import { CAPTION_LIMIT, captionLength, type CaptionVariant, type Platform } from "../../core/caption";
import { PLATFORM_LABEL } from "@/pages/planner/planMeta";

const PLATFORM_KEY = "carousel-caption-platform";
const STEP: Record<string, string> = { get_carousel: "Membaca slide…", get_brand: "Membaca brand…" };
type Msg = { t: "status"; tool: string } | { t: "text"; text: string } | { t: "done"; text: string; data?: { variants: CaptionVariant[] } } | { t: "error"; message: string };

/** Last platform the user picked (shared by the planner dialog and the editor). */
export const rememberedPlatform = (): Platform => {
  const v = localStorage.getItem(PLATFORM_KEY);
  return (PLATFORMS as readonly string[]).includes(v ?? "") ? (v as Platform) : "instagram";
};

/**
 * Asks the read-only caption agent for 1-3 variants for one project and platform. `pickLabel` + `onPick` decide what choosing a variant does
 * (planner: fill the fields; editor: copy to the clipboard). The run is cancelled when this unmounts.
 */
export function CaptionGenerator({ project, platform: initial, onPick, pickLabel, extra }: {
  project: string;
  platform?: Platform;
  onPick: (v: CaptionVariant, platform: Platform) => void;
  pickLabel: string;
  extra?: ReactNode;
}) {
  const [platform, setPlatform] = useState<Platform>(initial ?? rememberedPlatform());
  const [hint, setHint] = useState("");
  const [count, setCount] = useState("3");
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState("");
  const [error, setError] = useState("");
  const [variants, setVariants] = useState<CaptionVariant[] | null>(null);
  const [shownFor, setShownFor] = useState<Platform>(platform); // limits follow the platform the variants were written for
  const ctl = useRef<AbortController | null>(null);
  useEffect(() => () => ctl.current?.abort(), []);

  const run = async () => {
    if (running) return;
    localStorage.setItem(PLATFORM_KEY, platform);
    setRunning(true);
    setError("");
    setVariants(null);
    setStep("Mulai…");
    const c = new AbortController();
    ctl.current = c;
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(project)}/caption`, { method: "POST", body: JSON.stringify({ platform, variants: Number(count), hint }), signal: c.signal });
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText);
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = "";
      let settled = false;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += value;
        const lines = buf.split("\n");
        buf = lines.pop()!;
        for (const line of lines) {
          if (!line) continue;
          const m = JSON.parse(line) as Msg;
          if (m.t === "status") setStep(STEP[m.tool] ?? m.tool);
          else if (m.t === "done") {
            settled = true;
            if (m.data?.variants?.length) {
              setVariants(m.data.variants);
              setShownFor(platform);
            } else setError("Agent tidak mengembalikan caption");
          } else if (m.t === "error") {
            settled = true;
            setError(m.message);
          }
        }
      }
      if (!settled) setError("Koneksi terputus sebelum selesai");
    } catch (e) {
      if (!c.signal.aborted) setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
      setStep("");
    }
  };

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-[1fr_7rem] gap-2">
        <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)} disabled={running}>
          <SelectTrigger className="w-full" aria-label="Platform"><SelectValue /></SelectTrigger>
          <SelectContent>{PLATFORMS.map((p) => <SelectItem key={p} value={p}>{PLATFORM_LABEL[p]}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={count} onValueChange={setCount} disabled={running}>
          <SelectTrigger className="w-full" aria-label="Jumlah varian"><SelectValue /></SelectTrigger>
          <SelectContent>{["1", "2", "3"].map((n) => <SelectItem key={n} value={n}>{n} varian</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <Input
        value={hint}
        maxLength={300}
        disabled={running}
        placeholder="Arahan (opsional): nada santai, untuk pemula…"
        aria-label="Arahan caption"
        onChange={(e) => setHint(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault(); // this sits inside the planner form: Enter must not save it
            run();
          }
        }}
      />
      <div className="flex items-center gap-2">
        {running ? (
          <Button type="button" variant="outline" className="gap-1.5" onClick={() => ctl.current?.abort()}><Square className="size-3.5" /> Berhenti</Button>
        ) : (
          <Button type="button" className="gap-1.5" onClick={run}><Sparkles className="size-4" /> {variants ? "Buat ulang" : "Buat caption"}</Button>
        )}
        {running && <span className="text-muted-foreground flex items-center gap-1.5 text-xs"><Loader2 className="size-3.5 animate-spin" /> {step}</span>}
        {extra}
      </div>
      {error && <p role="alert" className="text-destructive text-xs">{error}</p>}
      {variants && (
        <ul className="grid gap-2">
          {variants.map((v, i) => {
            const len = captionLength(v);
            const limit = CAPTION_LIMIT[shownFor];
            return (
              <li key={i} className="bg-muted/40 grid gap-2 rounded-lg border p-3">
                <p className="text-sm whitespace-pre-wrap">{v.caption}</p>
                {v.hashtags && <p className="text-brand text-xs break-words">{v.hashtags}</p>}
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("text-xs tabular-nums", len > limit ? "text-destructive font-medium" : "text-muted-foreground")} title={`Batas ${PLATFORM_LABEL[shownFor]}: ${limit} karakter`}>
                    {len}/{limit}{len > limit ? " (kepanjangan)" : ""}
                  </span>
                  <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => onPick(v, shownFor)}>{pickLabel}</Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
