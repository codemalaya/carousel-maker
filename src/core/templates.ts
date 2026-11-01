import { copyFile, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { Carousel, Slide, SlideTemplate } from "./schema.ts";
import { IMAGE_TYPES, ROOT, assetsDir, checkFile, checkId, loadProject } from "./projects.ts";
import { renameAssets, slideAssets, type TemplateInstance } from "./templateUtil.ts";

/** templates/ sits next to projects/. Same rules as brands: ids are folder names, deleting moves to templates/.trash, nothing is hard-deleted here. */
export const TEMPLATES_ROOT = resolve(process.env.CAROUSEL_TEMPLATES ?? join(ROOT, "..", "templates"));

export const templateDir = (id: string) => join(TEMPLATES_ROOT, checkId(id));
const specPath = (id: string) => join(templateDir(id), "template.json");
export const templateAssetsDir = (id: string) => join(templateDir(id), "assets");
const exists = (p: string) => stat(p).then(() => true, () => false);

export type TemplateInfo = { id: string; name: string; format: SlideTemplate["format"]; tags: string[]; elements: number; updated: number };

export async function listTemplates(): Promise<TemplateInfo[]> {
  await mkdir(TEMPLATES_ROOT, { recursive: true });
  const out: TemplateInfo[] = [];
  for (const d of await readdir(TEMPLATES_ROOT, { withFileTypes: true })) {
    if (!d.isDirectory() || d.name.startsWith(".")) continue;
    try {
      const t = await loadTemplate(d.name);
      out.push({ id: d.name, name: t.name, format: t.format, tags: t.tags, elements: t.slide.elements.length, updated: (await stat(specPath(d.name))).mtimeMs });
    } catch {
      /* not a template folder */
    }
  }
  return out.sort((a, b) => b.updated - a.updated);
}

export async function loadTemplate(id: string): Promise<SlideTemplate> {
  try {
    return SlideTemplate.parse(JSON.parse(await readFile(specPath(id), "utf8")));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") throw new Error(`template "${id}" not found`);
    throw e;
  }
}

async function writeSpec(id: string, t: SlideTemplate) {
  await mkdir(templateDir(id), { recursive: true });
  const tmp = `${specPath(id)}.tmp`;
  await writeFile(tmp, JSON.stringify(t, null, 2) + "\n");
  await rename(tmp, specPath(id));
}

/** Template as a one-slide carousel, so the gallery can render it with the normal SlideView (assets resolve to the template's own route). */
export async function templateAsCarousel(id: string): Promise<Carousel> {
  const t = await loadTemplate(id);
  return Carousel.parse({ format: t.format, tokens: t.tokens, slides: [t.slide], title: t.name });
}

const slug = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "template";

/** A free id derived from the name ("hook-besar", "hook-besar-2", ...). */
async function freeId(name: string): Promise<string> {
  const base = slug(name);
  for (let n = 1; ; n++) {
    const id = n === 1 ? base : `${base}-${n}`;
    if (!(await exists(templateDir(id)))) return id;
  }
}

/**
 * Saves a slide as a NEW template (never overwrites). Images the slide uses are copied from the project's assets;
 * references to files that do not exist are left as they are (they render as broken images, same as in the project).
 */
export async function createTemplate(o: { name: string; tags?: string[]; project: string; slide: unknown; format?: SlideTemplate["format"]; tokens?: unknown }): Promise<{ id: string; template: SlideTemplate }> {
  const proj = await loadProject(o.project);
  const t = SlideTemplate.parse({ name: o.name, tags: o.tags ?? [], format: o.format ?? proj.format, tokens: o.tokens ?? proj.tokens, slide: Slide.parse(o.slide) });
  const id = await freeId(t.name);
  const files = (await Promise.all(slideAssets(t.slide).map(async (f) => ((await exists(join(assetsDir(o.project), f))) ? f : null)))).filter((f): f is string => !!f);
  await mkdir(templateAssetsDir(id), { recursive: true });
  for (const f of files) await copyFile(join(assetsDir(o.project), checkFile(f)), join(templateAssetsDir(id), f));
  await writeSpec(id, t);
  return { id, template: t };
}

export async function updateTemplate(id: string, patch: { name?: string; tags?: string[] }): Promise<SlideTemplate> {
  const t = await loadTemplate(id);
  const next = SlideTemplate.parse({ ...t, ...(patch.name !== undefined && { name: patch.name }), ...(patch.tags !== undefined && { tags: patch.tags }) });
  await writeSpec(id, next);
  return next;
}

export async function readTemplateAsset(id: string, name: string): Promise<{ data: Buffer; type: string }> {
  checkFile(name);
  return { data: await readFile(join(templateAssetsDir(id), name)), type: IMAGE_TYPES[extname(name).slice(1).toLowerCase()] ?? "application/octet-stream" };
}

const sameFile = async (a: string, b: string) => (await readFile(a)).equals(await readFile(b));

/**
 * Copies a template's images into the project's assets and returns the slide ready to insert.
 * A file that already exists with identical bytes is reused; a different file with the same name gets a "-n" suffix, and the slide is rewritten to match.
 * The project's spec is NOT touched: the caller inserts the slide (the editor keeps undo, MCP saves).
 */
export async function instantiateTemplate(templateId: string, projectId: string): Promise<TemplateInstance> {
  const t = await loadTemplate(templateId);
  const proj = await loadProject(projectId);
  await mkdir(assetsDir(projectId), { recursive: true });
  const map: Record<string, string> = {};
  for (const f of slideAssets(t.slide)) {
    const src = join(templateAssetsDir(templateId), f);
    if (!(await exists(src))) continue;
    const dot = f.lastIndexOf(".");
    let name = f;
    for (let n = 2; (await exists(join(assetsDir(projectId), name))) && !(await sameFile(src, join(assetsDir(projectId), name))); n++) name = `${f.slice(0, dot)}-${n}${f.slice(dot)}`;
    if (name !== f) map[f] = name;
    if (!(await exists(join(assetsDir(projectId), name)))) await copyFile(src, join(assetsDir(projectId), name));
  }
  const missing = (have: Record<string, string>, want: Record<string, string>) => Object.fromEntries(Object.entries(want).filter(([k]) => !(k in have)));
  const css = t.tokens.css.trim();
  return {
    name: t.name,
    format: t.format,
    slide: renameAssets(t.slide, map),
    palette: missing(proj.tokens.palette, t.tokens.palette),
    fonts: missing(proj.tokens.fonts, t.tokens.fonts),
    css: css && !proj.tokens.css.includes(`/* template:${templateId} */`) && !proj.tokens.css.includes(css) ? `/* template:${templateId} */\n${css}\n/* /template */` : "",
    mismatch: t.format !== proj.format,
  };
}

export async function trashTemplate(id: string): Promise<string> {
  const dest = join(TEMPLATES_ROOT, ".trash", `${checkId(id)}-${Date.now()}`);
  await mkdir(join(TEMPLATES_ROOT, ".trash"), { recursive: true });
  await rename(templateDir(id), dest);
  return dest;
}

/* ---- template trash (templates/.trash): list, restore, purge. Only the trash page purges; MCP and CLI never hard-delete. ---- */

const TRASH_NAME = /^([a-z0-9][a-z0-9_-]{0,63})-(\d{10,})$/i;
export type TemplateTrashItem = { name: string; id: string; title: string; format: SlideTemplate["format"]; tags: string[]; deleted: number };
const trashEntry = (name: string) => {
  if (!TRASH_NAME.test(checkFile(name))) throw new Error(`invalid trash entry "${name}"`);
  return join(TEMPLATES_ROOT, ".trash", name);
};

export async function listTemplateTrash(): Promise<TemplateTrashItem[]> {
  const dir = join(TEMPLATES_ROOT, ".trash");
  const out: TemplateTrashItem[] = [];
  for (const d of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const m = d.isDirectory() ? TRASH_NAME.exec(d.name) : null;
    if (!m) continue;
    try {
      const t = SlideTemplate.parse(JSON.parse(await readFile(join(dir, d.name, "template.json"), "utf8")));
      out.push({ name: d.name, id: m[1], title: t.name, format: t.format, tags: t.tags, deleted: Number(m[2]) });
    } catch {
      /* no readable template.json: nothing to restore from the UI */
    }
  }
  return out.sort((a, b) => b.deleted - a.deleted);
}

/** Raw template of a trashed entry, shaped as a one-slide carousel (thumbnails on the trash page). */
export async function readTrashTemplateSpec(name: string): Promise<string> {
  const t = SlideTemplate.parse(JSON.parse(await readFile(join(trashEntry(name), "template.json"), "utf8")));
  return JSON.stringify(Carousel.parse({ format: t.format, tokens: t.tokens, slides: [t.slide], title: t.name }));
}
export const readTrashTemplateAsset = (name: string, file: string) => readFile(join(trashEntry(name), "assets", checkFile(file)));

/** Moves a trashed template back. If its id is taken, restores under a free "<id>-restored[-n]" name. */
export async function restoreTemplate(name: string): Promise<string> {
  const m = TRASH_NAME.exec(checkFile(name));
  if (!m) throw new Error(`invalid trash entry "${name}"`);
  const src = trashEntry(name);
  if (!(await exists(src))) throw new Error(`"${name}" not found in trash`);
  let id = m[1];
  for (let n = 1; await exists(templateDir(id)); n++) {
    const suffix = n === 1 ? "-restored" : `-restored-${n}`;
    id = m[1].slice(0, 64 - suffix.length) + suffix;
  }
  await mkdir(TEMPLATES_ROOT, { recursive: true });
  await rename(src, templateDir(id));
  return id;
}

export async function purgeTemplateTrash(name: string): Promise<void> {
  await rm(trashEntry(name), { recursive: true, force: true });
}

export async function emptyTemplateTrash(): Promise<number> {
  const items = await listTemplateTrash();
  for (const it of items) await purgeTemplateTrash(it.name);
  return items.length;
}
