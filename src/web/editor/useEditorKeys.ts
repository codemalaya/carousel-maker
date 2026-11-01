import { useEffect } from "react";
import type { Editor } from "@/editor/useEditor";

/** Editor keyboard: undo/redo, delete, duplicate, nudge, P / Shift+P (preview / present). Global; skips inputs, dialogs and widgets that own the keys. */
export function useEditorKeys({ ed, sel, cur, nSlides, setSel, setPreview, setPresent }: {
  ed: Editor;
  sel: number | null;
  cur: number;
  nSlides: number;
  setSel: (i: number | null) => void;
  setPreview: (v: boolean) => void;
  setPresent: (v: boolean) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (/INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.closest('[role="dialog"],[role="alertdialog"]')) return;
      // widgets that handle arrows/Delete themselves (slider, toggle group, select, menus) must not also nudge/delete the element
      const widget = !!t.closest('[role="slider"],[role="radio"],[role="combobox"],[role="listbox"],[role="menu"]');
      const isArrow = e.key.startsWith("Arrow");
      if (widget && (isArrow || e.key === "Delete" || e.key === "Backspace")) return;
      if (isArrow && t.closest("[data-sortable]")) return; // arrows move the dragged row, not the element
      const mod = e.metaKey || e.ctrlKey;
      if (!mod && !e.altKey && e.key.toLowerCase() === "p" && nSlides > 0) {
        e.preventDefault();
        e.shiftKey ? setPresent(true) : setPreview(true);
        return;
      }
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? ed.redo() : ed.undo();
      } else if (sel == null) {
        return;
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        ed.mutate((d) => { d.slides[cur].elements.splice(sel, 1); });
        setSel(null);
      } else if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        ed.mutate((d) => { d.slides[cur].elements.splice(sel + 1, 0, structuredClone(d.slides[cur].elements[sel])); });
        setSel(sel + 1);
      } else if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        const n = e.shiftKey ? 10 : 1;
        ed.mutate((d) => {
          const el = d.slides[cur].elements[sel];
          if (e.key === "ArrowLeft") el.x -= n;
          if (e.key === "ArrowRight") el.x += n;
          if (e.key === "ArrowUp") el.y -= n;
          if (e.key === "ArrowDown") el.y += n;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
}
