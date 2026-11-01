import { useEffect, useRef, useState } from "react";
import { FileText, ImagePlus, Lightbulb, Palette, Pencil, Plus, RefreshCw, Trash2, Type, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { Brand } from "../../../core/schema";
import { api, brandLogoUrl, useBrands, type BrandInfo, type ProjectInfo } from "@/shared/api";
import { useDialogs, validateProjectId } from "@/app/dialogs";
import { ago } from "@/shared/format";
import { PageHeader } from "@/shared/PageHeader";
import { NoBrandsArt } from "@/shared/PlanBrandArt";
import { ThemeToggle } from "@/app/ThemeToggle";

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const NONE = "__none";

/** Small color dots for a brand's palette. */
export function Swatches({ colors, className }: { colors: string[]; className?: string }) {
  return (
    <span className={`flex items-center ${className ?? ""}`} aria-hidden>
      {colors.slice(0, 8).map((c, i) => (
        <span key={i} className="-ml-1 size-5 rounded-full border border-black/15 first:ml-0 dark:border-white/25" style={{ background: c }} />
      ))}
    </span>
  );
}

/** Editable list of name -> value rows (palette, fonts). Rows are kept in an array so renaming a key never reorders or merges them. */
function PairRows({ rows, onChange, keyPlaceholder, valuePlaceholder, color }: {
  rows: [string, string][];
  onChange: (rows: [string, string][]) => void;
  keyPlaceholder: string;
  valuePlaceholder: string;
  color?: boolean;
}) {
  const set = (i: number, j: 0 | 1, v: string) => onChange(rows.map((r, k) => (k === i ? (j === 0 ? [v, r[1]] : [r[0], v]) : r)) as [string, string][]);
  return (
    <div className="grid gap-1.5">
      {rows.map(([k, v], i) => (
        <div key={i} className="flex items-center gap-1.5">
          {color && (
            <input
              type="color"
              aria-label={`Pilih warna ${k || i + 1}`}
              className="size-8 shrink-0 cursor-pointer rounded border bg-transparent p-0.5"
              value={/^#[0-9a-f]{6}$/i.test(v) ? v : "#000000"}
              onChange={(e) => set(i, 1, e.target.value)}
            />
          )}
          <Input className="h-8 w-28 shrink-0 text-xs" aria-label="Nama" placeholder={keyPlaceholder} value={k} onChange={(e) => set(i, 0, e.target.value.replace(/[^\w-]/g, ""))} />
          <Input className="h-8 min-w-0 flex-1 text-xs" aria-label="Nilai" placeholder={valuePlaceholder} value={v} onChange={(e) => set(i, 1, e.target.value)} />
          <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0" aria-label="Hapus baris" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
            <X className="size-3.5" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="h-7 w-fit gap-1 text-xs" onClick={() => onChange([...rows, ["", color ? "#000000" : ""]])}>
        <Plus className="size-3" /> Tambah
      </Button>
    </div>
  );
}

const toRows = (r: Record<string, string>): [string, string][] => Object.entries(r);
const fromRows = (rows: [string, string][]) => Object.fromEntries(rows.filter(([k]) => k.trim()));

function BrandEditor({ id, onClose, onSaved }: { id: string; onClose: () => void; onSaved: () => void }) {
  const [brand, setBrand] = useState<Brand | null>(null);
  const [palette, setPalette] = useState<[string, string][]>([]);
  const [fonts, setFonts] = useState<[string, string][]>([]);
  const [logoV, setLogoV] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    api.brand(id).then(
      (b) => { if (live) { setBrand(b); setPalette(toRows(b.palette)); setFonts(toRows(b.fonts)); } },
      (e) => { toast.error(errMsg(e)); onClose(); },
    );
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const patch = (p: Partial<Brand>) => setBrand((b) => (b ? { ...b, ...p } : b));

  const save = async () => {
    if (!brand) return;
    setBusy(true);
    try {
      await api.saveBrand(id, { ...brand, palette: fromRows(palette), fonts: fromRows(fonts) });
      toast.success("Brand disimpan");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const upload = async (f: File | undefined) => {
    if (!f) return;
    try {
      const { logo } = await api.uploadBrandLogo(id, f);
      patch({ logo });
      setLogoV(Date.now());
      onSaved();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit brand "{id}"</DialogTitle>
        </DialogHeader>
        {!brand ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <div className="grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="b-name">Nama</Label>
              <Input id="b-name" value={brand.name} maxLength={80} onChange={(e) => patch({ name: e.target.value })} />
            </div>

            <div className="grid gap-2">
              <Label>Logo</Label>
              <div className="flex items-center gap-3">
                <div className="bg-canvas grid size-16 place-items-center overflow-hidden rounded-lg border">
                  {brand.logo ? <img src={brandLogoUrl(id, logoV)} alt="Logo brand" className="max-h-full max-w-full object-contain" /> : <span className="text-muted-foreground text-[10px]">Belum ada</span>}
                </div>
                <input ref={picker} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => picker.current?.click()}>
                  <ImagePlus className="size-3.5" /> {brand.logo ? "Ganti logo" : "Upload logo"}
                </Button>
                <span className="text-muted-foreground text-xs">PNG, JPG, WebP atau SVG, maks 5 MB. Langsung tersimpan.</span>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Palette <span className="text-muted-foreground font-normal">(dipakai sebagai {"{nama}"} di slide)</span></Label>
              <PairRows rows={palette} onChange={setPalette} keyPlaceholder="ink" valuePlaceholder="#111111" color />
            </div>

            <div className="grid gap-2">
              <Label>Font</Label>
              <PairRows rows={fonts} onChange={setFonts} keyPlaceholder="sans" valuePlaceholder="'Helvetica Neue', Arial, sans-serif" />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="b-css">CSS tambahan <span className="text-muted-foreground font-normal">(mis. @import font web)</span></Label>
              <Textarea id="b-css" className="font-mono text-xs" rows={3} spellCheck={false} value={brand.css} onChange={(e) => patch({ css: e.target.value })} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="b-brief">Brief untuk agent <span className="text-muted-foreground font-normal">(gaya, aturan tipografi, letak logo)</span></Label>
              <Textarea id="b-brief" className="text-sm" rows={4} value={brand.brief} placeholder="Judul HURUF BESAR, logo di pojok kiri atas tiap slide, tone santai…" onChange={(e) => patch({ brief: e.target.value })} />
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>Batal</Button>
              <Button type="button" disabled={busy} onClick={save}>Simpan</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function NewBrandDialog({ projects, onClose, onCreated }: { projects: ProjectInfo[]; onClose: () => void; onCreated: (id: string) => void }) {
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [from, setFrom] = useState(NONE);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const bid = id.trim();
    const err = !bid ? "Wajib diisi" : validateProjectId(bid);
    if (err) return setError(err);
    setBusy(true);
    try {
      await api.createBrand(bid, { name: name.trim() || bid, fromProject: from === NONE ? undefined : from });
      onCreated(bid);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>Brand baru</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="nb-id">ID brand</Label>
            <Input id="nb-id" autoFocus value={id} aria-invalid={!!error} onChange={(e) => { setId(e.target.value); setError(""); }} />
            {error && <p className="text-destructive text-xs">{error}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="nb-name">Nama tampilan</Label>
            <Input id="nb-name" value={name} maxLength={80} placeholder={id || "mis. Toko Kopi Senja"} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Mulai dari</Label>
            <Select value={from} onValueChange={setFrom}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Kosong</SelectItem>
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>Ambil palette & font dari "{p.id}"</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Batal</Button>
            <Button type="submit" disabled={busy}>Buat</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BrandCard({ b, onEdit, onDelete }: { b: BrandInfo; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="bg-card flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-start gap-3">
        <div className="bg-canvas grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg border">
          {b.logo ? <img src={brandLogoUrl(b.id, b.updated)} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-muted-foreground text-xl font-semibold">{(b.name || b.id).slice(0, 1).toUpperCase()}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium" title={b.id}>{b.name || b.id}</div>
          <div className="text-muted-foreground truncate text-xs">{b.id} · diubah {ago(b.updated)}</div>
        </div>
      </div>
      {b.colors.length > 0 ? <Swatches colors={b.colors} /> : <span className="text-muted-foreground text-xs">Belum ada warna</span>}
      <div className="mt-auto flex gap-1.5">
        <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={onEdit}><Pencil className="size-3.5" /> Edit</Button>
        <Button variant="ghost" size="icon" className="hover:text-destructive size-8" aria-label={`Hapus brand ${b.id}`} title="Hapus (dipindah ke brands/.trash)" onClick={onDelete}>
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}

/** Brand kits: palette, fonts, css, brief and logo that can be copied into any project (`?brands=1`). */
export function Brands({ projects }: { projects: ProjectInfo[] }) {
  const { confirm } = useDialogs();
  const { brands, refresh } = useBrands();
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const remove = async (b: BrandInfo) => {
    if (!(await confirm({
      title: `Hapus brand "${b.name || b.id}"?`,
      description: "Brand dipindahkan ke brands/.trash. Project yang sudah memakainya tidak berubah (tokens-nya sudah tersalin).",
      confirmText: "Hapus",
      destructive: true,
    }))) return;
    try {
      await api.deleteBrand(b.id);
      await refresh();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const panel = "bg-card rounded-2xl border p-4";

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Brand kit">
        <ThemeToggle />
      </PageHeader>

      <div className="flex min-h-0 flex-1">
        <div className="no-scrollbar min-w-0 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-6 px-8 pt-10 pb-8">
            <section>
              <p className="text-brand text-sm font-medium">Tampilan yang konsisten</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">Satu brand, semua carousel</h1>
              <p className="text-muted-foreground mt-1 text-sm">Simpan warna, font, logo, dan arahan gaya sekali, lalu terapkan ke project mana pun.</p>
            </section>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Semua brand</h2>
              <Button className="h-9 gap-1.5" onClick={() => setCreating(true)}><Plus className="size-4" /> Brand baru</Button>
            </div>

            {brands === null ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-36 w-full rounded-lg" />)}</div>
            ) : brands.length === 0 ? (
              <div className="grid place-items-center gap-1 rounded-lg border border-dashed bg-muted/50 py-16 text-center">
                <NoBrandsArt className="mb-2 w-52" />
                <p className="text-lg font-semibold">Belum ada brand</p>
                <p className="text-muted-foreground max-w-sm text-sm">Cara tercepat: buat brand dari project yang tampilannya sudah kamu suka. Palette dan fontnya langsung terambil.</p>
                <Button className="mt-3 gap-1.5" onClick={() => setCreating(true)}><Plus className="size-4" /> Brand baru</Button>
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
                {brands.map((b) => <BrandCard key={b.id} b={b} onEdit={() => setEditing(b.id)} onDelete={() => remove(b)} />)}
              </div>
            )}
          </div>
        </div>

        <div className="no-scrollbar hidden w-80 shrink-0 flex-col gap-4 overflow-y-auto px-4 pt-[148px] pb-8 xl:flex [&>*]:shrink-0">
          <section className={panel}>
            <h3 className="flex items-center gap-2 text-sm font-medium"><Palette className="text-muted-foreground size-4" /> Isi brand kit</h3>
            <ul className="mt-3 flex flex-col gap-2 text-xs">
              {[[Palette, "Palet warna", "jadi {token} di slide"], [Type, "Font", "nama font siap pakai"], [ImagePlus, "Logo", "disalin ke assets project"], [FileText, "CSS dan arahan gaya", "dibaca agent AI"]].map(([Icon, name, hint]) => {
                const I = Icon as typeof Palette;
                return (
                  <li key={name as string} className="flex items-center gap-2.5">
                    <span className="bg-muted grid size-7 shrink-0 place-items-center rounded-lg"><I className="size-3.5" /></span>
                    <span><span className="font-medium">{name as string}</span> <span className="text-muted-foreground">· {hint as string}</span></span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className={panel}>
            <h3 className="flex items-center gap-2 text-sm font-medium"><RefreshCw className="text-muted-foreground size-4" /> Cara kerja</h3>
            <ul className="text-muted-foreground mt-3 flex list-disc flex-col gap-1.5 pl-4 text-xs leading-relaxed">
              <li>Menerapkan brand menyalinnya ke project. Slide tidak diubah.</li>
              <li>Setelah mengedit brand, klik "Sinkron" di Inspector project untuk memperbarui.</li>
              <li>Menghapus brand memindahkannya ke brands/.trash.</li>
            </ul>
          </section>

          <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 via-rose-500 to-fuchsia-600 p-5 text-white">
            <span className="pointer-events-none absolute -top-12 -right-12 size-40 rounded-full bg-white/10" aria-hidden />
            <span className="pointer-events-none absolute -bottom-16 -left-10 size-44 rounded-full bg-black/10" aria-hidden />
            <h3 className="relative flex items-center gap-2 text-base font-semibold"><Lightbulb className="size-4" /> Tips</h3>
            <ul className="relative mt-3 flex list-disc flex-col gap-1.5 pl-4 text-xs leading-relaxed text-white/90 marker:text-white/60">
              <li>Cara tercepat: buat brand dari project yang tampilannya sudah kamu suka.</li>
              <li>Pilih brand saat membuat project atau di kotak AI di Home. Agent langsung memakai token-nya.</li>
              <li>Tulis aturan pemakaian logo di arahan gaya supaya agent mengikutinya.</li>
            </ul>
          </section>
        </div>
      </div>

      {creating && (
        <NewBrandDialog
          projects={projects}
          onClose={() => setCreating(false)}
          onCreated={async (id) => { setCreating(false); await refresh(); setEditing(id); }}
        />
      )}
      {editing && <BrandEditor key={editing} id={editing} onClose={() => setEditing(null)} onSaved={() => { refresh(); }} />}
    </div>
  );
}
