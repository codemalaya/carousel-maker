import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DEFAULT_PROJECT, createProject, listProjects, loadProject, projectDir } from "../core/projects";
import { lint, renderPdf, renderPng, renderVideo } from "../core/headless";
import { renderPresentHtml } from "../core/present";
import { renderMockups } from "../core/mockup";

const [cmd, ...args] = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const VALUE_FLAGS = ["out", "from", "scale", "fps", "hold", "step-gap", "slide", "size", "finish", "fit", "camera", "bg", "env", "grain", "soft", "shadow-tilt"];
const positional = args.filter((a, i) => !a.startsWith("--") && !VALUE_FLAGS.includes(args[i - 1]?.replace(/^--/, "")));
const project = positional[0] ?? DEFAULT_PROJECT;

const usage = () => {
  console.error(`usage:
  carousel list
  carousel new <project> [--from <project>]
  carousel render [project] [--pdf | --html | --mp4 | --gif] [--scale 2] [--out dir]   (default out: projects/<project>/out)
    video/gif: [--fps 30] [--hold 1500] [--step-gap 1000]   (hold/step-gap in ms; needs ffmpeg)
  carousel mockup [project] [--slide 1,3 | --slide all] [--size 32|44] [--finish glossy|matte] [--fit cover|contain]
    [--camera angled|three-quarter|front|top-down|back] [--bg #hex | --bg transparent]
    [--env <file in mockup-maker/hdri> [--env-bg]] [--shadow-tilt 0-90] [--grain 0-1] [--soft 0-6]   (slide numbers from 1; default: slide 1; needs mockup-maker, see MOCKUP_MAKER_DIR)
    -> projects/<project>/assets/mockup-<hash>.png
  carousel lint [project]`);
  process.exit(1);
};

if (cmd === "list") {
  for (const p of await listProjects()) console.log(`${p.id}\t${p.slides} slides`);
} else if (cmd === "new") {
  if (!positional[0]) usage();
  await createProject(project, flag("from"));
  console.log(`created ${projectDir(project)}`);
} else if (cmd === "mockup") {
  const c = await loadProject(project);
  const sl = flag("slide") ?? "1";
  const slides = sl === "all" ? c.slides.map((_, i) => i) : sl.split(",").map((n) => Number(n) - 1);
  if (slides.some((i) => !Number.isInteger(i))) usage();
  const size = Number(flag("size") ?? 44) === 32 ? 32 : Number(flag("size") ?? 44) === 44 ? 44 : usage();
  const bg = flag("bg");
  const num = (k: string) => (flag(k) !== undefined ? Number(flag(k)) : undefined);
  const env = flag("env");
  const tilt = num("shadow-tilt");
  const grain = num("grain");
  const soft = num("soft");
  const results = await renderMockups(project, c, slides, {
    diameterMm: size,
    finish: (flag("finish") as "glossy" | "matte" | undefined) ?? "glossy",
    fit: (flag("fit") as "cover" | "contain" | undefined) ?? "cover",
    ...(flag("camera") ? { camera: { preset: flag("camera") } } : {}),
    scene: {
      ...(bg === "transparent" ? { background: { type: "transparent" } } : bg ? { background: { type: "solid", color: bg } } : {}),
      ...(env ? { environment: { src: env, background: args.includes("--env-bg") && bg !== "transparent" } } : {}),
      ...(tilt !== undefined ? { shadow: { tilt, ...(tilt >= 45 ? { distance: 0.25, blur: 3 } : {}) } } : {}),
    },
    output: { ...(bg === "transparent" ? { transparent: true } : {}), ...(grain !== undefined ? { grain } : {}), ...(soft !== undefined ? { softness: soft } : {}) },
  });
  for (const r of results) console.log(`slide ${r.slide + 1} -> ${join(projectDir(project), "assets", r.file)}${r.cached ? " (cached)" : ""}`);
} else if (cmd === "render" || cmd === "lint") {
  const c = await loadProject(project);
  const all = c.slides.map((_, i) => i);
  if (cmd === "render") {
    const out = flag("out") ?? join(projectDir(project), "out");
    await mkdir(out, { recursive: true });
    if (args.includes("--pdf")) {
      const file = join(out, `${project}.pdf`);
      await writeFile(file, await renderPdf(c, project));
      console.log(`pdf -> ${file}`);
      process.exit(0);
    }
    if (args.includes("--html")) {
      const file = join(out, `${project}.html`);
      await writeFile(file, await renderPresentHtml(c, project));
      console.log(`html -> ${file}`);
      process.exit(0);
    }
    for (const kind of ["mp4", "gif"] as const) {
      if (!args.includes(`--${kind}`)) continue;
      const n = (name: string) => (flag(name) != null ? Number(flag(name)) : undefined);
      const file = join(out, `${project}.${kind}`);
      await writeFile(file, await renderVideo(c, project, { kind, fps: n("fps"), hold: n("hold"), stepGap: n("step-gap") }));
      console.log(`${kind} -> ${file}`);
      process.exit(0);
    }
    const pngs = await renderPng(c, all, project, Number(flag("scale") ?? 1));
    await Promise.all(
      pngs.map((buf, i) => writeFile(join(out, `slide-${String(i + 1).padStart(2, "0")}.png`), buf)),
    );
    console.log(`rendered ${pngs.length} slides -> ${out}`);
  } else {
    const issues = await lint(c, all, project);
    if (!issues.length) console.log("no issues");
    for (const i of issues) console.log(`slide ${i.slide + 1} el ${i.element}: ${i.kind}: ${i.message}`);
    process.exit(issues.some((i) => i.kind !== "bleed") ? 1 : 0);
  }
} else usage();
