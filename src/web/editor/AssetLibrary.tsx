import { useEffect, useMemo, useState } from "react";
import { Camera, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Element, FORMATS } from "../../core/schema";
import { SHAPE_PRESETS, svgElement } from "../../core/shapePresets";
import { api, type IconHit, type StockPhoto } from "@/shared/api";
import type { Editor } from "@/editor/useEditor";

type Tab = "ikon" | "bentuk" | "foto";
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const SUGGEST = ["arrow", "check", "star", "heart", "user", "chart", "mail", "phone", "lightbulb", "rocket", "calendar", "map-pin"];

/** Icons (Lucide), ready-made shapes and stock photos (Pexels, only when the server has a key). Picking one inserts it centered on the open slide. */
export function AssetLibrary({ open, onOpenChange, ed, project, cur, onInserted }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  ed: Editor;
  project: string;
  cur: number;
  onInserted: (index: number) => void;
}) {
  const doc = ed.doc!;
  const { width: W, height: H } = FORMATS[doc.format];
  const [tab, setTab] = useState<Tab>("ikon");
  const [stock, setStock] = useState(false); // photo tab only exists when the server has a key (offline mode: icons and shapes still work)
  const [color, setColor] = useState("#111111");
  const palette = useMemo(() => Object.entries(doc.tokens.palette), [doc.tokens.palette]);

  useEffect(() => {
    if (open) api.stockStatus().then((s) => setStock(s.enabled), () => setStock(false));
  }, [open]);

  const insert = (el: unknown) => {
    const at = doc.slides[cur].elements.length;
    ed.mutate((d) => {
      d.slides[cur].elements.push(Element.parse(el));
    });
    onInserted(at);
    onOpenChange(false);
  };

  // icons
  const [q, setQ] = useState("");
  const [icons, setIcons] = useState<IconHit[] | null>(null);
  useEffect(() => {
    if (!open || tab !== "ikon") return;
    let live = true;
    const t = setTimeout(() => api.icons(q.trim()).then((r) => live && setIcons(r), (e) => live && (toast.error(errMsg(e)), setIcons([]))), 200);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [open, tab, q]);

  // photos
  const [pq, setPq] = useState("");
  const [photos, setPhotos] = useState<StockPhoto[]>([]);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const search = async (next: number) => {
    if (!pq.trim()) return;
    setBusy("search");
    try {
      const r = await api.stockSearch(pq.trim(), next);
      setPhotos((cur) => (next === 1 ? r.photos : [...cur, ...r.photos]));
      setPage(r.page);
      setMore(r.hasMore);
      setSearched(true);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(null);
    }
  };
  const pickPhoto = async (p: StockPhoto) => {
    setBusy(p.id);
    try {
      await ed.flush(); // the server saves into the project's assets; our pending edits first
      const r = await api.addStock(project, p.id);
      const k = Math.min((W * 0.8) / r.width, (H * 0.8) / r.height);
      const w = Math.round(r.width * k);
      const h = Math.round(r.height * k);
      insert({ type: "image", src: `assets/${r.name}`, x: Math.round((W - w) / 2), y: Math.round((H - h) / 2), w, h, fit: "cover" });
      toast.success("Foto ditambahkan", { description: `Foto: ${r.credit.photographer} / Pexels. Cantumkan kredit di slide terakhir.` });
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  const tabs: [Tab, string][] = [["ikon", "Ikon"], ["bentuk", "Bentuk"], ...(stock ? ([["foto", "Foto"]] as [Tab, string][]) : [])];
  const active: Tab = tab === "foto" && !stock ? "ikon" : tab;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-4 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Library aset</DialogTitle>
          <DialogDescription>Klik untuk menyisipkan di tengah slide {cur + 1}. Warna ikon dan bentuk bisa diubah lagi di inspector.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-muted flex rounded-md p-0.5" role="tablist">
            {tabs.map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={active === id} onClick={() => setTab(id)} className={cn("rounded px-3 py-1 text-sm", active === id ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                {label}
              </button>
            ))}
          </div>
          {active !== "foto" && (
            <div className="ml-auto flex items-center gap-1.5">
              <span className="text-muted-foreground text-xs">Warna</span>
              {palette.slice(0, 6).map(([k, v]) => (
                <button key={k} type="button" title={`{${k}}`} aria-label={`Warna ${k}`} onClick={() => setColor(`{${k}}`)} className={cn("size-5 rounded-full border", color === `{${k}}` && "ring-brand ring-2 ring-offset-1")} style={{ background: v }} />
              ))}
              <Input value={color} onChange={(e) => setColor(e.target.value)} aria-label="Warna" placeholder="#111111 atau {brand}" className="h-7 w-32 px-2 text-xs" />
            </div>
          )}
        </div>

        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
          {active === "ikon" && (
            <div className="flex flex-col gap-3">
              <div className="relative">
                <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
                <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari ikon (bahasa Inggris): arrow, chart, user…" aria-label="Cari ikon" className="pl-8" />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SUGGEST.map((s) => (
                  <button key={s} type="button" onClick={() => setQ(s)} className="hover:bg-accent rounded-full border px-2.5 py-0.5 text-xs">{s}</button>
                ))}
              </div>
              {icons === null ? (
                <p className="text-muted-foreground py-8 text-center text-sm">Memuat…</p>
              ) : icons.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center text-sm">Tidak ada ikon "{q}". Coba kata Inggris lain.</p>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-2">
                  {icons.map((i) => (
                    <button key={i.name} type="button" title={i.name} aria-label={`Ikon ${i.name}`} onClick={() => insert(svgElement(i.svg, { cx: W / 2, cy: H / 2, size: 240, color }))} className="hover:bg-accent flex flex-col items-center gap-1.5 rounded-lg border p-3">
                      <span className="size-9" dangerouslySetInnerHTML={{ __html: i.svg }} />
                      <span className="text-muted-foreground w-full truncate text-center text-[10px]">{i.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {active === "bentuk" && (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2">
              {SHAPE_PRESETS.map((s) => (
                <button key={s.id} type="button" aria-label={`Bentuk ${s.label}`} onClick={() => insert(svgElement(s.svg, { cx: W / 2, cy: H / 2, size: 360, ratio: s.w / s.h, color }))} className="hover:bg-accent flex flex-col items-center gap-2 rounded-lg border p-4">
                  <span className="flex h-14 w-full items-center justify-center" style={{ color: color.startsWith("{") ? doc.tokens.palette[color.slice(1, -1)] : color }}>
                    <span className="block max-h-full max-w-full" style={{ aspectRatio: `${s.w} / ${s.h}`, height: s.h > s.w ? "100%" : undefined, width: s.h > s.w ? undefined : "70%" }} dangerouslySetInnerHTML={{ __html: s.svg }} />
                  </span>
                  <span className="text-xs">{s.label}</span>
                </button>
              ))}
            </div>
          )}

          {active === "foto" && (
            <div className="flex flex-col gap-3">
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  setPhotos([]);
                  search(1);
                }}
              >
                <div className="relative flex-1">
                  <Camera className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
                  <Input autoFocus value={pq} onChange={(e) => setPq(e.target.value)} placeholder="Cari foto (bahasa Inggris): office, coffee, team…" aria-label="Cari foto" className="pl-8" />
                </div>
                <Button type="submit" disabled={busy !== null || !pq.trim()}>Cari</Button>
              </form>
              {busy === "search" && photos.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center text-sm">Mencari…</p>
              ) : searched && photos.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center text-sm">Tidak ada foto untuk "{pq}".</p>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
                  {photos.map((p) => (
                    <button key={p.id} type="button" disabled={busy !== null} onClick={() => pickPhoto(p)} aria-label={`Pakai foto ${p.alt || p.id}`} className="group bg-muted relative overflow-hidden rounded-lg border" style={{ aspectRatio: `${p.width} / ${p.height}`, maxHeight: 220 }}>
                      <img src={p.thumb} alt={p.alt} loading="lazy" className="size-full object-cover" />
                      {busy === p.id && <span className="absolute inset-0 grid place-items-center bg-black/40"><Loader2 className="size-5 animate-spin text-white" /></span>}
                      <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1.5 py-0.5 text-left text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">{p.photographer}</span>
                    </button>
                  ))}
                </div>
              )}
              {more && <Button variant="outline" disabled={busy !== null} onClick={() => search(page + 1)}>Muat lagi</Button>}
              <p className="text-muted-foreground text-xs">
                Foto dari <a className="underline" href="https://www.pexels.com" target="_blank" rel="noreferrer">Pexels</a>. Foto disalin ke aset project (tidak dihotlink); cantumkan nama fotografer di slide terakhir.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
