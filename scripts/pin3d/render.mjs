// node scripts/pin3d/render.mjs <out.png> [letter] [face] [ink]
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { chromium } from "playwright";
const root = path.resolve(import.meta.dirname, "../..");
const [out, letter = "", face = "#f7e8c6", ink = "#1b1b1b"] = process.argv.slice(2);
const types = { ".js": "text/javascript", ".html": "text/html", ".mjs": "text/javascript" };
const srv = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(new URL(req.url, "http://x").pathname.replace("/pin.html", "/scripts/pin3d/pin.html")));
  if (!p.startsWith(root) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" }); fs.createReadStream(p).pipe(res);
}).listen(0);
const port = srv.address().port;
const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"] });
const pg = await b.newPage({ viewport: { width: 1600, height: 1600 } });
pg.on("console", (m) => console.log("[page]", m.text())); pg.on("pageerror", (e) => console.log("[err]", e.message));
await pg.goto(`http://localhost:${port}/pin.html?letter=${encodeURIComponent(letter)}&face=${encodeURIComponent(face)}&ink=${encodeURIComponent(ink)}`);
await pg.waitForFunction("window.__done === true", null, { timeout: 60000 });
await pg.screenshot({ path: out, omitBackground: true });
await b.close(); srv.close(); console.log("ok", out);
