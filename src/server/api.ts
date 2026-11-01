import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import {
  IMAGE_TYPES, assetsDir, createProject, listFiles, listProjects, projectExists,
  emptyTrash, listTrash, loadProject, readAsset, readProjectText, referencesDir, purgeTrash, readTrashAsset, readTrashSpec, renameProject, restoreProject, saveAsset, saveProject, setProjectTitle, trashProject,
} from "../core/projects.ts";
import { Brand, Carousel } from "../core/schema.ts";
import { createPlanItem, emptyPlanTrash, listPlan, toIcs, listPlanTrash, markExported, purgePlanTrash, removePlanItem, restorePlanItem, updatePlanItem } from "../core/planner.ts";
import {
  createTemplate, emptyTemplateTrash, instantiateTemplate, listTemplateTrash, listTemplates, loadTemplate, purgeTemplateTrash, readTemplateAsset, readTrashTemplateAsset,
  readTrashTemplateSpec, restoreTemplate, templateAsCarousel, trashTemplate, updateTemplate,
} from "../core/templates.ts";
import { applyBrand, createBrand, emptyBrandTrash, listBrandTrash, listBrands, purgeBrandTrash, restoreBrand, loadBrand, readBrandLogo, saveBrand, setBrandLogo, trashBrand } from "../core/brands.ts";

const MAX_UPLOAD = 25 * 1024 * 1024;

async function body(req: IncomingMessage, limit = 5 * 1024 * 1024): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error("payload too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

const json = (res: ServerResponse, data: unknown, status = 200) => {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(data));
};

/** GET export?format=png|zip|pdf|html|mp4|gif&slide=N&scale=1|2[&fps=&hold=&stepGap=] -> file download. */
async function exportProject(res: ServerResponse, id: string, q: URLSearchParams) {
  const { renderPdf, renderPng } = await import("../core/headless.ts"); // lazy: playwright is heavy
  const { zipSync } = await import("fflate");
  const c = await loadProject(id);
  const format = z.enum(["png", "zip", "pdf", "html", "mp4", "gif"]).parse(q.get("format") ?? "png");
  const scale = z.coerce.number().min(1).max(3).parse(q.get("scale") ?? 1);
  const pad = (i: number) => String(i + 1).padStart(2, "0");
  const send = (data: Uint8Array | Buffer, name: string, type: string) => {
    res.setHeader("content-type", type);
    res.setHeader("content-disposition", `attachment; filename="${name}"`);
    res.end(Buffer.from(data));
  };

  if (format === "pdf") return send(await renderPdf(c, id), `${id}.pdf`, "application/pdf");
  if (format === "html") {
    const { renderPresentHtml } = await import("../core/present.ts");
    return send(Buffer.from(await renderPresentHtml(c, id)), `${id}.html`, "text/html; charset=utf-8");
  }
  if (format === "mp4" || format === "gif") {
    const { renderVideo } = await import("../core/headless.ts");
    const num = (k: string, min: number, max: number) => (q.has(k) ? z.coerce.number().min(min).max(max).parse(q.get(k)) : undefined);
    const video = await renderVideo(c, id, { kind: format, fps: num("fps", 1, 60), hold: num("hold", 0, 30000), stepGap: num("stepGap", 100, 10000) });
    return send(video, `${id}.${format}`, format === "mp4" ? "video/mp4" : "image/gif");
  }

  const slide = q.get("slide");
  const which = format === "png" ? [z.coerce.number().int().min(0).parse(slide ?? 0)] : c.slides.map((_, i) => i);
  which.forEach((i) => { if (!c.slides[i]) throw new Error(`slide ${i} not found`); });
  const pngs = await renderPng(c, which, id, scale);
  if (format === "png") return send(pngs[0], `${id}-slide-${pad(which[0])}.png`, "image/png");
  const files = Object.fromEntries(pngs.map((b, n) => [`${id}-slide-${pad(which[n])}.png`, new Uint8Array(b)]));
  send(zipSync(files, { level: 0 }), `${id}-slides.zip`, "application/zip");
}

/**
 * /api/templates[/:id[/spec|assets/:file]]  GET list / template / one-slide carousel for thumbnails / image | POST {name, tags?, project, slide, format?, tokens?} save a slide as template | PATCH :id {name?, tags?} | DELETE :id (to templates/.trash)
 * /api/projects/:id/templates/:tid        POST copy the template's images into the project, returns {slide, palette, fonts, css, mismatch} to insert
 * /api/trash/template[/:name[/spec|assets/:file]]  list / restore / purge / empty / thumbnails of trashed templates
 * /api/trash/brand[/:name] , /api/trash/plan[/:id]   GET list | POST :key restore | DELETE :key purge | DELETE empty (brand kits / plan items)
 * /api/trash[/:name/spec|assets/:file]    GET list / trashed spec / trashed asset (thumbnails) | DELETE empty | POST /api/trash/:name restore | DELETE /api/trash/:name purge
 * /api/plan/ics                        GET iCalendar file of every slot that is not published yet
 * /api/plan/agent                      POST {prompt} -> ndjson stream (headless Claude Code limited to the planner tools: fills the calendar with idea slots)
 * /api/plan[/:id]                      GET list | POST item | PATCH :id partial | DELETE :id (to planner.trash.json) | POST /api/plan/exported {project} -> siap/terjadwal become terbit
 * /api/brands[/:id[/logo]]              GET list / brand / logo | POST {id, name?, fromProject?} create | PUT :id save | POST :id/logo?ext= raw bytes | DELETE :id (to brands/.trash)
 * /api/projects/:id/brand               POST {brand} copy the brand's palette/fonts/css/brief/logo into the project
 * /api/projects                         GET list | POST {id, from?}
 * /api/projects/:id                     GET spec (raw text) | POST spec | PATCH {rename} | DELETE (to trash)
 * /api/projects/:id/agent               POST {prompt} -> ndjson stream (headless Claude Code on the carousel MCP)
 * /api/projects/:id/assets[/:name]    GET list/file | POST raw bytes
 * /api/projects/:id/references[/:name]  GET list/file | POST raw bytes
 */
export async function handleApi(req: IncomingMessage, res: ServerResponse, path: string, query = new URLSearchParams()): Promise<boolean> {
  const m = path.split("/").filter(Boolean).map(decodeURIComponent); // ["projects", id, sub, name]
  if (m[0] === "trash") {
    try {
      // brand kits and plan items have their own trash; project trash names always end in -<digits>, so these two words never collide
      if (m[1] === "template") {
        const key = m[2];
        if (key && m[3] === "spec" && req.method === "GET") {
          res.setHeader("content-type", "application/json");
          return res.end(await readTrashTemplateSpec(key)), true;
        }
        if (key && m[3] === "assets" && m[4] && req.method === "GET") {
          res.setHeader("content-type", IMAGE_TYPES[m[4].split(".").pop()!.toLowerCase()] ?? "application/octet-stream");
          return res.end(await readTrashTemplateAsset(key, m[4])), true;
        }
        if (!key && req.method === "GET") return json(res, await listTemplateTrash()), true;
        if (key && req.method === "POST") return json(res, { id: await restoreTemplate(key) }), true;
        if (key && req.method === "DELETE") return await purgeTemplateTrash(key), json(res, { ok: true }), true;
        if (!key && req.method === "DELETE") return json(res, { removed: await emptyTemplateTrash() }), true;
        return json(res, { error: "bad request" }, 400), true;
      }
      if (m[1] === "brand" || m[1] === "plan") {
        const brand = m[1] === "brand";
        const key = m[2];
        if (!key && req.method === "GET") return json(res, brand ? await listBrandTrash() : await listPlanTrash()), true;
        if (key && req.method === "POST") return json(res, brand ? { id: await restoreBrand(key) } : { id: (await restorePlanItem(key)).id }), true;
        if (key && req.method === "DELETE") return await (brand ? purgeBrandTrash(key) : purgePlanTrash(key)), json(res, { ok: true }), true;
        if (!key && req.method === "DELETE") return json(res, { removed: brand ? await emptyBrandTrash() : await emptyPlanTrash() }), true;
        return json(res, { error: "bad request" }, 400), true;
      }
      if (!m[1] && req.method === "GET") return json(res, await listTrash()), true;
      if (m[1] && m[2] === "spec" && req.method === "GET") {
        res.setHeader("content-type", "application/json");
        return res.end(await readTrashSpec(m[1])), true;
      }
      if (m[1] && m[2] === "assets" && m[3] && req.method === "GET") {
        res.setHeader("content-type", IMAGE_TYPES[m[3].split(".").pop()!.toLowerCase()] ?? "application/octet-stream");
        return res.end(await readTrashAsset(m[1], m[3])), true;
      }
      if (m[1] && req.method === "POST") return json(res, { id: await restoreProject(m[1]) }), true;
      if (m[1] && req.method === "DELETE") return await purgeTrash(m[1]), json(res, { ok: true }), true;
      if (!m[1] && req.method === "DELETE") return json(res, { removed: await emptyTrash() }), true;
      return json(res, { error: "bad request" }, 400), true;
    } catch (e) {
      return json(res, { error: e instanceof Error ? e.message : String(e) }, 400), true;
    }
  }
  if (m[0] === "plan") {
    try {
      const [, pid] = m;
      const read = async () => JSON.parse((await body(req)).toString());
      if (!pid && req.method === "GET") return json(res, await listPlan()), true;
      if (!pid && req.method === "POST") return json(res, await createPlanItem(await read())), true;
      if (pid === "ics" && req.method === "GET") {
        res.setHeader("content-type", "text/calendar; charset=utf-8");
        res.setHeader("content-disposition", 'attachment; filename="rencana-konten.ics"');
        return res.end(toIcs(await listPlan())), true;
      }
      if (pid === "agent" && req.method === "POST") {
        const { prompt } = z.object({ prompt: z.string().trim().min(1).max(40000) }).parse(await read());
        const { runPlanAgent } = await import("./agent.ts");
        await runPlanAgent(req, res, prompt);
        return true;
      }
      if (pid === "exported" && req.method === "POST") {
        const { project } = z.object({ project: z.string() }).parse(await read());
        return json(res, { marked: await markExported(project) }), true;
      }
      if (pid && req.method === "PATCH") return json(res, await updatePlanItem(pid, await read())), true;
      if (pid && req.method === "DELETE") return await removePlanItem(pid), json(res, { ok: true }), true;
      return json(res, { error: "bad request" }, 400), true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return json(res, { error: msg }, /not found/.test(msg) ? 404 : 400), true;
    }
  }
  if (m[0] === "brands") {
    try {
      const [, bid, what] = m;
      if (!bid && req.method === "GET") return json(res, await listBrands()), true;
      if (!bid && req.method === "POST") {
        const { id, name, fromProject } = z
          .object({ id: z.string(), name: z.string().max(80).optional(), fromProject: z.string().optional() })
          .parse(JSON.parse((await body(req)).toString()));
        return json(res, { id, brand: await createBrand(id, { name, fromProject }) }), true;
      }
      if (bid && !what && req.method === "GET") return json(res, await loadBrand(bid)), true;
      if (bid && !what && req.method === "PUT") {
        const current = await loadBrand(bid); // must exist: PUT never creates
        const next = Brand.parse(JSON.parse((await body(req)).toString()));
        return json(res, await saveBrand(bid, { ...next, logo: current.logo })), true; // the logo only changes through POST :id/logo
      }
      if (bid && !what && req.method === "DELETE") return await trashBrand(bid), json(res, { ok: true }), true;
      if (bid && what === "logo" && req.method === "GET") {
        const logo = await readBrandLogo(bid);
        if (!logo) return json(res, { error: "no logo" }, 404), true;
        res.setHeader("content-type", logo.type);
        res.setHeader("cache-control", "no-cache");
        return res.end(logo.data), true;
      }
      if (bid && what === "logo" && req.method === "POST") {
        return json(res, { logo: await setBrandLogo(bid, query.get("ext") ?? "", await body(req, 5 * 1024 * 1024)) }), true;
      }
      return json(res, { error: "bad request" }, 400), true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return json(res, { error: msg }, /not found|ENOENT/.test(msg) ? 404 : 400), true;
    }
  }
  if (m[0] === "templates") {
    try {
      const [, tid, what, file] = m;
      if (!tid && req.method === "GET") return json(res, await listTemplates()), true;
      if (!tid && req.method === "POST") {
        const o = z
          .object({ name: z.string().trim().min(1).max(80), tags: z.array(z.string()).max(8).optional(), project: z.string(), slide: z.unknown(), format: Carousel.shape.format.optional(), tokens: z.unknown().optional() })
          .parse(JSON.parse((await body(req, 10 * 1024 * 1024)).toString()));
        const { id, template } = await createTemplate(o);
        return json(res, { id, template }), true;
      }
      if (tid && !what && req.method === "GET") return json(res, await loadTemplate(tid)), true;
      if (tid && !what && req.method === "PATCH") {
        const patch = z.object({ name: z.string().trim().min(1).max(80).optional(), tags: z.array(z.string()).max(8).optional() }).parse(JSON.parse((await body(req)).toString()));
        return json(res, await updateTemplate(tid, patch)), true;
      }
      if (tid && !what && req.method === "DELETE") return await trashTemplate(tid), json(res, { ok: true }), true;
      if (tid && what === "spec" && req.method === "GET") {
        res.setHeader("content-type", "application/json");
        res.setHeader("cache-control", "no-cache");
        return res.end(JSON.stringify(await templateAsCarousel(tid))), true;
      }
      if (tid && what === "assets" && file && req.method === "GET") {
        const a = await readTemplateAsset(tid, file);
        res.setHeader("content-type", a.type);
        res.setHeader("cache-control", "no-cache");
        return res.end(a.data), true;
      }
      return json(res, { error: "bad request" }, 400), true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return json(res, { error: msg }, /not found|ENOENT/.test(msg) ? 404 : 400), true;
    }
  }
  if (m[0] !== "projects") return false;
  const [, id, sub, name] = m;
  try {
    if (!id) {
      if (req.method === "GET") return json(res, await listProjects()), true;
      if (req.method === "POST") {
        const { id: newId, from, format } = z
          .object({ id: z.string(), from: z.string().optional(), format: z.enum(["1:1", "4:5", "9:16", "16:9", "4:3"]).optional() })
          .parse(JSON.parse((await body(req)).toString()));
        await createProject(newId, from, format);
        return json(res, { id: newId }), true;
      }
    } else if (!sub) {
      if (req.method === "GET") {
        const text = await readProjectText(id);
        if (text == null) return json(res, { error: "not found" }, 404), true;
        res.setHeader("content-type", "application/json");
        return res.end(text), true;
      }
      if (req.method === "POST") {
        if (!(await projectExists(id))) return json(res, { error: "not found" }, 404), true;
        const spec = Carousel.parse(JSON.parse((await body(req)).toString()));
        res.setHeader("content-type", "application/json");
        return res.end(await saveProject(id, spec)), true;
      }
      if (req.method === "PATCH") {
        const { rename, title } = z
          .object({ rename: z.string().optional(), title: z.string().max(80).optional() })
          .parse(JSON.parse((await body(req)).toString()));
        if (title !== undefined) await setProjectTitle(id, title);
        if (rename) await renameProject(id, rename);
        return json(res, { id: rename ?? id }), true;
      }
      if (req.method === "DELETE") {
        await trashProject(id);
        return json(res, { ok: true }), true;
      }
    } else if (sub === "brand" && req.method === "POST") {
      if (!(await projectExists(id))) return json(res, { error: "not found" }, 404), true;
      const { brand } = z.object({ brand: z.string() }).parse(JSON.parse((await body(req)).toString()));
      return json(res, await applyBrand(id, brand)), true;
    } else if (sub === "templates" && name && req.method === "POST") {
      // copies the template's images into the project and returns the slide to insert; the editor inserts it itself (keeps undo)
      if (!(await projectExists(id))) return json(res, { error: "not found" }, 404), true;
      return json(res, await instantiateTemplate(name, id)), true;
    } else if (sub === "agent" && req.method === "POST") {
      if (!(await projectExists(id))) return json(res, { error: "not found" }, 404), true;
      const { prompt } = z.object({ prompt: z.string().trim().min(1).max(4000) }).parse(JSON.parse((await body(req)).toString()));
      const { runAgent } = await import("./agent.ts");
      await runAgent(req, res, id, prompt);
      return true;
    } else if (sub === "export" && req.method === "GET") {
      await exportProject(res, id, query);
      return true;
    } else if (sub === "assets" || sub === "references") {
      const dir = sub === "assets" ? assetsDir(id) : referencesDir(id);
      if (!name && req.method === "GET") return json(res, await listFiles(dir)), true;
      if (name && req.method === "GET") {
        const data = await readAsset(id, name, sub);
        res.setHeader("content-type", IMAGE_TYPES[name.split(".").pop()!.toLowerCase()] ?? "application/octet-stream");
        res.setHeader("cache-control", "no-cache");
        return res.end(data), true;
      }
      if (name && req.method === "POST") {
        await saveAsset(id, name, await body(req, MAX_UPLOAD), sub);
        return json(res, { name }), true;
      }
    }
    return json(res, { error: "bad request" }, 400), true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json(res, { error: msg }, /ENOENT/.test(msg) ? 404 : 400), true;
  }
}

