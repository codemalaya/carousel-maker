import { ChevronDown, Copy, FolderOpen, LayoutGrid, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ProjectInfo } from "@/shared/api";
import { useRunning } from "@/editor/ai/agentRuns";

type ProjectAction = "new" | "dup" | "rename" | "delete";

export type ProjectMenuProps = {
  project: string;
  projects: ProjectInfo[];
  onSwitch: (id: string) => void;
  onProjectAction: (kind: ProjectAction) => void;
  onHome: () => void;
};

const RECENT = 8; // the full list lives on the home page

/** Full-width project switcher; lives at the top of the slide panel (project > slides). */
export function ProjectMenu({ project, projects, onSwitch, onProjectAction, onHome }: ProjectMenuProps) {
  const running = useRunning();
  const recent = [...projects].sort((a, b) => b.updated - a.updated).slice(0, RECENT);
  if (!recent.some((x) => x.id === project)) recent.unshift({ id: project, title: "", slides: 0, format: "4:5", updated: 0 });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 w-full justify-start gap-2 px-2.5" aria-label={`Project: ${project}`}>
          <FolderOpen className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-left font-medium">{projects.find((x) => x.id === project)?.title || project}</span>
          {[...running].some((id) => id !== project) && <span className="bg-brand size-2 shrink-0 animate-pulse rounded-full" title="AI bekerja di project lain" />}
          <ChevronDown className="size-3.5 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel>Terakhir dibuka</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={project} onValueChange={onSwitch}>
          {recent.map((x) => (
            <DropdownMenuRadioItem key={x.id} value={x.id}>
              <span className="flex-1 truncate">{x.title || x.id}</span>
              {running.has(x.id) && <Loader2 className="text-brand ml-2 size-3.5 animate-spin" aria-label="AI bekerja" />}
              <span className="text-muted-foreground ml-3 text-xs">{x.slides} slide</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuItem onSelect={onHome}>
          <LayoutGrid /> Semua project{projects.length > RECENT ? ` (${projects.length})` : ""}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onProjectAction("new")}>
          <Plus /> Project baru…
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onProjectAction("dup")}>
          <Copy /> Salin project…
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onProjectAction("rename")}>
          <Pencil /> Rename…
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => onProjectAction("delete")}>
          <Trash2 /> Hapus project…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
