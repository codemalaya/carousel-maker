import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { CHART_KINDS, type ChartEl, type TableEl } from "../../../core/schema";
import { ColorField, Field, OptionField, TextField, type Focus } from "@/editor/inspector/fields";
import { chartToText, parseChartText, parseTableText, tableToText } from "@/editor/inspector/chartData";

const yn = ["ya", "tidak"] as const;
const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

/** Spreadsheet-style editor: applies on blur when the text parses, otherwise shows why it does not. Same external-sync pattern as JsonBox (undo, agent edits). */
function DataBox({ value, hint, parse, onApply }: { value: string; hint: string; parse: (text: string) => string | null; onApply: (text: string) => void }) {
  const [text, setText] = useState(value);
  const [prev, setPrev] = useState(value);
  const [err, setErr] = useState("");
  if (value !== prev) {
    setPrev(value);
    setText(value);
    setErr("");
  }
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Textarea
        className="field-sizing-fixed max-w-full min-h-28 font-mono text-xs whitespace-pre"
        rows={7}
        wrap="off"
        spellCheck={false}
        aria-invalid={!!err}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const bad = parse(text);
          setErr(bad ?? "");
          if (!bad && text !== value) onApply(text);
        }}
      />
      <p className={err ? "text-destructive text-[11px] leading-relaxed" : "text-muted-foreground text-[11px] leading-relaxed"}>{err || hint}</p>
    </div>
  );
}

type P<T> = { el: T; patch: (p: Partial<T>) => void; palette: [string, string][]; focus: Focus };

export function ChartFields({ el, patch, focus }: Omit<P<ChartEl>, "palette">) {
  const pie = el.kind === "pie" || el.kind === "donut";
  return (
    <>
      <OptionField label="jenis" value={el.kind} options={CHART_KINDS} onChange={(v) => patch({ kind: v })} />
      <TextField label="judul" value={el.title ?? ""} onChange={(v) => patch({ title: v || undefined })} {...focus} />
      <Field label="data">
        <DataBox
          value={chartToText(el)}
          hint={pie ? "Baris pertama: nama seri. Kolom 1 = nama irisan, kolom 2 = nilai. Tempel dari spreadsheet." : "Baris pertama: nama tiap seri. Kolom 1 = label sumbu X. Tempel dari spreadsheet."}
          parse={(t) => {
            const r = parseChartText(t);
            return typeof r === "string" ? r : null;
          }}
          onApply={(t) => {
            const r = parseChartText(t);
            if (typeof r !== "string") patch({ labels: r.labels, series: r.series });
          }}
        />
      </Field>
      <TextField label={pie ? "warna irisan" : "warna seri"} value={el.colors.join(", ")} placeholder="{brand}, #0ea5e9" onChange={(v) => patch({ colors: list(v) })} {...focus} />
      <OptionField label="legenda" value={el.legend == null ? "otomatis" : el.legend ? "ya" : "tidak"} options={["otomatis", ...yn]} onChange={(v) => patch({ legend: v === "otomatis" ? undefined : v === "ya" })} />
      <OptionField label="label nilai" value={el.valueLabels ? "ya" : "tidak"} options={yn} onChange={(v) => patch({ valueLabels: v === "ya" })} />
      <TextField label="satuan" value={el.unit} placeholder="% atau  jt" onChange={(v) => patch({ unit: v })} {...focus} />
    </>
  );
}

export function TableFields({ el, patch, palette, focus }: P<TableEl>) {
  return (
    <>
      <Field label="isi">
        <DataBox
          value={tableToText(el)}
          hint="Satu baris per baris tabel, kolom dipisah tab (tempel dari spreadsheet) atau ; atau koma."
          parse={(t) => {
            const r = parseTableText(t);
            return typeof r === "string" ? r : null;
          }}
          onApply={(t) => {
            const r = parseTableText(t);
            if (typeof r !== "string") patch({ rows: r });
          }}
        />
      </Field>
      <OptionField label="header" value={el.header ? "ya" : "tidak"} options={yn} onChange={(v) => patch({ header: v === "ya" })} />
      <OptionField label="belang" value={el.zebra ? "ya" : "tidak"} options={yn} onChange={(v) => patch({ zebra: v === "ya" })} />
      <TextField
        label="rata kolom"
        value={el.align.join(", ")}
        placeholder="left, right, center"
        onChange={(v) => patch({ align: list(v).filter((a): a is "left" | "center" | "right" => a === "left" || a === "center" || a === "right") })}
        {...focus}
      />
      <ColorField label="header bg" value={el.headerFill} palette={palette} onChange={(v) => patch({ headerFill: v })} {...focus} />
      <ColorField label="header teks" value={el.headerColor} palette={palette} onChange={(v) => patch({ headerColor: v })} {...focus} />
      <TextField label="warna belang" value={el.stripeFill} onChange={(v) => patch({ stripeFill: v })} {...focus} />
      <TextField label="warna garis" value={el.lineColor} onChange={(v) => patch({ lineColor: v })} {...focus} />
    </>
  );
}
