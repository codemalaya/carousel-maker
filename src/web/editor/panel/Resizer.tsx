import { cn } from "@/lib/utils";

/** Thin drag handle on a panel edge. `edge` is the distance of the handle from the app's left/right side. */
export function Resizer({ side, offset, onResize }: {
  side: "left" | "right";
  offset: number;
  /** receives the desired panel width */
  onResize: (width: number) => void;
}) {
  const start = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const move = (m: PointerEvent) => onResize(side === "left" ? m.clientX : window.innerWidth - m.clientX);
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  };
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={side === "left" ? "Lebar panel slide" : "Lebar inspector"}
      onPointerDown={start}
      className={cn("absolute top-14 bottom-0 z-20 w-1.5 cursor-col-resize transition-colors hover:bg-brand/50 active:bg-brand/70")}
      style={{ [side]: offset - 3 }}
    />
  );
}
