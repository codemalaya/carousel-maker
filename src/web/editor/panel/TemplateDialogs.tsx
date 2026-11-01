import { useEffect, useMemo, useState } from "react";
import { LayoutTemplate, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { FORMATS, type Carousel } from "../../../core/schema";
import { insertInstance } from "../../../core/templateUtil";
import { useDialogs } from "@/app/dialogs";
import { api, type TemplateInfo } from "@/shared/api";
import { SlideView } from "@/shared/SlideView";
import { useLazyDoc } from "@/shared/useLazyDoc";
import type { Editor } from "@/editor/useEditor";

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const parseTags = (s: string) => [...new Set(s.split(/[,\n]/).map((t) => t.trim().toLowerCase().slice(0, 24)).filter(Boolean))].slice(0, 8);

/** Names the current slide and saves it as a template (images and tokens are copied by the server). */
export function SaveTemplateDialog({ open, onOpenChange, doc, project, index }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  doc: Carousel;
  project: string;
  index: number;
}) {
  const slide = doc.slides[index];
  const [name, setName] = useState("");
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setName(slide?.name?.trim() ?? "");
      setTags("");
    }
  }, [open, slide]);

  const save = async () => {
    if (!slide || !name.trim()) return;
    setBusy(true);
    try {
      await api.saveTemplate({ name: name.trim(), tags: parseTags(tags), project, slide, format: doc.format, tokens: doc.tokens });
      toast.success(`Template "${name.trim()}" disimpan`);
      onOpenChange(false);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          className="flex flex-col gap-4"
        >
          <DialogHeader>
            <DialogTitle>Simpan sebagai template</DialogTitle>
            <DialogDescription>Slide {index + 1} dan gambar yang dipakainya disalin. Template tidak berubah kalau slide ini diedit lagi.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tpl-name">Nama</Label>
            <Input id="tpl-name" autoFocus value={name} maxLength={80} placeholder="mis. Hook besar" onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tpl-tags">Tag (pisahkan dengan koma)</Label>
            <Input id="tpl-tags" value={tags} placeholder="hook, quote, cta" onChange={(e) => setTags(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
            <Button type="submit" disabled={busy || !name.trim()}>Simpan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TemplateCard({ t, onPick, onDelete, disabled }: { t: TemplateInfo; onPick: () => void; onDelete: () => void; disabled: boolean }) {
  const { box, doc, width } = useLazyDoc(`/api/templates/${encodeURIComponent(t.id)}/spec`, t.updated);
  const fmt = FORMATS[t.format];
  return (
    <div className="group bg-card relative flex flex-col overflow-hidden rounded-lg border">
      <button type="button" disabled={disabled} onClick={onPick} className="text-left focus-visible:outline-2 focus-visible:outline-offset-2" aria-label={`Pakai template ${t.name}`}>
        <div ref={box} className="bg-canvas w-full overflow-hidden" style={{ aspectRatio: `${fmt.width} / ${fmt.height}` }}>
          {doc && width > 0 ? <SlideView doc={doc} project={t.id} index={0} scale={width / fmt.width} assetBase={`/api/templates/${encodeURIComponent(t.id)}/assets`} /> : <Skeleton className="size-full rounded-none" />}
        </div>
        <div className="p-2.5">
          <div className="truncate text-sm font-medium" title={t.name}>{t.name}</div>
          <div className="text-muted-foreground mt-0.5 flex flex-wrap gap-x-1.5 text-[11px]">
            <span>{t.format}</span>
            {t.tags.map((g) => <span key={g}>#{g}</span>)}
          </div>
        </div>
      </button>
      <Button
        variant="secondary"
        size="icon"
        disabled={disabled}
        className="absolute top-1.5 right-1.5 size-7 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
        aria-label={`Hapus template ${t.name}`}
        title="Pindahkan ke sampah"
        onClick={onDelete}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}

/** Gallery of saved templates. Picking one copies its images into the project and inserts the slide after the current one (one undo step). */
export function TemplateGallery({ open, onOpenChange, ed, project, cur, onInserted }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  ed: Editor;
  project: string;
  cur: number;
  onInserted: (index: number) => void;
}) {
  const { confirm } = useDialogs();
  const [items, setItems] = useState<TemplateInfo[] | null>(null);
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [sameFormat, setSameFormat] = useState(true);
  const [busy, setBusy] = useState(false);
  const doc = ed.doc!;

  const load = () => api.templates().then(setItems, (e) => { toast.error(errMsg(e)); setItems([]); });
  useEffect(() => {
    if (open) load();
  }, [open]);

  const tags = useMemo(() => [...new Set((items ?? []).flatMap((t) => t.tags))].sort(), [items]);
  const shown = (items ?? []).filter(
    (t) => (!sameFormat || t.format === doc.format) && (!tag || t.tags.includes(tag)) && (!q.trim() || `${t.name} ${t.tags.join(" ")}`.toLowerCase().includes(q.trim().toLowerCase())),
  );

  const pick = async (t: TemplateInfo) => {
    if (t.format !== doc.format && !(await confirm({ title: `Template ${t.format}, project ${doc.format}`, description: "Posisi elemen memakai piksel absolut, jadi mungkin perlu disesuaikan setelah disisipkan.", confirmText: "Sisipkan" }))) return;
    setBusy(true);
    try {
      await ed.flush(); // the server reads the project's assets/tokens: make sure our pending edits are on disk first
      const inst = await api.useTemplate(project, t.id);
      const at = doc.slides.length ? cur + 1 : 0;
      ed.mutate((d) => {
        insertInstance(d, inst, at);
      });
      onInserted(at);
      onOpenChange(false);
      toast.success(`"${inst.name}" disisipkan sebagai slide ${at + 1}`);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (t: TemplateInfo) => {
    if (!(await confirm({ title: `Hapus template "${t.name}"?`, description: "Dipindahkan ke Sampah, bisa dipulihkan dari sana. Project yang sudah memakainya tidak berubah.", confirmText: "Pindahkan ke sampah", destructive: true }))) return;
    try {
      await api.deleteTemplate(t.id);
      await load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-4 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Template slide</DialogTitle>
          <DialogDescription>Pilih satu untuk disisipkan setelah slide yang terbuka. Simpan slide bagus dari menu slide.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-40 flex-1">
            <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari template" aria-label="Cari template" className="pl-8" />
          </div>
          <Button variant={sameFormat ? "default" : "outline"} size="sm" className="h-9" aria-pressed={sameFormat} onClick={() => setSameFormat((v) => !v)}>
            Format {doc.format}
          </Button>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((g) => (
              <button
                key={g}
                type="button"
                aria-pressed={tag === g}
                onClick={() => setTag(tag === g ? null : g)}
                className={cn("rounded-full border px-2.5 py-0.5 text-xs", tag === g ? "bg-brand text-white" : "hover:bg-accent")}
              >
                #{g}
              </button>
            ))}
          </div>
        )}

        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
          {items === null ? (
            <div className="grid grid-cols-3 gap-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="aspect-[4/5] rounded-lg" />)}</div>
          ) : shown.length === 0 ? (
            <div className="bg-muted/50 grid place-items-center gap-1 rounded-lg border border-dashed py-14 text-center">
              <LayoutTemplate className="text-muted-foreground size-8" />
              <p className="font-medium">{items.length === 0 ? "Belum ada template" : "Tidak ada yang cocok"}</p>
              <p className="text-muted-foreground max-w-xs text-sm">
                {items.length === 0 ? "Pilih slide, lalu \"Simpan sebagai template\" di bawah daftar slide." : sameFormat && items.some((t) => t.format !== doc.format) ? `Ada template di format lain: matikan filter Format ${doc.format}.` : "Coba kata kunci atau tag lain."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] items-start gap-3">
              {shown.map((t) => <TemplateCard key={t.id} t={t} disabled={busy} onPick={() => pick(t)} onDelete={() => remove(t)} />)}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
