import { Loader2, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Carousel } from "../../../core/schema";
import type { ProjectInfo } from "@/shared/api";

export type Filter = "all" | "pinned" | "ai" | Carousel["format"];

export const matchesFilter = (f: Filter, p: ProjectInfo, pins: string[], running: Set<string>) =>
  f === "all" || (f === "pinned" ? pins.includes(p.id) : f === "ai" ? running.has(p.id) : p.format === f);

const FORMATS: Carousel["format"][] = ["1:1", "4:5", "9:16", "16:9", "4:3"];

/** Quick filters under the toolbar. A chip only shows when it would match something (or is the active one). */
export function FilterChips({ projects, pins, running, value, onChange }: {
  projects: ProjectInfo[];
  pins: string[];
  running: Set<string>;
  value: Filter;
  onChange: (f: Filter) => void;
}) {
  const count = (f: Filter) => projects.filter((p) => matchesFilter(f, p, pins, running)).length;
  const present = FORMATS.filter((f) => count(f) > 0);
  const chips: { f: Filter; label: React.ReactNode }[] = [
    { f: "pinned" as Filter, label: <><Star className="size-3 fill-current" /> Disematkan</> },
    { f: "ai" as Filter, label: <><Loader2 className="size-3 animate-spin" /> AI bekerja</> },
    ...(present.length > 1 ? present.map((f) => ({ f: f as Filter, label: <>{f}</> })) : []),
  ].filter((c) => c.f === value || count(c.f) > 0);
  if (chips.length === 0) return null;

  const chip = (f: Filter, label: React.ReactNode) => (
    <button
      key={f}
      type="button"
      aria-pressed={value === f}
      onClick={() => onChange(value === f ? "all" : f)}
      className={cn(
        "flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors",
        value === f ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {label}
      <span className="tabular-nums opacity-60">{count(f)}</span>
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter project">
      {chip("all", "Semua")}
      {chips.map((c) => chip(c.f, c.label))}
    </div>
  );
}
