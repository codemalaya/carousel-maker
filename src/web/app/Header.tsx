import { AlertCircle, Check, ChevronDown, GalleryHorizontalEnd, Loader2, Play, Presentation, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Carousel } from "../../core/schema";
import { ShortcutsButton } from "@/app/ShortcutsDialog";
import { ThemeToggle } from "@/app/ThemeToggle";
import type { Status } from "@/editor/useEditor";

function SaveStatus({ status, error }: { status: Status; error: string }) {
  const map = {
    saved: { icon: <Check className="size-3.5" />, text: "Tersimpan", cls: "text-muted-foreground" },
    saving: { icon: <Loader2 className="size-3.5 animate-spin" />, text: "Menyimpan…", cls: "text-amber-500" },
    error: { icon: <AlertCircle className="size-3.5" />, text: "Gagal simpan", cls: "text-destructive" },
  }[status];
  const body = (
    <span className={`flex items-center gap-1 text-xs ${map.cls}`}>
      {map.icon}
      {map.text}
    </span>
  );
  if (!error) return body;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{body}</TooltipTrigger>
      <TooltipContent className="max-w-xs break-words">{error}</TooltipContent>
    </Tooltip>
  );
}

type HeaderProps = {
  status: Status;
  error: string;
  project: string;
  /** display name; falls back to the project id */
  title?: string;
  onHome: () => void;
  /** other projects with an AI run in progress */
  aiElsewhere?: string[];
  onOpenProject?: (id: string) => void;
  /** 1-based number of the open slide, 0 when the project has none */
  slide: number;
  count: number;
  /** manual name of the open slide, if any */
  slideName?: string;
  format: Carousel["format"];
  onFormat: (f: Carousel["format"]) => void;
  canPreview: boolean;
  onPreview: () => void;
  onPresent: () => void;
};

const FORMAT_LABEL: Record<Carousel["format"], string> = { "1:1": "1:1 (1080×1080)", "4:5": "4:5 (1080×1350)", "9:16": "9:16 (1080×1920)", "16:9": "16:9 (1920×1080)", "4:3": "4:3 (1440×1080)" };

export function Header({ status, error, project, title, onHome, aiElsewhere = [], onOpenProject, slide, count, slideName, format, onFormat, canPreview, onPreview, onPresent }: HeaderProps) {
  return (
    <header className="grid grid-cols-[1fr_auto_1fr] items-center">
      <button type="button" className="flex items-center gap-2 justify-self-start rounded-md" onClick={onHome} title="Semua project" aria-label="Semua project">
        <span className="bg-brand grid size-6 place-items-center rounded-md text-white">
          <GalleryHorizontalEnd className="size-3.5" />
        </span>
        <strong className="text-sm">Carousel Maker</strong>
      </button>

      {/* what am I editing right now */}
      <div className="bg-background flex h-8 min-w-0 items-center gap-2 rounded-full border pr-1 pl-3 text-xs">
        <span className="max-w-48 truncate font-medium" title={project}>{title || project}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground whitespace-nowrap tabular-nums">{slide ? `Slide ${slide}/${count}` : "Belum ada slide"}</span>
        {slideName && (
          <>
            <span className="text-muted-foreground">·</span>
            <span className="max-w-40 truncate" title={slideName}>{slideName}</span>
          </>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm" className="h-6 gap-1 rounded-full px-2 text-xs" aria-label={`Format ${format}`}>
              {format}
              <ChevronDown className="size-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-48">
            <DropdownMenuLabel>Format canvas</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={format} onValueChange={(v) => onFormat(v as Carousel["format"])}>
              {(Object.keys(FORMAT_LABEL) as Carousel["format"][]).map((f) => (
                <DropdownMenuRadioItem key={f} value={f}>{FORMAT_LABEL[f]}</DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center justify-end gap-3">
        {aiElsewhere.length > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="secondary" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => onOpenProject?.(aiElsewhere[0])}>
                <Loader2 className="size-3.5 animate-spin" />
                <Sparkles className="size-3.5" />
                AI di {aiElsewhere[0]}{aiElsewhere.length > 1 ? ` +${aiElsewhere.length - 1}` : ""}
              </Button>
            </TooltipTrigger>
            <TooltipContent>AI masih bekerja di project lain. Klik untuk membuka.</TooltipContent>
          </Tooltip>
        )}
        <SaveStatus status={status} error={error} />
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Button variant="outline" size="sm" className="h-8 gap-1.5" disabled={!canPreview} onClick={onPreview}>
                <Play className="size-3.5" /> Preview
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Preview swipe layar penuh (P)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Button size="sm" className="h-8 gap-1.5" disabled={!canPreview} onClick={onPresent}>
                <Presentation className="size-3.5" /> Presentasi
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Mode presentasi layar penuh (⇧P)</TooltipContent>
        </Tooltip>
        <ShortcutsButton />
        <ThemeToggle />
      </div>
    </header>
  );
}
