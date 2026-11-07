# carousel-maker

Editor carousel lokal. Satu carousel = satu file JSON; satu renderer dipakai editor web, export PNG/PDF/HTML/MP4/GIF, dan agent AI (Claude, Codex, atau Gemini lewat MCP).

## Fitur

- **Format**: 1:1, 4:5, 9:16 (social), 16:9 dan 4:3 (presentasi).
- **Editor web**: text, image, shape, grafik (bar, line, pie, donut), tabel, html/SVG; edit teks langsung, undo/redo, zoom/pan, ruler, guide, snapping, drag-drop slide dan layer, tema light/dark.
- **Animasi**: animasi per elemen, step klik, transisi slide (hanya di mode presentasi dan export animasi).
- **Mode presentasi**: fullscreen, speaker notes, laser, blackout, timer.
- **Agent AI**: buat atau ubah carousel dari prompt, artikel (URL), atau teks sumber. Pilih Claude, Codex, atau Gemini ([setup](#agent-ai)).
- **Template slide**: simpan slide bagus beserta gambarnya, sisipkan ke project lain dari galeri (filter format, tag, cari).
- **Caption otomatis**: AI menulis 1-3 varian caption + hashtag per platform dari slide (hanya membaca), dari editor atau dialog slot planner.
- **Library aset**: ikon (Lucide), bentuk siap pakai, dan foto stok gratis (Pexels, perlu kunci API).
- **Font sendiri**: unggah .woff2/.woff/.ttf/.otf; dipakai di editor dan semua export (PNG, PDF, HTML mandiri, MP4, GIF).
- **Brand kit**: palette, font, css, brief, logo; diterapkan sebagai snapshot ke project.
- **Planner konten**: kalender bulan/minggu, status slot, pengingat, export `.ics`. Tidak pernah posting otomatis.
- **Sampah**: project, brand kit, template, dan slot planner dihapus ke trash dan bisa dipulihkan.
- **Export**: PNG, ZIP, PDF, HTML (satu file mandiri), MP4, GIF.

## Kebutuhan

- Node.js 20+
- Chromium untuk Playwright (render PNG/PDF/video): `npx playwright install chromium`
- `ffmpeg` di PATH (hanya untuk export MP4/GIF)
- Salah satu CLI agent (hanya untuk fitur AI), lihat [Agent AI](#agent-ai)
- Opsional: kunci API gratis dari [pexels.com/api](https://www.pexels.com/api/) untuk foto stok. Taruh di `.env` (`PEXELS_API_KEY=...`) atau env shell sebelum `npm run dev`. Tanpa kunci, tab Foto tidak muncul; ikon dan bentuk tetap jalan.

## Mulai

```bash
npm install
npx playwright install chromium
npm run dev
```

Buka URL yang ditampilkan Vite. Tanpa `?p=` tampil Home; `?p=<id>` membuka project.

Editor, export, dan CLI jalan tanpa AI. Untuk fitur AI (kotak prompt di Home, tombol Minta AI, Ide AI di planner, caption), pasang satu CLI agent dan jalankan dengan `AGENT_PROVIDER`; langkahnya ada di [Agent AI](#agent-ai).

## Jalankan dengan klik

Folder [start/](start/) berisi peluncur untuk tiap agent AI. Klik dua kali, tanpa terminal:

| | Mac | Windows |
|---|---|---|
| Claude | `mulai-claude.command` | `mulai-claude.bat` |
| Codex | `mulai-codex.command` | `mulai-codex.bat` |
| Gemini | `mulai-gemini.command` | `mulai-gemini.bat` |

Tiap peluncur memasang dependensi di run pertama (`npm install` + Chromium), mengeset `AGENT_PROVIDER`, menjalankan `npm run dev`, dan membuka browser. Gemini menanyakan `GEMINI_API_KEY` kalau belum diset. Syarat: Node.js 20+ dan CLI agent yang dipilih. Di Mac, kalau macOS menolak ("tidak dapat diverifikasi"), klik kanan file lalu Open sekali. Kalau file kehilangan izin eksekusi (mis. dari ZIP), jalankan `chmod +x start/*.command`.

Peluncur Windows belum dicoba; export dan editor seharusnya jalan, tapi spawn CLI agent di Windows (`npx`, shim `.cmd`) belum diuji.

## Agent AI

Fitur AI menjalankan CLI agent tanpa antarmuka (headless) yang terhubung ke server MCP carousel. Pilih lewat env `AGENT_PROVIDER`; default `claude`.

| Provider | Pasang | Login | Env opsional |
|---|---|---|---|
| `claude` | [Claude Code](https://claude.com/claude-code) | `claude` (sekali) | `CLAUDE_BIN` |
| `codex` | `brew install codex` atau `npm i -g @openai/codex` | `codex login` atau `OPENAI_API_KEY` | `CODEX_BIN` |
| `gemini` | `brew install gemini-cli` atau `npm i -g @google/gemini-cli` | `GEMINI_API_KEY` dari [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | `GEMINI_BIN`, `GEMINI_MODEL` |

```bash
AGENT_PROVIDER=codex npm run dev
GEMINI_API_KEY=... GEMINI_MODEL=gemini-3.8-flash AGENT_PROVIDER=gemini npm run dev
```

Cek dulu di terminal, di luar editor, sebelum dipakai:

```bash
claude -p "balas: ok"
codex exec --skip-git-repo-check "balas: ok"
gemini -p "balas: ok"
```

Tiap run AI menjalankan CLI itu di folder project ini dan memuat server MCP carousel (`src/mcp/server.ts`). Satu run membuka satu proses `npx tsx`, jadi `npx` dan `tsx` harus bisa jalan. Env yang diteruskan ke MCP: `CAROUSEL_HOME`, `CAROUSEL_BRANDS`, `CAROUSEL_TEMPLATES`, `CAROUSEL_PLANNER`, `PEXELS_API_KEY`.

Kalau gagal:

| Pesan di UI | Penyebab |
|---|---|
| "... tidak ketemu. Install atau set env ..." | CLI tidak ada di PATH; pasang, atau set `CLAUDE_BIN` / `CODEX_BIN` / `GEMINI_BIN` ke path lengkapnya |
| "approval ... never" / tool MCP ditolak | Provider Codex di versi lama; update (`brew upgrade codex`) |
| 503 "high demand" / "no longer available" | Dari sisi Google; ulangi, atau ganti `GEMINI_MODEL` |
| "migrate to Antigravity" | Login Google pribadi ditutup; pakai `GEMINI_API_KEY` |

Catatan:
- Env diset di shell (`.env` hanya dibaca untuk `PEXELS_*`); nama dan versi model Gemini sering berubah, cek `/model` di `gemini` kalau ditolak.
- Login Google pribadi di Gemini CLI sudah ditutup Google (pesan "migrate to Antigravity"); pakai API key.
- Gemini CLI butuh sekitar 12 detik untuk start, jadi tiap run terasa lebih lambat. Run pertama juga mengecek versinya.
- macOS bisa memblokir binary Codex ("Apple could not verify..."). Binary-nya bertanda tangan OpenAI; hapus karantina dengan `xattr -dr com.apple.quarantine /usr/local/Caskroom/codex/<versi>`.
- Pembatasan tool (agent caption hanya boleh membaca) dipaksa tiap provider dengan caranya sendiri. Claude paling teruji. Codex sudah dicoba untuk panggilan tool MCP, belum untuk semua alur. Adapter Gemini belum teruji sampai selesai.

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

Klien MCP lain (Claude Code, Codex, Gemini CLI, Cursor) bisa memakai server yang sama tanpa editor: arahkan ke `npx tsx src/mcp/server.ts` dengan folder ini sebagai working directory, mis. untuk Codex `codex mcp add carousel-maker -- npx tsx src/mcp/server.ts`.

Tool utama: `list_projects`, `create_project`, `get_carousel`, `get_references`, `set_meta`, `set_slide`, `set_element`, `reorder_slides`, `add_asset`, `add_font`, `search_icons`, `add_icon`, `search_stock`, `add_stock_asset`, `render_slide`, `lint`, `export`, `delete` (ke trash), `fetch_source`, `list_brands`, `get_brand`, `apply_brand`, `save_brand`, `list_templates`, `get_template`, `apply_template`, `save_template`, `list_plan`, `set_plan_item`.

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
