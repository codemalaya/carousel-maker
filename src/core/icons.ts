import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/** Lucide icons as inline SVG for slides (the editor's icon library and MCP `add_icon`). Read from the installed lucide-react package, so no extra dependency. */

type Node = [string, Record<string, string | number>][];

type Index = { names: string[]; load: Record<string, () => Promise<unknown>>; /** old name -> current name: those files only re-export the real icon */ alias: Map<string, string> };
let index: Promise<Index> | null = null;

function iconsDir(): string {
  for (const base of [import.meta.url, join(process.cwd(), "x.js")]) {
    try {
      return join(dirname(createRequire(base).resolve("lucide-react/package.json")), "dist/esm/icons");
    } catch {
      /* try the next base */
    }
  }
  throw new Error("lucide-react is not installed");
}

function load(): Promise<Index> {
  return (index ??= (async () => {
    const loaders = (await import("lucide-react/dynamicIconImports")).default as Record<string, () => Promise<unknown>>;
    const names = Object.keys(loaders);
    const dir = iconsDir();
    const alias = new Map<string, string>();
    await Promise.all(
      names.map(async (n) => {
        const to = /export \{ default \} from '\.\/([a-z0-9-]+)\.mjs'/.exec(await readFile(join(dir, `${n}.mjs`), "utf8").catch(() => ""))?.[1];
        if (to) alias.set(n, to);
      }),
    );
    return { names, alias, load: loaders };
  })());
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** Names containing every word of `q` (words split on space or "-"); best matches first (exact, prefix, then shorter names). Old alias names match too but the result is always the current name. */
export async function searchIcons(q: string, limit = 60): Promise<string[]> {
  const { names, alias } = await load();
  const words = q.toLowerCase().split(/[\s-]+/).filter(Boolean);
  const canon = (n: string) => alias.get(n) ?? n;
  const pool = words.length ? names.filter((n) => words.every((w) => n.includes(w))) : names.filter((n) => !alias.has(n));
  const joined = words.join("-");
  const rank = (n: string) => (n === joined ? 0 : n.startsWith(joined) ? 1 : n.split("-").includes(words[0]) ? 2 : 3);
  const sorted = words.length ? pool.sort((a, b) => rank(a) - rank(b) || a.length - b.length || a.localeCompare(b)) : pool;
  return [...new Set(sorted.map(canon))].slice(0, limit);
}

/** `<svg>` for one icon, 100% x 100% so the element box sets the size, stroked with currentColor. Throws for an unknown name (the name is checked against the real list, never used as a path blindly). */
export async function iconSvg(name: string, strokeWidth = 2): Promise<string> {
  const { names, alias, load: loaders } = await load();
  if (!/^[a-z0-9-]+$/.test(name) || !names.includes(name)) throw new Error(`unknown icon "${name}" (use search_icons)`);
  const real = alias.get(name) ?? name; // an old name works too: it points at the current icon
  if (!names.includes(real)) throw new Error(`icon "${name}" points at a missing icon`);
  const mod = (await loaders[real]()) as { __iconData?: { node: Node }; __iconNode?: Node };
  const node = mod.__iconData?.node ?? mod.__iconNode; // the package changed this export between versions
  if (!node) throw new Error(`icon "${name}" has an unsupported format`);
  const inner = node.map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).filter(([k]) => k !== "key").map(([k, v]) => `${k}="${esc(String(v))}"`).join(" ")}/>`).join("");
  const sw = Math.min(6, Math.max(0.5, strokeWidth));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}
