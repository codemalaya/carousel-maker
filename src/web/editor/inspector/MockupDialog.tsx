import { useEffect, useState } from "react";
import { Loader2, Plus, Layers } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Element, FORMATS, Slide } from "../../../core/schema";
import { photoElement, placePin } from "../../../core/mockupPlace";
import { api, useAssets, type MockupResult } from "@/shared/api";
import type { Editor } from "@/editor/useEditor";

const CAMERAS = [
  ["angled", "Miring"],
  ["three-quarter", "3/4"],
  ["front", "Depan"],
  ["top-down", "Flat lay"],
  ["back", "Belakang"],
] as const;
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
/** assets that are renders/logos of this feature, not photos to put a pin on */
const NOT_PHOTO = /^(mockup-|pin-|scene-|logo)/i;

type Run = { results: MockupResult[]; bg: string; camera: string };

/** Button-pin mockup of the open slide (or all slides): rendered by the mockup-maker app, saved into assets, then added as image / new slide. */
export function MockupDialog({ open, onOpenChange, ed, project, cur, onInserted }: {
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
  const [size, setSize] = useState<"32" | "44">("44");
  const [finish, setFinish] = useState<"glossy" | "matte">("glossy");
  const [fit, setFit] = useState<"cover" | "contain">("cover");
  const [camera, setCamera] = useState<(typeof CAMERAS)[number][0]>("angled");
  const [bg, setBg] = useState("#e9e4da");
  const [transparent, setTransparent] = useState(false);
  const [all, setAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [run, setRun] = useState<Run | null>(null);
  // "Tempel di atas foto": the pin is rendered transparent and without floor shadow, then placed over a photo from the assets
  const [onPhoto, setOnPhoto] = useState(false);
  const [photo, setPhoto] = useState<string>("");
  const [cx, setCx] = useState(50);
  const [cy, setCy] = useState(50);
  const [pinSize, setPinSize] = useState(30); // pin width, % of slide width
  const [rot, setRot] = useState(0);
  const [shadow, setShadow] = useState(35); // contact shadow, %
  // lighting from an HDRI file in mockup-maker/hdri (empty = the built-in preset). With a photo the lighting should match it.
  const [envs, setEnvs] = useState<string[]>([]);
  const [env, setEnv] = useState("");
  const [envBg, setEnvBg] = useState(false);
  const [grain, setGrain] = useState(0);
  const [soft, setSoft] = useState(0);
  const [tilt, setTilt] = useState(100); // 100 = faces the camera, lower = disc squashed like a surface seen at an angle

  useEffect(() => {
    api.mockupHdri().then(setEnvs, () => setEnvs([]));
  }, []);

  const { width: W, height: H } = FORMATS[doc.format];
  const photoFile = photo || photos[0] || "";

  const toggleOnPhoto = (v: boolean) => {
    setOnPhoto(v);
    setRun(null);
    if (v) {
      setCamera("front"); // a pin stuck on something faces the camera
      setAll(false);
    }
  };

  const render = async () => {
    setBusy(true);
    const t = toast.loading("Merender mockup… beberapa detik per slide");
    try {
      await ed.flush(); // the server renders the slides from the file on disk
      const slides = all && !onPhoto ? doc.slides.map((_, i) => i) : [cur];
      const flat = onPhoto || transparent;
      const opts = {
        diameterMm: Number(size),
        finish,
        fit,
        camera: { preset: camera },
        scene: {
          background: flat ? { type: "transparent" } : { type: "solid", color: bg },
          ...(env ? { environment: { src: env, background: envBg && !flat } } : {}),
          // the floor shadow would fall on a floor the photo does not have; a vertical plane right behind the pin only leaves a soft halo
          ...(onPhoto ? { shadow: { enabled: true, opacity: 0.5, tilt: 90, distance: 0.25, blur: 3 } } : {}),
        },
        output: { ...(flat ? { format: "png", transparent: true } : {}), ...(grain ? { grain: grain / 100 } : {}), ...(soft ? { softness: soft / 10 } : {}) },
      };
      const results = await api.mockup(project, slides, opts);
      setRun({ results, bg: flat ? "#ffffff" : bg, camera });
      toast.success(`${results.length} mockup siap`, { id: t });
    } catch (e) {
      toast.error(`Mockup gagal: ${errMsg(e)}`, { id: t });
    } finally {
      setBusy(false);
    }
  };

  const side = Math.min(W, H);
  const image = (file: string) =>
    Element.parse({ type: "image", src: `assets/${file}`, x: Math.round((W - side) / 2), y: Math.round((H - side) / 2), w: side, h: side, fit: "contain" });
  const pinOnPhoto = (file: string) =>
    placePin({ W, H, cx: cx / 100, cy: cy / 100, size: pinSize / 100, rotate: rot, squash: tilt / 100, camera: run?.camera, file, shadow: shadow / 100 });

  const addToSlide = () => {
    const r = run?.results.find((x) => x.slide === cur) ?? run?.results[0];
    if (!r) return;
    const at = doc.slides[cur].elements.length;
    ed.mutate((d) => { d.slides[cur].elements.push(onPhoto ? pinOnPhoto(r.file) : image(r.file)); });
    onInserted(at);
    onOpenChange(false);
    toast.success("Mockup ditambahkan ke slide ini");
  };
  const addAsSlides = () => {
    if (!run) return;
    ed.mutate((d) => {
      for (const r of run.results) {
        const els = onPhoto && photoFile ? [photoElement(photoFile, W, H), pinOnPhoto(r.file)] : [image(r.file)];
        d.slides.push(Slide.parse({ bg: run.bg, name: `Mockup ${r.slide + 1}`, elements: els }));
      }
    });
    onOpenChange(false);
    toast.success(run.results.length === 1 ? "Slide mockup ditambahkan di akhir" : `${run.results.length} slide mockup ditambahkan di akhir`);
  };

  const url = (f: string) => `/api/projects/${encodeURIComponent(project)}/assets/${encodeURIComponent(f)}`;
  const PREVIEW_W = 420;
  const k = PREVIEW_W / W;
  const pinEl = run && onPhoto ? pinOnPhoto(run.results[0].file) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Mockup button pin</DialogTitle>
          <DialogDescription>
            Slide ditempel ke button pin 3D (mockup-maker). Slide dipotong ke lingkaran: &ldquo;Isi penuh&rdquo; memotong sisi slide, &ldquo;Utuh&rdquo; menampilkan seluruh slide.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 text-sm">
          <Row label="Ukuran">
            <ToggleGroup type="single" variant="outline" size="sm" value={size} onValueChange={(v) => v && setSize(v as "32" | "44")}>
              <ToggleGroupItem value="32" className="h-8 px-3">32 mm</ToggleGroupItem>
              <ToggleGroupItem value="44" className="h-8 px-3">44 mm</ToggleGroupItem>
            </ToggleGroup>
          </Row>
          <Row label="Finishing">
            <ToggleGroup type="single" variant="outline" size="sm" value={finish} onValueChange={(v) => v && setFinish(v as "glossy" | "matte")}>
              <ToggleGroupItem value="glossy" className="h-8 px-3">Glossy</ToggleGroupItem>
              <ToggleGroupItem value="matte" className="h-8 px-3">Matte</ToggleGroupItem>
            </ToggleGroup>
          </Row>
          <Row label="Slide">
            <ToggleGroup type="single" variant="outline" size="sm" value={fit} onValueChange={(v) => v && setFit(v as "cover" | "contain")}>
              <ToggleGroupItem value="cover" className="h-8 px-3">Isi penuh</ToggleGroupItem>
              <ToggleGroupItem value="contain" className="h-8 px-3">Utuh</ToggleGroupItem>
            </ToggleGroup>
          </Row>
          <Row label="Kamera">
            <Select value={camera} onValueChange={(v) => setCamera(v as typeof camera)}>
              <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CAMERAS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </Row>
          {envs.length > 0 && (
            <Row label="Cahaya (HDRI)">
              <Select value={env || "-"} onValueChange={(v) => setEnv(v === "-" ? "" : v)}>
                <SelectTrigger className="h-8 w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="-">Preset bawaan</SelectItem>
                  {envs.map((f) => <SelectItem key={f} value={f}>{f.replace(/\.[^.]+$/, "")}</SelectItem>)}
                </SelectContent>
              </Select>
            </Row>
          )}
          {env && !onPhoto && !transparent && (
            <Row label="Latar HDRI">
              <label className="flex items-center gap-1.5 text-xs">
                <input type="checkbox" checked={envBg} onChange={(e) => setEnvBg(e.target.checked)} /> Pakai HDRI sebagai latar
              </label>
            </Row>
          )}
          <Row label="Tempel di atas foto">
            <label className="flex items-center gap-1.5 text-xs">
              <input type="checkbox" checked={onPhoto} onChange={(e) => toggleOnPhoto(e.target.checked)} /> Pin transparan, tanpa bayangan lantai
            </label>
          </Row>
          {onPhoto ? (
            <div className="grid gap-3 rounded-md border p-3">
              {photos.length ? (
                <Row label="Foto">
                  <Select value={photoFile} onValueChange={setPhoto}>
                    <SelectTrigger className="h-8 w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {photos.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Row>
              ) : (
                <p className="text-muted-foreground text-xs">Belum ada foto di assets project ini. Unggah atau tambah foto (Library aset &gt; Foto) dulu.</p>
              )}
              <Slide2 label="Posisi X" value={cx} min={0} max={100} unit="%" onChange={setCx} />
              <Slide2 label="Posisi Y" value={cy} min={0} max={100} unit="%" onChange={setCy} />
              <Slide2 label="Ukuran pin" value={pinSize} min={5} max={80} unit="%" onChange={setPinSize} />
              <Slide2 label="Rotasi" value={rot} min={-180} max={180} unit="°" onChange={setRot} />
              <Slide2 label="Miring" value={tilt} min={50} max={100} unit="%" onChange={setTilt} />
              <Slide2 label="Grain" value={grain} min={0} max={60} unit="%" onChange={setGrain} />
              <Slide2 label="Blur halus" value={soft} min={0} max={30} unit="" onChange={setSoft} />
              <Slide2 label="Bayangan" value={shadow} min={0} max={80} unit="%" onChange={setShadow} />
            </div>
          ) : (
            <>
              <Row label="Latar">
                <div className="flex items-center gap-3">
                  <input type="color" value={bg} disabled={transparent} onChange={(e) => setBg(e.target.value)} aria-label="Warna latar" className="h-8 w-10 cursor-pointer rounded border bg-transparent disabled:opacity-40" />
                  <label className="flex items-center gap-1.5 text-xs">
                    <input type="checkbox" checked={transparent} onChange={(e) => setTransparent(e.target.checked)} /> Transparan
                  </label>
                </div>
              </Row>
              <Row label="Cakupan">
                <label className="flex items-center gap-1.5 text-xs">
                  <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Semua slide ({doc.slides.length})
                </label>
              </Row>
            </>
          )}
        </div>

        <Button onClick={render} disabled={busy || !doc.slides.length || (onPhoto && !photoFile)} className="gap-1.5">
          {busy && <Loader2 className="size-4 animate-spin" />} Render mockup
        </Button>

        {run && (
          <div className="grid gap-3 border-t pt-3">
            {pinEl && pinEl.type === "image" && photoFile ? (
              // live preview: the slide is drawn at real px and scaled, so the shadow filter matches the export; sliders need no re-render
              <div className="mx-auto overflow-hidden rounded border" style={{ width: W * k, height: H * k }}>
                <div style={{ width: W, height: H, transform: `scale(${k})`, transformOrigin: "top left", position: "relative", background: "#fff" }}>
                  <img src={url(photoFile)} alt="" style={{ position: "absolute", inset: 0, width: W, height: H, objectFit: "cover" }} />
                  <img
                    src={url(run.results[0].file)}
                    alt="Pin di atas foto"
                    style={{
                      position: "absolute", left: pinEl.x, top: pinEl.y, width: pinEl.w, height: pinEl.h,
                      transform: String(pinEl.style.transform ?? `rotate(${pinEl.rotate}deg)`), filter: String(pinEl.style.filter ?? "none"),
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {run.results.map((r) => (
                  <img key={r.file} src={url(r.file)} alt={`Mockup slide ${r.slide + 1}`} className="aspect-square w-full rounded border object-contain" style={{ background: run.bg }} />
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={addToSlide}>
                <Layers className="size-3.5" /> {onPhoto ? "Tempel ke slide ini" : "Tambah ke slide ini"}
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={addAsSlides}>
                <Plus className="size-3.5" /> {onPhoto ? "Slide baru (foto + pin)" : "Jadikan slide baru"}
              </Button>
            </div>
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

function Slide2({ label, value, min, max, unit, onChange }: { label: string; value: number; min: number; max: number; unit: string; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <Label className="text-muted-foreground w-20 shrink-0 text-xs">{label}</Label>
      <Slider value={[value]} min={min} max={max} step={1} onValueChange={(v) => onChange(v[0])} className="flex-1" />
      <span className="w-12 text-right text-xs tabular-nums">{value}{unit}</span>
    </div>
  );
}
