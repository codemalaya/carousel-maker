import { useEffect, useState } from "react";
import { Loader2, Plus, Layers } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { FORMATS, Slide } from "../../../core/schema";
import { photoElement } from "../../../core/mockupPlace";
import { api, useAssets, type PinsDetected } from "@/shared/api";
import type { Editor } from "@/editor/useEditor";

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const NOT_PHOTO = /^(mockup-|pin-|scene-|logo|pinphoto-)/i;

/**
 * Photo with green placeholder pins -> the pins get the design of slides of this project (see core/pinPhoto.ts).
 * Detection runs when a photo is picked (overlay shows what was found); size of the new disc is measured per pin unless set by hand.
 */
export function PinPhotoDialog({ open, onOpenChange, ed, project, cur, onInserted }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  ed: Editor;
  project: string;
  cur: number;
  onInserted: (index: number) => void;
}) {
  const doc = ed.doc!;
  const { assets } = useAssets(project);
  const photos = assets.filter((a) => !NOT_PHOTO.test(a));
  const [photo, setPhoto] = useState("");
  const [face, setFace] = useState<number[]>([cur]); // slide indices; pin i gets face[i % n]
  const [det, setDet] = useState<PinsDetected | null>(null);
  const [detBusy, setDetBusy] = useState(false);
  const [auto, setAuto] = useState(true);
  const [grow, setGrow] = useState(110); // %
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const photoFile = photo || photos[0] || "";
  const url = (f: string) => `/api/projects/${encodeURIComponent(project)}/assets/${encodeURIComponent(f)}`;

  useEffect(() => {
    if (open) setFace([cur]);
  }, [open, cur]);

  useEffect(() => {
    if (!open || !photoFile) return;
    let live = true;
    setDet(null);
    setResult(null);
    setDetBusy(true);
    api.pinsDetect(project, photoFile).then(
      (d) => live && setDet(d),
      (e) => live && toast.error(errMsg(e)),
    ).finally(() => live && setDetBusy(false));
    return () => { live = false; };
  }, [open, project, photoFile]);

  const toggleFace = (i: number) =>
    setFace((f) => (f.includes(i) ? (f.length > 1 ? f.filter((x) => x !== i) : f) : [...f, i].sort((a, b) => a - b)));

  const run = async () => {
    setBusy(true);
    const t = toast.loading("Mengganti pin… sekitar 10-20 detik");
    try {
      await ed.flush(); // the server renders the slides from the file on disk
      const r = await api.pinsReplace(project, photoFile, face, auto ? { grow: "auto" } : { grow: grow / 100 });
      setResult(r.file);
      toast.success(`${r.pins.length} pin diganti`, { id: t });
    } catch (e) {
      toast.error(errMsg(e), { id: t });
    } finally {
      setBusy(false);
    }
  };

  const { width: W, height: H } = FORMATS[doc.format];
  const addToSlide = () => {
    if (!result) return;
    const at = doc.slides[cur].elements.length;
    ed.mutate((d) => { d.slides[cur].elements.push(photoElement(result, W, H)); });
    onInserted(at);
    onOpenChange(false);
    toast.success("Foto ditambahkan ke slide ini");
  };
  const addAsSlide = () => {
    if (!result) return;
    ed.mutate((d) => { d.slides.push(Slide.parse({ bg: "#000000", name: "Foto pin", elements: [photoElement(result, W, H)] })); });
    onOpenChange(false);
    toast.success("Slide foto ditambahkan di akhir");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ganti pin hijau di foto</DialogTitle>
          <DialogDescription>
            Foto dengan pin berwarna hijau chroma (placeholder) dipasangi desain slide, dengan cahaya dan bayangan foto itu sendiri.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 text-sm">
          {photos.length ? (
            <Row label="Foto">
              <Select value={photoFile} onValueChange={setPhoto}>
                <SelectTrigger className="h-8 w-56"><SelectValue /></SelectTrigger>
                <SelectContent>{photos.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
              </Select>
            </Row>
          ) : (
            <p className="text-muted-foreground text-xs">Belum ada foto di assets project ini. Tambah foto dulu (Library aset &gt; Foto atau seret ke editor).</p>
          )}

          {photoFile && (
            <div className="relative mx-auto w-full overflow-hidden rounded border">
              <img src={url(result ?? photoFile)} alt="Foto" className="block w-full" />
              {det && !result && (
                <svg viewBox={`0 0 ${det.width} ${det.height}`} className="pointer-events-none absolute inset-0 size-full">
                  {det.pins.map((p, i) => (
                    <g key={i}>
                      <ellipse cx={p.cx} cy={p.cy} rx={p.a} ry={p.b} transform={`rotate(${(p.theta * 180) / Math.PI} ${p.cx} ${p.cy})`} fill="none" stroke="#ff2d95" strokeWidth={Math.max(2, det.width / 300)} />
                      <text x={p.cx} y={p.cy} textAnchor="middle" dominantBaseline="central" fontSize={Math.max(14, p.b * 0.7)} fill="#ff2d95" fontWeight="700">{i + 1}</text>
                    </g>
                  ))}
                </svg>
              )}
              {detBusy && <div className="bg-background/60 absolute inset-0 grid place-items-center"><Loader2 className="size-5 animate-spin" /></div>}
            </div>
          )}
          {det && (
            <p className="text-muted-foreground text-xs">
              {det.pins.length ? `${det.pins.length} pin hijau terdeteksi.` : det.small ? `${det.small} lingkaran hijau ketemu tapi terlalu kecil (<40 px). Pakai foto dengan pin lebih besar.` : "Tidak ada pin hijau. Pakai foto dengan pin hijau chroma yang jelas."}
            </p>
          )}

          <div className="grid gap-1.5">
            <Label className="text-muted-foreground text-xs">Desain pin (slide). Pilih satu = sama di semua pin; pilih beberapa = bergantian urut</Label>
            <div className="flex flex-wrap gap-1.5">
              {doc.slides.map((s, i) => (
                <Button key={i} size="sm" variant={face.includes(i) ? "default" : "outline"} className="h-7 px-2 text-xs" onClick={() => toggleFace(i)}>
                  {i + 1}{s.name ? ` ${s.name}` : ""}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <label className="flex items-center gap-1.5 text-xs">
              <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Ukuran otomatis (diukur dari tepi rim tiap pin)
            </label>
            {!auto && (
              <div className="flex items-center gap-3">
                <Label className="text-muted-foreground w-20 shrink-0 text-xs">Besar pin</Label>
                <Slider value={[grow]} min={100} max={130} step={1} onValueChange={(v) => setGrow(v[0])} className="flex-1" />
                <span className="w-12 text-right text-xs tabular-nums">{grow}%</span>
              </div>
            )}
          </div>
        </div>

        <Button onClick={run} disabled={busy || !det?.pins.length || !face.length} className="gap-1.5">
          {busy && <Loader2 className="size-4 animate-spin" />} Ganti pin
        </Button>

        {result && (
          <div className="grid grid-cols-2 gap-2 border-t pt-3">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={addToSlide}><Layers className="size-3.5" /> Tempel ke slide ini</Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={addAsSlide}><Plus className="size-3.5" /> Slide baru</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="text-muted-foreground text-xs">{label}</Label>
      {children}
    </div>
  );
}
