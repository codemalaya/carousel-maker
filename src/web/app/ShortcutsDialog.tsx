import { useEffect, useState } from "react";
import { Keyboard } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { IconButton } from "@/shared/IconButton";

const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";

type Row = { keys: string[][]; label: string };
const GROUPS: { title: string; rows: Row[] }[] = [
  {
    title: "Umum",
    rows: [
      { keys: [[mod, "Z"]], label: "Undo" },
      { keys: [[mod, "⇧", "Z"]], label: "Redo" },
      { keys: [["P"]], label: "Preview swipe layar penuh" },
      { keys: [["⇧", "P"]], label: "Mode presentasi" },
      { keys: [["?"]], label: "Buka daftar ini" },
    ],
  },
  {
    title: "Elemen terpilih",
    rows: [
      { keys: [["Delete"], ["⌫"]], label: "Hapus elemen" },
      { keys: [[mod, "D"]], label: "Duplikat elemen" },
      { keys: [["←", "↑", "→", "↓"]], label: "Geser 1 px" },
      { keys: [["⇧", "panah"]], label: "Geser 10 px" },
      { keys: [[mod, "drag"]], label: "Drag tanpa snap (sementara)" },
    ],
  },
  {
    title: "Canvas",
    rows: [
      { keys: [[mod, "scroll"], ["pinch"]], label: "Zoom ke kursor" },
      { keys: [[mod, "+"], [mod, "−"]], label: "Perbesar / perkecil" },
      { keys: [[mod, "0"]], label: "Fit ke layar" },
      { keys: [[mod, "1"]], label: "Zoom 100%" },
      { keys: [["Space", "drag"], ["klik tengah", "drag"]], label: "Geser tampilan" },
      { keys: [["⇧", "R"]], label: "Tampilkan / sembunyikan penggaris" },
      { keys: [["drag dari penggaris"]], label: "Buat guide (tarik balik ke penggaris = hapus)" },
      { keys: [["klik ganda guide"]], label: "Hapus guide" },
    ],
  },
  {
    title: "Saat preview",
    rows: [
      { keys: [["←"], ["→"]], label: "Slide sebelumnya / berikutnya" },
      { keys: [["swipe"], ["drag"]], label: "Geser antar slide" },
      { keys: [["Home"], ["End"]], label: "Slide pertama / terakhir" },
      { keys: [["Esc"]], label: "Keluar (membuka slide terakhir yang dilihat)" },
    ],
  },
  {
    title: "Saat presentasi",
    rows: [
      { keys: [["→"], ["Space"], ["Enter"]], label: "Berikutnya (memunculkan elemen bertahap dulu)" },
      { keys: [["←"], ["Backspace"]], label: "Sebelumnya" },
      { keys: [["B"], ["."]], label: "Layar hitam" },
      { keys: [["N"]], label: "Catatan pembicara + slide berikutnya" },
      { keys: [["L"]], label: "Laser pointer" },
      { keys: [["T"]], label: "Ulang timer" },
      { keys: [["F"]], label: "Layar penuh" },
      { keys: [["Esc"]], label: "Selesai (membuka slide terakhir)" },
    ],
  },
  {
    title: "Mengurutkan",
    rows: [
      { keys: [["drag"]], label: "Pindahkan slide atau layer" },
      { keys: [["Space"], ["panah"]], label: "Mengurutkan dengan keyboard (fokus di baris)" },
    ],
  },
];

const Kbd = ({ children }: { children: string }) => (
  <kbd className="bg-muted text-muted-foreground rounded border px-1.5 py-0.5 font-mono text-[11px] leading-none">{children}</kbd>
);

/** Header button + dialog listing every shortcut. `?` opens it too. */
export function ShortcutsButton() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key !== "?" || e.metaKey || e.ctrlKey) return;
      if (/INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable || t.closest('[role="dialog"],[role="alertdialog"]')) return;
      e.preventDefault();
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <IconButton label="Shortcut keyboard (?)" onClick={() => setOpen(true)}>
        <Keyboard />
      </IconButton>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Shortcut keyboard</DialogTitle>
            <DialogDescription>Berlaku saat fokus tidak sedang di kolom teks.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            {GROUPS.map((g) => (
              <section key={g.title} className="grid gap-1.5">
                <h3 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">{g.title}</h3>
                {g.rows.map((r) => (
                  <div key={r.label} className="flex items-center justify-between gap-4 text-sm">
                    <span>{r.label}</span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {r.keys.map((combo, i) => (
                        <span key={i} className="flex items-center gap-1">
                          {i > 0 && <span className="text-muted-foreground text-xs">atau</span>}
                          {combo.map((k) => (
                            <Kbd key={k}>{k}</Kbd>
                          ))}
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
              </section>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
