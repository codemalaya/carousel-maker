import type { ExportOpts, ProjectInfo } from "@/shared/api";
import { ago } from "@/shared/format";
import { matchesFilter, type Filter } from "@/pages/home/FilterChips";

export type Sort = "recent" | "name";
export type View = "grid" | "list";
export type OpenFn = (id: string) => void;
/** card/row click: opens the project, or toggles selection when selecting (Shift/Cmd/Ctrl+click starts it) */
export type ActivateFn = (id: string, e: React.MouseEvent) => void;
export type PreviewFn = (id: string) => void;
export type ExportFn = (id: string, format: ExportOpts["format"]) => void;
export type Action = "dup" | "rename" | "title" | "delete";

export const label = (p: ProjectInfo) => p.title || p.id;

export const FRESH_MS = 2 * 60_000; // edited this recently = an agent (or you) is probably still on it

export const greeting = () => {
  const h = new Date().getHours();
  return `${h < 11 ? "Selamat pagi" : h < 15 ? "Selamat siang" : h < 18 ? "Selamat sore" : "Selamat malam"} 👋`;
};

export function summary(projects: ProjectInfo[]) {
  if (!projects.length) return "Mulai dari satu ide, atau jatuhkan gambar ke halaman ini.";
  const slides = projects.reduce((n, p) => n + p.slides, 0);
  const latest = Math.max(...projects.map((p) => p.updated));
  return `${projects.length} project · ${slides} slide · terakhir diedit ${ago(latest)}`;
}

export const PINS_KEY = "carousel-pins";
export const loadPins = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(PINS_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
};

export type Group = { key: string; label?: string; items: ProjectInfo[]; /** full size when `items` was cut by "show more" */ total?: number };

export const PAGE = 24; // projects shown per step; pinned ones are always shown

const DAY = 86_400_000;

export function groupProjects(projects: ProjectInfo[], pins: string[], sort: Sort, needle: string, filter: Filter, running: Set<string>): Group[] {
  const list = projects.filter((p) => `${p.title} ${p.id}`.toLowerCase().includes(needle) && matchesFilter(filter, p, pins, running));
  list.sort(sort === "name" ? (a, b) => label(a).localeCompare(label(b)) : (a, b) => b.updated - a.updated);
  const pinned = list.filter((p) => pins.includes(p.id));
  const rest = list.filter((p) => !pins.includes(p.id));
  if (needle || filter !== "all") return list.length ? [{ key: "found", items: [...pinned, ...rest] }] : [];

  const out: Group[] = [];
  if (pinned.length) out.push({ key: "pin", label: "Disematkan", items: pinned });
  if (sort === "recent") {
    const today = new Date().setHours(0, 0, 0, 0);
    const buckets: Group[] = [
      { key: "today", label: "Hari ini", items: rest.filter((p) => p.updated >= today) },
      { key: "week", label: "Minggu ini", items: rest.filter((p) => p.updated < today && p.updated >= today - 6 * DAY) },
      { key: "older", label: "Lebih lama", items: rest.filter((p) => p.updated < today - 6 * DAY) },
    ];
    out.push(...buckets.filter((g) => g.items.length));
  } else if (rest.length) {
    out.push({ key: "all", label: pinned.length ? "Lainnya" : undefined, items: rest });
  }
  return out;
}
