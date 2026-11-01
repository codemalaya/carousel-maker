import type { ChartEl, TableEl } from "./schema.ts";

/** Pure SVG / HTML for chart and table elements (no node imports: the web editor and the headless renderer share it). */

export const DEFAULT_COLORS = ["#4f46e5", "#f59e0b", "#10b981", "#ef4444", "#06b6d4", "#8b5cf6", "#ec4899", "#84cc16"];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const r1 = (n: number) => Math.round(n * 10) / 10;
const textW = (s: string, fs: number) => s.length * fs * 0.56; // rough width, good enough to place labels
const clip = (s: string, max: number) => (max < 1 ? "" : s.length <= max ? s : max <= 1 ? "…" : `${s.slice(0, max - 1)}…`);

/** 1234.5 -> "1234.5", 0.1+0.2 -> "0.3": same output in every browser and in node, so editor == export. */
export const fmtNum = (v: number) => String(Math.round(v * 100) / 100);

function niceScale(min: number, max: number, ticks = 5) {
  if (max === min) max = min + 1;
  const rough = (max - min) / (ticks - 1);
  const mag = 10 ** Math.floor(Math.log10(rough));
  const n = rough / mag;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
  const lo = Math.floor(min / step + 1e-9) * step;
  const hi = Math.ceil(max / step - 1e-9) * step;
  const out: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(Number(v.toFixed(10)));
  return { lo: out[0], hi: out[out.length - 1], ticks: out };
}

/** Data problems the linter reports (empty chart, ragged series, negative pie, ...). */
export function chartIssues(el: ChartEl): string[] {
  const out: string[] = [];
  const n = Math.max(el.labels.length, ...el.series.map((s) => s.values.length), 0);
  if (!el.series.length || n === 0) return ["chart has no data"];
  if (el.series.some((s) => s.values.length !== el.labels.length)) out.push(`series length differs from labels (${el.labels.length} labels; series have ${el.series.map((s) => s.values.length).join("/")} values)`);
  if ((el.kind === "pie" || el.kind === "donut") && el.series[0].values.some((v) => v < 0)) out.push("pie/donut ignores negative values");
  if ((el.kind === "pie" || el.kind === "donut") && el.series[0].values.every((v) => v <= 0)) out.push("pie/donut has no positive value");
  if ((el.kind === "pie" || el.kind === "donut") && el.series.length > 1) out.push("pie/donut only draws the first series");
  return out;
}

export function tableIssues(el: TableEl): string[] {
  if (!el.rows.length) return ["table has no rows"];
  const cols = el.rows.map((r) => r.length);
  return new Set(cols).size > 1 ? [`rows have different column counts (${[...new Set(cols)].join(", ")}); short rows are padded`] : [];
}

/**
 * `color` maps a color string (may hold `{token}` refs) to a CSS color. Text uses `currentColor`, so it follows the element's `style.color`.
 * Text sizes are in slide px: base = style.fontSize, else about 1/22 of the smaller side.
 */
export function chartSvg(el: ChartEl, color: (s: string) => string): string {
  const W = el.w ?? 800;
  const H = el.h ?? 500;
  const fs = Number(el.style.fontSize) || Math.max(14, Math.round(Math.min(W, H) / 22));
  const pie = el.kind === "pie" || el.kind === "donut";
  const n = Math.max(el.labels.length, ...el.series.map((s) => s.values.length), 0);
  const pal = (i: number) => color(el.colors[i] ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length]);
  const fmt = (v: number) => `${fmtNum(v)}${esc(el.unit)}`;
  const parts: string[] = [];
  const t = (x: number, y: number, s: string, o: { size?: number; anchor?: string; weight?: number; fill?: string; extra?: string } = {}) =>
    `<text x="${r1(x)}" y="${r1(y)}" font-size="${r1(o.size ?? fs)}" text-anchor="${o.anchor ?? "middle"}"${o.weight ? ` font-weight="${o.weight}"` : ""} fill="${o.fill ?? "currentColor"}"${o.extra ?? ""}>${esc(s)}</text>`;

  if (!el.series.length || n === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${t(W / 2, H / 2, "Belum ada data", { fill: "currentColor", extra: ' opacity="0.5"' })}</svg>`;
  }

  const pad = fs * 0.8;
  let top = pad;
  if (el.title) {
    parts.push(t(W / 2, top + fs * 1.1, el.title, { size: fs * 1.3, weight: 700 }));
    top += fs * 1.9;
  }

  // legend (bottom): greedy rows, centered
  const showLegend = el.legend ?? (pie || el.series.length > 1);
  const entries = pie
    ? el.labels.slice(0, n).map((l, i) => ({ text: el.series[0].values[i] != null && el.valueLabels ? `${l} · ${fmt(el.series[0].values[i])}` : l, c: pal(i) }))
    : el.series.map((s, i) => ({ text: s.name || `Seri ${i + 1}`, c: pal(i) }));
  let bottom = pad;
  if (showLegend && entries.length) {
    const sw = fs * 0.8;
    const rows: (typeof entries)[] = [[]];
    let rowW = 0;
    for (const e of entries) {
      const w = sw + fs * 0.4 + textW(e.text, fs * 0.9) + fs * 1.2;
      if (rowW + w > W - pad * 2 && rows[rows.length - 1].length) {
        rows.push([]);
        rowW = 0;
      }
      rows[rows.length - 1].push(e);
      rowW += w;
    }
    const rowH = fs * 1.5;
    bottom += rows.length * rowH;
    rows.forEach((row, ri) => {
      const widths = row.map((e) => sw + fs * 0.4 + textW(e.text, fs * 0.9) + fs * 1.2);
      let x = (W - widths.reduce((a, b) => a + b, 0) + fs * 1.2) / 2;
      const y = H - pad - (rows.length - ri) * rowH + rowH / 2;
      row.forEach((e, k) => {
        parts.push(`<rect x="${r1(x)}" y="${r1(y - sw / 2)}" width="${r1(sw)}" height="${r1(sw)}" rx="${r1(sw * 0.25)}" fill="${e.c}"/>`);
        parts.push(t(x + sw + fs * 0.4, y + fs * 0.32, e.text, { size: fs * 0.9, anchor: "start" }));
        x += widths[k];
      });
    });
  }

  if (pie) {
    const vals = Array.from({ length: n }, (_, i) => Math.max(0, el.series[0].values[i] ?? 0));
    const total = vals.reduce((a, b) => a + b, 0);
    const cx = W / 2;
    const cy = (top + (H - bottom)) / 2;
    const R = Math.max(10, Math.min(W - pad * 2, H - top - bottom) / 2);
    const inner = el.kind === "donut" ? R * 0.58 : 0;
    if (total <= 0) {
      parts.push(t(cx, cy, "Belum ada data", { extra: ' opacity="0.5"' }));
    } else {
      let a0 = -Math.PI / 2;
      vals.forEach((v, i) => {
        if (v <= 0) return;
        const a1 = a0 + (v / total) * Math.PI * 2;
        const pt = (rad: number, a: number) => `${r1(cx + rad * Math.cos(a))} ${r1(cy + rad * Math.sin(a))}`;
        if (v === total) {
          // a single full slice cannot be an arc (start == end)
          parts.push(inner ? `<path d="M${pt(R, 0)}A${R} ${R} 0 1 1 ${pt(R, Math.PI)}A${R} ${R} 0 1 1 ${pt(R, 0)}M${pt(inner, 0)}A${inner} ${inner} 0 1 0 ${pt(inner, Math.PI)}A${inner} ${inner} 0 1 0 ${pt(inner, 0)}Z" fill="${pal(i)}" fill-rule="evenodd"/>` : `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(R)}" fill="${pal(i)}"/>`);
        } else {
          const large = a1 - a0 > Math.PI ? 1 : 0;
          const d = inner
            ? `M${pt(R, a0)}A${r1(R)} ${r1(R)} 0 ${large} 1 ${pt(R, a1)}L${pt(inner, a1)}A${r1(inner)} ${r1(inner)} 0 ${large} 0 ${pt(inner, a0)}Z`
            : `M${r1(cx)} ${r1(cy)}L${pt(R, a0)}A${r1(R)} ${r1(R)} 0 ${large} 1 ${pt(R, a1)}Z`;
          parts.push(`<path d="${d}" fill="${pal(i)}" stroke="#fff" stroke-width="${r1(fs * 0.12)}"/>`);
        }
        if (el.valueLabels && v / total >= 0.05) {
          const mid = (a0 + a1) / 2;
          const rr = inner ? (R + inner) / 2 : R * 0.62;
          parts.push(t(cx + rr * Math.cos(mid), cy + rr * Math.sin(mid) + fs * 0.32, `${Math.round((v / total) * 100)}%`, { size: fs * 0.9, weight: 700, fill: "#fff", extra: ` stroke="rgba(0,0,0,.35)" stroke-width="${r1(fs * 0.12)}" paint-order="stroke"` }));
        }
        a0 = a1;
      });
    }
  } else {
    const all = el.series.flatMap((s) => s.values.slice(0, n));
    const sc = niceScale(Math.min(0, ...all), Math.max(0, ...all));
    const tickText = sc.ticks.map(fmt);
    const yLabelW = Math.max(...tickText.map((s) => textW(s, fs * 0.85))) + fs * 0.5;
    const x0 = pad + yLabelW;
    const x1 = W - pad;
    const y0 = top + (el.valueLabels ? fs * 0.9 : fs * 0.3);
    const y1 = H - bottom - fs * 1.7;
    const Y = (v: number) => y1 - ((v - sc.lo) / (sc.hi - sc.lo)) * (y1 - y0);
    sc.ticks.forEach((v, i) => {
      parts.push(`<line x1="${r1(x0)}" x2="${r1(x1)}" y1="${r1(Y(v))}" y2="${r1(Y(v))}" stroke="currentColor" stroke-opacity="${v === 0 ? 0.45 : 0.14}" stroke-width="${v === 0 ? 2 : 1}"/>`);
      parts.push(t(x0 - fs * 0.4, Y(v) + fs * 0.3, tickText[i], { size: fs * 0.85, anchor: "end", extra: ' fill-opacity="0.7"' }));
    });
    const group = (x1 - x0) / n;
    const maxChars = Math.floor(group / (fs * 0.56 * 0.9));
    const every = maxChars >= 3 ? 1 : Math.ceil(3 / Math.max(1, maxChars));
    for (let i = 0; i < n; i += every) {
      const lab = el.labels[i] ?? "";
      parts.push(t(x0 + group * (i + 0.5), y1 + fs * 1.3, clip(lab, Math.floor((group * every) / (fs * 0.56 * 0.9))), { size: fs * 0.9, extra: ' fill-opacity="0.8"' }));
    }
    const k = el.series.length;
    if (el.kind === "bar") {
      const inner = group * 0.78;
      const bw = inner / k;
      el.series.forEach((s, si) => {
        for (let i = 0; i < n; i++) {
          const v = s.values[i];
          if (v == null) continue;
          const x = x0 + group * i + (group - inner) / 2 + bw * si;
          const ya = Y(v);
          const yb = Y(0);
          parts.push(`<rect x="${r1(x + bw * 0.04)}" y="${r1(Math.min(ya, yb))}" width="${r1(bw * 0.92)}" height="${r1(Math.max(1, Math.abs(yb - ya)))}" rx="${r1(Math.min(bw * 0.12, fs * 0.3))}" fill="${pal(si)}"/>`);
          const lab = fmt(v);
          if (el.valueLabels && textW(lab, fs * 0.85) <= group / k) parts.push(t(x + bw / 2, v >= 0 ? ya - fs * 0.3 : ya + fs * 1.0, lab, { size: fs * 0.85, weight: 600 }));
        }
      });
    } else {
      el.series.forEach((s, si) => {
        const pts = s.values.slice(0, n).map((v, i) => [x0 + group * (i + 0.5), Y(v), v] as const);
        parts.push(`<polyline points="${pts.map(([x, y]) => `${r1(x)},${r1(y)}`).join(" ")}" fill="none" stroke="${pal(si)}" stroke-width="${r1(fs * 0.2)}" stroke-linejoin="round" stroke-linecap="round"/>`);
        pts.forEach(([x, y, v]) => {
          parts.push(`<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(fs * 0.32)}" fill="${pal(si)}" stroke="#fff" stroke-width="${r1(fs * 0.1)}"/>`);
          const lab = fmt(v);
          if (el.valueLabels && textW(lab, fs * 0.85) <= group) parts.push(t(x, y - fs * 0.65, lab, { size: fs * 0.85, weight: 600 }));
        });
      });
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block;overflow:visible">${parts.join("")}</svg>`;
}

export function tableHtml(el: TableEl, color: (s: string) => string): string {
  const cols = Math.max(0, ...el.rows.map((r) => r.length));
  const cell = (s: string) => esc(s).replace(/\n/g, "<br>");
  const line = color(el.lineColor);
  const rows = el.rows
    .map((row, ri) => {
      const head = el.header && ri === 0;
      const bg = head ? `background:${color(el.headerFill)};color:${color(el.headerColor)};font-weight:700` : el.zebra && (ri - (el.header ? 1 : 0)) % 2 === 1 ? `background:${color(el.stripeFill)}` : "";
      const tds = Array.from({ length: cols }, (_, ci) => {
        const tag = head ? "th" : "td";
        return `<${tag} style="padding:.5em .75em;text-align:${el.align[ci] ?? "left"};border-bottom:1px solid ${line};vertical-align:middle">${cell(row[ci] ?? "")}</${tag}>`;
      }).join("");
      return `<tr style="${bg}">${tds}</tr>`;
    })
    .join("");
  return `<table style="width:100%;border-collapse:collapse;font:inherit;color:inherit"><tbody>${rows}</tbody></table>`;
}
