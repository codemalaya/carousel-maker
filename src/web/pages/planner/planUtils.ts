import { type PlanItem } from "../../../core/schema";

export type Status = PlanItem["status"];
export type Platform = PlanItem["platform"];
export type Format = NonNullable<PlanItem["format"]>;

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
export const NONE = "__none";
export const FORMAT_IDS: Format[] = ["1:1", "4:5", "9:16", "16:9", "4:3"];
export const DAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
export const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
export const STATUS_HINT: Record<Status, string> = { ide: "baru sebatas gagasan", draft: "carousel sedang dibuat", siap: "siap tayang", terjadwal: "jam tayang sudah diatur", terbit: "sudah tayang" };

export const AUTO_PUBLISH_KEY = "carousel-plan-autopublish";
/** "Buat carousel" also starts the AI right away (checkbox in the idea dialog, on by default). */
export const AUTO_AI_KEY = "carousel-plan-autoai";

/** Marker of the plan block in a project's brief; agent.ts looks for it to know the user already decided what this carousel is about. */
export const PLAN_BLOCK_OPEN = "[rencana konten]";
export const PLAN_BLOCK_CLOSE = "[/rencana konten]";
/** What the agent receives (and history shows) when it is started from "Buat carousel". */
export const PLAN_AI_PROMPT = "Buat carousel lengkap dari [rencana konten] di brief project ini.";

/** The slot's idea, as a block for the brief: topic, platform, caption draft (the angle), hashtags, and the URLs in the caption as sources. */
export function planBrief(f: { title: string; platform: string; caption: string; hashtags: string }, platformLabel: string, format: string): string {
  const urls = [...new Set(f.caption.match(/https?:\/\/[^\s)>\]"']+/g) ?? [])].slice(0, 3);
  return [
    PLAN_BLOCK_OPEN,
    `Judul / ide: ${f.title.trim()}`,
    `Platform: ${platformLabel} (format ${format})`,
    f.caption.trim() && `Draft caption (arah cerita dan sudut pandang; jangan disalin mentah ke slide):\n${f.caption.trim()}`,
    f.hashtags.trim() && `Hashtag: ${f.hashtags.trim()}`,
    urls.length > 0 && `Sumber (baca dengan fetch_source, cantumkan kreditnya di slide terakhir):\n${urls.map((u) => `- ${u}`).join("\n")}`,
    PLAN_BLOCK_CLOSE,
  ].filter(Boolean).join("\n");
}

export const pad = (n: number) => String(n).padStart(2, "0");
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (s: string) => new Date(`${s}T00:00:00`);
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
/** Monday of the week containing d. */
export const weekStart = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));
export const DRAG_ITEM = "application/x-plan-item";
export const DRAG_PROJECT = "application/x-plan-project";

export const STATUS_TINT: Record<Status, string> = {
  ide: "border-zinc-400 bg-zinc-500/10 hover:bg-zinc-500/20",
  draft: "border-amber-500 bg-amber-500/10 hover:bg-amber-500/20",
  siap: "border-sky-500 bg-sky-500/10 hover:bg-sky-500/20",
  terjadwal: "border-violet-500 bg-violet-500/10 hover:bg-violet-500/20",
  terbit: "border-emerald-500 bg-emerald-500/10 opacity-70 hover:bg-emerald-500/20 hover:opacity-100",
};
export const PLATFORM_ABBR: Record<Platform, string> = { instagram: "IG", linkedin: "IN", tiktok: "TT", facebook: "FB", x: "X", threads: "TH", youtube: "YT", lainnya: "··" };
export const MAX_CHIPS = 3; // per day in the month view; the rest opens that week
