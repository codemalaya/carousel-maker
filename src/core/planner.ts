import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { z } from "zod";
import { PlanInput, PlanItem } from "./schema.ts";
import { ROOT } from "./projects.ts";

/**
 * Content planner: one JSON file in data/ (next to projects/) (override with CAROUSEL_PLANNER). Removing an item moves it to planner.trash.json,
 * nothing is hard-deleted here. Writes are serialized so two requests never overwrite each other.
 */
export const PLANNER_FILE = resolve(process.env.CAROUSEL_PLANNER ?? join(ROOT, "..", "data", "planner.json"));
const TRASH_FILE = PLANNER_FILE.replace(/\.json$/, "") + ".trash.json";

const File = z.object({ items: z.array(PlanItem).default([]) });
/** Trashed items keep when they were removed (older trash files have none: 0). */
const TrashItem = PlanItem.extend({ deleted: z.number().default(0) });
export type PlanTrashItem = z.infer<typeof TrashItem>;
const TrashFile = z.object({ items: z.array(TrashItem).default([]) });

async function read(path: string): Promise<PlanItem[]> {
  try {
    return File.parse(JSON.parse(await readFile(path, "utf8"))).items;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

async function readTrash(): Promise<PlanTrashItem[]> {
  try {
    return TrashFile.parse(JSON.parse(await readFile(TRASH_FILE, "utf8"))).items;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

async function write(path: string, items: object[]) {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  await writeFile(tmp, JSON.stringify({ items }, null, 2) + "\n");
  await rename(tmp, path);
}

let queue: Promise<unknown> = Promise.resolve();
const serial = <T>(fn: () => Promise<T>): Promise<T> => {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
};

const byTime = (a: PlanItem, b: PlanItem) => (a.date + a.time).localeCompare(b.date + b.time) || a.id.localeCompare(b.id);

/** Empty strings from forms mean "cleared". */
const clean = (o: Record<string, unknown>) => {
  for (const k of ["project", "brand", "format"]) if (o[k] === "" || o[k] === null) delete o[k];
  return o;
};

export const listPlan = () => read(PLANNER_FILE).then((l) => l.sort(byTime));

export const createPlanItem = (input: unknown) =>
  serial(async () => {
    const item = PlanItem.parse({ ...PlanInput.parse(clean({ ...(input as object) })), id: randomUUID().replace(/-/g, "").slice(0, 10) });
    const items = await read(PLANNER_FILE);
    await write(PLANNER_FILE, [...items, item]);
    return item;
  });

export const updatePlanItem = (id: string, patch: unknown) =>
  serial(async () => {
    const items = await read(PLANNER_FILE);
    const at = items.findIndex((i) => i.id === id);
    if (at < 0) throw new Error(`plan item "${id}" not found`);
    const { id: _id, ...rest } = items[at];
    const merged = clean({ ...rest, ...(patch as object) });
    const next = PlanItem.parse({ ...PlanInput.parse(merged), id });
    items[at] = next;
    await write(PLANNER_FILE, items);
    return next;
  });

export const removePlanItem = (id: string) =>
  serial(async () => {
    const items = await read(PLANNER_FILE);
    const item = items.find((i) => i.id === id);
    if (!item) throw new Error(`plan item "${id}" not found`);
    await write(TRASH_FILE, [...(await readTrash()), { ...item, deleted: Date.now() }]);
    await write(PLANNER_FILE, items.filter((i) => i.id !== id));
    return item;
  });

/** After exporting a project: its `siap` / `terjadwal` items become `terbit`. Returns how many changed. */
export const markExported = (project: string) =>
  serial(async () => {
    const items = await read(PLANNER_FILE);
    let n = 0;
    const next = items.map((i) => (i.project === project && (i.status === "siap" || i.status === "terjadwal") ? (n++, { ...i, status: "terbit" as const }) : i));
    if (n) await write(PLANNER_FILE, next);
    return n;
  });

/* ---- plan trash: list, restore, purge. Purge is for the trash page only; MCP and CLI never hard-delete. ---- */

export const listPlanTrash = () => readTrash().then((l) => l.sort((a, b) => b.deleted - a.deleted));

/** Puts a trashed item back in the plan (with a fresh id if that id is somehow taken). Returns the restored item. */
export const restorePlanItem = (id: string) =>
  serial(async () => {
    const trash = await readTrash();
    const found = trash.find((i) => i.id === id);
    if (!found) throw new Error(`trashed plan item "${id}" not found`);
    const { deleted: _deleted, ...item } = found;
    const items = await read(PLANNER_FILE);
    const restored = items.some((i) => i.id === id) ? { ...item, id: randomUUID().replace(/-/g, "").slice(0, 10) } : item;
    await write(PLANNER_FILE, [...items, restored]);
    await write(TRASH_FILE, trash.filter((i) => i.id !== id));
    return restored;
  });

export const purgePlanTrash = (id: string) =>
  serial(async () => {
    const trash = await readTrash();
    if (!trash.some((i) => i.id === id)) throw new Error(`trashed plan item "${id}" not found`);
    await write(TRASH_FILE, trash.filter((i) => i.id !== id));
  });

export const emptyPlanTrash = () =>
  serial(async () => {
    const trash = await readTrash();
    await write(TRASH_FILE, []);
    return trash.length;
  });

/* ---- calendar export (.ics) ---- */

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Folds a content line at 75 octets (RFC 5545): continuation lines start with one space. */
function fold(line: string): string {
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const n = Buffer.byteLength(ch);
    if (bytes + n > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join("\r\n ");
}

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const local = (date: string, time: string) => `${date.replace(/-/g, "")}T${time.replace(":", "")}00`;
const PLATFORM_NAME: Record<PlanItem["platform"], string> = { instagram: "Instagram", linkedin: "LinkedIn", tiktok: "TikTok", facebook: "Facebook", x: "X", threads: "Threads", youtube: "YouTube", lainnya: "Lainnya" };

/**
 * iCalendar text for the plan (published slots are left out). Times are "floating" (no time zone), so a 18:00 slot shows at 18:00 wherever
 * the calendar app is. Ready slots (`siap`/`terjadwal`) carry a 15 minute alarm; ideas and drafts are TENTATIVE and tagged in the title.
 */
export function toIcs(items: PlanItem[], now = new Date()): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//carousel-maker//planner//ID", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:Rencana konten"];
  for (const i of items.filter((x) => x.status !== "terbit").sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))) {
    const endAt = new Date(new Date(`${i.date}T${i.time}:00`).getTime() + 30 * 60_000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const endLocal = `${endAt.getFullYear()}${pad(endAt.getMonth() + 1)}${pad(endAt.getDate())}T${pad(endAt.getHours())}${pad(endAt.getMinutes())}00`;
    const ready = i.status === "siap" || i.status === "terjadwal";
    const tag = i.status === "ide" ? "Ide" : i.status === "draft" ? "Draft" : PLATFORM_NAME[i.platform];
    const desc = [i.caption, i.hashtags, i.project && `Project: ${i.project}`, `Status: ${i.status}`, `Platform: ${PLATFORM_NAME[i.platform]}`].filter(Boolean).join("\n\n");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${i.id}@carousel-maker`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${local(i.date, i.time)}`,
      `DTEND:${endLocal}`,
      `SUMMARY:${esc(`[${tag}] ${i.title || i.project || "Konten"}`)}`,
      `DESCRIPTION:${esc(desc)}`,
      `STATUS:${ready ? "CONFIRMED" : "TENTATIVE"}`,
      `CATEGORIES:${esc(PLATFORM_NAME[i.platform])}`,
    );
    if (ready) lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(`Waktunya tayang: ${i.title || i.project || "konten"}`)}`, "TRIGGER:-PT15M", "END:VALARM");
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
