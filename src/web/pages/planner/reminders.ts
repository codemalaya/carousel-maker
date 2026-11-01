import { useEffect } from "react";
import { toast } from "sonner";
import type { PlanItem } from "../../../core/schema";
import { api, exportProject } from "@/shared/api";
import { PLATFORM_LABEL } from "@/pages/planner/planMeta";
import { planItems, refreshPlan } from "@/pages/planner/planStore";

/**
 * Reminders for the content plan. Nothing is posted anywhere: when a slot that is `siap` or `terjadwal` reaches its time, a toast
 * (and a browser notification when the tab is in the background) offers "Ekspor & salin caption" and "Tandai terbit".
 * It only runs while the editor tab is open. Slots that are already more than WINDOW_MS late are not announced (they show in the badges instead),
 * so opening the app after a weekend does not fire a pile of toasts.
 */
const KEY = "carousel-plan-reminded";
const POLL_MS = 30_000;
const CHECK_MS = 15_000;
const WINDOW_MS = 15 * 60_000;
const KEEP = 300;

const keyOf = (i: PlanItem) => `${i.id}@${i.date}T${i.time}`; // a rescheduled slot gets a new key and can remind again
const at = (i: PlanItem) => new Date(`${i.date}T${i.time}:00`).getTime();

const reminded = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
};
const remember = (k: string) => {
  try {
    localStorage.setItem(KEY, JSON.stringify([...reminded().filter((x) => x !== k), k].slice(-KEEP)));
  } catch {
    /* storage blocked: the worst case is a repeated reminder */
  }
};

export const caption = (i: PlanItem) => [i.caption, i.hashtags].filter(Boolean).join("\n\n");

async function markPublished(i: PlanItem) {
  try {
    await api.updatePlan(i.id, { status: "terbit" });
    await refreshPlan();
    toast.success(`"${i.title || i.project || "Slot"}" ditandai terbit`);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

/** Copies caption + hashtags and downloads the files (PDF for LinkedIn, ZIP of PNGs otherwise). Must start inside a click so the clipboard is allowed. */
async function exportAndCopy(i: PlanItem) {
  let copied = false;
  try {
    await navigator.clipboard.writeText(caption(i));
    copied = true;
  } catch {
    /* clipboard refused: say so below */
  }
  if (!i.project) {
    toast(copied ? "Caption disalin. Slot ini belum punya project, jadi tidak ada file untuk diunduh." : "Caption tidak bisa disalin dan slot ini belum punya project.");
    return;
  }
  const t = toast.loading(`Menyiapkan file "${i.project}"…`);
  try {
    await exportProject(i.project, { format: i.platform === "linkedin" ? "pdf" : "zip", scale: 1 });
    toast.success(copied ? "Caption disalin dan file diunduh" : "File diunduh, tapi caption tidak bisa disalin", {
      id: t,
      duration: 20_000,
      action: { label: "Tandai terbit", onClick: () => void markPublished(i) },
    });
  } catch (e) {
    toast.error(`Ekspor gagal: ${e instanceof Error ? e.message : String(e)}`, { id: t });
  }
}

export const canNotify = () => typeof Notification !== "undefined";
export const notifyPermission = () => (canNotify() ? Notification.permission : "denied");
/** Must be called from a click. Resolves to the resulting permission. */
export const askNotifications = async () => (canNotify() ? Notification.requestPermission() : "denied");

function announce(i: PlanItem) {
  const title = i.title || i.project || "Konten";
  const detail = `${i.time} · ${PLATFORM_LABEL[i.platform]}`;
  toast(`Waktunya tayang: ${title}`, {
    id: keyOf(i),
    description: detail,
    duration: Infinity,
    action: { label: "Ekspor & salin caption", onClick: () => void exportAndCopy(i) },
    cancel: { label: "Tandai terbit", onClick: () => void markPublished(i) },
  });
  if (canNotify() && Notification.permission === "granted" && document.hidden) {
    const n = new Notification(`Waktunya tayang: ${title}`, { body: detail, tag: keyOf(i) });
    n.onclick = () => {
      window.focus();
      window.dispatchEvent(new CustomEvent("carousel:plan"));
      n.close();
    };
  }
}

/** Slots whose time has come, are still ready to go, and have not been announced yet. */
function dueNow(list: PlanItem[], now = Date.now(), done = new Set(reminded())): PlanItem[] {
  return list.filter((i) => (i.status === "siap" || i.status === "terjadwal") && at(i) <= now && now - at(i) <= WINDOW_MS && !done.has(keyOf(i)));
}

function check() {
  const list = planItems();
  if (!list) return;
  for (const i of dueNow(list)) {
    remember(keyOf(i));
    announce(i);
  }
}

/** Mount once at the top of the app: keeps the plan fresh and fires reminders on every page (editor included). */
export function useReminders() {
  useEffect(() => {
    const tick = () => refreshPlan().then(check);
    tick();
    const poll = window.setInterval(tick, POLL_MS);
    const clock = window.setInterval(check, CHECK_MS);
    const wake = () => !document.hidden && tick();
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(clock);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
    };
  }, []);
}
