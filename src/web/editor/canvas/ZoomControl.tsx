import { Check, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl+";
const PRESETS = [0.5, 1, 2, 4];

type ZoomControlProps = {
  /** actual scale, 1 = one slide pixel per screen pixel */
  scale: number;
  fit: boolean;
  onStep: (dir: 1 | -1) => void;
  onSet: (zoom: number | null) => void; // null = fit
  rulers: boolean;
  onRulers: (on: boolean) => void;
  guides: boolean;
  onGuides: (on: boolean) => void;
  guideCount: number;
  onClearGuides: () => void;
  snap: boolean;
  onSnap: (on: boolean) => void;
};

/** Floating zoom pill, bottom-right of the canvas. */
export function ZoomControl({ scale, fit, onStep, onSet, rulers, onRulers, guides, onGuides, guideCount, onClearGuides, snap, onSnap }: ZoomControlProps) {
  return (
    <div role="group" aria-label="Zoom" className="bg-card/95 absolute right-4 bottom-4 z-30 flex items-center rounded-full border p-1 shadow-lg backdrop-blur">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8 rounded-full" aria-label="Perkecil" onClick={() => onStep(-1)}>
            <Minus />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">{`Perkecil (${mod}−)`}</TooltipContent>
      </Tooltip>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 min-w-14 rounded-full px-2 text-xs tabular-nums" aria-label="Level zoom">
            {Math.round(scale * 100)}%
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-52">
          <DropdownMenuItem onSelect={() => onSet(null)}>
            <span className="flex-1">Fit</span>
            {fit ? <Check /> : <span className="text-muted-foreground text-xs">{`${mod}0`}</span>}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {PRESETS.map((z) => (
            <DropdownMenuItem key={z} onSelect={() => onSet(z)}>
              <span className="flex-1">{z * 100}%</span>
              {!fit && Math.abs(scale - z) < 0.005 ? <Check /> : z === 1 ? <span className="text-muted-foreground text-xs">{`${mod}1`}</span> : null}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Tampilan</DropdownMenuLabel>
          <DropdownMenuCheckboxItem checked={rulers} onCheckedChange={onRulers}>
            <span className="flex-1">Penggaris</span>
            <span className="text-muted-foreground text-xs">⇧R</span>
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked={guides} onCheckedChange={onGuides}>
            Guide{guideCount ? ` (${guideCount})` : ""}
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked={snap} onCheckedChange={onSnap}>
            <span className="flex-1">Snap ke guide & tepi</span>
            <span className="text-muted-foreground text-xs">{`${mod} = mati`}</span>
          </DropdownMenuCheckboxItem>
          <DropdownMenuItem disabled={!guideCount} onSelect={onClearGuides}>
            Hapus semua guide
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8 rounded-full" aria-label="Perbesar" onClick={() => onStep(1)}>
            <Plus />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">{`Perbesar (${mod}+)`}</TooltipContent>
      </Tooltip>
    </div>
  );
}
