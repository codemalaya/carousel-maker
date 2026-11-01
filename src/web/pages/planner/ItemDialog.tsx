import { useState } from "react";
import { ExternalLink, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { PLAN_STATUS, PLATFORMS, type Carousel, type PlanItem } from "../../../core/schema";
import { slug, uniqueId } from "@/pages/home/AiCreate";
import { api, useBrands, type ProjectInfo } from "@/shared/api";
import { PLATFORM_LABEL, STATUS_DOT, STATUS_LABEL } from "@/pages/planner/planMeta";
import { useDialogs } from "@/app/dialogs";
import { CaptionGenerator } from "@/shared/CaptionGenerator";
import { normalizeTags } from "../../../core/caption";
import { type Status, type Platform, type Format, errMsg, NONE, FORMAT_IDS } from "@/pages/planner/planUtils";

export function ItemDialog({ item, projects, onClose, onSaved, onRemoved, onOpenProject }: {
  /** Existing item, or a draft for a new one (no id) */
  item: Omit<PlanItem, "id"> & { id?: string };
  projects: ProjectInfo[];
  onClose: () => void;
  onSaved: () => Promise<unknown>;
  onRemoved: () => Promise<unknown>;
  onOpenProject: (id: string) => void;
}) {
  const { confirm } = useDialogs();
  const { brands } = useBrands();
  const [f, setF] = useState(item);
  const [busy, setBusy] = useState(false);
  const [capOpen, setCapOpen] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((cur) => ({ ...cur, [k]: v }));
  const linked = projects.find((p) => p.id === f.project);
  const body = () => ({ ...f, project: f.project ?? "", brand: f.brand ?? "", format: f.format ?? "" });

  const save = async (close = true) => {
    if (!f.title.trim() && !f.project) return toast.error("Isi judul atau tautkan project");
    setBusy(true);
    try {
      const saved = f.id ? await api.updatePlan(f.id, body()) : await api.createPlan(body() as never);
      await onSaved();
      if (close) onClose();
      return saved;
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!f.id) return;
    if (!(await confirm({ title: "Hapus dari rencana?", description: "Item dipindahkan ke planner.trash.json. Project yang tertaut tidak ikut terhapus.", confirmText: "Hapus", destructive: true }))) return;
    try {
      await api.deletePlan(f.id);
      await onRemoved();
      onClose();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  /** Idea -> real project: made in the slot's format with its brand, the idea and caption go into the brief, and the slot becomes a draft. */
  const makeCarousel = async () => {
    const title = f.title.trim();
    if (!title) return toast.error("Isi judul dulu");
    setBusy(true);
    try {
      const id = uniqueId(slug(title), projects);
      await api.create(id, undefined, f.format ?? "4:5");
      if (f.brand) await api.applyBrand(id, f.brand);
      await api.setTitle(id, title.slice(0, 60));
      const spec = (await (await fetch(`/api/projects/${encodeURIComponent(id)}`)).json()) as Carousel;
      const note = [`Topik: ${title}`, f.caption.trim() && `Caption rencana:\n${f.caption.trim()}`, `Platform: ${PLATFORM_LABEL[f.platform]}`].filter(Boolean).join("\n");
      await api.saveSpec(id, { ...spec, brief: [note, spec.brief].filter(Boolean).join("\n\n") });
      const next = { ...f, project: id, status: f.status === "ide" ? ("draft" as const) : f.status };
      if (f.id) await api.updatePlan(f.id, { ...next, brand: next.brand ?? "", format: next.format ?? "" });
      else await api.createPlan(next);
      await onSaved();
      onClose();
      onOpenProject(id);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={(e) => { e.preventDefault(); save(); }} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{item.id ? "Ubah rencana" : "Rencana baru"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-1.5">
            <Label htmlFor="pl-title">Judul / ide</Label>
            <Input id="pl-title" autoFocus value={f.title} maxLength={120} onChange={(e) => set("title", e.target.value)} />
          </div>

          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="pl-date">Tanggal</Label>
              <Input id="pl-date" type="date" required value={f.date} onChange={(e) => e.target.value && set("date", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pl-time">Jam</Label>
              <Input id="pl-time" type="time" required value={f.time} onChange={(e) => e.target.value && set("time", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Platform</Label>
              <Select value={f.platform} onValueChange={(v) => set("platform", v as Platform)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{PLATFORMS.map((p) => <SelectItem key={p} value={p}>{PLATFORM_LABEL[p]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select value={f.status} onValueChange={(v) => set("status", v as Status)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLAN_STATUS.map((s) => (
                    <SelectItem key={s} value={s}><span className={cn("mr-1.5 inline-block size-2 rounded-full", STATUS_DOT[s])} />{STATUS_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Project</Label>
            <Select value={f.project ?? NONE} onValueChange={(v) => set("project", v === NONE ? undefined : v)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Belum ada (ide)</SelectItem>
                {f.project && !linked && <SelectItem value={f.project}>{f.project} (sudah tidak ada)</SelectItem>}
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.title || p.id} ({p.slides} slide)</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {!f.project && (
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Format carousel</Label>
                <Select value={f.format ?? "4:5"} onValueChange={(v) => set("format", v as Format)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{FORMAT_IDS.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {!!brands?.length && (
                <div className="grid gap-1.5">
                  <Label>Brand kit</Label>
                  <Select value={f.brand ?? NONE} onValueChange={(v) => set("brand", v === NONE ? undefined : v)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Tanpa brand</SelectItem>
                      {brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name || b.id}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="pl-cap">Caption</Label>
              {f.project && linked && (
                <Button type="button" variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs" aria-expanded={capOpen} onClick={() => setCapOpen((o) => !o)}>
                  <Sparkles className="size-3.5" /> Buat caption dengan AI
                </Button>
              )}
            </div>
            {capOpen && f.project && (
              <div className="bg-card rounded-lg border p-3">
                <CaptionGenerator
                  project={f.project}
                  platform={f.platform}
                  pickLabel="Pakai"
                  onPick={(v) => {
                    setF((cur) => ({ ...cur, caption: v.caption, hashtags: normalizeTags(v.hashtags).slice(0, 1000) }));
                    setCapOpen(false);
                    toast.success("Caption dan hashtag diisi. Periksa lalu simpan.");
                  }}
                />
              </div>
            )}
            <Textarea id="pl-cap" rows={4} maxLength={5000} value={f.caption} onChange={(e) => set("caption", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pl-tags">Hashtag</Label>
            <Input id="pl-tags" placeholder="#desain #tips" maxLength={1000} value={f.hashtags} onChange={(e) => set("hashtags", e.target.value)} />
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <div className="flex gap-2">
              {item.id && <Button type="button" variant="outline" className="text-destructive gap-1.5" onClick={remove}><Trash2 className="size-4" /> Hapus</Button>}
              {f.project && linked && <Button type="button" variant="outline" className="gap-1.5" onClick={() => { onClose(); onOpenProject(f.project!); }}><ExternalLink className="size-4" /> Buka project</Button>}
              {!f.project && <Button type="button" variant="outline" className="gap-1.5" disabled={busy} onClick={makeCarousel}><Sparkles className="size-4" /> Buat carousel</Button>}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
              <Button type="submit" disabled={busy}>Simpan</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
