import { Check, Copy, Download, Eye, FileArchive, FileImage, FileText, Loader2, MoreHorizontal, Pencil, Star, Tag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent,
  DropdownMenuSubTrigger, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ProjectInfo } from "@/shared/api";
import { ago } from "@/shared/format";
import { useRunning } from "@/editor/ai/agentRuns";
import { Thumb } from "@/pages/home/Thumb";
import { FRESH_MS, label, type Action, type ActivateFn, type ExportFn, type PreviewFn } from "@/pages/home/homeData";

function PinButton({ id, pinned, onToggle, className }: { id: string; pinned: boolean; onToggle: (id: string) => void; className?: string }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("size-7", pinned ? "text-amber-500" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100", className)}
      aria-label={pinned ? `Lepas sematan ${id}` : `Sematkan ${id}`}
      aria-pressed={pinned}
      onClick={() => onToggle(id)}
    >
      <Star className={cn("size-4", pinned && "fill-current")} />
    </Button>
  );
}

const EXPORTS = [
  { format: "png", label: "PNG (slide 1)", icon: FileImage },
  { format: "zip", label: "ZIP (semua slide)", icon: FileArchive },
  { format: "pdf", label: "PDF", icon: FileText },
] as const;

function ProjectMenuButton({ p, onAction, onPreview, onExport }: {
  p: ProjectInfo;
  onAction: (kind: Action, id: string) => void;
  onPreview: PreviewFn;
  onExport: ExportFn;
}) {
  const id = p.id;
  const empty = p.slides === 0;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
          aria-label={`Menu ${id}`}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem disabled={empty} onSelect={() => onPreview(id)}><Eye /> Preview</DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger disabled={empty}><Download /> Export</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {EXPORTS.map(({ format, label, icon: Icon }) => (
              <DropdownMenuItem key={format} onSelect={() => onExport(id, format)}><Icon /> {label}</DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onAction("dup", id)}><Copy /> Salin…</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAction("title", id)}><Tag /> Ubah judul…</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAction("rename", id)}><Pencil /> Rename ID…</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => onAction("delete", id)}><Trash2 /> Hapus…</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SelectBox({ id, selected, selecting, onSelect, className }: {
  id: string;
  selected: boolean;
  selecting: boolean;
  onSelect: (id: string, range: boolean) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      aria-label={`Pilih ${id}`}
      onClick={(e) => { e.stopPropagation(); onSelect(id, e.shiftKey); }}
      className={cn(
        "grid size-6 place-items-center rounded-full border-2 backdrop-blur transition-opacity",
        selected ? "bg-brand border-brand text-white" : "border-white/80 bg-black/40 text-transparent",
        selected || selecting ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
        className,
      )}
    >
      <Check className="size-3.5" strokeWidth={3} />
    </button>
  );
}

type ItemProps = {
  p: ProjectInfo;
  pinned: boolean;
  selected: boolean;
  selecting: boolean;
  onSelect: (id: string, range: boolean) => void;
  onOpen: ActivateFn;
  onAction: (kind: Action, id: string) => void;
  onPin: (id: string) => void;
  onPreview: PreviewFn;
  onExport: ExportFn;
};

export function Card({ p, pinned, selected, selecting, onSelect, onOpen, onAction, onPin, onPreview, onExport }: ItemProps) {
  const ai = useRunning().has(p.id);
  return (
    <div
      data-selecting={selecting ? "true" : undefined}
      className={cn("group bg-card relative flex flex-col overflow-hidden rounded-lg border transition-shadow hover:shadow-md", selected && "border-brand ring-brand ring-1")}
    >
      <SelectBox id={p.id} selected={selected} selecting={selecting} onSelect={onSelect} className="absolute top-2 left-2 z-10" />
      <button type="button" className="block text-left outline-offset-2" onClick={(e) => onOpen(p.id, e)} aria-label={`Buka ${p.id}`}>
        <Thumb id={p.id} updated={p.updated} format={p.format} ai={ai} />
      </button>
      <div className="relative flex items-center">
        <button type="button" className="flex min-w-0 flex-1 flex-col gap-0.5 p-3 text-left outline-offset-2" onClick={(e) => onOpen(p.id, e)} tabIndex={-1}>
          <span className="truncate font-medium" title={p.id}>{label(p)}</span>
          <span className="text-muted-foreground text-xs">
            {p.slides} slide · {ago(p.updated)}
          </span>
        </button>
        {/* vertically centred in the footer; takes over the right end on hover */}
        <div className="group-hover:bg-card has-[[data-state=open]]:bg-card absolute inset-y-0 right-1.5 flex items-center rounded-md pl-1">
          <PinButton id={p.id} pinned={pinned} onToggle={onPin} />
          <ProjectMenuButton p={p} onAction={onAction} onPreview={onPreview} onExport={onExport} />
        </div>
      </div>
    </div>
  );
}

export function Row({ p, pinned, selected, selecting, onSelect, onOpen, onAction, onPin, onPreview, onExport }: ItemProps) {
  const ai = useRunning().has(p.id);
  const fresh = Date.now() - p.updated < FRESH_MS;
  return (
    <div
      data-selecting={selecting ? "true" : undefined}
      className={cn("group bg-card hover:bg-accent/40 flex items-center gap-2 rounded-lg border p-2 pr-3 transition-colors", selected && "border-brand ring-brand ring-1")}
    >
      <SelectBox id={p.id} selected={selected} selecting={selecting} onSelect={onSelect} className="ml-1 shrink-0" />
      <button type="button" className="flex min-w-0 flex-1 items-center gap-4 text-left outline-offset-2" onClick={(e) => onOpen(p.id, e)} aria-label={`Buka ${p.id}`}>
        <div className="w-14 shrink-0 overflow-hidden rounded-md border">
          <Thumb id={p.id} updated={p.updated} format={p.format} compact />
        </div>
        <span className="min-w-0 flex-1 truncate font-medium" title={p.id}>{label(p)}</span>
        <span className="text-muted-foreground hidden w-14 text-xs tabular-nums sm:block">{p.format}</span>
        <span className="text-muted-foreground hidden w-20 text-xs tabular-nums sm:block">{p.slides} slide</span>
        <span className="text-muted-foreground flex w-32 items-center gap-1.5 text-xs">
          {ai ? <><Loader2 className="text-brand size-3 animate-spin" /> AI bekerja</> : <>
            {fresh && <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />}
            {ago(p.updated)}
          </>}
        </span>
      </button>
      <PinButton id={p.id} pinned={pinned} onToggle={onPin} />
      <ProjectMenuButton p={p} onAction={onAction} onPreview={onPreview} onExport={onExport} />
    </div>
  );
}
