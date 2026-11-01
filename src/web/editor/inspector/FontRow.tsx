import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Type, Unlink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FONT_EXTS, attachFont, fontFaceCss, fontFamilyOf, fontTokenKey } from "../../../core/fontUtil";
import { api, uploadFont } from "@/shared/api";
import type { Editor } from "@/editor/useEditor";
import { errMsg } from "@/editor/inspector/fields";

/** Uploaded fonts of this project: attach (upload), detach, re-attach. Files are never deleted; "Lepas" only removes the @font-face from the spec. */
export function FontRow({ ed, project }: { ed: Editor; project: string }) {
  const doc = ed.doc!;
  const input = useRef<HTMLInputElement>(null);
  const [onDisk, setOnDisk] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(() => api.fonts(project).then(setOnDisk, () => setOnDisk([])), [project]);
  useEffect(() => {
    refresh();
  }, [refresh]);

  const attached = doc.tokens.fontFiles;
  const spare = onDisk.filter((f) => !attached.includes(f));
  // the preview below must work even when no slide is rendered with these fonts yet
  const css = useMemo(() => fontFaceCss([...attached, ...spare], (f) => `/api/projects/${encodeURIComponent(project)}/fonts/${encodeURIComponent(f)}`), [attached, spare, project]);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
        if (!(FONT_EXTS as readonly string[]).includes(ext)) throw new Error(`${file.name}: pilih file ${FONT_EXTS.join(", ")}`);
        const name = await uploadFont(project, file);
        ed.mutate((d) => {
          attachFont(d, name);
        });
        toast.success(`Font "${fontFamilyOf(name)}" dipasang`, { description: `Pakai {${fontTokenKey(name)}} atau fontFamily '${fontFamilyOf(name)}'` });
      }
      await refresh();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const detach = (f: string) =>
    ed.mutate((d) => {
      d.tokens.fontFiles = d.tokens.fontFiles.filter((x) => x !== f);
    });
  const attach = (f: string) =>
    ed.mutate((d) => {
      attachFont(d, f);
    });

  const row = (f: string, action: React.ReactNode) => (
    <li key={f} className="flex items-center gap-2 rounded-md border px-2 py-1.5">
      <span className="w-9 shrink-0 text-lg leading-none" style={{ fontFamily: `'${fontFamilyOf(f)}', sans-serif` }}>Aa</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium" title={f}>{fontFamilyOf(f)}</span>
        <span className="text-muted-foreground block truncate text-[11px]">{`{${fontTokenKey(f)}}`}</span>
      </span>
      {action}
    </li>
  );

  return (
    <div className="mb-3 flex flex-col gap-2">
      <style>{css}</style>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase"><Type className="size-3.5" /> Font sendiri</span>
        <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" disabled={busy} onClick={() => input.current?.click()}>
          <Plus className="size-3.5" /> Unggah
        </Button>
        <input ref={input} type="file" hidden multiple accept={FONT_EXTS.map((e) => `.${e}`).join(",")} onChange={(e) => upload(e.target.files)} />
      </div>
      {attached.length === 0 && spare.length === 0 ? (
        <p className="text-muted-foreground text-[11px] leading-relaxed">Unggah .woff2, .woff, .ttf, atau .otf (maks 5 MB). Nama family = nama file tanpa ekstensi, jadi unggah tiap ketebalan sebagai file sendiri (mis. Poppins-Bold.woff2).</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {attached.map((f) => row(f, <Button variant="ghost" size="icon" className="size-7" aria-label={`Lepas font ${fontFamilyOf(f)}`} title="Lepas dari project (file tetap tersimpan)" onClick={() => detach(f)}><Unlink className="size-3.5" /></Button>))}
          {spare.map((f) => row(f, <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => attach(f)}>Pasang</Button>))}
        </ul>
      )}
      <p className="text-muted-foreground text-[11px] leading-relaxed">Kamu bertanggung jawab atas lisensi font yang diunggah.</p>
    </div>
  );
}
