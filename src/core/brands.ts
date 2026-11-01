import { copyFile, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { Brand, Carousel } from "./schema.ts";
import { IMAGE_TYPES, ROOT, assetsDir, checkFile, checkId, loadProject, saveProject } from "./projects.ts";

/** brands/ sits next to projects/. Same rules: ids are folder names, deleting moves to brands/.trash, nothing is ever hard-deleted here. */
export const BRANDS_ROOT = resolve(process.env.CAROUSEL_BRANDS ?? join(ROOT, "..", "brands"));

const MAX_LOGO = 5 * 1024 * 1024;
export const brandDir = (id: string) => join(BRANDS_ROOT, checkId(id));
const specPath = (id: string) => join(brandDir(id), "brand.json");

export type BrandInfo = { id: string; name: string; colors: string[]; logo?: string; updated: number };

export async function listBrands(): Promise<BrandInfo[]> {
  await mkdir(BRANDS_ROOT, { recursive: true });
  const out: BrandInfo[] = [];
  for (const d of await readdir(BRANDS_ROOT, { withFileTypes: true })) {
    if (!d.isDirectory() || d.name.startsWith(".")) continue;
    try {
      const b = await loadBrand(d.name);
      out.push({ id: d.name, name: b.name, colors: Object.values(b.palette).slice(0, 8), logo: b.logo, updated: (await stat(specPath(d.name))).mtimeMs });
    } catch {
      /* not a brand folder */
    }
  }
  return out.sort((a, b) => b.updated - a.updated);
}

export async function loadBrand(id: string): Promise<Brand> {
  try {
    return Brand.parse(JSON.parse(await readFile(specPath(id), "utf8")));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") throw new Error(`brand "${id}" not found`);
    throw e;
  }
}

export async function saveBrand(id: string, b: Brand): Promise<Brand> {
  const parsed = Brand.parse(b);
  if (parsed.logo) checkFile(parsed.logo);
  await mkdir(brandDir(id), { recursive: true });
  const tmp = `${specPath(id)}.tmp`;
  await writeFile(tmp, JSON.stringify(parsed, null, 2) + "\n");
  await rename(tmp, specPath(id));
  return parsed;
}

export async function brandExists(id: string) {
  return stat(specPath(id)).then(() => true, () => false);
}

/** Snapshot a project's tokens as a new brand. Refuses to overwrite an existing brand. */
export async function createBrand(id: string, o: { name?: string; fromProject?: string } = {}): Promise<Brand> {
  if (await brandExists(id)) throw new Error(`brand "${id}" already exists`);
  let b: Brand = Brand.parse({ name: o.name ?? id });
  if (o.fromProject) {
    const c = await loadProject(o.fromProject);
    b = Brand.parse({ name: o.name ?? o.fromProject, palette: c.tokens.palette, fonts: c.tokens.fonts, css: stripBlock(c.tokens.css, "css"), brief: stripBlock(c.brief, "brief") });
  }
  return saveBrand(id, b);
}

export async function setBrandLogo(id: string, ext: string, data: Buffer): Promise<string> {
  const e = ext.toLowerCase().replace(/^\./, "");
  if (!["png", "jpg", "jpeg", "webp", "svg"].includes(e)) throw new Error("logo must be png, jpg, webp or svg");
  if (data.length > MAX_LOGO) throw new Error("logo too large (max 5 MB)");
  const b = await loadBrand(id);
  const name = `logo-${Date.now().toString(36)}.${e}`;
  await writeFile(join(brandDir(id), name), data);
  await saveBrand(id, { ...b, logo: name });
  return name;
}

export async function readBrandLogo(id: string): Promise<{ data: Buffer; type: string } | null> {
  const b = await loadBrand(id);
  if (!b.logo) return null;
  return { data: await readFile(join(brandDir(id), checkFile(b.logo))), type: IMAGE_TYPES[extname(b.logo).slice(1).toLowerCase()] ?? "application/octet-stream" };
}

export async function trashBrand(id: string): Promise<string> {
  const dest = join(BRANDS_ROOT, ".trash", `${checkId(id)}-${Date.now()}`);
  await mkdir(join(BRANDS_ROOT, ".trash"), { recursive: true });
  await rename(brandDir(id), dest);
  return dest;
}

/* ---- brand trash (brands/.trash): list, restore, purge. The trash page is the only caller of purge; MCP and CLI never hard-delete. ---- */

const TRASH_NAME = /^([a-z0-9][a-z0-9_-]{0,63})-(\d{10,})$/i;
export type BrandTrashItem = { name: string; id: string; title: string; colors: string[]; deleted: number };
const trashEntry = (name: string) => {
  if (!TRASH_NAME.test(checkFile(name))) throw new Error(`invalid trash entry "${name}"`);
  return join(BRANDS_ROOT, ".trash", name);
};

export async function listBrandTrash(): Promise<BrandTrashItem[]> {
  const dir = join(BRANDS_ROOT, ".trash");
  const out: BrandTrashItem[] = [];
  for (const d of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const m = d.isDirectory() ? TRASH_NAME.exec(d.name) : null;
    if (!m) continue;
    try {
      const b = Brand.parse(JSON.parse(await readFile(join(dir, d.name, "brand.json"), "utf8")));
      out.push({ name: d.name, id: m[1], title: b.name, colors: Object.values(b.palette).slice(0, 8), deleted: Number(m[2]) });
    } catch {
      /* no readable brand.json: nothing to restore from the UI */
    }
  }
  return out.sort((a, b) => b.deleted - a.deleted);
}

/** Moves a trashed brand back. If its id is taken, restores under a free "<id>-restored[-n]" name. */
export async function restoreBrand(name: string): Promise<string> {
  const m = TRASH_NAME.exec(checkFile(name));
  if (!m) throw new Error(`invalid trash entry "${name}"`);
  const src = trashEntry(name);
  if (!(await stat(src).then(() => true, () => false))) throw new Error(`"${name}" not found in trash`);
  let id = m[1];
  for (let n = 1; await brandExists(id); n++) {
    const suffix = n === 1 ? "-restored" : `-restored-${n}`;
    id = m[1].slice(0, 64 - suffix.length) + suffix;
  }
  await mkdir(BRANDS_ROOT, { recursive: true });
  await rename(src, brandDir(id));
  return id;
}

export async function purgeBrandTrash(name: string): Promise<void> {
  await rm(trashEntry(name), { recursive: true, force: true });
}

export async function emptyBrandTrash(): Promise<number> {
  const items = await listBrandTrash();
  for (const it of items) await purgeBrandTrash(it.name);
  return items.length;
}

/* ---- applying a brand to a project ---- */

const open = (id: string, kind: "css" | "brief") => (kind === "css" ? `/* brand:${id} */` : `[brand:${id}]`);
const close = (kind: "css" | "brief") => (kind === "css" ? "/* /brand */" : "[/brand]");
const blockRe = (kind: "css" | "brief") => new RegExp(`${kind === "css" ? "/\\* brand:[\\w-]+ \\*/" : "\\[brand:[\\w-]+\\]"}[\\s\\S]*?${kind === "css" ? "/\\* /brand \\*/" : "\\[/brand\\]"}\\n?`);

/** Removes a previously applied brand block (so "save project as brand" does not nest another brand's text). */
export function stripBlock(text: string, kind: "css" | "brief"): string {
  return text.replace(blockRe(kind), "").trim();
}

/** Replaces the project's brand block in `text` (or prepends/appends it); an empty brand text just removes the block. */
function putBlock(text: string, id: string, body: string, kind: "css" | "brief"): string {
  const rest = stripBlock(text, kind);
  if (!body.trim()) return rest;
  const block = `${open(id, kind)}\n${body.trim()}\n${close(kind)}`;
  return kind === "css" ? `${block}\n${rest}`.trim() : `${rest}\n\n${block}`.trim(); // @import must stay first in css
}

export type ApplyResult = { palette: string[]; fonts: string[]; logo?: string };

/**
 * Copies a brand into a project: palette and fonts are MERGED (brand keys win, project-only keys stay, so `{tokens}` used by slides never go missing),
 * css and brief go in a marked block that a later apply replaces, the logo is copied to assets/brand-logo.<ext>. Slides are never touched.
 */
export async function applyBrand(projectId: string, brandId: string): Promise<ApplyResult> {
  const b = await loadBrand(brandId);
  const c: Carousel = await loadProject(projectId);
  c.tokens.palette = { ...c.tokens.palette, ...b.palette };
  c.tokens.fonts = { ...c.tokens.fonts, ...b.fonts };
  c.tokens.css = putBlock(c.tokens.css, brandId, b.css, "css");
  c.brief = putBlock(c.brief, brandId, b.brief, "brief");
  c.brand = brandId;
  let logo: string | undefined;
  if (b.logo) {
    await mkdir(assetsDir(projectId), { recursive: true });
    logo = `brand-logo${extname(b.logo).toLowerCase()}`;
    await copyFile(join(brandDir(brandId), checkFile(b.logo)), join(assetsDir(projectId), logo));
  }
  await saveProject(projectId, c);
  return { palette: Object.keys(b.palette), fonts: Object.keys(b.fonts), logo: logo ? `assets/${logo}` : undefined };
}
