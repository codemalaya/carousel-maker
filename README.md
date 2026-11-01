# carousel-maker

Editor carousel lokal. Satu carousel = satu file JSON; satu renderer dipakai editor web, export PNG/PDF/HTML/MP4/GIF, dan agent AI (Claude lewat MCP).

## Fitur

- **Format**: 1:1, 4:5, 9:16 (social), 16:9 dan 4:3 (presentasi).
- **Editor web**: text, image, shape, grafik (bar, line, pie, donut), tabel, html/SVG; edit teks langsung, undo/redo, zoom/pan, ruler, guide, snapping, drag-drop slide dan layer, tema light/dark.
- **Animasi**: animasi per elemen, step klik, transisi slide (hanya di mode presentasi dan export animasi).
- **Mode presentasi**: fullscreen, speaker notes, laser, blackout, timer.
- **Agent AI**: buat atau ubah carousel dari prompt, artikel (URL), atau teks sumber.
- **Template slide**: simpan slide bagus beserta gambarnya, sisipkan ke project lain dari galeri (filter format, tag, cari).
- **Font sendiri**: unggah .woff2/.woff/.ttf/.otf; dipakai di editor dan semua export (PNG, PDF, HTML mandiri, MP4, GIF).
- **Brand kit**: palette, font, css, brief, logo; diterapkan sebagai snapshot ke project.
- **Planner konten**: kalender bulan/minggu, status slot, pengingat, export `.ics`. Tidak pernah posting otomatis.
- **Sampah**: project, brand kit, template, dan slot planner dihapus ke trash dan bisa dipulihkan.
- **Export**: PNG, ZIP, PDF, HTML (satu file mandiri), MP4, GIF.

## Kebutuhan

- Node.js 20+
- Chromium untuk Playwright (render PNG/PDF/video): `npx playwright install chromium`
- `ffmpeg` di PATH (hanya untuk export MP4/GIF)
- Claude Code CLI (hanya untuk fitur agent AI)

## Mulai

```bash
npm install
npx playwright install chromium
npm run dev
```

Buka URL yang ditampilkan Vite. Tanpa `?p=` tampil Home; `?p=<id>` membuka project.

## Script

| Perintah | Fungsi |
| --- | --- |
| `npm run dev` | Editor web (Vite) |
| `npm run build` | Build ke `dist/` |
| `npm run typecheck` | Cek tipe |
| `npm run carousel -- <cmd>` | CLI (lihat di bawah) |
| `npm run mcp` | Jalankan MCP server (stdio) |

## CLI

```bash
npm run carousel -- list
npm run carousel -- new <id> [--from <id>]
npm run carousel -- render [id] [--pdf|--html|--mp4|--gif] [--scale 2] [--fps 30] [--hold 1500] [--step-gap 1000] [--out dir]
npm run carousel -- lint [id]
```

Hasil export default ke `projects/<id>/out`.

## MCP

Konfigurasi ada di `.mcp.json` (env `CAROUSEL_PROJECT` = project default). Setiap tool menerima `project` opsional.

Tool utama: `list_projects`, `create_project`, `get_carousel`, `get_references`, `set_meta`, `set_slide`, `set_element`, `reorder_slides`, `add_asset`, `add_font`, `render_slide`, `lint`, `export`, `delete` (ke trash), `fetch_source`, `list_brands`, `get_brand`, `apply_brand`, `save_brand`, `list_templates`, `get_template`, `apply_template`, `save_template`, `list_plan`, `set_plan_item`.

`fetch_source` mengambil halaman web sebagai teks tidak tepercaya, dengan pengaman: hanya http(s) port 80/443, tanpa alamat lokal/privat, batas 2 MB / 15 dtk / 5 redirect.

## Struktur data

```
projects/<id>/
  carousel.json   spec carousel
  assets/         gambar yang dipakai slide
  fonts/          font yang diunggah
  references/     referensi gaya untuk agent
  out/            hasil export
projects/.trash/  project terhapus
brands/<id>/      brand.json + logo (override: CAROUSEL_BRANDS)
templates/<id>/   template.json + assets/ (override: CAROUSEL_TEMPLATES)
data/planner.json planner konten (override: CAROUSEL_PLANNER)
```

Lokasi project bisa diubah dengan `CAROUSEL_HOME`.

## Struktur kode

```
src/core     schema, render, projects, brands, planner, source, headless (Playwright)
src/server   REST API untuk editor (api.ts, agent.ts)
src/cli      CLI
src/mcp      MCP server
src/web      editor React + Tailwind v4 + shadcn/ui
```

Detail arsitektur dan alur kerja agent ada di [CLAUDE.md](CLAUDE.md). Daftar tugas di [todo.md](todo.md).

## Catatan

- Editor dan agent menulis file yang sama; penulis terakhir menang. Editor polling file, jadi edit agent muncul langsung.
- Hapus permanen hanya lewat halaman Sampah di UI; MCP dan CLI tidak pernah menghapus permanen.
