import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Carousel } from "../../core/schema";
import { parseDoc } from "@/editor/useEditor";

/** Fetches a spec only once `box` scrolls into view, and again when `dep` (e.g. mtime) changes. */
export function useLazyDoc(url: string, dep: number) {
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [doc, setDoc] = useState<Carousel | null>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = box.current!;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { rootMargin: "200px" });
    io.observe(el);
    return () => { ro.disconnect(); io.disconnect(); };
  }, []);

  useEffect(() => {
    if (!visible) return;
    let live = true;
    fetch(url)
      .then((r) => r.text())
      .then((t) => live && setDoc(parseDoc(t)))
      .catch(() => {});
    return () => { live = false; };
  }, [visible, url, dep]);

  return { box, doc, width };
}
