/** Lucide icons as inline SVG for slides (the editor's icon library and MCP `add_icon`). Read from the installed lucide-react package, so no extra dependency. */

type Node = [string, Record<string, string | number>][];

let names: Set<string> | null = null;

async function iconNames(): Promise<Set<string>> {
  if (!names) {
    const map = (await import("lucide-react/dynamicIconImports")).default as Record<string, unknown>;
    names = new Set(Object.keys(map));
  }
  return names;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** Names containing every word of `q` (words split on space or "-"); best matches first (exact, prefix, then shorter names). */
export async function searchIcons(q: string, limit = 60): Promise<string[]> {
  const words = q.toLowerCase().split(/[\s-]+/).filter(Boolean);
  const all = [...(await iconNames())];
  if (!words.length) return all.slice(0, limit);
  const joined = words.join("-");
  const rank = (n: string) => (n === joined ? 0 : n.startsWith(joined) ? 1 : n.split("-").includes(words[0]) ? 2 : 3);
  return all
    .filter((n) => words.every((w) => n.includes(w)))
    .sort((a, b) => rank(a) - rank(b) || a.length - b.length || a.localeCompare(b))
    .slice(0, limit);
}

/** `<svg>` for one icon, 100% x 100% so the element box sets the size, stroked with currentColor. Throws for an unknown name (the name is checked against the real list, never used as a path blindly). */
export async function iconSvg(name: string, strokeWidth = 2): Promise<string> {
  if (!/^[a-z0-9-]+$/.test(name) || !(await iconNames()).has(name)) throw new Error(`unknown icon "${name}" (use search_icons)`);
  const mod = (await import(`lucide-react/icons/${name}`)) as { __iconData?: { node: Node }; __iconNode?: Node };
  const node = mod.__iconData?.node ?? mod.__iconNode; // the package changed this export between versions
  if (!node) throw new Error(`icon "${name}" has an unsupported format`);
  const inner = node.map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).filter(([k]) => k !== "key").map(([k, v]) => `${k}="${esc(String(v))}"`).join(" ")}/>`).join("");
  const sw = Math.min(6, Math.max(0.5, strokeWidth));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}
