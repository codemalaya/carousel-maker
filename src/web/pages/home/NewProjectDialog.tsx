import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { FORMATS, type Carousel } from "../../../core/schema";
import { useBrands, type ProjectInfo } from "@/shared/api";
import { validateProjectId } from "@/app/dialogs";

type Format = Carousel["format"];
export type NewProject = { id: string; format: Format; from?: string; brand?: string };

const BLANK = "__blank";
const NO_BRAND = "__nobrand";
const FORMAT_HINT: Record<Format, string> = { "1:1": "Persegi", "4:5": "Feed IG", "9:16": "Story / Reels", "16:9": "Presentasi", "4:3": "Presentasi klasik" };

/** Mini frame in the real aspect ratio, so the format choice is visible, not just a label. */
function FormatOption({ f, active, disabled, onPick }: { f: Format; active: boolean; disabled: boolean; onPick: () => void }) {
  const { width, height } = FORMATS[f];
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onPick}
      className={cn(
        "flex flex-1 flex-col items-center gap-2 rounded-lg border p-3 transition-colors disabled:opacity-40",
        active ? "border-foreground bg-accent" : "hover:bg-accent/50",
      )}
    >
      <span className="border-foreground/50 bg-background block h-12 rounded-sm border-2" style={{ aspectRatio: `${width} / ${height}` }} />
      <span className="text-sm font-medium">{f}</span>
      <span className="text-muted-foreground text-[11px]">{FORMAT_HINT[f]}</span>
    </button>
  );
}

export function NewProjectDialog({ open, projects, onClose, onCreate }: {
  open: boolean;
  projects: ProjectInfo[];
  onClose: () => void;
  onCreate: (p: NewProject) => Promise<void>;
}) {
  const [id, setId] = useState("");
  const [format, setFormat] = useState<Format>("4:5");
  const [from, setFrom] = useState(BLANK);
  const [brand, setBrand] = useState(NO_BRAND);
  const { brands } = useBrands();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const copying = from !== BLANK;
  const reset = () => { setId(""); setFormat("4:5"); setFrom(BLANK); setBrand(NO_BRAND); setError(""); };
  const close = () => { onClose(); reset(); };

  const submit = async () => {
    const name = id.trim();
    const err = !name
      ? "Wajib diisi"
      : (validateProjectId(name) ?? (projects.some((p) => p.id.toLowerCase() === name.toLowerCase()) ? `"${name}" sudah ada` : ""));
    if (err) return setError(err);
    setBusy(true);
    try {
      await onCreate({ id: name, format, from: copying ? from : undefined, brand: brand === NO_BRAND ? undefined : brand });
      reset();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>Project baru</DialogTitle>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor="np-name">Nama project</Label>
            <Input id="np-name" autoFocus value={id} aria-invalid={!!error} onChange={(e) => { setId(e.target.value); setError(""); }} />
            {error && <p className="text-destructive text-xs">{error}</p>}
          </div>

          <div className="grid gap-2">
            <Label>Mulai dari</Label>
            <Select value={from} onValueChange={setFrom}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={BLANK}>Project kosong</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>Salin "{p.id}" ({p.slides} slide)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!!brands?.length && (
            <div className="grid gap-2">
              <Label>Brand kit</Label>
              <Select value={brand} onValueChange={setBrand}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_BRAND}>Tanpa brand</SelectItem>
                  {brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name || b.id}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-2">
            <Label>Format</Label>
            <div role="radiogroup" aria-label="Format" className="grid grid-cols-3 gap-2">
              {(Object.keys(FORMATS) as Format[]).map((f) => (
                <FormatOption
                  key={f}
                  f={f}
                  active={copying ? projects.find((p) => p.id === from)?.format === f : format === f}
                  disabled={copying}
                  onPick={() => setFormat(f)}
                />
              ))}
            </div>
            {copying && <p className="text-muted-foreground text-xs">Format mengikuti project yang disalin.</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>Batal</Button>
            <Button type="submit" disabled={busy}>Buat</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
