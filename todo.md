# TODO

## Tahap 1: Format presentasi 16:9
- [x] Tambah `16:9` (1920x1080) di `FORMATS` dan enum `format` (`src/core/schema.ts`)
- [x] Opsional: tambah `4:3` (1440x1080)
- [x] Cek `NewProjectDialog.tsx` dan menu format header ikut menampilkan format baru
- [ ] Cek canvas, zoom, rulers, snapping jalan di landscape
- [x] Cek `Preview.tsx` fit ke layar landscape
- [x] Cek ekspor PNG/ZIP/PDF memakai ukuran dari format (bukan ukuran tetap)
- [x] Update deskripsi tool MCP `set_meta` + panduan komposisi landscape untuk agent
- [x] Update CLAUDE.md

## Tahap 2: Animasi
- [x] Field `anim` per elemen: `{ type, delay, duration, trigger }`
- [x] Renderer: terjemahkan `anim` ke CSS `@keyframes` (`src/core/render.ts`)
- [x] Build steps: field `step` per elemen, tampil bertahap di mode present
- [x] Transisi antar slide: `transition: slide | fade | zoom`
- [x] Ekspor PNG/PDF paksa ke state akhir animasi
- [x] Lint overflow menilai posisi akhir, bukan awal
- [x] Inspector: panel animasi per elemen
- [x] Update deskripsi tool MCP agar agent memakai field baru

## Tahap 3: Ekspor lanjutan
- [x] Ekspor HTML mandiri (satu file, bisa dipresentasikan di browser)
- [x] Ekspor MP4/GIF (Playwright per frame + ffmpeg)

## Mode presentasi
- [x] `Present.tsx`: layar penuh, auto-hide kontrol, step/animasi/transisi
- [x] Catatan pembicara (`notes`) + thumbnail slide berikutnya, timer, laser, layar hitam
- [ ] Cek di browser sungguhan (fullscreen API di Safari/Firefox, layar kedua)
- [ ] Presenter view di jendela terpisah (catatan di laptop, slide di proyektor)

## Ide proyek lain
- [x] Repurpose: URL artikel/transkrip jadi carousel via agent (`fetch_source` + chip teks sumber; belum dicoba end-to-end dengan agent sungguhan)
- [x] Brand kit: tokens (palette, font, logo) dipakai lintas project (salinan/snapshot; belum dicoba dengan agent sungguhan)
- [ ] OG image / thumbnail maker
- [ ] Generator sertifikat massal dari CSV
- [ ] Content planner + pengingat (rincian di bagian bawah)

## Content planner + pengingat
Posting otomatis ke platform sengaja tidak dikerjakan (butuh OAuth/token akun sosial + server yang selalu hidup).

### Tahap 1: Planner (lokal)
- [x] Schema `PlanItem` di `src/core`: id, tanggal+jam, platform, project (opsional), caption, hashtag, status (`ide|draft|siap|terjadwal|terbit`)
- [x] `planner.ts` storage: `planner.json` di samping `projects/` (override env `CAROUSEL_PLANNER`), hapus = ke `.trash`, tanpa hard delete
- [x] API `/api/plan` (list, buat, ubah, hapus)
- [x] `Planner.tsx` (`?plan=1`, ikon kalender di header Home): kalender bulan/minggu, slot per hari
- [x] Dialog slot: platform, jam, caption, hashtag, status, pilih project
- [x] Tarik-lepas kartu project/slot ke tanggal
- [x] Slot tanpa project = ide; tombol "Buat carousel" membuat project (format + brand dari slot, topik/caption masuk brief) lalu membuka editor; belum langsung menjalankan AI
- [x] Tandai "terbit" otomatis saat project diekspor (opsional, bisa dimatikan; hanya dari editor, bukan CLI/MCP)

### Tahap 2: Bantuan agent
- [x] Tool MCP `list_plan`, `set_plan_item` (tidak bisa hapus, tidak bisa set `terbit`, maks 40 slot baru per run)
- [x] Prompt "buatkan N ide konten bulan depan" mengisi slot ide, bukan langsung slide (tombol "Ide AI" di Planner; agent hanya diberi tool rencana)
- [x] Repurpose: satu artikel jadi beberapa slot berurutan (URL lewat `fetch_source`, atau tempel teks)
- [x] Uji dengan agent sungguhan (ide: 4 slot hari Selasa; repurpose dari teks sumber berisi instruksi jahat: diabaikan; lewat UI: 2 slot muncul live). Belum dicoba: URL sungguhan lewat `fetch_source` dari Ide AI

### Tahap 3: Pengingat (bukan posting otomatis)
- [x] Cek jadwal saat editor terbuka: notifikasi di jam tayang (toast + Notification API, izin diminta dari tombol di kartu Pengingat; notifikasi browser hanya saat tab tersembunyi; belum dicoba di Chrome/Safari/Firefox sungguhan, hanya Chromium dengan Notification di-stub)
- [x] Aksi di pengingat: "Ekspor & salin caption" (ZIP/PNG + caption ke clipboard) dan "Tandai terbit"
- [x] Badge slot terlewat / hari ini di Home dan header Planner
- [x] Ekspor `.ics` supaya jadwal muncul di Google Calendar/Apple Calendar
- [x] Catatan: pengingat hanya jalan saat tab editor terbuka


## Refactor `src/web`
Masalah: ~50 file flat di satu folder, `dist/` ada di dalam `src/web`, file gemuk (`Home.tsx` 853, `Canvas.tsx` 522, `Planner.tsx` 506, `Inspector.tsx` 497, `App.tsx` 430). Bukan git repo, jadi backup dulu.

Target struktur:
```
src/web/
  app/        App, AppShell, Header, main, theme, dialogs
  pages/      home/ planner/ brands/ trash/
  editor/     canvas/ inspector/ panel/ ai/ present/ + useEditor, Toolbar
  shared/     api, format, SlideView, useLazyDoc, IconButton, PageHeader, FilterChips, slideTitle
  components/ui  (tetap)
```

### Fase 0: persiapan
- [x] Backup `src/web` ke scratchpad (`scratchpad/web-backup`)
- [x] Baseline: `tsc --noEmit` dan `vite build` hijau sebelum mulai
- [x] Keluarkan `dist/` dari `src/web` (cek `build.outDir` di `vite.config.ts` dan `.gitignore`)

### Fase 1: pindah file (isi tidak diubah)
- [x] Buat folder `app/`, `pages/{home,planner,brands,trash}/`, `editor/{canvas,inspector,panel,ai,present}/`, `shared/`
- [x] Pindah file sesuai peta struktur
- [x] Ubah import relatif ke alias `@/`
- [x] Pastikan offset `Resizer.tsx` dan grid `styles.css` tidak berubah
- [x] `tsc` + `vite build` hijau; buka editor, Home, Planner, Brands, Trash di browser (belum)

### Fase 2: pecah file gemuk
- [x] `Home.tsx`: pisah `Thumb`, `Hero`, `PinButton` + pins, `Card`/`Row`, `ProjectMenuButton`, `SelectBox`, `groupProjects`
- [x] `Canvas.tsx`: pisah drag/resize, inline edit, overlay
- [x] `Planner.tsx`: pisah grid kalender, chip, panel kanan
- [x] `Inspector.tsx`: satu file per section accordion (field component tetap module-level)
- [x] `App.tsx`: pisah key handler dan routing `goPage`
- [x] `tsc` + build setelah tiap pecahan

### Fase 3: rapikan
- [x] Cari file mati / import tidak terpakai
- [x] Update CLAUDE.md (path file yang berubah)
- [x] Tes manual (otomatis, Playwright/Chromium): edit teks inline, zoom, drag slide, present, preview, export PNG. AI run belum dites
