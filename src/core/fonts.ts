import { copyFile, mkdir, readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { FONT_EXTS, attachFont } from "./fontUtil.ts";
import { checkFile, loadProject, projectDir, saveProject } from "./projects.ts";

export const MAX_FONT = 5 * 1024 * 1024;
export const FONT_TYPES: Record<string, string> = { woff2: "font/woff2", woff: "font/woff", ttf: "font/ttf", otf: "font/otf" };

export const fontsDir = (project: string) => join(projectDir(project), "fonts");
const exists = (p: string) => stat(p).then(() => true, () => false);
const extOf = (n: string) => n.slice(n.lastIndexOf(".") + 1).toLowerCase();

/** The file must really be a font of the type its extension claims (magic bytes), so arbitrary data never lands in fonts/ or a @font-face url. */
export function checkFont(name: string, data: Buffer): string {
  checkFile(name);
  const ext = extOf(name);
  if (!(FONT_EXTS as readonly string[]).includes(ext) || name.lastIndexOf(".") < 1) throw new Error(`font must be ${FONT_EXTS.join(", ")}`);
  if (data.length > MAX_FONT) throw new Error("font too large (max 5 MB)");
  if (data.length < 12) throw new Error("not a valid font file");
  const tag = data.subarray(0, 4).toString("latin1");
  const ok = ext === "woff2" ? tag === "wOF2" : ext === "woff" ? tag === "wOFF" : ext === "otf" ? tag === "OTTO" || data.readUInt32BE(0) === 0x00010000 : data.readUInt32BE(0) === 0x00010000 || tag === "true" || tag === "ttcf";
  if (!ok) throw new Error(`"${name}" is not a valid .${ext} font file`);
  return ext;
}

export async function listFonts(project: string): Promise<string[]> {
  try {
    return (await readdir(fontsDir(project))).filter((f) => !f.startsWith(".") && FONT_TYPES[extOf(f)]).sort();
  } catch {
    return [];
  }
}

/** Stores a font in the project's fonts/. Never replaces a different file of the same name (slides already use that family); the same bytes again is fine. */
export async function saveFont(project: string, name: string, data: Buffer): Promise<string> {
  checkFont(name, data);
  const dest = join(fontsDir(project), name);
  if (await exists(dest)) {
    if ((await readFile(dest)).equals(data)) return name;
    throw new Error(`a different font named "${name}" already exists in this project: rename the file`);
  }
  await mkdir(fontsDir(project), { recursive: true });
  const tmp = `${dest}.tmp`;
  await writeFile(tmp, data);
  await rename(tmp, dest);
  return name;
}

export async function readFontFile(dir: string, name: string): Promise<{ data: Buffer; type: string }> {
  checkFile(name);
  return { data: await readFile(join(dir, name)), type: FONT_TYPES[extOf(name)] ?? "application/octet-stream" };
}

/** MCP / CLI: copy a local font file in and attach it (file + `fontFiles` + a `{token}`). Returns the family name and token. */
export async function importFont(project: string, srcPath: string): Promise<{ file: string; family: string; token: string }> {
  const file = checkFile(basename(srcPath));
  await saveFont(project, file, await readFile(srcPath));
  const c = await loadProject(project);
  const token = attachFont(c, file);
  await saveProject(project, c);
  return { file, family: file.slice(0, file.lastIndexOf(".")), token };
}

/** Copies the named font files from one fonts/ folder to another; a file that already exists at the destination is kept. Missing sources are skipped. Returns the names now present. */
export async function copyFonts(srcDir: string, dstDir: string, files: string[]): Promise<string[]> {
  const present: string[] = [];
  for (const f of files) {
    checkFile(f);
    const src = join(srcDir, f);
    if (!(await exists(src))) continue;
    await mkdir(dstDir, { recursive: true });
    if (!(await exists(join(dstDir, f)))) await copyFile(src, join(dstDir, f));
    present.push(f);
  }
  return present;
}
