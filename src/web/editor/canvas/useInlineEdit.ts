import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { Carousel } from "../../../core/schema";
import type { Editor } from "@/editor/useEditor";

/**
 * Inline text editing: the rendered text node itself becomes contenteditable, so font, wrap, rotation and zoom are exactly what the export shows.
 * `stage` holds the rendered slide; `measure` re-reads the overlay boxes while typing.
 */
export function useInlineEdit({ ed, stage, slide, cur, sel, setSel, measure }: {
  ed: Editor;
  stage: RefObject<HTMLDivElement | null>;
  slide: Carousel["slides"][number];
  cur: number;
  sel: number | null;
  setSel: (i: number | null) => void;
  measure: () => void;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const edit = useRef<{ node: HTMLElement; original: string; index: number; slide: number; cleanup: () => void } | null>(null);
  const edRef = useRef(ed);
  edRef.current = ed;

  const stopEdit = useCallback((save: boolean) => {
    const s = edit.current;
    if (!s) return;
    edit.current = null;
    s.cleanup();
    setEditing(null);
    const value = s.node.innerText.replace(/\n$/, "");
    s.node.removeAttribute("contenteditable");
    s.node.blur();
    if (!save || value === s.original) {
      s.node.textContent = s.original; // discard typing; the DOM is not re-rendered when the doc is unchanged
      return;
    }
    edRef.current.mutate((d) => {
      const t = d.slides[s.slide]?.elements[s.index];
      if (t?.type === "text") t.text = value;
    });
  }, []);

  const startEdit = (i: number) => {
    const el = slide.elements[i];
    if (el?.type !== "text") return;
    if (edit.current) stopEdit(true);
    const node = stage.current?.querySelector(".slide")?.children[i] as HTMLElement | undefined;
    if (!node) return;
    setSel(i);
    node.contentEditable = "plaintext-only";
    const plain = node.contentEditable === "plaintext-only";
    if (!plain) node.contentEditable = "true"; // older Firefox
    node.spellcheck = false;
    node.style.outline = "none";
    node.style.cursor = "text";
    node.focus();
    const range = document.createRange();
    range.selectNodeContents(node);
    const selection = getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation(); // typing must not reach the editor shortcuts (Delete, arrows, P, undo...)
      if (e.key === "Escape") { e.preventDefault(); stopEdit(false); }
      else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); stopEdit(true); }
    };
    const onBlur = () => stopEdit(true);
    const onInput = () => measure();
    const onPaste = (e: ClipboardEvent) => {
      if (plain) return;
      e.preventDefault();
      document.execCommand("insertText", false, e.clipboardData?.getData("text/plain") ?? "");
    };
    node.addEventListener("keydown", onKey);
    node.addEventListener("blur", onBlur);
    node.addEventListener("input", onInput);
    node.addEventListener("paste", onPaste);
    edit.current = {
      node, original: el.text, index: i, slide: cur,
      cleanup: () => {
        node.removeEventListener("keydown", onKey);
        node.removeEventListener("blur", onBlur);
        node.removeEventListener("input", onInput);
        node.removeEventListener("paste", onPaste);
      },
    };
    setEditing(i);
  };
  const startEditRef = useRef(startEdit);
  startEditRef.current = startEdit;
  const selRef = useRef(sel);
  selRef.current = sel;

  // the slide re-rendered under us (agent edit, undo): the node is gone, drop the edit instead of saving into the wrong place
  useEffect(() => {
    const s = edit.current;
    if (s && !s.node.isConnected) {
      s.cleanup();
      edit.current = null;
      setEditing(null);
    }
  }, [slide, cur]);
  useEffect(() => () => { if (edit.current) stopEdit(true); }, [stopEdit]);

  return { editing, edit, stopEdit, startEdit, startEditRef, selRef };
}
