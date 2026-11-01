import { useState, type ReactNode } from "react";
import { AlignCenter, AlignLeft, AlignRight } from "lucide-react";
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { type Carousel } from "../../../core/schema";

export type El = Carousel["slides"][number]["elements"][number];

export const num = (v: string): string | number => (v.trim() !== "" && !isNaN(Number(v)) ? Number(v) : v);
export const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/* ---- field primitives (module level: defining these inside Inspector remounts them each render and drops input focus) ---- */

export type Focus = { onFocus: () => void };

export function Field({ label, children }: { label: string; children: ReactNode }) {
  // label wraps its control: clicking the text focuses it and screen readers get the association
  return (
    <Label className="flex items-center gap-2 font-normal">
      <span className="text-muted-foreground w-16 shrink-0 text-xs">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </Label>
  );
}

const inputCls = "h-7 px-2 text-xs";

/** Label above the input: keeps 4-digit values readable in a narrow panel. */
export function NumField({ label, value, step = 1, placeholder, onChange, onFocus }: { label: string; value: number | undefined; step?: number; placeholder?: string; onChange: (v: number | undefined) => void } & Focus) {
  return (
    <Label className="grid min-w-0 gap-1 font-normal">
      <span className="text-muted-foreground text-[10px] tracking-wide uppercase">{label}</span>
      <Input
        className={inputCls}
        type="number"
        step={step}
        value={value ?? ""}
        placeholder={placeholder}
        onFocus={onFocus}
        onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
      />
    </Label>
  );
}

export function OpacityField({ value, onChange, onFocus }: { value: number; onChange: (v: number) => void } & Focus) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-[10px] tracking-wide uppercase">Opasitas</span>
        <span className="text-xs tabular-nums">{Math.round(value * 100)}%</span>
      </div>
      <Slider
        aria-label="Opasitas"
        min={0}
        max={1}
        step={0.05}
        value={[value]}
        onFocus={onFocus}
        onPointerDown={onFocus} // one undo step per drag
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  );
}

export function AlignField({ value, onChange, onFocus }: { value: string; onChange: (v: string) => void } & Focus) {
  return (
    <Field label="align">
      <ToggleGroup type="single" size="sm" variant="outline" className="w-full" value={value} onValueChange={(v) => { onFocus(); onChange(v); }}>
        {([["left", AlignLeft], ["center", AlignCenter], ["right", AlignRight]] as const).map(([v, Icon]) => (
          <ToggleGroupItem key={v} value={v} aria-label={`Rata ${v}`} className="h-7 flex-1">
            <Icon className="size-3.5" />
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </Field>
  );
}

export function TextField({ label, value, placeholder, onChange, onFocus }: { label: string; value: string; placeholder?: string; onChange: (v: string) => void } & Focus) {
  return (
    <Field label={label}>
      <Input className={inputCls} value={value} placeholder={placeholder} onFocus={onFocus} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

export function ColorField({ label, value, palette, onChange, onFocus }: { label: string; value: string; palette: [string, string][]; onChange: (v: string) => void } & Focus) {
  return (
    <Field label={label}>
      <div className="grid gap-1.5">
        <Input className={inputCls} value={value} onFocus={onFocus} onChange={(e) => onChange(e.target.value)} />
        {palette.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {palette.map(([name, color]) => (
              <Tooltip key={name}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Warna ${name}`}
                    className="focus-visible:ring-ring size-5 rounded-full border border-black/20 outline-none focus-visible:ring-2 dark:border-white/30"
                    style={{ background: color }}
                    onClick={() => {
                      onFocus();
                      onChange(`{${name}}`);
                    }}
                  />
                </TooltipTrigger>
                <TooltipContent>{`{${name}}`}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        )}
      </div>
    </Field>
  );
}

export function OptionField<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly T[]; onChange: (v: T) => void }) {
  return (
    <Field label={label}>
      <Select value={value} onValueChange={(v) => onChange(v as T)}>
        <SelectTrigger size="sm" className="h-7 w-full text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

/** Raw JSON editor, applied on blur if valid. Escape hatch for any key. */
export function JsonBox<T>({ value, parse, onApply }: { value: T; parse: (v: unknown) => T; onApply: (v: T) => void }) {
  const json = JSON.stringify(value, null, 2);
  const [text, setText] = useState(json);
  const [bad, setBad] = useState(false);
  const [prev, setPrev] = useState(json);
  if (json !== prev) {
    setPrev(json);
    setText(json); // external change (undo, agent)
  }
  return (
    <Textarea
      className="min-h-32 font-mono text-xs whitespace-pre"
      aria-invalid={bad}
      rows={8}
      wrap="off"
      spellCheck={false}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        try {
          const v = parse(JSON.parse(text));
          setBad(false);
          if (JSON.stringify(v, null, 2) !== json) onApply(v);
        } catch {
          setBad(true);
        }
      }}
    />
  );
}

export function Section({ value, title, children }: { value: string; title: string; children: ReactNode }) {
  return (
    <AccordionItem value={value}>
      <AccordionTrigger className="py-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase hover:no-underline">
        {title}
      </AccordionTrigger>
      <AccordionContent className="grid gap-2 pb-3">{children}</AccordionContent>
    </AccordionItem>
  );
}

