import { request as httpsRequest } from "node:https";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { assetsDir, projectDir } from "./projects.ts";
import { safeLookup } from "./source.ts";

/**
 * Stock photos from Pexels. The API key stays on the server (env PEXELS_API_KEY). The agent and the browser only ever pass a numeric photo id:
 * every URL that is fetched comes out of Pexels' own API response and must be https on api.pexels.com / images.pexels.com, port 443,
 * connect to a public address (same lookup guard as fetch_source), no redirects, size and type limits. The photo is saved INTO the project's assets (no hotlinking).
 */

const API_HOST = "api.pexels.com";
const IMAGE_HOST = "images.pexels.com";
const MAX_IMAGE = 15 * 1024 * 1024;
const MAX_JSON = 2 * 1024 * 1024;
const TIMEOUT_MS = 20_000;

export const stockEnabled = () => !!process.env.PEXELS_API_KEY;

/** What was fetched; swappable so tests do not need the network. */
export type Transport = (url: URL, headers: Record<string, string>, maxBytes: number) => Promise<{ status: number; type: string; body: Buffer }>;

export const httpsTransport: Transport = (url, headers, maxBytes) =>
  new Promise((resolve, reject) => {
    const req = httpsRequest(url, { method: "GET", lookup: safeLookup as never, timeout: TIMEOUT_MS, headers: { "user-agent": "carousel-maker", ...headers } }, (res) => {
      const chunks: Buffer[] = [];
      let size = 0;
      res.on("data", (c: Buffer) => {
        size += c.length;
        if (size > maxBytes) return req.destroy(new Error("response too large"));
        chunks.push(c);
      });
      res.on("end", () => resolve({ status: res.statusCode ?? 0, type: String(res.headers["content-type"] ?? "").toLowerCase(), body: Buffer.concat(chunks) }));
      res.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new Error(`timed out after ${TIMEOUT_MS / 1000}s`)));
    req.on("error", reject);
    req.end();
  });

function allowed(raw: string, host: string): URL {
  const u = new URL(raw);
  if (u.protocol !== "https:" || u.hostname !== host || (u.port && u.port !== "443") || u.username || u.password) throw new Error(`refused URL (only https://${host} is allowed)`);
  return u;
}

async function api<T>(path: string, t: Transport): Promise<T> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) throw new Error("stock photos are off: set PEXELS_API_KEY on the server (free key from pexels.com/api)");
  const r = await t(allowed(`https://${API_HOST}${path}`, API_HOST), { authorization: key, accept: "application/json" }, MAX_JSON);
  if (r.status === 401 || r.status === 403) throw new Error("Pexels rejected the API key");
  if (r.status === 429) throw new Error("Pexels rate limit reached (200 requests/hour on the free plan): try again later");
  if (r.status < 200 || r.status >= 300) throw new Error(`Pexels answered HTTP ${r.status}`);
  return JSON.parse(r.body.toString("utf8")) as T;
}

type PexelsPhoto = { id: number; width: number; height: number; url: string; photographer: string; photographer_url: string; alt?: string; src: Record<string, string> };
export type StockPhoto = { id: string; width: number; height: number; thumb: string; alt: string; photographer: string; photographerUrl: string; pageUrl: string };

const strip = (s: string) => s.replace(/[\r\n<>]+/g, " ").trim().slice(0, 200); // text from the provider is shown to the user and the agent: keep it plain

const toPhoto = (p: PexelsPhoto): StockPhoto => ({
  id: String(p.id),
  width: p.width,
  height: p.height,
  thumb: p.src.medium ?? p.src.small ?? "",
  alt: strip(p.alt ?? ""),
  photographer: strip(p.photographer ?? ""),
  photographerUrl: p.photographer_url ?? "",
  pageUrl: p.url ?? "",
});

export async function searchStock(query: string, o: { page?: number; orientation?: "landscape" | "portrait" | "square" } = {}, t: Transport = httpsTransport): Promise<{ photos: StockPhoto[]; page: number; hasMore: boolean }> {
  const q = query.trim().slice(0, 100);
  if (!q) throw new Error("empty search");
  const page = Math.max(1, Math.min(50, Math.floor(o.page ?? 1)));
  const qs = new URLSearchParams({ query: q, per_page: "24", page: String(page) });
  if (o.orientation) qs.set("orientation", o.orientation);
  const r = await api<{ photos: PexelsPhoto[]; next_page?: string }>(`/v1/search?${qs}`, t);
  return { photos: r.photos.map(toPhoto).filter((p) => p.thumb.startsWith(`https://${IMAGE_HOST}/`)), page, hasMore: !!r.next_page };
}

/* ---- credits: who took the photo, kept next to the project (the provider asks for attribution) ---- */

export type Credit = { source: "Pexels"; photographer: string; photographerUrl: string; url: string };
const creditsPath = (project: string) => join(projectDir(project), "credits.json");

export async function readCredits(project: string): Promise<Record<string, Credit>> {
  try {
    return JSON.parse(await readFile(creditsPath(project), "utf8"));
  } catch {
    return {};
  }
}

async function addCredit(project: string, file: string, c: Credit) {
  const all = await readCredits(project);
  all[file] = c;
  const tmp = `${creditsPath(project)}.tmp`;
  await writeFile(tmp, JSON.stringify(all, null, 2) + "\n");
  await rename(tmp, creditsPath(project));
}

function imageType(b: Buffer): "jpg" | "png" | "webp" | null {
  if (b.length > 12 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b.length > 12 && b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) return "png";
  if (b.length > 12 && b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") return "webp";
  return null;
}

/** Downloads one photo (by numeric id) into the project's assets as pexels-<id>.<ext> and records the credit. Repeating it reuses the file. */
export async function downloadStock(project: string, photoId: string, t: Transport = httpsTransport): Promise<{ name: string; width: number; height: number; credit: Credit }> {
  if (!/^\d{1,12}$/.test(photoId)) throw new Error("photo id must be the number from search_stock");
  const p = await api<PexelsPhoto>(`/v1/photos/${photoId}`, t);
  const src = p.src?.large2x ?? p.src?.large;
  if (!src) throw new Error("Pexels returned no image URL for this photo");
  const credit: Credit = { source: "Pexels", photographer: strip(p.photographer ?? ""), photographerUrl: p.photographer_url ?? "", url: p.url ?? "" };
  for (const ext of ["jpg", "png", "webp"]) {
    const name = `pexels-${photoId}.${ext}`;
    if (await stat(join(assetsDir(project), name)).then(() => true, () => false)) return { name, width: p.width, height: p.height, credit };
  }
  const r = await t(allowed(src, IMAGE_HOST), { accept: "image/jpeg,image/png,image/webp" }, MAX_IMAGE);
  if (r.status < 200 || r.status >= 300) throw new Error(`image download failed (HTTP ${r.status})`);
  const ext = imageType(r.body);
  if (!ext) throw new Error("the download is not a JPEG, PNG or WebP image");
  const name = `pexels-${photoId}.${ext}`;
  await mkdir(assetsDir(project), { recursive: true });
  const dest = join(assetsDir(project), name);
  await writeFile(`${dest}.tmp`, r.body);
  await rename(`${dest}.tmp`, dest);
  await addCredit(project, name, credit);
  return { name, width: p.width, height: p.height, credit };
}
