import { useCallback, useEffect, useState } from "react";

import type { Brand, Carousel, PlanInput, PlanItem, Slide, SlideTemplate } from "../../core/schema";
import type { TemplateInstance } from "../../core/templateUtil";

export type ProjectInfo = { id: string; title: string; slides: number; format: Carousel["format"]; updated: number };

export type TrashItem = { name: string; id: string; title: string; format: Carousel["format"]; deleted: number; slides: number };

export type TemplateInfo = { id: string; name: string; format: Carousel["format"]; tags: string[]; elements: number; updated: number };
export type TemplateTrashItem = { name: string; id: string; title: string; format: Carousel["format"]; tags: string[]; deleted: number };
export type BrandTrashItem = { name: string; id: string; title: string; colors: string[]; deleted: number };
export type PlanTrashItem = PlanItem & { deleted: number };
export type BrandInfo = { id: string; name: string; colors: string[]; logo?: string; updated: number };
type ApplyResult = { palette: string[]; fonts: string[]; logo?: string };

const enc = encodeURIComponent;

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? res.statusText);
  return data as T;
}
const send = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export const api = {
  list: () => call<ProjectInfo[]>("/api/projects"),
  create: (id: string, from?: string, format?: Carousel["format"]) => call("/api/projects", send("POST", { id, from, format })),
  rename: (id: string, to: string) => call(`/api/projects/${enc(id)}`, send("PATCH", { rename: to })),
  setTitle: (id: string, title: string) => call(`/api/projects/${enc(id)}`, send("PATCH", { title })),
  saveSpec: (id: string, doc: Carousel) => call(`/api/projects/${enc(id)}`, send("POST", doc)),
  trash: () => call<TrashItem[]>("/api/trash"),
  restore: (name: string) => call<{ id: string }>(`/api/trash/${enc(name)}`, { method: "POST" }),
  purge: (name: string) => call(`/api/trash/${enc(name)}`, { method: "DELETE" }),
  emptyTrash: () => call<{ removed: number }>("/api/trash", { method: "DELETE" }),
  trashBrands: () => call<BrandTrashItem[]>("/api/trash/brand"),
  restoreBrand: (name: string) => call<{ id: string }>(`/api/trash/brand/${enc(name)}`, { method: "POST" }),
  purgeBrand: (name: string) => call(`/api/trash/brand/${enc(name)}`, { method: "DELETE" }),
  emptyBrandTrash: () => call<{ removed: number }>("/api/trash/brand", { method: "DELETE" }),
  trashPlan: () => call<PlanTrashItem[]>("/api/trash/plan"),
  restorePlan: (id: string) => call<{ id: string }>(`/api/trash/plan/${enc(id)}`, { method: "POST" }),
  purgePlan: (id: string) => call(`/api/trash/plan/${enc(id)}`, { method: "DELETE" }),
  emptyPlanTrash: () => call<{ removed: number }>("/api/trash/plan", { method: "DELETE" }),
  trashTemplates: () => call<TemplateTrashItem[]>("/api/trash/template"),
  restoreTemplate: (name: string) => call<{ id: string }>(`/api/trash/template/${enc(name)}`, { method: "POST" }),
  purgeTemplate: (name: string) => call(`/api/trash/template/${enc(name)}`, { method: "DELETE" }),
  emptyTemplateTrash: () => call<{ removed: number }>("/api/trash/template", { method: "DELETE" }),
  templates: () => call<TemplateInfo[]>("/api/templates"),
  saveTemplate: (o: { name: string; tags: string[]; project: string; slide: Slide; format: Carousel["format"]; tokens: Carousel["tokens"] }) =>
    call<{ id: string; template: SlideTemplate }>("/api/templates", send("POST", o)),
  deleteTemplate: (id: string) => call(`/api/templates/${enc(id)}`, { method: "DELETE" }),
  useTemplate: (project: string, template: string) => call<TemplateInstance>(`/api/projects/${enc(project)}/templates/${enc(template)}`, { method: "POST" }),
  remove: (id: string) => call(`/api/projects/${enc(id)}`, { method: "DELETE" }),
  fonts: (id: string) => call<string[]>(`/api/projects/${enc(id)}/fonts`),
  assets: (id: string) => call<string[]>(`/api/projects/${enc(id)}/assets`),
  plan: () => call<PlanItem[]>("/api/plan"),
  createPlan: (i: PlanInput) => call<PlanItem>("/api/plan", send("POST", i)),
  updatePlan: (id: string, patch: Partial<Record<keyof PlanInput, unknown>>) => call<PlanItem>(`/api/plan/${enc(id)}`, send("PATCH", patch)),
  deletePlan: (id: string) => call(`/api/plan/${enc(id)}`, { method: "DELETE" }),
  planExported: (project: string) => call<{ marked: number }>("/api/plan/exported", send("POST", { project })),
  brands: () => call<BrandInfo[]>("/api/brands"),
  brand: (id: string) => call<Brand>(`/api/brands/${enc(id)}`),
  createBrand: (id: string, o: { name?: string; fromProject?: string }) => call("/api/brands", send("POST", { id, ...o })),
  saveBrand: (id: string, b: Brand) => call<Brand>(`/api/brands/${enc(id)}`, send("PUT", b)),
  deleteBrand: (id: string) => call(`/api/brands/${enc(id)}`, { method: "DELETE" }),
  applyBrand: (project: string, brand: string) => call<ApplyResult>(`/api/projects/${enc(project)}/brand`, send("POST", { brand })),
  uploadBrandLogo: (id: string, file: File) => {
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    return call<{ logo: string }>(`/api/brands/${enc(id)}/logo?ext=${enc(ext)}`, { method: "POST", body: file });
  },
};

export const brandLogoUrl = (id: string, version: string | number) => `/api/brands/${enc(id)}/logo?v=${version}`;

/** Saved brand kits; `refresh` after any change. */
export function useBrands() {
  const [brands, setBrands] = useState<BrandInfo[] | null>(null);
  const refresh = useCallback(() => api.brands().then(setBrands, () => setBrands([])), []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return { brands, refresh };
}

/** Upload an image into the project's assets (or references = style refs for agents). Unique name so nothing gets overwritten. */
export async function uploadAsset(project: string, file: File, kind: "assets" | "references" = "assets"): Promise<{ name: string; w: number; h: number }> {
  const dot = file.name.lastIndexOf(".");
  const base = (dot > 0 ? file.name.slice(0, dot) : file.name).replace(/[^\w-]+/g, "-").slice(0, 40) || "image";
  const ext = (dot > 0 ? file.name.slice(dot + 1) : "png").toLowerCase().replace(/[^a-z0-9]/g, "");
  const name = `${base}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}.${ext}`; // random tail: pasted screenshots are all "image.png"
  await call(`/api/projects/${enc(project)}/${kind}/${enc(name)}`, { method: "POST", body: file });
  const bmp = await createImageBitmap(file).catch(() => null); // svg etc. may fail: fall back to square
  return { name, w: bmp?.width ?? 600, h: bmp?.height ?? 600 };
}

/** Uploads a font file into the project's fonts/ (the file only; the caller attaches it to the spec). Returns the stored name. */
export async function uploadFont(project: string, file: File): Promise<string> {
  const name = file.name.replace(/[^\w .()-]+/g, "-").replace(/^[^\w]+/, "").slice(0, 120);
  await call(`/api/projects/${enc(project)}/fonts/${enc(name)}`, { method: "POST", body: file });
  return name;
}

export function useAssets(project: string) {
  const [assets, setAssets] = useState<string[]>([]);
  const refresh = useCallback(() => api.assets(project).then(setAssets, () => setAssets([])), [project]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return { assets, refresh };
}

export type ExportOpts = { format: "png" | "zip" | "pdf" | "html" | "mp4" | "gif"; slide?: number; scale?: number };

/** Server renders (Playwright), browser saves the blob. Errors surface instead of a dead download. */
export async function exportProject(project: string, o: ExportOpts): Promise<void> {
  const q = new URLSearchParams({ format: o.format, scale: String(o.scale ?? 1) });
  if (o.slide != null) q.set("slide", String(o.slide));
  const res = await fetch(`/api/projects/${enc(project)}/export?${q}`);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText);
  const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? `${project}.${o.format}`;
  saveBlob(await res.blob(), name);
}

function saveBlob(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

/** One ZIP with a folder per project (each project's slides as PNG). Sequential: the server renders with a single browser. */
export async function exportMany(ids: string[], scale = 1): Promise<void> {
  const { unzipSync, zipSync } = await import("fflate");
  const all: Record<string, Uint8Array> = {};
  for (const id of ids) {
    const res = await fetch(`/api/projects/${enc(id)}/export?${new URLSearchParams({ format: "zip", scale: String(scale) })}`);
    if (!res.ok) throw new Error(`${id}: ${(await res.json().catch(() => ({}))).error ?? res.statusText}`);
    for (const [name, data] of Object.entries(unzipSync(new Uint8Array(await res.arrayBuffer())))) all[`${id}/${name}`] = data;
  }
  saveBlob(new Blob([zipSync(all, { level: 0 }) as BlobPart], { type: "application/zip" }), "carousel-export.zip");
}
