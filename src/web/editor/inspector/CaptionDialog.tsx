import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CaptionGenerator } from "@/shared/CaptionGenerator";
import { PLATFORM_LABEL } from "@/pages/planner/planMeta";

/** Editor side of the caption agent: pick a variant to copy "caption + hashtags" to the clipboard. */
export function CaptionDialog({ open, onOpenChange, project }: { open: boolean; onOpenChange: (o: boolean) => void; project: string }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Caption untuk carousel ini</DialogTitle>
          <DialogDescription>AI membaca slide project ini (hanya membaca, tidak mengubah apa pun) lalu menulis caption dan hashtag. Pilih satu untuk disalin.</DialogDescription>
        </DialogHeader>
        <CaptionGenerator
          project={project}
          pickLabel="Salin"
          onPick={async (v, platform) => {
            try {
              await navigator.clipboard.writeText(v.hashtags ? `${v.caption}\n\n${v.hashtags}` : v.caption);
              toast.success(`Caption ${PLATFORM_LABEL[platform]} disalin`);
            } catch {
              toast.error("Clipboard ditolak browser. Pilih teksnya lalu salin manual.");
            }
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
