import type { ChartEl, TableEl } from "../../../core/schema";

/** Spreadsheet-style text <-> chart/table data. Paste straight from Sheets/Excel (tab separated), or type with ";" or ",". */

function delimiter(text: string): string {
  return text.includes("\t") ? "\t" : text.includes(";") ? ";" : ",";
}

/** One line split on `d`, honoring "double quoted" cells. */
function splitLine(line: string, d: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') (cur += '"'), i++;
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === d) (out.push(cur), (cur = ""));
    else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

const grid = (text: string) => {
  const d = delimiter(text);
  return { d, rows: text.split(/\r?\n/).filter((l) => l.trim() !== "").map((l) => splitLine(l, d)) };
};

const cellText = (s: string) => (/[\t\n]/.test(s) ? s.replace(/[\t\n]+/g, " ") : s);

export const chartToText = (el: Pick<ChartEl, "labels" | "series">): string => {
  const n = Math.max(el.labels.length, ...el.series.map((s) => s.values.length), 0);
  const head = ["", ...el.series.map((s) => cellText(s.name))].join("\t");
  const body = Array.from({ length: n }, (_, i) => [cellText(el.labels[i] ?? ""), ...el.series.map((s) => (s.values[i] == null ? "" : String(s.values[i])))].join("\t"));
  return [head, ...body].join("\n");
};

/** First row = header (first cell ignored, the rest are series names); first column = labels. Returns an error message instead of throwing. */
export function parseChartText(text: string): { labels: string[]; series: ChartEl["series"] } | string {
  const { d, rows } = grid(text);
  if (rows.length < 2) return "Butuh baris judul (nama seri) dan minimal satu baris data.";
  const head = rows[0];
  if (head.length < 2) return "Butuh minimal dua kolom: label dan satu seri.";
  if (head.length > 9) return "Maksimal 8 seri.";
  const series: ChartEl["series"] = head.slice(1).map((name) => ({ name, values: [] }));
  const labels: string[] = [];
  for (let r = 1; r < rows.length; r++) {
    labels.push(rows[r][0] ?? "");
    for (let c = 1; c < head.length; c++) {
      const raw = rows[r][c] ?? "";
      if (raw === "") {
        series[c - 1].values.push(0);
        continue;
      }
      // with ";" or tab as separator a comma is the decimal mark ("1,5")
      const cleaned = (d === "," ? raw : raw.replace(",", ".")).replace(/[^\d.\-eE]/g, "");
      const v = cleaned === "" ? NaN : Number(cleaned); // "abc" strips to "" and Number("") would be 0
      if (!Number.isFinite(v)) return `Baris ${r + 1}, kolom ${c + 1}: "${raw}" bukan angka.`;
      series[c - 1].values.push(v);
    }
  }
  if (labels.length > 60) return "Maksimal 60 baris data.";
  return { labels, series };
}

export const tableToText = (el: Pick<TableEl, "rows">): string => el.rows.map((r) => r.map(cellText).join("\t")).join("\n");

export function parseTableText(text: string): string[][] | string {
  const { rows } = grid(text);
  if (!rows.length) return "Tabel kosong.";
  if (rows.length > 60) return "Maksimal 60 baris.";
  if (rows.some((r) => r.length > 12)) return "Maksimal 12 kolom.";
  return rows;
}
