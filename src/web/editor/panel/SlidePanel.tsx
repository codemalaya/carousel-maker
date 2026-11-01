import { useLayoutEffect, useRef, useState } from "react";
import { Copy, GalleryVertical, List, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { FORMATS } from "../../../core/schema";
import { Input } from "@/components/ui/input";
import { IconButton } from "@/shared/IconButton";
import { ProjectMenu, type ProjectMenuProps } from "@/editor/panel/ProjectMenu";
import { SlideView } from "@/shared/SlideView";
import { SortableItem, SortableList, followIndex } from "@/shared/Sortable";
import { NAME_MAX, autoTitle, slideTitle } from "@/shared/slideTitle";
import type { Editor } from "@/editor/useEditor";

type View = "thumbs" | "list";
const VIEW_KEY = "carousel-slide-view";

export function SlidePanel({ ed, project, projects, onSwitch, onProjectAction, onHome, cur, setCur, setSel }: {
  ed: Editor;
  project: string;
  projects: ProjectMenuProps["projects"];
  onSwitch: ProjectMenuProps["onSwitch"];
  onProjectAction: ProjectMenuProps["onProjectAction"];
  onHome: ProjectMenuProps["onHome"];
  cur: number;
  setCur: (i: number) => void;
  setSel: (i: number | null) => void;
}) {
  const doc = ed.doc!;
  const n = doc.slides.length;
  const [view, setViewState] = useState<View>(() => (localStorage.getItem(VIEW_KEY) === "list" ? "list" : "thumbs"));
  const setView = (v: View) => {
    setViewState(v);
    localStorage.setItem(VIEW_KEY, v);
  };

  const [editing, setEditing] = useState<number | null>(null); // list row being renamed
  const skipBlur = useRef(false); // Esc/Enter already settled it; don't commit again on blur

  // thumbnails fill the panel width (minus padding), so resizing the panel resizes them
  const nav = useRef<HTMLElement>(null);
  const [scale, setScale] = useState(0.2);
  useLayoutEffect(() => {
    const el = nav.current!;
    const fit = () => setScale(Math.max(0.05, (el.clientWidth - 32) / FORMATS[doc.format].width));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [doc.format]);

  const move = (from: number, to: number) => {
    ed.mutate((d) => {
      const [s] = d.slides.splice(from, 1);
      d.slides.splice(to, 0, s);
    });
    setCur(followIndex(cur, from, to) ?? 0); // keep the open slide open
  };
  const add = () => {
    const at = n ? cur + 1 : 0;
    ed.mutate((d) => {
      d.slides.splice(at, 0, { bg: "#ffffff", elements: [] } as never);
    });
    setCur(at);
    setSel(null);
  };
  const rename = (i: number, value: string) => {
    const name = value.trim().slice(0, NAME_MAX);
    if ((doc.slides[i].name ?? "") === name) return; // nothing changed: no undo step
    ed.mutate((d) => {
      if (name) d.slides[i].name = name;
      else delete d.slides[i].name; // empty = back to the automatic title
    });
  };
  const duplicate = () => {
    ed.mutate((d) => {
      const copy = structuredClone(d.slides[cur]);
      if (copy.name) copy.name = `${copy.name} (salinan)`.slice(0, NAME_MAX);
      d.slides.splice(cur + 1, 0, copy);
    });
    setCur(cur + 1);
    setSel(null);
  };
  const remove = () => {
    ed.mutate((d) => {
      d.slides.splice(cur, 1);
    });
    setSel(null);
  };

  return (
    <nav ref={nav} className="slides">
      <div className="shrink-0 border-b p-3">
        <ProjectMenu project={project} projects={projects} onSwitch={onSwitch} onProjectAction={onProjectAction} onHome={onHome} />
      </div>
      <div className="flex shrink-0 items-center justify-between border-b py-1.5 pr-2 pl-4">
        <span className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">Slide ({n})</span>
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          value={view}
          onValueChange={(v) => v && setView(v as View)} // clicking the active item would otherwise clear it
        >
          {([["thumbs", GalleryVertical, "Tampilan thumbnail"], ["list", List, "Tampilan list"]] as const).map(([v, Icon, tip]) => (
            <Tooltip key={v}>
              <TooltipTrigger asChild>
                <ToggleGroupItem value={v} aria-label={tip} className="size-7 min-w-7 px-0">
                  <Icon className="size-3.5" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>{tip}</TooltipContent>
            </Tooltip>
          ))}
        </ToggleGroup>
      </div>

      {/* only the list scrolls; the action bar below stays pinned */}
      <div className={cn("no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto", view === "thumbs" ? "gap-4 p-4" : "gap-0.5 p-2")}>
        <SortableList ids={doc.slides.map((_, i) => String(i))} onMove={move}>
          {doc.slides.map((slide, i) => {
            const title = slideTitle(slide, i);
            return view === "thumbs" ? (
              <SortableItem
                key={i}
                id={String(i)}
                aria-label={`Slide ${i + 1}`}
                title={slide.name?.trim() || undefined}
                className={cn(
                  "cursor-grab shrink-0 overflow-hidden rounded-md shadow-sm outline-2 outline-offset-4 outline-transparent ring-1 ring-black/10 active:cursor-grabbing dark:ring-white/15",
                  i === cur && "outline-brand",
                )}
                onClick={() => {
                  setCur(i);
                  setSel(null);
                }}
              >
                <SlideView doc={doc} project={project} index={i} scale={scale} />
                <span className="absolute top-1.5 left-1.5 rounded bg-black/65 px-1 text-[11px] text-white">{i + 1}</span>
              </SortableItem>
            ) : (
              <SortableItem
                key={i}
                id={String(i)}
                aria-label={`Slide ${i + 1}`}
                className={cn(
                  "flex shrink-0 cursor-grab items-center gap-2 rounded-md px-2 py-1.5 text-xs active:cursor-grabbing",
                  i === cur ? "bg-brand/25" : "hover:bg-accent",
                )}
                title="Klik ganda untuk ganti nama"
                onClick={() => {
                  setCur(i);
                  setSel(null);
                }}
                onDoubleClick={() => setEditing(i)}
              >
                <span className="bg-muted text-muted-foreground flex size-5 shrink-0 items-center justify-center rounded text-[11px]">{i + 1}</span>
                {editing === i ? (
                  <Input
                    autoFocus
                    defaultValue={slide.name ?? ""}
                    placeholder={autoTitle(slide, i)}
                    maxLength={NAME_MAX}
                    aria-label={`Nama slide ${i + 1}`}
                    className="h-6 min-w-0 flex-1 px-1.5 text-xs"
                    onFocus={(e) => {
                      skipBlur.current = false; // a previous Esc/Enter unmounted the input before its blur ran
                      e.currentTarget.select();
                    }}
                    // the row is draggable and listens for Space/Enter: keep typing and clicks inside the input
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter") {
                        skipBlur.current = true;
                        rename(i, e.currentTarget.value);
                        setEditing(null);
                      } else if (e.key === "Escape") {
                        skipBlur.current = true;
                        setEditing(null);
                      }
                    }}
                    onBlur={(e) => {
                      if (!skipBlur.current) rename(i, e.currentTarget.value);
                      skipBlur.current = false;
                      setEditing(null);
                    }}
                  />
                ) : (
                  <span className={cn("min-w-0 flex-1 truncate", !title.named && "text-foreground/65")}>{title.title}</span>
                )}
                <span className="text-muted-foreground shrink-0 text-[11px]">{slide.elements.length}</span>
              </SortableItem>
            );
          })}
        </SortableList>
      </div>

      <div className="flex shrink-0 items-center gap-1 border-t p-2">
        <Button variant="outline" size="sm" className="h-8 flex-1 gap-1" onClick={add}>
          <Plus className="size-4" /> Slide
        </Button>
        <IconButton label="Salin slide" disabled={!n} onClick={duplicate}>
          <Copy />
        </IconButton>
        <IconButton label="Hapus slide" disabled={!n} onClick={remove} className="size-8 hover:text-destructive">
          <Trash2 />
        </IconButton>
      </div>
    </nav>
  );
}
