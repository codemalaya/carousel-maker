import type { Carousel } from "./schema.ts";

/** Pure font helpers shared by the renderer, the server, MCP and the web editor (no node imports here). */

export const FONT_EXTS = ["woff2", "woff", "ttf", "otf"] as const;
const FORMAT: Record<string, string> = { woff2: "woff2", woff: "woff", ttf: "truetype", otf: "opentype" };

const extOf = (file: string) => file.slice(file.lastIndexOf(".") + 1).toLowerCase();

/** CSS family name of an uploaded font = its file name without the extension ("Poppins-Bold.woff2" -> "Poppins-Bold"). */
export const fontFamilyOf = (file: string) => file.slice(0, file.lastIndexOf("."));

/** Palette/font tokens are referenced as `{name}` with \w+ only, so "Poppins-Bold" becomes the token `Poppins_Bold`. */
export const fontTokenKey = (file: string) => fontFamilyOf(file).replace(/\W+/g, "_").replace(/^_+|_+$/g, "") || "font";

/**
 * @font-face rules for the font files a project has attached (`tokens.fontFiles`). `url` maps a file name to where it is served.
 * Declared with weight 100-900 so one file serves any requested weight without the browser faking bold; upload each weight as its own family name.
 * File names are limited to [\w .()-] by the server, so nothing here can break out of the quotes.
 */
export function fontFaceCss(files: string[], url?: (file: string) => string): string {
  if (!url) return "";
  return files
    .filter((f) => FORMAT[extOf(f)])
    .map((f) => `@font-face{font-family:'${fontFamilyOf(f)}';src:url('${url(f)}') format('${FORMAT[extOf(f)]}');font-weight:100 900;font-style:normal;font-display:block}`)
    .join("\n");
}

/** Attaches an uploaded font to a project spec: lists the file and adds a `{token}` for it unless that name is taken. Mutates `c`. */
export function attachFont(c: Carousel, file: string): string {
  if (!c.tokens.fontFiles.includes(file)) c.tokens.fontFiles.push(file);
  const key = fontTokenKey(file);
  if (!(key in c.tokens.fonts)) c.tokens.fonts[key] = `'${fontFamilyOf(file)}', sans-serif`;
  return key;
}
