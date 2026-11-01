import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, useBrands } from "@/shared/api";
import { useDialogs, validateProjectId } from "@/app/dialogs";
import type { Editor } from "@/editor/useEditor";
import { errMsg } from "@/editor/inspector/fields";

/** Copy a saved brand into this project (palette/fonts merge, css+brief in marked blocks, logo to assets), or save this project's look as a brand. */
export function BrandRow({ ed, project, current }: { ed: Editor; project: string; current?: string }) {
  const { ask } = useDialogs();
  const { brands, refresh } = useBrands();
  const [pick, setPick] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const chosen = pick || current || "";

  const apply = async () => {
    if (!chosen) return;
    setBusy(true);
    try {
      await ed.flush(); // unsaved edits first, the editor picks the new file up on its next poll
      const r = await api.applyBrand(project, chosen);
      toast.success(`Brand "${chosen}" diterapkan`, { description: `${r.palette.length} warna, ${r.fonts.length} font${r.logo ? ", logo → " + r.logo : ""}` });
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    const id = await ask({
      title: "Simpan sebagai brand",
      label: "ID brand (palette, font, dan css project ini diambil)",
      initial: project,
      confirmText: "Simpan",
      validate: (v) => validateProjectId(v) ?? (brands?.some((b) => b.id.toLowerCase() === v.toLowerCase()) ? `"${v}" sudah ada` : null),
    });
    if (!id) return;
    try {
      await ed.flush();
      await api.createBrand(id, { name: id, fromProject: project });
      await refresh();
      setPick(id);
      toast.success(`Brand "${id}" disimpan`, { description: "Atur logo dan brief-nya di halaman Brand (Home)." });
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div className="grid gap-2 rounded-md border p-2">
      <span className="text-muted-foreground text-[10px] tracking-wide uppercase">Brand kit{current ? ` · dari "${current}"` : ""}</span>
      <div className="flex items-center gap-1.5">
        <Select value={chosen} onValueChange={setPick} disabled={!brands?.length}>
          <SelectTrigger size="sm" className="h-7 min-w-0 flex-1 text-xs">
            <SelectValue placeholder={brands?.length ? "Pilih brand…" : "Belum ada brand"} />
          </SelectTrigger>
          <SelectContent>
            {brands?.map((b) => <SelectItem key={b.id} value={b.id} className="text-xs">{b.name || b.id}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" className="h-7 text-xs" disabled={!chosen || busy} onClick={apply}>{current && current === chosen ? "Sinkron" : "Terapkan"}</Button>
      </div>
      <Button variant="ghost" size="sm" className="h-7 justify-start text-xs" onClick={save}>Simpan project ini sebagai brand…</Button>
    </div>
  );
}
