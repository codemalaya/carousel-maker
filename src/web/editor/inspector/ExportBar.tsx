import { CircleDot, FileArchive, Sparkles, FileCode, FileImage, FileText, Film, Images, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ExportOpts } from "@/shared/api";

type ExportBarProps = {
  hasSlide: boolean;
  /** which format is rendering right now, if any */
  exporting: ExportOpts["format"] | null;
  scale: number;
  onScale: (n: number) => void;
  onExport: (o: ExportOpts) => void;
  onCaption: () => void;
  onMockup: () => void;
  onPinPhoto: () => void;
};

const FORMATS = [
  { format: "png", label: "PNG", icon: FileImage, tip: "Slide ini sebagai PNG" },
  { format: "zip", label: "ZIP", icon: FileArchive, tip: "Semua slide sebagai PNG dalam ZIP" },
  { format: "pdf", label: "PDF", icon: FileText, tip: "Semua slide sebagai satu PDF" },
  { format: "html", label: "HTML", icon: FileCode, tip: "Satu file HTML untuk presentasi di browser, lengkap dengan animasi" },
  { format: "mp4", label: "MP4", icon: Film, tip: "Video semua slide dengan animasi (butuh ffmpeg, bisa memakan waktu)" },
  { format: "gif", label: "GIF", icon: Images, tip: "GIF animasi, lebar 720 px (butuh ffmpeg)" },
] as const;

/** Pinned to the bottom of the inspector. */
export function ExportBar({ hasSlide, exporting, scale, onScale, onExport, onCaption, onMockup, onPinPhoto }: ExportBarProps) {
  return (
    <div className="grid shrink-0 gap-2 border-t p-3">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">Export</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <ToggleGroup
                type="single"
                size="sm"
                variant="outline"
                value={String(scale)}
                onValueChange={(v) => v && onScale(Number(v))} // keep one resolution always selected
              >
                <ToggleGroupItem value="1" aria-label="Resolusi 1x (ukuran slide)" className="h-7 min-w-9 px-2 text-xs">1x</ToggleGroupItem>
                <ToggleGroupItem value="2" aria-label="Resolusi 2x (dua kali ukuran slide)" className="h-7 min-w-9 px-2 text-xs">2x</ToggleGroupItem>
              </ToggleGroup>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">Resolusi PNG: 1x = ukuran slide, 2x = dua kalinya</TooltipContent>
        </Tooltip>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {FORMATS.map(({ format, label, icon: Icon, tip }) => (
          <Tooltip key={format}>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Button
                  variant={format === "pdf" ? "default" : "outline"}
                  size="sm"
                  className="h-8 w-full gap-1.5"
                  disabled={!hasSlide || exporting !== null}
                  onClick={() => onExport({ format })}
                >
                  {exporting === format ? <Loader2 className="size-3.5 animate-spin" /> : <Icon className="size-3.5" />}
                  {label}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">{tip}</TooltipContent>
          </Tooltip>
        ))}
      </div>
      <Button variant="outline" size="sm" className="h-8 gap-1.5" disabled={!hasSlide} onClick={onMockup}>
        <CircleDot className="size-3.5" /> Mockup button pin
      </Button>
      <Button variant="outline" size="sm" className="h-8 gap-1.5" disabled={!hasSlide} onClick={onPinPhoto}>
        <CircleDot className="size-3.5" /> Ganti pin hijau di foto
      </Button>
      <Button variant="ghost" size="sm" className="text-muted-foreground h-7 gap-1.5 text-xs" disabled={!hasSlide} onClick={onCaption}>
        <Sparkles className="size-3.5" /> Buat caption &amp; hashtag
      </Button>
    </div>
  );
}
