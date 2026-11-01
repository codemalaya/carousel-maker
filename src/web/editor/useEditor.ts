import { useCallback, useEffect, useRef, useState } from "react";
import { Carousel } from "../../core/schema";

export type Status = "saved" | "saving" | "error";

/**
 * Owns the document: load, poll for external (agent) edits, debounced save, undo/redo.
 * `live` mutates without history; `mutate` = checkpoint + live; drags/typing checkpoint once.
 */
/** Parse a project's raw JSON text; used to preload a project before switching to it. */
export const parseDoc = (text: string) => Carousel.parse(JSON.parse(text));

export function useEditor(project: string, initial?: { text: string; doc: Carousel }) {
  const url = `/api/projects/${encodeURIComponent(project)}`;
  const [doc, setDocState] = useState<Carousel | null>(initial?.doc ?? null);
  const [status, setStatus] = useState<Status>("saved");
  const [error, setError] = useState("");
  const [, bump] = useState(0);

  const docRef = useRef<Carousel | null>(initial?.doc ?? null);
  const past = useRef<Carousel[]>([]);
  const future = useRef<Carousel[]>([]);
  const lastSynced = useRef<string | null>(initial?.text ?? null);
  const saveTimer = useRef<number | undefined>(undefined);
  const saving = useRef(false);
  const skipSave = useRef(false);

  const setDoc = (d: Carousel) => {
    docRef.current = d;
    setDocState(d);
  };

  const checkpoint = useCallback(() => {
    if (!docRef.current) return;
    past.current = [...past.current.slice(-99), docRef.current];
    future.current = [];
    bump((n) => n + 1);
  }, []);

  const live = useCallback((fn: (d: Carousel) => void) => {
    if (!docRef.current) return;
    const next = structuredClone(docRef.current);
    fn(next);
    setDoc(next);
  }, []);

  const mutate = useCallback(
    (fn: (d: Carousel) => void) => {
      checkpoint();
      live(fn);
    },
    [checkpoint, live],
  );

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev || !docRef.current) return;
    future.current.push(docRef.current);
    setDoc(prev);
  }, []);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next || !docRef.current) return;
    past.current.push(docRef.current);
    setDoc(next);
  }, []);

  // pull external changes (agent edits) when we have nothing unsaved
  useEffect(() => {
    const pull = async () => {
      if (saveTimer.current !== undefined || saving.current) return;
      try {
        const text = await (await fetch(url)).text();
        if (text === lastSynced.current) return;
        const parsed = Carousel.parse(JSON.parse(text));
        if (docRef.current) {
          past.current = [...past.current.slice(-99), docRef.current];
          future.current = [];
        }
        lastSynced.current = text;
        skipSave.current = true;
        setDoc(parsed);
        setError("");
      } catch (e) {
        setError(String(e));
      }
    };
    pull();
    const t = setInterval(pull, 1500);
    return () => clearInterval(t);
  }, [url]);

  const doSave = useCallback(async () => {
    saveTimer.current = undefined;
    saving.current = true;
    try {
      const res = await fetch(url, { method: "POST", body: JSON.stringify(docRef.current) });
      if (!res.ok) throw new Error(await res.text());
      lastSynced.current = await res.text();
      setStatus("saved");
    } catch (e) {
      setError(String(e));
      setStatus("error");
    } finally {
      saving.current = false;
    }
  }, [url]);

  // debounced save
  useEffect(() => {
    if (!doc) return;
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    window.clearTimeout(saveTimer.current);
    setStatus("saving");
    saveTimer.current = window.setTimeout(doSave, 300);
  }, [doc, doSave]);

  /** Resolve once everything typed so far is on disk (call before reading it server-side, e.g. export). */
  const flush = useCallback(async () => {
    if (saveTimer.current !== undefined) {
      window.clearTimeout(saveTimer.current);
      await doSave();
    }
    while (saving.current) await new Promise((r) => setTimeout(r, 40));
  }, [doSave]);

  return {
    doc,
    status,
    error,
    flush,
    checkpoint,
    live,
    mutate,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  };
}
export type Editor = ReturnType<typeof useEditor>;
