import { useMemo, useSyncExternalStore } from "react";
import { toast } from "sonner";

/**
 * AI runs live here, outside React, so they survive switching projects (the editor remounts per project).
 * One run per project at a time; different projects can run in parallel. History is kept per project in localStorage.
 * A page reload kills the server-side process (it dies with the connection), so stored "running" entries become "interrupted".
 */
type RunStatus = "running" | "done" | "error" | "stopped" | "interrupted";
export type Run = {
  id: number;
  prompt: string;
  status: RunStatus;
  /** latest tool name while running */
  step: string;
  reply: string;
  error: string;
  startedAt: number;
  endedAt?: number;
};

type Msg = { t: "status"; tool: string } | { t: "text"; text: string } | { t: "done"; text: string } | { t: "error"; message: string };

const KEY = "carousel-ai-runs";
const KEEP = 20;
const EMPTY: Run[] = [];

let state: Record<string, Run[]> = load();
let runningKey = computeRunning();
const subs = new Set<() => void>();
const aborts = new Map<string, AbortController>();
/** project currently open in the editor (null on home); decides whether a finished run needs a toast */
let viewing: string | null = null;

function load(): Record<string, Run[]> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, Run[]>;
    for (const runs of Object.values(raw)) {
      for (const r of runs) if (r.status === "running") Object.assign(r, { status: "interrupted", step: "", endedAt: r.endedAt ?? Date.now() });
    }
    return raw;
  } catch {
    return {};
  }
}

function computeRunning() {
  return Object.keys(state).filter((p) => state[p][0]?.status === "running").sort().join("|");
}

function commit(next: Record<string, Run[]>) {
  state = next;
  runningKey = computeRunning();
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full or blocked: history just won't persist */
  }
  subs.forEach((f) => f());
}

const subscribe = (f: () => void) => {
  subs.add(f);
  return () => void subs.delete(f);
};

function patch(project: string, id: number, p: Partial<Run>) {
  const runs = state[project] ?? EMPTY;
  commit({ ...state, [project]: runs.map((r) => (r.id === id ? { ...r, ...p } : r)) });
}

export const setViewing = (project: string | null) => { viewing = project; };

/** Newest first. */
export const useRuns = (project: string): Run[] =>
  useSyncExternalStore(subscribe, () => state[project] ?? EMPTY);

/** Projects with a run in progress. */
export function useRunning(): Set<string> {
  const key = useSyncExternalStore(subscribe, () => runningKey);
  return useMemo(() => new Set(key ? key.split("|") : []), [key]);
}

export const clearRuns = (project: string) => {
  if (state[project]?.[0]?.status === "running") return;
  const { [project]: _gone, ...rest } = state;
  commit(rest);
};

export const stopRun = (project: string) => aborts.get(project)?.abort();

const openProject = (id: string) => window.dispatchEvent(new CustomEvent("carousel:open", { detail: id }));

function finished(project: string, kind: "done" | "error", text: string) {
  if (viewing === project) return; // the bar already shows it
  const action = { label: "Buka", onClick: () => openProject(project) };
  if (kind === "done") toast.success(`AI selesai di "${project}"`, { description: text.slice(0, 140) || undefined, action });
  else toast.error(`AI gagal di "${project}"`, { description: text.slice(0, 140), action });
}

/** Start a run; `flush` makes sure the editor's unsaved edits are on disk before the agent reads them. `opts.send` = what the agent receives when it differs from the prompt shown in history. */
export async function startRun(project: string, prompt: string, flush: () => Promise<unknown>, opts: { send?: string } = {}) {
  if (state[project]?.[0]?.status === "running") return;
  const id = Date.now();
  commit({
    ...state,
    [project]: [{ id, prompt, status: "running" as RunStatus, step: "Mulai…", reply: "", error: "", startedAt: id }, ...(state[project] ?? EMPTY)].slice(0, KEEP),
  });
  const ctl = new AbortController();
  aborts.set(project, ctl);
  let outcome: "done" | "error" = "error";
  let text = "";
  try {
    await flush();
    const res = await fetch(`/api/projects/${encodeURIComponent(project)}/agent`, {
      method: "POST",
      body: JSON.stringify({ prompt: opts.send ?? prompt }),
      signal: ctl.signal,
    });
    if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText);
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buf = "";
    let settled = false;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += value;
      const lines = buf.split("\n");
      buf = lines.pop()!;
      for (const line of lines) {
        if (!line) continue;
        const m = JSON.parse(line) as Msg;
        if (m.t === "status") patch(project, id, { step: m.tool });
        else if (m.t === "text") patch(project, id, { reply: m.text });
        else if (m.t === "done") {
          settled = true;
          outcome = "done";
          text = m.text;
          patch(project, id, { status: "done", step: "", reply: m.text, endedAt: Date.now() });
        } else {
          settled = true;
          text = m.message;
          patch(project, id, { status: "error", step: "", error: m.message, endedAt: Date.now() });
        }
      }
    }
    if (!settled) {
      text = "Koneksi terputus sebelum selesai";
      patch(project, id, { status: "error", step: "", error: text, endedAt: Date.now() });
    }
  } catch (e) {
    if (ctl.signal.aborted) {
      patch(project, id, { status: "stopped", step: "", endedAt: Date.now() });
      return;
    }
    text = e instanceof Error ? e.message : String(e);
    patch(project, id, { status: "error", step: "", error: text, endedAt: Date.now() });
  } finally {
    aborts.delete(project);
  }
  finished(project, outcome, text);
}
