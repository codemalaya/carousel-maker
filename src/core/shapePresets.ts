/** Ready-made shapes as inline SVG (pure; shared by the web editor and MCP). They use `currentColor`, so the element's `style.color` ({token} allowed) colors them. */

export type ShapePreset = { id: string; label: string; w: number; h: number; svg: string };

const open = (vb: string, extra = `fill="currentColor"`) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="100%" height="100%" ${extra}>`;

export const SHAPE_PRESETS: ShapePreset[] = [
  { id: "arrow", label: "Panah", w: 240, h: 120, svg: `${open("0 0 240 120")}<path d="M0 40h150V0l90 60-90 60V80H0z"/></svg>` },
  { id: "star", label: "Bintang", w: 200, h: 200, svg: `${open("0 0 200 200")}<path d="M100 8l27 58 63 7-47 43 13 63-56-32-56 32 13-63L10 73l63-7z"/></svg>` },
  { id: "heart", label: "Hati", w: 200, h: 180, svg: `${open("0 0 200 180")}<path d="M100 170C20 112 0 76 0 48 0 20 22 0 50 0c22 0 40 12 50 30C110 12 128 0 150 0c28 0 50 20 50 48 0 28-20 64-100 122z"/></svg>` },
  { id: "blob", label: "Blob", w: 240, h: 220, svg: `${open("0 0 240 220")}<path d="M185 25c34 22 58 62 50 100-8 40-46 75-90 85-44 10-98-6-122-42C-7 133 3 82 35 48 67 14 150 3 185 25z"/></svg>` },
  { id: "bubble", label: "Bubble chat", w: 260, h: 200, svg: `${open("0 0 260 200")}<path d="M40 0h180c22 0 40 18 40 40v80c0 22-18 40-40 40h-90l-60 40v-40H40c-22 0-40-18-40-40V40C0 18 18 0 40 0z"/></svg>` },
  { id: "ring", label: "Cincin", w: 200, h: 200, svg: `${open("0 0 200 200", `fill="none" stroke="currentColor" stroke-width="16"`)}<circle cx="100" cy="100" r="88"/></svg>` },
  { id: "wave", label: "Gelombang", w: 400, h: 60, svg: `${open("0 0 400 60", `fill="none" stroke="currentColor" stroke-width="10" stroke-linecap="round"`)}<path d="M5 30c25-40 50-40 75 0s50 40 75 0 50-40 75 0 50 40 75 0 50-40 65-10"/></svg>` },
  { id: "burst", label: "Ledakan", w: 220, h: 220, svg: `${open("0 0 220 220")}<path d="M110 0l22 38 40-20 4 46 44 14-26 38 26 38-44 14-4 46-40-20-22 38-22-38-40 20-4-46-44-14 26-38-26-38 44-14 4-46 40 20z"/></svg>` },
];

const num = (n: number) => Math.round(n);

/**
 * An `html` element holding an SVG, centered on (cx, cy) in slide px. `size` is the longer side; the aspect ratio of `ratio` (w/h) is kept.
 * `color` may be a `{token}`; icons draw with currentColor, so it colors them.
 */
export function svgElement(svg: string, o: { cx: number; cy: number; size: number; ratio?: number; color?: string }) {
  const ratio = o.ratio ?? 1;
  const w = ratio >= 1 ? o.size : o.size * ratio;
  const h = ratio >= 1 ? o.size / ratio : o.size;
  return { type: "html" as const, x: num(o.cx - w / 2), y: num(o.cy - h / 2), w: num(w), h: num(h), html: svg, style: { color: o.color ?? "#111111" } };
}
