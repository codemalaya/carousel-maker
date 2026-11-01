import { mkdir, readdir, readFile, rename, rm, stat, writeFile, cp, copyFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { Carousel } from "./schema.ts";

export const ROOT = resolve(process.env.CAROUSEL_HOME ?? "projects");
export const DEFAULT_PROJECT = process.env.CAROUSEL_PROJECT ?? "default";

const ID = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
const FILENAME = /^[\w][\w .()-]{0,127}$/;
export const IMAGE_TYPES: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp",
  gif: "image/gif", svg: "image/svg+xml", avif: "image/avif",
};

export function checkId(id: string): string {
  if (!ID.test(id)) throw new Error(`invalid project id "${id}" (letters, digits, - _; max 64)`);
  return id;
}
export function checkFile(name: string): string {
  if (name !== basename(name) || !FILENAME.test(name)) throw new Error(`invalid file name "${name}"`);
  return name;
}

export const projectDir = (id: string) => join(ROOT, checkId(id));
const specPath = (id: string) => join(projectDir(id), "carousel.json");
export const assetsDir = (id: string) => join(projectDir(id), "assets");
export const referencesDir = (id: string) => join(projectDir(id), "references");

const exists = (p: string) => stat(p).then(() => true, () => false);

async function writeAtomic(path: string, data: string | Buffer) {
  const tmp = `${path}.tmp`;
  await writeFile(tmp, data);
  await rename(tmp, path); // readers (agents, other tabs) never see a half-written file
}

export type ProjectInfo = { id: string; title: string; slides: number; format: Carousel["format"]; updated: number };

/** Parsed list entries by project id, valid while the spec's mtime and size are unchanged (the editor polls the list). */
const infoCache = new Map<string, { mtime: number; size: number; info: ProjectInfo | null }>();

export async function listProjects(): Promise<ProjectInfo[]> {
  await mkdir(ROOT, { recursive: true });
  const dirs = (await readdir(ROOT, { withFileTypes: true })).filter((d) => d.isDirectory() && ID.test(d.name));
  const seen = new Set<string>();
  const infos = await Promise.all(
    dirs.map(async (d): Promise<ProjectInfo | null> => {
      const file = specPath(d.name);
      try {
        const st = await stat(file);
        seen.add(d.name);
        let hit = infoCache.get(d.name);
        if (!hit || hit.mtime !== st.mtimeMs || hit.size !== st.size) {
          let info: ProjectInfo | null = null;
          try {
            const c = Carousel.parse(JSON.parse(await readFile(file, "utf8")));
            info = { id: d.name, title: c.title, slides: c.slides.length, format: c.format, updated: st.mtimeMs };
          } catch {
            /* unreadable spec: not a project (cached so it is not re-parsed every poll) */
          }
          hit = { mtime: st.mtimeMs, size: st.size, info };
          infoCache.set(d.name, hit);
        }
        return hit.info;
      } catch {
        return null; // no carousel.json
      }
    }),
  );
  for (const id of infoCache.keys()) if (!seen.has(id)) infoCache.delete(id);
  return infos.filter((i): i is ProjectInfo => !!i).sort((a, b) => b.updated - a.updated);
}

export async function projectExists(id: string) {
  return exists(specPath(id));
}

/** Raw file text, or null when missing. Used by the polling editor for cheap change detection. */
export async function readProjectText(id: string): Promise<string | null> {
  try {
    return await readFile(specPath(id), "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

export async function loadProject(id: string): Promise<Carousel> {
  const text = await readProjectText(id);
  if (text == null) throw new Error(`project "${id}" not found`);
  return Carousel.parse(JSON.parse(text));
}

export async function saveProject(id: string, c: Carousel): Promise<string> {
  const text = JSON.stringify(Carousel.parse(c), null, 2) + "\n";
  await mkdir(projectDir(id), { recursive: true });
  await writeAtomic(specPath(id), text);
  return text;
}

export async function createProject(id: string, from?: string, format?: Carousel["format"]): Promise<void> {
  if (await projectExists(id)) throw new Error(`project "${id}" already exists`);
  await mkdir(assetsDir(id), { recursive: true });
  await mkdir(referencesDir(id), { recursive: true });
  if (from) {
    // duplicate: spec + assets + references + fonts
    for (const sub of ["assets", "references", "fonts"]) {
      const src = join(projectDir(from), sub);
      if (await exists(src)) await cp(src, join(projectDir(id), sub), { recursive: true });
    }
    await saveProject(id, await loadProject(from));
  } else {
    await saveProject(id, Carousel.parse(format ? { format } : {}));
  }
}

export async function renameProject(id: string, to: string): Promise<void> {
  if (await exists(projectDir(to))) throw new Error(`"${to}" already exists`);
  await rename(projectDir(id), projectDir(to));
}

/** Never hard-delete: move to projects/.trash so a mistake is recoverable. */
export async function trashProject(id: string): Promise<string> {
  const dest = join(ROOT, ".trash", `${checkId(id)}-${Date.now()}`);
  await mkdir(join(ROOT, ".trash"), { recursive: true });
  await rename(projectDir(id), dest);
  return dest;
}

export type TrashItem = { name: string; id: string; title: string; format: Carousel["format"]; deleted: number; slides: number };
const TRASH_NAME = /^([a-z0-9][a-z0-9_-]{0,63})-(\d{10,})$/i;

export async function listTrash(): Promise<TrashItem[]> {
  const dir = join(ROOT, ".trash");
  const out: TrashItem[] = [];
  for (const d of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const m = d.isDirectory() ? TRASH_NAME.exec(d.name) : null;
    if (!m) continue;
    let c: Carousel;
    try {
      c = Carousel.parse(JSON.parse(await readFile(join(dir, d.name, "carousel.json"), "utf8")));
    } catch {
      continue; // no readable spec: nothing to restore from the UI
    }
    out.push({ name: d.name, id: m[1], title: c.title, format: c.format, deleted: Number(m[2]), slides: c.slides.length });
  }
  return out.sort((a, b) => b.deleted - a.deleted);
}

const trashEntry = (name: string) => {
  if (!TRASH_NAME.test(checkFile(name))) throw new Error(`invalid trash entry "${name}"`);
  return join(ROOT, ".trash", name);
};

/** Raw spec text of a trashed project (for thumbnails on the trash page). */
export const readTrashSpec = (name: string) => readFile(join(trashEntry(name), "carousel.json"), "utf8");
export const trashFontsDir = (name: string) => join(trashEntry(name), "fonts");
export const readTrashAsset = (name: string, file: string) => readFile(join(trashEntry(name), "assets", checkFile(file)));

/** Move a trashed project back. If its id is taken, restore under a free "<id>-restored[-n]" name. */
export async function restoreProject(name: string): Promise<string> {
  const m = TRASH_NAME.exec(checkFile(name));
  if (!m) throw new Error(`invalid trash entry "${name}"`);
  const src = join(ROOT, ".trash", name);
  if (!(await exists(src))) throw new Error(`"${name}" not found in trash`);
  let id = m[1];
  for (let n = 1; await exists(projectDir(id)); n++) {
    const suffix = n === 1 ? "-restored" : `-restored-${n}`;
    id = m[1].slice(0, 64 - suffix.length) + suffix;
  }
  await rename(src, projectDir(id));
  return id;
}

/** The only hard delete in the app, reachable from the trash page only (not MCP, not CLI). Same name rules as restore. */
export async function purgeTrash(name: string): Promise<void> {
  if (!TRASH_NAME.test(checkFile(name))) throw new Error(`invalid trash entry "${name}"`);
  await rm(join(ROOT, ".trash", name), { recursive: true, force: true });
}

/** Purge everything the trash page lists; returns how many projects went. */
export async function emptyTrash(): Promise<number> {
  const items = await listTrash();
  for (const it of items) await purgeTrash(it.name);
  return items.length;
}

export async function setProjectTitle(id: string, title: string): Promise<void> {
  const c = await loadProject(id);
  c.title = title.trim();
  await saveProject(id, c);
}

export async function listFiles(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir)).filter((f) => !f.startsWith(".") && IMAGE_TYPES[f.split(".").pop()!.toLowerCase()]).sort();
  } catch {
    return [];
  }
}

export async function saveAsset(id: string, name: string, data: Buffer, kind: "assets" | "references" = "assets") {
  checkFile(name);
  if (!IMAGE_TYPES[name.split(".").pop()!.toLowerCase()]) throw new Error("only image files allowed");
  const dir = join(projectDir(id), kind);
  await mkdir(dir, { recursive: true });
  await writeAtomic(join(dir, name), data);
}

export async function importAsset(id: string, srcPath: string, kind: "assets" | "references" = "assets") {
  const name = checkFile(basename(srcPath));
  const dir = join(projectDir(id), kind);
  await mkdir(dir, { recursive: true });
  await copyFile(srcPath, join(dir, name));
  return name;
}

export async function readAsset(id: string, name: string, kind: "assets" | "references" = "assets") {
  checkFile(name);
  return readFile(join(projectDir(id), kind, name));
}

export async function removeFile(path: string) {
  await rm(path, { force: true });
}
