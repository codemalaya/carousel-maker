import { z } from "zod";

export const FORMATS = {
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
  "4:3": { width: 1440, height: 1080 },
} as const;

const Style = z.record(z.string(), z.union([z.string(), z.number()])).default({});

export const ANIM_TYPES = ["fade", "up", "down", "left", "right", "zoom", "pop"] as const;
export const TRANSITIONS = ["slide", "fade", "zoom"] as const;

/** Entrance animation. Only plays in the present/preview mode; PNG/PDF exports and the editor canvas show the final state. */
export const Anim = z.object({
  /** fade = opacity only; up/down/left/right = moves in that direction into place; zoom = scales up; pop = overshoots then settles */
  type: z.enum(ANIM_TYPES).default("fade"),
  /** ms to wait after the slide (or its step) appears */
  delay: z.number().min(0).max(10000).default(0),
  /** ms */
  duration: z.number().min(0).max(5000).default(600),
});
export type Anim = z.infer<typeof Anim>;

const Box = {
  id: z.string().optional(),
  x: z.number().default(0),
  y: z.number().default(0),
  w: z.number().optional(),
  h: z.number().optional(),
  rotate: z.number().default(0),
  opacity: z.number().min(0).max(1).default(1),
  z: z.number().default(0),
  style: Style,
  anim: Anim.optional(),
  /** Reveal order in present mode: 0 = visible when the slide appears, 1 = first click/arrow, 2 = second, ... */
  step: z.number().int().min(0).max(50).default(0),
};

export const TextEl = z.object({
  type: z.literal("text"),
  ...Box,
  text: z.string(),
});

export const ImageEl = z.object({
  type: z.literal("image"),
  ...Box,
  src: z.string(),
  fit: z.enum(["cover", "contain"]).default("cover"),
  /** CSS clip-path, e.g. "circle(50%)" or "polygon(...)" */
  mask: z.string().optional(),
});

export const ShapeEl = z.object({
  type: z.literal("shape"),
  ...Box,
  kind: z.enum(["rect", "circle", "line"]).default("rect"),
  fill: z.string().default("#000"),
});

/** Escape hatch: raw HTML/SVG, rendered as-is inside the slide. */
export const HtmlEl = z.object({
  type: z.literal("html"),
  ...Box,
  html: z.string(),
});

export const CHART_KINDS = ["bar", "line", "pie", "donut"] as const;

/** Chart from data, rendered as static SVG (no runtime library, so editor == PNG == PDF == HTML). Size = w x h (default 800 x 500). */
export const ChartEl = z.object({
  type: z.literal("chart"),
  ...Box,
  kind: z.enum(CHART_KINDS).default("bar"),
  title: z.string().max(120).optional(),
  /** X axis categories (bar/line) or slice names (pie/donut) */
  labels: z.array(z.string().max(60)).max(60).default([]),
  /** bar/line: one entry per series (grouped bars / lines). pie/donut: only the first series is used. values[i] belongs to labels[i]. */
  series: z.array(z.object({ name: z.string().max(60).default(""), values: z.array(z.number().finite()).max(60) })).max(8).default([]),
  /** bar/line: one color per series; pie/donut: one per slice. `{token}` refs allowed. Missing ones fall back to a built-in palette. */
  colors: z.array(z.string()).max(60).default([]),
  /** Default: shown for several series and for pie/donut */
  legend: z.boolean().optional(),
  valueLabels: z.boolean().default(true),
  /** Appended to values, e.g. "%" or " jt" */
  unit: z.string().max(12).default(""),
});
export type ChartEl = z.infer<typeof ChartEl>;

/** Table from rows of text. Font (size, family, color) comes from `style`; cells inherit it. */
export const TableEl = z.object({
  type: z.literal("table"),
  ...Box,
  rows: z.array(z.array(z.string().max(500)).max(12)).max(60).default([]),
  /** First row is a header */
  header: z.boolean().default(true),
  /** Per column; missing = left */
  align: z.array(z.enum(["left", "center", "right"])).max(12).default([]),
  zebra: z.boolean().default(true),
  headerFill: z.string().default("#111111"),
  headerColor: z.string().default("#ffffff"),
  stripeFill: z.string().default("rgba(0,0,0,0.05)"),
  lineColor: z.string().default("rgba(0,0,0,0.15)"),
});
export type TableEl = z.infer<typeof TableEl>;

export const Element = z.discriminatedUnion("type", [TextEl, ImageEl, ShapeEl, HtmlEl, ChartEl, TableEl]);
export type Element = z.infer<typeof Element>;

export const Slide = z.object({
  /** Any CSS background value: color, gradient, url(...) */
  bg: z.string().default("#fff"),
  elements: z.array(Element).default([]),
  /** Optional label shown in the slide list, header and preview. Falls back to the biggest text on the slide. */
  name: z.string().max(80).optional(),
  notes: z.string().optional(),
  /** How this slide enters in present mode. Default "slide" (swipe). */
  transition: z.enum(TRANSITIONS).optional(),
});
export type Slide = z.infer<typeof Slide>;

export const Tokens = z.object({
  palette: z.record(z.string(), z.string()).default({}),
  fonts: z.record(z.string(), z.string()).default({}),
  /** Extra CSS injected into every slide (e.g. @import for web fonts) */
  css: z.string().default(""),
  /** Uploaded font files attached to the project (names inside projects/<id>/fonts/); rendered as @font-face, family = file name without extension */
  fontFiles: z.array(z.string()).default([]),
});

/** Reusable look shared across projects (`brands/<id>/brand.json`). Applying it COPIES these into a project's tokens. */
export const Brand = z.object({
  name: z.string().max(80).default(""),
  palette: z.record(z.string(), z.string()).default({}),
  fonts: z.record(z.string(), z.string()).default({}),
  /** Extra CSS (e.g. @import for web fonts), copied into the project's tokens.css inside a marked block */
  css: z.string().default(""),
  /** Tone and rules for agents (layout habits, how to use the logo); copied into the project's brief inside a marked block */
  brief: z.string().default(""),
  /** File name inside brands/<id>/ (png, svg, jpg, webp), copied to the project's assets as brand-logo.<ext> */
  logo: z.string().optional(),
  /** Uploaded font files in brands/<id>/fonts/, copied into the project's fonts/ and attached when the brand is applied */
  fontFiles: z.array(z.string()).default([]),
});
export type Brand = z.infer<typeof Brand>;

/** Reusable slide (`templates/<id>/template.json` + `assets/`). Inserting COPIES the slide and its images into a project. */
export const SlideTemplate = z.object({
  name: z.string().trim().min(1).max(80),
  /** Format the slide was designed for; inserting into another format works but warns (coordinates are absolute px) */
  format: z.enum(["1:1", "4:5", "9:16", "16:9", "4:3"]).default("4:5"),
  tags: z.array(z.string().trim().min(1).max(24)).max(8).default([]),
  /** Tokens the slide was designed with: the gallery thumbnail renders with them, and inserting adds the ones the project lacks */
  tokens: Tokens.default({ palette: {}, fonts: {}, css: "", fontFiles: [] }),
  slide: Slide,
});
export type SlideTemplate = z.infer<typeof SlideTemplate>;

/** Content planner (`data/planner.json`): what goes out when, on which platform. Local only, nothing is posted anywhere. */
export const PLATFORMS = ["instagram", "linkedin", "tiktok", "facebook", "x", "threads", "youtube", "lainnya"] as const;
export const PLAN_STATUS = ["ide", "draft", "siap", "terjadwal", "terbit"] as const;
export const PlanItem = z.object({
  id: z.string().regex(/^[a-z0-9]{6,24}$/),
  /** Short working title / the idea */
  title: z.string().max(120).default(""),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((d) => !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) && new Date(`${d}T00:00:00Z`).toISOString().startsWith(d), "invalid date"),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default("09:00"),
  platform: z.enum(PLATFORMS).default("instagram"),
  /** Linked project id (no slide data is copied; the link can outlive the project) */
  project: z.string().max(64).optional(),
  /** Brand and format used when "Buat carousel" turns an idea into a project */
  brand: z.string().max(64).optional(),
  format: z.enum(["1:1", "4:5", "9:16", "16:9", "4:3"]).optional(),
  caption: z.string().max(5000).default(""),
  hashtags: z.string().max(1000).default(""),
  status: z.enum(PLAN_STATUS).default("ide"),
});
export type PlanItem = z.infer<typeof PlanItem>;
export const PlanInput = PlanItem.omit({ id: true });
export type PlanInput = z.input<typeof PlanInput>;

export const Carousel = z.object({
  /** Brand this project's tokens were last copied from (informational; re-apply to sync). */
  brand: z.string().optional(),
  /** Display name for the project list (the folder id stays the identity). Empty = show the id. */
  title: z.string().max(80).default(""),
  /** Editor guide lines in slide pixels, shared by every slide (consistent margins). Not rendered in exports. */
  guides: z.object({ x: z.array(z.number()).default([]), y: z.array(z.number()).default([]) }).default({ x: [], y: [] }),
  /** Design direction for this project (style, tone, rules). Agents read this before composing. */
  brief: z.string().default(""),
  format: z.enum(["1:1", "4:5", "9:16", "16:9", "4:3"]).default("4:5"),
  tokens: Tokens.default({ palette: {}, fonts: {}, css: "", fontFiles: [] }),
  slides: z.array(Slide).default([]),
});
export type Carousel = z.infer<typeof Carousel>;
