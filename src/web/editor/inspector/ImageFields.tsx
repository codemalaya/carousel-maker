import { useRef } from "react";
import { ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { uploadAsset, useAssets } from "@/shared/api";
import { Field, OptionField, TextField, errMsg, type El, type Focus } from "@/editor/inspector/fields";

export function ImageFields({ el, project, patch, focus }: { el: Extract<El, { type: "image" }>; project: string; patch: (p: Partial<El>) => void; focus: Focus }) {
  const { assets, refresh } = useAssets(project);
  const upload = useRef<HTMLInputElement>(null);
  return (
    <>
      <TextField label="src" value={el.src} onChange={(v) => patch({ src: v })} {...focus} />
      <Field label="asset">
        <Select value="" onValueChange={(v) => patch({ src: `assets/${v}` })}>
          <SelectTrigger size="sm" className="h-7 w-full text-xs">
            <SelectValue placeholder={assets.length ? "Pilih dari project…" : "Belum ada aset"} />
          </SelectTrigger>
          <SelectContent>
            {assets.map((a) => (
              <SelectItem key={a} value={a} className="text-xs">{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => upload.current?.click()}>
        <ImagePlus className="size-3.5" /> Upload gambar…
      </Button>
      <input
        ref={upload}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          try {
            const { name } = await uploadAsset(project, f);
            await refresh();
            focus.onFocus();
            patch({ src: `assets/${name}` });
          } catch (err) {
            toast.error(`Upload gagal: ${errMsg(err)}`);
          }
        }}
      />
      <OptionField label="fit" value={el.fit} options={["cover", "contain"]} onChange={(v) => patch({ fit: v })} />
      <TextField label="mask" value={el.mask ?? ""} placeholder="circle(50%)" onChange={(v) => patch({ mask: v || undefined })} {...focus} />
    </>
  );
}
