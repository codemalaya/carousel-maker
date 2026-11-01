import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type Theme = "light" | "dark" | "system";
const KEY = "carousel-theme";
const query = () => window.matchMedia("(prefers-color-scheme: dark)");

const read = (): Theme => {
  const v = localStorage.getItem(KEY);
  return v === "light" || v === "dark" ? v : "system";
};
const resolve = (t: Theme): "light" | "dark" => (t === "system" ? (query().matches ? "dark" : "light") : t);

const Ctx = createContext<{ theme: Theme; resolvedTheme: "light" | "dark"; setTheme: (t: Theme) => void } | null>(null);

/** Class-based theming (".dark" on <html>). index.html applies it before first paint to avoid a flash. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(read);
  const [resolvedTheme, setResolved] = useState(() => resolve(read()));

  useEffect(() => {
    const apply = () => {
      const r = resolve(theme);
      setResolved(r);
      document.documentElement.classList.toggle("dark", r === "dark");
      document.documentElement.style.colorScheme = r;
    };
    apply();
    const mq = query();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    localStorage.setItem(KEY, t);
    setThemeState(t);
  }, []);
  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme, setTheme]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useTheme outside ThemeProvider");
  return c;
}
