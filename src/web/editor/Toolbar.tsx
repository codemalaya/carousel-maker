import { Code2, ImagePlus, Loader2, Redo2, Sparkles, Square, Type, Undo2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl+";

function Tool({ label, children, className, ...props }: { label: string } & React.ComponentProps<typeof Button>) {
  return (
    <Tooltip>
      {/* span wrapper: a disabled <button> swallows pointer events, so it can't trigger the tooltip itself */}
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <Button variant="ghost" size="icon" className={cn("size-9 rounded-full", className)} aria-label={label} {...props}>
            {children}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

type ToolbarProps = {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  hasSlide: boolean;
  onAddElement: (type: "text" | "shape" | "html") => void;
  onPickImage: () => void;
  aiOpen: boolean;
  aiBusy: boolean;
  onToggleAi: () => void;
};

/** Floating pill at the bottom-center of the canvas. */
export function Toolbar(p: ToolbarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Alat editor"
      className="bg-card/95 absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-0.5 rounded-full border p-1 shadow-lg backdrop-blur"
    >
      <Tool label={`Undo (${mod}Z)`} disabled={!p.canUndo} onClick={p.onUndo}>
        <Undo2 />
      </Tool>
      <Tool label={`Redo (${mod}⇧Z)`} disabled={!p.canRedo} onClick={p.onRedo}>
        <Redo2 />
      </Tool>
      <Separator orientation="vertical" className="mx-1 h-5" />
      <Tool label="Tambah teks" disabled={!p.hasSlide} onClick={() => p.onAddElement("text")}>
        <Type />
      </Tool>
      <Tool label="Tambah bentuk" disabled={!p.hasSlide} onClick={() => p.onAddElement("shape")}>
        <Square />
      </Tool>
      <Tool label="Tambah HTML / SVG" disabled={!p.hasSlide} onClick={() => p.onAddElement("html")}>
        <Code2 />
      </Tool>
      <Tool label="Upload gambar (atau drag ke kanvas)" disabled={!p.hasSlide} onClick={p.onPickImage}>
        <ImagePlus />
      </Tool>
      <Separator orientation="vertical" className="mx-1 h-5" />
      <Tool label={p.aiBusy ? "AI sedang bekerja…" : "Minta AI"} aria-pressed={p.aiOpen} className={p.aiOpen ? "bg-accent" : ""} onClick={p.onToggleAi}>
        {p.aiBusy ? <Loader2 className="animate-spin" /> : <Sparkles />}
      </Tool>
    </div>
  );
}
