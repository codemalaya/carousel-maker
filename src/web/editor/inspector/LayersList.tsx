import { useEffect, useRef } from "react";
import { BarChart3, Code2, GripVertical, ImageIcon, Square, Table2, Type } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Carousel } from "../../../core/schema";
import { SortableItem, SortableList, followIndex } from "@/shared/Sortable";
import type { Editor } from "@/editor/useEditor";

type El = Carousel["slides"][number]["elements"][number];

const ICON = { text: Type, shape: Square, image: ImageIcon, html: Code2, chart: BarChart3, table: Table2 } as const;

const label = (e: El) =>
  e.type === "text" ? e.text.replace(/\s+/g, " ").slice(0, 28) || "(kosong)"
  : e.type === "image" ? e.src.split("/").pop()!
  : e.type === "shape" ? e.kind
  : e.type === "chart" ? `grafik ${e.kind}${e.title ? `: ${e.title}` : ""}`.slice(0, 28)
  : e.type === "table" ? `tabel ${e.rows.length}×${Math.max(0, ...e.rows.map((r) => r.length))}`
  : "html";

/** Frontmost layer on top (like design tools). Ids are array indices; later index = drawn on top. */
export function LayersList({ ed, cur, sel, setSel }: {
  ed: Editor;
  cur: number;
  sel: number | null;
  setSel: (i: number | null) => void;
}) {
  const els = ed.doc!.slides[cur]?.elements ?? [];
  const order = els.map((_, i) => i).reverse();
  const box = useRef<HTMLDivElement>(null);

  // keep the selected row visible when it was picked on the canvas
  useEffect(() => {
    box.current?.querySelector('[data-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  const move = (from: number, to: number) => {
    ed.mutate((d) => {
      const arr = d.slides[cur].elements;
      const [e] = arr.splice(from, 1);
      arr.splice(to, 0, e);
    });
    setSel(followIndex(sel, from, to));
  };

  if (!els.length) return <p className="text-muted-foreground py-2 text-xs">Belum ada elemen. Tambah dari toolbar.</p>;

  return (
    <div ref={box} className="max-h-[170px] overflow-y-auto rounded-md border [scrollbar-width:thin]">
      <SortableList ids={order.map(String)} onMove={move}>
        {order.map((i) => {
          const Icon = ICON[els[i].type];
          return (
            <SortableItem
              key={i}
              id={String(i)}
              aria-label={`Layer ${label(els[i])}`}
              data-selected={sel === i}
              onClick={() => setSel(i)}
              className={cn(
                "flex cursor-grab items-center gap-1.5 bg-card px-1.5 py-1 text-xs active:cursor-grabbing",
                sel === i ? "bg-brand/25" : "hover:bg-accent",
              )}
            >
              <GripVertical className="text-muted-foreground size-3.5 shrink-0" />
              <Icon className="text-muted-foreground size-3.5 shrink-0" />
              <span className="truncate">{label(els[i])}</span>
            </SortableItem>
          );
        })}
      </SortableList>
    </div>
  );
}
