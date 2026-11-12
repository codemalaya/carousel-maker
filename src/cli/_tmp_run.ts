import { renderMockups } from "../core/mockup.ts";
import { loadProject } from "../core/projects.ts";
const c = await loadProject("ransom-club-kapital");
const all = c.slides.map((_, i) => i);
const out: Record<string, string[]> = { "32": [], "44": [] };
for (const mm of [32, 44] as const) {
  const r = await renderMockups("ransom-club-kapital", c, all, {
    diameterMm: mm, finish: "glossy", fit: "cover", camera: { preset: "front" },
    scene: { background: { type: "transparent" }, shadow: { enabled: false }, lighting: { intensity: 1.5 } },
    output: { transparent: true, toneMapping: "neutral" }, timeoutSec: 600,
  });
  out[mm] = r.map((x) => x.file);
}
console.log(JSON.stringify(out));
