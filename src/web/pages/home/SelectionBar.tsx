import { Download, Loader2, Star, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Floating bar while projects are selected (click a checkbox, or Shift/Cmd/Ctrl+click a card). */
export function SelectionBar({ count, total, allPinned, busy, onPin, onExport, onDelete, onAll, onClear }: {
  count: number;
  total: number;
  allPinned: boolean;
  busy: boolean;
  onPin: () => void;
  onExport: () => void;
  onDelete: () => void;
  onAll: () => void;
  onClear: () => void;
}) {
  return (
    <div
      role="toolbar"
      aria-label="Aksi untuk project terpilih"
      className="bg-card/95 animate-in fade-in slide-in-from-bottom-2 fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full border p-1.5 pl-4 shadow-lg backdrop-blur"
    >
      <span className="mr-2 text-sm font-medium tabular-nums">{count} dipilih</span>
      {count < total && (
        <Button variant="ghost" size="sm" className="h-8 rounded-full text-xs" disabled={busy} onClick={onAll}>Pilih semua</Button>
      )}
      <Button variant="ghost" size="sm" className="h-8 gap-1.5 rounded-full" disabled={busy} onClick={onPin}>
        <Star className="size-4" /> {allPinned ? "Lepas sematan" : "Sematkan"}
      </Button>
      <Button variant="ghost" size="sm" className="h-8 gap-1.5 rounded-full" disabled={busy} onClick={onExport}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Export ZIP
      </Button>
      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive h-8 gap-1.5 rounded-full" disabled={busy} onClick={onDelete}>
        <Trash2 className="size-4" /> Hapus
      </Button>
      <Button variant="ghost" size="icon" className="size-8 rounded-full" aria-label="Batal pilih" title="Batal (Esc)" onClick={onClear}>
        <X className="size-4" />
      </Button>
    </div>
  );
}
