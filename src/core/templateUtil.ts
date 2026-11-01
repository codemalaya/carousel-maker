import type { Carousel, Slide, SlideTemplate } from "./schema.ts";

/** Pure helpers shared by the server, MCP and the web editor (no node imports here). */

export const ASSET_REF = /assets\/([\w][\w .()-]{0,127}\.[A-Za-z0-9]{2,5})/g;

/** File names under `assets/` that a slide refers to (image src, html, bg url(...), style values). */
export function slideAssets(slide: Slide): string[] {
  return [...new Set([...JSON.stringify(slide).matchAll(ASSET_REF)].map((m) => m[1]))];
}

/** Rewrites `assets/<old>` to `assets/<new>` for every entry in `map`; other references stay as they are. */
export function renameAssets(slide: Slide, map: Record<string, string>): Slide {
  return JSON.parse(JSON.stringify(slide).replace(ASSET_REF, (all, name: string) => (map[name] ? `assets/${map[name]}` : all)));
}

/** What the server hands back after copying a template's images into a project. */
export type TemplateInstance = {
  name: string;
  format: SlideTemplate["format"];
  slide: Slide;
  /** tokens the template has that the project did not (project values always win) */
  palette: Record<string, string>;
  fonts: Record<string, string>;
  /** font files (already copied into the project's fonts/) to attach */
  fontFiles: string[];
  /** marked css block to prepend, or "" */
  css: string;
  /** true when the template was designed for another format than the project's */
  mismatch: boolean;
};

/** Inserts the instance's slide at `at` (default: end) and merges the missing tokens. Mutates `c`. Returns the index used. */
export function insertInstance(c: Carousel, inst: TemplateInstance, at?: number): number {
  const i = Math.max(0, Math.min(at ?? c.slides.length, c.slides.length));
  c.slides.splice(i, 0, inst.slide);
  c.tokens.palette = { ...inst.palette, ...c.tokens.palette };
  c.tokens.fonts = { ...inst.fonts, ...c.tokens.fonts };
  c.tokens.fontFiles = [...new Set([...c.tokens.fontFiles, ...inst.fontFiles])];
  if (inst.css && !c.tokens.css.includes(inst.css)) c.tokens.css = `${inst.css}\n${c.tokens.css}`.trim();
  return i;
}
