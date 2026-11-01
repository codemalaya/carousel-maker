import { useCallback, useState } from "react";

/** Resizable panel width, persisted per key. */
export function usePanelWidth(key: string, def: number, min: number, max: number) {
  const clamp = useCallback((n: number) => Math.min(max, Math.max(min, Math.round(n))), [min, max]);
  const [width, setWidthState] = useState(() => {
    const saved = Number(localStorage.getItem(key));
    return saved ? clamp(saved) : def;
  });
  const setWidth = useCallback(
    (n: number) => {
      const w = clamp(n);
      setWidthState(w);
      localStorage.setItem(key, String(w));
    },
    [clamp, key],
  );
  return [width, setWidth] as const;
}
