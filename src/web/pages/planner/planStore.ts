import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { PlanItem } from "../../../core/schema";
import { api } from "@/shared/api";

/**
 * The content plan, shared by the planner page, the sidebar badge and the reminders (module store, like agentRuns).
 * `null` = not loaded yet. Pages call `refreshPlan` after changing something; reminders poll it.
 */
let items: PlanItem[] | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => void subs.delete(f);
};

export const planItems = () => items;

/** Optimistic local update (the next refreshPlan replaces it with the file's truth). */
function setPlanItems(update: (cur: PlanItem[] | null) => PlanItem[] | null) {
  items = update(items);
  emit();
}

export async function refreshPlan() {
  try {
    items = await api.plan();
  } catch {
    items ??= [];
  }
  emit();
}

export function usePlan() {
  const cur = useSyncExternalStore(subscribe, planItems);
  useEffect(() => {
    if (planItems() === null) refreshPlan();
  }, []);
  return { items: cur, set: setPlanItems, refresh: refreshPlan };
}

const pad = (n: number) => String(n).padStart(2, "0");
const isoDay = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Slots somebody still has to act on: a draft or ready slot. Ideas have nothing to miss, published ones are done. */
const needsAction = (i: PlanItem) => i.status === "draft" || i.status === "siap" || i.status === "terjadwal";
export const isLate = (i: PlanItem, today = isoDay()) => needsAction(i) && i.date < today;

/** Counts for the badges: slots before today, and slots today, that are not published. Re-evaluated every minute (midnight rolls over). */
export function usePlanAlerts() {
  const { items: list } = usePlan();
  const [today, setToday] = useState(isoDay);
  useEffect(() => {
    const t = window.setInterval(() => setToday(isoDay()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  return useMemo(() => {
    const open = (list ?? []).filter(needsAction);
    return { overdue: open.filter((i) => i.date < today).length, today: open.filter((i) => i.date === today).length };
  }, [list, today]);
}
