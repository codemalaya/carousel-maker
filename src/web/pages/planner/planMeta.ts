import type { PlanItem } from "../../../core/schema";

type Platform = PlanItem["platform"];
type Status = PlanItem["status"];

/** Labels and colors shared by the planner page, the trash page and the reminders. */
export const PLATFORM_LABEL: Record<Platform, string> = { instagram: "Instagram", linkedin: "LinkedIn", tiktok: "TikTok", facebook: "Facebook", x: "X", threads: "Threads", youtube: "YouTube", lainnya: "Lainnya" };
export const STATUS_LABEL: Record<Status, string> = { ide: "Ide", draft: "Draft", siap: "Siap", terjadwal: "Terjadwal", terbit: "Terbit" };
export const STATUS_DOT: Record<Status, string> = { ide: "bg-zinc-400", draft: "bg-amber-500", siap: "bg-sky-500", terjadwal: "bg-violet-500", terbit: "bg-emerald-500" };
