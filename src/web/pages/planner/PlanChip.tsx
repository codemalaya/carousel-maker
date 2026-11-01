import { cn } from "@/lib/utils";
import { type PlanItem } from "../../../core/schema";
import { PLATFORM_LABEL, STATUS_LABEL } from "@/pages/planner/planMeta";
import { DRAG_ITEM, STATUS_TINT, PLATFORM_ABBR } from "@/pages/planner/planUtils";

export function Chip({ item, projectMissing, compact, late, onOpen }: { item: PlanItem; projectMissing: boolean; late: boolean; /** month view: no time, the title gets the room */ compact: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => { e.dataTransfer.setData(DRAG_ITEM, item.id); e.dataTransfer.effectAllowed = "move"; }}
      onClick={(e) => { e.stopPropagation(); onOpen(); }}
      title={`${item.time} · ${PLATFORM_LABEL[item.platform]} · ${STATUS_LABEL[item.status]}${projectMissing ? " · project sudah tidak ada" : ""}`}
      className={cn("flex w-full cursor-grab items-center gap-1.5 rounded-md border-l-[3px] py-1 pr-1.5 pl-1.5 text-left text-[11px] leading-tight transition-colors active:cursor-grabbing", STATUS_TINT[item.status])}
    >
      {!compact && <span className="text-muted-foreground shrink-0 tabular-nums">{item.time}</span>}
      <span className={cn("min-w-0 flex-1 truncate font-medium", projectMissing && "line-through opacity-60")}>{item.title || PLATFORM_LABEL[item.platform]}</span>
      {late && <span className="size-1.5 shrink-0 rounded-full bg-red-500" role="img" aria-label="terlewat" title="Terlewat" />}
      <span className="bg-foreground/10 text-foreground/70 shrink-0 rounded px-1 text-[9px] font-semibold">{PLATFORM_ABBR[item.platform]}</span>
    </button>
  );
}
