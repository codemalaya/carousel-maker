import { fontFaceCss } from "./fontUtil.ts";
import { FORMATS, type Carousel, type Element, type Slide } from "./schema.ts";

export type RenderOpts = {
  /** Where "assets/<file>" srcs are served from (web: API url, headless: data URIs instead). */
  assetBase?: string;
  /** Takes priority over `assetBase`: maps a file name inside assets/ to a URL (standalone HTML inlines data URIs). */
  assetUrl?: (file: string) => string;
  /** Present mode: mark animated/stepped elements so `animCss` can drive them. Off = final state (editor, PNG, PDF). */
  animate?: boolean;
  /** Where an uploaded font file (`tokens.fontFiles`) is served from; without it no @font-face is emitted (the web editor injects its own). */
  fontUrl?: (file: string) => string;
};

/** Entrance keyframes use the individual `translate`/`scale` properties so they compose with the element's own `rotate` transform. */
export const ANIM_CSS = `
@keyframes cm-fade{from{opacity:0}}
@keyframes cm-up{from{opacity:0;translate:0 60px}}
@keyframes cm-down{from{opacity:0;translate:0 -60px}}
@keyframes cm-left{from{opacity:0;translate:60px 0}}
@keyframes cm-right{from{opacity:0;translate:-60px 0}}
@keyframes cm-zoom{from{opacity:0;scale:.6}}
@keyframes cm-pop{0%{opacity:0;scale:.3}70%{opacity:1;scale:1.08}100%{scale:1}}
@keyframes cm-t-fade{from{opacity:0}}
@keyframes cm-t-zoom{from{opacity:0;scale:.92}}
.cm-a{animation:none}
[data-active="true"] .cm-a{animation:var(--a) var(--d) ease-out var(--dl) both}
[data-active="true"][data-t="fade"]{animation:cm-t-fade 400ms ease both}
[data-active="true"][data-t="zoom"]{animation:cm-t-zoom 450ms cubic-bezier(.22,.8,.3,1) both}
`;

/** Highest reveal step used on a slide (0 = no stepped elements). */
export const maxStep = (slide: Slide) => slide.elements.reduce((m, e) => Math.max(m, e.step), 0);

/** Hides elements whose step is still ahead of the wrapper's `data-cur`. */
export function stepCss(max: number): string {
  let out = "";
  for (let k = 0; k < max; k++) {
    const hidden = Array.from({ length: max - k }, (_, i) => `[data-cur="${k}"] [data-step="${k + 1 + i}"]`).join(",");
    out += `${hidden}{display:none}\n`;
  }
  return out;
}

const resolveSrc = (src: string, o: RenderOpts) =>
  o.assetUrl && src.startsWith("assets/")
    ? o.assetUrl(src.slice("assets/".length))
    : o.assetBase && src.startsWith("assets/")
    ? `${o.assetBase}/${encodeURIComponent(src.slice("assets/".length))}`
    : src;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Resolve "var:name" / "{name}" palette & font refs inside a CSS value. */
function resolve(value: string | number, c: Carousel): string {
  if (typeof value === "number") return `${value}px`;
  return value.replace(/\{(\w+)\}/g, (_, k) => c.tokens.palette[k] ?? c.tokens.fonts[k] ?? `{${k}}`);
}

function css(obj: Record<string, string | number>, c: Carousel): string {
  const unitless = new Set(["opacity", "font-weight", "line-height", "z-index", "flex"]);
  return Object.entries(obj)
    .map(([k, v]) => {
      const prop = k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
      const val = typeof v === "number" && unitless.has(prop) ? String(v) : resolve(v, c);
      return `${prop}:${val}`;
    })
    .join(";");
}

function box(el: Element, c: Carousel, o: RenderOpts): string {
  const parts = [
    "position:absolute",
    `left:${el.x}px`,
    `top:${el.y}px`,
    el.w != null ? `width:${el.w}px` : "",
    el.h != null ? `height:${el.h}px` : "",
    el.rotate ? `transform:rotate(${el.rotate}deg)` : "",
    el.opacity !== 1 ? `opacity:${el.opacity}` : "",
    `z-index:${el.z}`,
    o.animate && el.anim ? `--a:cm-${el.anim.type};--d:${el.anim.duration}ms;--dl:${el.anim.delay}ms` : "",
  ].filter(Boolean);
  return parts.join(";") + ";" + css(el.style, c);
}

function renderElement(el: Element, c: Carousel, o: RenderOpts): string {
  const id =
    (el.id ? ` data-id="${esc(el.id)}"` : "") +
    (o.animate && el.anim ? ` class="cm-a"` : "") +
    (o.animate && el.step > 0 ? ` data-step="${el.step}"` : "");
  switch (el.type) {
    case "text":
      return `<div${id} style="${box(el, c, o)};white-space:pre-wrap">${esc(el.text)}</div>`;
    case "image": {
      const mask = el.mask ? `;clip-path:${el.mask}` : "";
      return `<img${id} src="${esc(resolveSrc(el.src, o))}" style="${box(el, c, o)};object-fit:${el.fit}${mask}">`;
    }
    case "shape": {
      const radius = el.kind === "circle" ? ";border-radius:50%" : "";
      const h = el.kind === "line" && el.h == null ? ";height:4px" : "";
      return `<div${id} style="${box(el, c, o)};background:${resolve(el.fill, c)}${radius}${h}"></div>`;
    }
    case "html":
      return `<div${id} style="${box(el, c, o)}">${el.html}</div>`;
  }
}

export function renderSlideBody(slide: Slide, c: Carousel, o: RenderOpts = {}): string {
  const { width, height } = FORMATS[c.format];
  const els = slide.elements.map((e) => renderElement(e, c, o)).join("\n");
  return `<div class="slide" style="position:relative;overflow:hidden;color:#000;font:400 16px/normal system-ui,-apple-system,'Segoe UI',sans-serif;width:${width}px;height:${height}px;background:${resolve(slide.bg, c)}">${els}</div>`;
}

/** Full standalone HTML doc for a single slide. Used by both web preview and Playwright. */
export function renderSlideHtml(c: Carousel, index: number, o: RenderOpts = {}): string {
  const slide = c.slides[index];
  if (!slide) throw new Error(`slide ${index} not found (have ${c.slides.length})`);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${c.tokens.css}
${fontFaceCss(c.tokens.fontFiles, o.fontUrl)}
*{box-sizing:border-box;margin:0}
body{margin:0;background:#fff}
svg{display:block}
</style></head><body>${renderSlideBody(slide, c, o)}</body></html>`;
}

/** All slides as one printable doc: one page per slide, page size = canvas size. */
export function renderDeckHtml(c: Carousel, o: RenderOpts = {}): string {
  const { width, height } = FORMATS[c.format];
  const pages = c.slides.map((s) => renderSlideBody(s, c, o)).join("\n");
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${c.tokens.css}
${fontFaceCss(c.tokens.fontFiles, o.fontUrl)}
@page{size:${width}px ${height}px;margin:0}
*{box-sizing:border-box;margin:0}
html,body{margin:0;background:#fff}
svg{display:block}
.slide{break-after:page;page-break-after:always}
.slide:last-child{break-after:auto;page-break-after:auto}
</style></head><body>${pages}</body></html>`;
}
