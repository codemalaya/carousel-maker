import { useRef, useState, type ReactNode } from "react";
import { Copy, Trash2 } from "lucide-react";
import { Accordion } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ANIM_TYPES, Element, TRANSITIONS, Tokens, type Carousel } from "../../../core/schema";
import { NAME_MAX, autoTitle } from "@/shared/slideTitle";
import { LayersList } from "@/editor/inspector/LayersList";
import type { Editor } from "@/editor/useEditor";
import { ImageFields } from "@/editor/inspector/ImageFields";
import { BrandRow } from "@/editor/inspector/BrandRow";
import { ChartFields, TableFields } from "@/editor/inspector/ChartFields";
import { FontRow } from "@/editor/inspector/FontRow";
import { type El, num, type Focus, Field, NumField, OpacityField, AlignField, TextField, ColorField, OptionField, JsonBox, Section } from "@/editor/inspector/fields";


export function Inspector({ ed, project, cur, sel, setSel, footer }: {
  ed: Editor;
  project: string;
  cur: number;
  sel: number | null;
  setSel: (i: number | null) => void;
  /** pinned below the scrolling area (export bar) */
  footer?: ReactNode;
}) {
  const doc = ed.doc!;
  const slide = doc.slides[cur];
  const el = sel != null ? slide?.elements[sel] : undefined;
  const palette = Object.entries(doc.tokens.palette);
  const [open, setOpen] = useState(["layers", "pos", "content", "type", "slide", "anim"]);

  // checkpoint once per focus session (first real change), so typing = one undo step
  const armed = useRef(true);
  const focus: Focus = { onFocus: () => (armed.current = true) };
  const edit = (fn: (d: Carousel) => void) => {
    // controls can fire onChange with an unchanged value (e.g. slider pointer-down); don't spend an undo step on that
    const next = structuredClone(doc);
    fn(next);
    if (JSON.stringify(next) === JSON.stringify(doc)) return;
    if (armed.current) {
      ed.checkpoint();
      armed.current = false;
    }
    ed.live(fn);
  };
  const patch = (p: Partial<El>) => edit((d) => Object.assign(d.slides[cur].elements[sel!], p));
  const setStyle = (key: string, v: string) =>
    edit((d) => {
      const s = d.slides[cur].elements[sel!].style;
      if (v === "") delete s[key];
      else s[key] = num(v);
    });
  const style = (k: string) => String(el?.style[k] ?? "");

  return (
    <aside className="inspector">
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 pt-1 pb-3">
      <Accordion type="multiple" value={open} onValueChange={setOpen}>
        <Section value="layers" title={`Layers (${slide?.elements.length ?? 0})`}>
          <LayersList ed={ed} cur={cur} sel={sel} setSel={setSel} />
        </Section>

        {el && sel != null ? (
          <>
            <Section value="pos" title="Posisi & ukuran">
              <div className="grid grid-cols-2 gap-x-2 gap-y-2.5">
                <NumField label="X" value={el.x} onChange={(v) => patch({ x: v ?? 0 })} {...focus} />
                <NumField label="Y" value={el.y} onChange={(v) => patch({ y: v ?? 0 })} {...focus} />
                <NumField label="Lebar" value={el.w} placeholder="auto" onChange={(v) => patch({ w: v })} {...focus} />
                <NumField label="Tinggi" value={el.h} placeholder="auto" onChange={(v) => patch({ h: v })} {...focus} />
                <NumField label="Rotasi" value={el.rotate} onChange={(v) => patch({ rotate: v ?? 0 })} {...focus} />
                <NumField label="Z-index" value={el.z} onChange={(v) => patch({ z: v ?? 0 })} {...focus} />
              </div>
              <OpacityField value={el.opacity} onChange={(v) => patch({ opacity: v })} {...focus} />
            </Section>

            {el.type === "text" && (
              <>
                <Section value="content" title="Teks">
                  <Textarea className="text-sm" rows={4} value={el.text} onFocus={focus.onFocus} onChange={(e) => patch({ text: e.target.value })} />
                </Section>
                <Section value="type" title="Tipografi">
                  <TextField label="size" value={style("fontSize")} onChange={(v) => setStyle("fontSize", v)} {...focus} />
                  <TextField label="font" value={style("fontFamily")} placeholder="{sans}" onChange={(v) => setStyle("fontFamily", v)} {...focus} />
                  <TextField label="weight" value={style("fontWeight")} onChange={(v) => setStyle("fontWeight", v)} {...focus} />
                  <TextField label="line-h" value={style("lineHeight")} onChange={(v) => setStyle("lineHeight", v)} {...focus} />
                  <TextField label="tracking" value={style("letterSpacing")} placeholder="-0.05em" onChange={(v) => setStyle("letterSpacing", v)} {...focus} />
                  <AlignField value={style("textAlign")} onChange={(v) => setStyle("textAlign", v)} {...focus} />
                  <ColorField label="color" value={style("color")} palette={palette} onChange={(v) => setStyle("color", v)} {...focus} />
                </Section>
              </>
            )}
            {el.type === "image" && (
              <Section value="content" title="Gambar">
                <ImageFields el={el} project={project} patch={patch} focus={focus} />
              </Section>
            )}
            {el.type === "shape" && (
              <Section value="content" title="Bentuk">
                <OptionField label="kind" value={el.kind} options={["rect", "circle", "line"]} onChange={(v) => patch({ kind: v })} />
                <ColorField label="fill" value={el.fill} palette={palette} onChange={(v) => patch({ fill: v })} {...focus} />
              </Section>
            )}
            {el.type === "chart" && (
              <>
                <Section value="content" title="Grafik">
                  <ChartFields el={el} patch={patch} focus={focus} />
                </Section>
                <Section value="type" title="Tipografi">
                  <TextField label="size" value={style("fontSize")} placeholder="auto" onChange={(v) => setStyle("fontSize", v)} {...focus} />
                  <TextField label="font" value={style("fontFamily")} placeholder="{sans}" onChange={(v) => setStyle("fontFamily", v)} {...focus} />
                  <ColorField label="color" value={style("color")} palette={palette} onChange={(v) => setStyle("color", v)} {...focus} />
                </Section>
              </>
            )}
            {el.type === "table" && (
              <>
                <Section value="content" title="Tabel">
                  <TableFields el={el} patch={patch} palette={palette} focus={focus} />
                </Section>
                <Section value="type" title="Tipografi">
                  <TextField label="size" value={style("fontSize")} onChange={(v) => setStyle("fontSize", v)} {...focus} />
                  <TextField label="font" value={style("fontFamily")} placeholder="{sans}" onChange={(v) => setStyle("fontFamily", v)} {...focus} />
                  <ColorField label="color" value={style("color")} palette={palette} onChange={(v) => setStyle("color", v)} {...focus} />
                </Section>
              </>
            )}
            {el.type === "html" && (
              <Section value="content" title="HTML / SVG">
                <ColorField label="color" value={style("color")} palette={palette} onChange={(v) => setStyle("color", v)} {...focus} />
                <Textarea className="min-h-28 font-mono text-xs whitespace-pre" rows={7} wrap="off" spellCheck={false} value={el.html} onFocus={focus.onFocus} onChange={(e) => patch({ html: e.target.value })} />
              </Section>
            )}

            <Section value="anim" title="Animasi (mode present)">
              <OptionField
                label="masuk"
                value={el.anim?.type ?? "none"}
                options={["none", ...ANIM_TYPES]}
                onChange={(v) => edit((d) => { d.slides[cur].elements[sel].anim = v === "none" ? undefined : { type: v, delay: el.anim?.delay ?? 0, duration: el.anim?.duration ?? 600 }; })}
              />
              {el.anim && (
                <div className="grid grid-cols-2 gap-x-2">
                  <NumField label="Delay (ms)" value={el.anim.delay} step={100} onChange={(v) => edit((d) => { d.slides[cur].elements[sel].anim = { ...el.anim!, delay: Math.max(0, v ?? 0) }; })} {...focus} />
                  <NumField label="Durasi (ms)" value={el.anim.duration} step={100} onChange={(v) => edit((d) => { d.slides[cur].elements[sel].anim = { ...el.anim!, duration: Math.max(0, v ?? 600) }; })} {...focus} />
                </div>
              )}
              <NumField label="Langkah (0 = langsung tampil)" value={el.step} onChange={(v) => patch({ step: Math.max(0, Math.round(v ?? 0)) })} {...focus} />
            </Section>

            <Section value="json" title="Style (JSON)">
              <JsonBox
                key={`${cur}-${sel}`}
                value={el.style}
                parse={(v) => Element.options[0].shape.style.parse(v)}
                onApply={(s) => ed.mutate((d) => { d.slides[cur].elements[sel].style = s; })}
              />
            </Section>
          </>
        ) : (
          slide && (
            <>
              <Section value="slide" title={`Slide ${cur + 1}`}>
                <TextField
                  label="nama"
                  value={slide.name ?? ""}
                  placeholder={autoTitle(slide, cur)}
                  onChange={(v) => edit((d) => { const name = v.slice(0, NAME_MAX); if (name.trim()) d.slides[cur].name = name; else delete d.slides[cur].name; })}
                  {...focus}
                />
                <ColorField label="bg" value={slide.bg} palette={palette} onChange={(v) => edit((d) => { d.slides[cur].bg = v; })} {...focus} />
                <Field label="catatan">
                  <Textarea
                    className="text-xs"
                    rows={3}
                    value={slide.notes ?? ""}
                    placeholder="Catatan pembicara (tampil di mode presentasi, tombol N)"
                    onFocus={focus.onFocus}
                    onChange={(e) => edit((d) => { if (e.target.value) d.slides[cur].notes = e.target.value; else delete d.slides[cur].notes; })}
                  />
                </Field>
                <OptionField
                  label="transisi"
                  value={slide.transition ?? "slide"}
                  options={TRANSITIONS}
                  onChange={(v) => ed.mutate((d) => { if (v === "slide") delete d.slides[cur].transition; else d.slides[cur].transition = v; })}
                />
                <OptionField label="format" value={doc.format} options={["1:1", "4:5", "9:16", "16:9", "4:3"]} onChange={(v) => ed.mutate((d) => { d.format = v; })} />
              </Section>
              <Section value="brief" title="Brief (arahan untuk agent)">
                <Textarea
                  className="text-xs"
                  rows={6}
                  value={doc.brief}
                  placeholder="Gaya, warna, aturan tipografi, tone…"
                  onFocus={focus.onFocus}
                  onChange={(e) => edit((d) => { d.brief = e.target.value; })}
                />
              </Section>
              <Section value="tokens" title="Tokens (JSON)">
                <BrandRow ed={ed} project={project} current={doc.brand} />
                <FontRow ed={ed} project={project} />
                <JsonBox value={doc.tokens} parse={(v) => Tokens.parse(v)} onApply={(t) => ed.mutate((d) => { d.tokens = t; })} />
              </Section>
            </>
          )
        )}
      </Accordion>

      {el && sel != null && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 flex-1 gap-1.5"
            onClick={() => {
              ed.mutate((d) => { d.slides[cur].elements.splice(sel + 1, 0, structuredClone(d.slides[cur].elements[sel])); });
              setSel(sel + 1);
            }}
          >
            <Copy className="size-3.5" /> Duplikat
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="hover:text-destructive h-8 flex-1 gap-1.5"
            onClick={() => {
              ed.mutate((d) => { d.slides[cur].elements.splice(sel, 1); });
              setSel(null);
            }}
          >
            <Trash2 className="size-3.5" /> Hapus
          </Button>
        </div>
      )}
      </div>
      {footer}
    </aside>
  );
}

