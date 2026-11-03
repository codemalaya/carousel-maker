# Brief Video TikTok (Remotion + Voice-over)

Sembilan video 9:16, **minimal 1 menit** (65–85 detik), tiap 3 hari di samping carousel harian. Semua judul baru, tidak ada yang berasal dari carousel yang sudah dibuat.

**Aturan keras:** semua isi cerita di naskah ini **karangan untuk contoh** (kejadian, angka, komentar). Ganti dengan kejadian nyatamu sebelum direkam; jangan rekam apa adanya kalau tidak benar-benar terjadi. Naskah ini sekitar 2,3 kata per detik; kalau kamu mengganti isinya, pertahankan panjangnya supaya durasi tetap di atas 1 menit.

## Jadwal (selang-seling dengan carousel)

Carousel tiap hari, video tiap 3 hari (5, 8, 11, 14, 17, 20, 23, 26, 29 Nov). Di hari video ada dua posting: carousel 12:00 dan video 19:00 (jarak 7 jam). Planner sudah sesuai.

| No | Tanggal | Hari | Jam | Judul video | Durasi |
|---|---|---|---|---|---|
| V1 | 5 Nov | Kamis | 19:00 | POV: Kamu Orang IT di Kantor | ~65 dtk |
| V2 | 8 Nov | Minggu | 19:00 | Yang Orang Bilang Pas Tahu Aku Kerja di IT | ~70 dtk |
| V3 | 11 Nov | Rabu | 19:00 | Rutinitas Pagi Developer Sebelum Ngoding | ~75 dtk |
| V4 | 14 Nov | Sabtu | 19:00 | Aku Minta AI Bikinin Website, Ini yang Terjadi | ~85 dtk |
| V5 | 17 Nov | Selasa | 19:00 | Error Paling Absurd yang Pernah Kutemui | ~75 dtk |
| V6 | 20 Nov | Jumat | 19:00 | Gaji Pertama Developer: Habis ke Mana? | ~75 dtk |
| V7 | 23 Nov | Senin | 19:00 | Kalian Nanya: Gimana Mulai Belajar Coding? | ~85 dtk |
| V8 | 26 Nov | Kamis | 19:00 | Aku Review Kode Buatanku dari Setahun Lalu | ~80 dtk |
| V9 | 29 Nov | Minggu | 19:00 | Kalian Nanya Lagi: Jawab Komentar Part 2 | ~85 dtk |

**Soal durasi 1 menit lebih:** video yang lebih panjang butuh alasan untuk ditonton sampai habis. Karena itu tiap naskah punya (1) hook di 3 detik pertama, (2) "hook ulang" tiap 15-20 detik ("tapi tunggu, ada yang lebih parah"), dan (3) penutup yang menyambung ke awal. Setahu saya TikTok juga memberi syarat durasi di atas 1 menit untuk Creator Rewards; cek aturan terbaru di akunmu.

---

## Brief umum untuk Remotion (tempel sekali, berlaku untuk semua video)

```
Buat komposisi Remotion untuk video TikTok vertikal.

SPEC
- 1080x1920, 30 fps, durasi ikut file suara (voice.wav) + 1 detik jeda akhir. Target 65-85 detik.
- Satu komposisi generik "StoryVideo" yang membaca props JSON: lihat skema di bawah. Satu file props per video (V1..V7).
- Audio: voice.wav (utama), bgm.mp3 opsional di -22 dB dan turun lagi (ducking) saat suara berbicara.
- Safe zone TikTok (perkiraan, UI TikTok bisa berubah): jangan taruh teks penting di 170 px teratas, 380 px terbawah, dan 140 px paling kanan. Margin samping 80 px.

GAYA (samakan dengan carousel)
- Satu neo-grotesk: 'Helvetica Neue', Helvetica, Arial. Judul HURUF BESAR, weight 800, letter-spacing -0.058em, line-height 0.88.
- Warna: ink #0a0a0a, navy #0a1a3f, blue #2457ff, sky #3ad1ff, red #fc1201, yellow #f9d361, paper #f4f1ea. Satu warna latar per adegan, ganti tiap adegan.
- Tanpa emoji. Teks pendek, maksimal 2 baris besar per adegan.
- Gerak: teks masuk pop/slide 8-12 frame, tahan, keluar cepat. Potong tiap 2-5 detik. Jangan ada adegan statis lebih dari 5 detik.

RITME VIDEO PANJANG
- Bar kemajuan tipis di tepi atas (di bawah safe zone atas) yang terisi sepanjang video.
- Penanda bagian kecil ("1/5", "2/5", ...) di pojok kiri atas, hanya jika naskah punya bagian berurutan.
- Tiap ~15-20 detik ada "hook ulang": adegan bertanda note "REHOOK" memakai latar kontras dan teks besar (mis. "TAPI TUNGGU.").
- Akhir video menyambung ke awal (teks terakhir mengulang kata dari adegan pertama) supaya enak diputar ulang.

CAPTION
- Caption kata-per-kata (karaoke) dari transkrip bertimestamp, di tengah-bawah di atas safe zone bawah, font 64-72 px, kata aktif berwarna kuning #f9d361, sisanya putih dengan outline ink 6 px.
- Timestamp kata dibuat dari voice.wav (mis. whisper.cpp lewat paket Remotion untuk captions; cek dokumentasi Remotion terbaru).

SKEMA PROPS
{
  "id": "V1",
  "title": "...",
  "voice": "public/V1/voice.wav",
  "bgm": "public/bgm.mp3" | null,
  "scenes": [
    { "from": 0.0, "to": 2.5, "bg": "#0a1a3f", "layout": "bigtext|stamp|list|split|screen|quote|comment",
      "lines": ["BARIS 1", "BARIS 2"], "accent": "#f9d361", "note": "arahan visual / REHOOK" }
  ],
  "cta": { "text": "...", "from": 0.0 }
}

LAYOUT
- bigtext: 1-3 baris raksasa, satu baris berwarna aksen.
- stamp: kotak/stempel miring -5 derajat yang muncul (pop) di atas teks.
- list: item muncul satu per satu dengan nomor besar di latar.
- split: layar terbelah atas/bawah (bayangan vs kenyataan).
- screen: placeholder untuk rekaman layar/foto asli (file di public/<id>/), diberi bingkai tipis.
- quote: kutipan dalam tanda petik dengan nama/atribusi kecil.
- comment: kartu komentar ala TikTok (avatar bulat, nama, teks) yang masuk dari bawah.

KELUARAN
- Tampilkan satu video dulu (V1) sebagai pratinjau, lalu render yang lain dengan props masing-masing. Jangan mengarang isi kata: pakai teks dari naskah di bawah apa adanya.
```

---

## V1. POV: Kamu Orang IT di Kantor
- **Jadwal:** Kamis 5 Nov, 19:00 | **Durasi:** ~65 detik (~150 kata) | **Jenis:** humor relatable (aman tanpa cerita pribadi; ganti dengan versimu kalau punya)
- **STATUS ISI: KARANGAN.** Semua isi `[isi]` di bawah dikarang untuk contoh. Ganti dengan kejadian nyatamu sebelum direkam; jangan rekam apa adanya kalau tidak benar-benar terjadi.

**Voice-over**
> POV: kamu orang IT di kantor. Dan hari ini baru dimulai.
>
> Jam sembilan. "Mas, wifi-nya mati." Wifinya nggak mati. Kamu cuma belum nyambung.
> Jam sepuluh. "Mas, printernya ngambek." Kertasnya habis.
> Jam sebelas. "Mas, lupa password." Yang ketiga kalinya minggu ini.
> Jam dua belas. Kamu baru mau makan. "Mas, bentar ya..." Dan kamu jawab: iya, bentar.
>
> Tapi tunggu, belum selesai.
>
> Jam satu. "Mas, laptopku lemot." Lemot, karena tab yang kebuka empat puluh.
> Jam tiga. "Mas, bisa bikinin aplikasi? Cuma sederhana kok." Sederhana. Tiga hari kerja.
> Jam lima. Semua orang sudah pulang. Terus servernya error. Dan siapa yang dicari? Kamu.
>
> Anehnya, aku tetap suka kerjaan ini. Soalnya tiap kali ada yang bilang "makasih ya, jadi lancar lagi", rasanya kayak nyelamatin hari satu kantor.
>
> Kamu juga pernah di posisi ini? Tulis kalimat yang paling sering kamu dengar. Yang paling lucu, aku balas.

**Brief Remotion (props ringkas)**
| Waktu | Layout | Teks di layar | Latar | Catatan |
|---|---|---|---|---|
| 0.0-4.0 | bigtext | POV: / KAMU ORANG IT | #0a1a3f | "ORANG IT" kuning |
| 4.0-10.0 | comment + stempel | 09:00 / "Mas, wifi-nya mati." | #f4f1ea | stempel "NGGAK MATI" |
| 10.0-15.5 | comment + stempel | 10:00 / "Mas, printernya ngambek." | #f9d361 | stempel "KERTAS HABIS" |
| 15.5-21.0 | comment + stempel | 11:00 / "Mas, lupa password." | #2457ff | stempel "KETIGA KALINYA" |
| 21.0-27.0 | comment | 12:00 / "Mas, bentar ya..." | #0a0a0a | "iya, bentar." muncul terakhir |
| 27.0-31.0 | bigtext | TAPI TUNGGU. / BELUM SELESAI. | #fc1201 | REHOOK |
| 31.0-37.0 | comment + stempel | 13:00 / "Mas, laptopku lemot." | #f4f1ea | stempel "40 TAB" |
| 37.0-45.0 | comment + stempel | 15:00 / "...cuma sederhana kok." | #0a1a3f | stempel "3 HARI KERJA" |
| 45.0-52.0 | comment + stempel | 17:00 / SERVER ERROR | #0a0a0a | stempel merah "SIAPA YANG DICARI?" |
| 52.0-59.0 | quote | "Rasanya kayak nyelamatin hari satu kantor." | #f9d361 | |
| 59.0-65.0 | bigtext | KAMU JUGA / PERNAH? | #2457ff | CTA, menyambung ke "POV" |

**Caption:** POV kamu orang IT di kantor: semua orang butuh bantuan di jam yang sama. Kalimat apa yang paling sering kamu dengar? Tulis di komentar.
**Tagar:** `#kerjait #itsupport #developer #povkantor`

---

## V2. Yang Orang Bilang Pas Tahu Aku Kerja di IT
- **Jadwal:** Minggu 8 Nov, 19:00 | **Durasi:** ~70 detik (~160 kata) | **Jenis:** daftar + komentar
- **STATUS ISI: KARANGAN.** Semua isi `[isi]` di bawah dikarang untuk contoh. Ganti dengan kejadian nyatamu sebelum direkam; jangan rekam apa adanya kalau tidak benar-benar terjadi.

**Voice-over**
> Waktu orang tahu aku kerja di IT, ini yang mereka bilang. Aku catat semuanya.
>
> Satu: "Oh, bisa benerin printer ya?"
> Dua: "Bisa bikinin website murah?"
> Tiga: "Laptopku lemot, tolong dong."
> Empat: "Kerja IT pasti gajinya gede ya."
> Lima: "Bisa bobol Instagram mantanku?"
> Enam: "Kerjanya ngetik doang kan?"
> Tujuh: "Kamu bisa benerin AC?"
>
> Dan ini yang paling sering kudengar: "Kerjaannya enak ya, tinggal duduk depan laptop."
>
> Tapi tunggu. Ini yang sebenarnya aku kerjakan.
> Satu: ngerawat server supaya nggak mati pas orang lagi kerja.
> Dua: nulis dan memperbaiki kode aplikasi kantor.
> Tiga: ngecek keamanan data supaya nggak bocor.
>
> Jadi orang IT itu bukan tukang segala. Tapi aku nggak marah. Kebanyakan orang cuma nggak tahu.
>
> Aku justru senang kalau ada yang nanya, asal ceritain masalahnya dulu, jangan cuma bilang "rusak".
>
> Sekarang giliran kamu. Kamu kerja apa, dan orang bilang apa? Tulis di komentar.

**Brief Remotion**
| Waktu | Layout | Teks di layar | Latar | Catatan |
|---|---|---|---|---|
| 0.0-4.0 | bigtext | PAS ORANG TAHU / AKU KERJA DI IT | #0a1a3f | |
| 4.0-30.0 | list (7 item, ~3.7 dtk each) | angka 1-7 besar di latar, kutipan tiap item | ganti tiap item | kartu komentar masuk dari bawah |
| 30.0-38.0 | quote | "Kerjaannya enak ya, tinggal duduk depan laptop." | #2457ff | |
| 38.0-42.0 | bigtext | TAPI TUNGGU. | #fc1201 | REHOOK |
| 42.0-56.0 | list (3 item) | "YANG SEBENARNYA KUKERJAIN": NGERAWAT SERVER / NULIS + PERBAIKI KODE / JAGA KEAMANAN DATA | #f4f1ea | |
| 56.0-64.0 | split | ATAS: "BUKAN TUKANG SEGALA" / BAWAH: "TAPI NGGAK MARAH" | #f9d361 / #0a0a0a | |
| 64.0-70.0 | bigtext | KAMU KERJA APA? / ORANG BILANG APA? | #2457ff | CTA |

**Caption:** Pas orang tahu aku kerja di IT, ini yang mereka bilang. Kamu dengar apa? Tulis di komentar.
**Tagar:** `#kerjait #developer #programmer #relatable`

---

## V3. Rutinitas Pagi Developer Sebelum Ngoding
- **Jadwal:** Rabu 11 Nov, 19:00 | **Durasi:** ~75 detik (~170 kata) | **Jenis:** satu hari nyata, versi tidak estetik
- **STATUS ISI: KARANGAN.** Semua isi `[isi]` di bawah dikarang untuk contoh. Ganti dengan kejadian nyatamu sebelum direkam; jangan rekam apa adanya kalau tidak benar-benar terjadi.

**Voice-over (contoh karangan)**
> Orang kira pagi developer itu begini: kopi, laptop, musik, langsung ngoding.
> Ini pagiku yang sebenarnya.
>
> Jam setengah enam. Aku bangun, dan hal pertama yang kubuka bukan kopi, tapi grup chat kantor, karena ada notifikasi error semalam.
> Jam tujuh kurang. Berangkat. Di jalan aku dengerin podcast sambil mikirin bug kemarin yang belum ketemu.
> Jam delapan lewat. Sampai kantor. Kerjaan belum mulai, tapi aku sudah dapat tiga pesan: "bisa bantu bentar?"
>
> Tapi tunggu, ini belum ngoding.
>
> Jam sembilan. Ada standup lima belas menit. Semua orang bilang apa yang macet, dan punyaku macet di tempat yang sama dari kemarin.
> Jam setengah sepuluh. Akhirnya bisa buka kode. Itu pun cuma dua puluh menit.
> Terus ada rapat dadakan, dan fokusku hilang.
>
> Di media sosial, pagi developer itu estetik. Pagiku: kopi sudah dingin, tab terbuka dua puluh, dan belum ngetik satu baris pun sampai jam sepuluh.
>
> Tapi ada satu momen yang bikin aku tetap suka: pas satu tes yang kemarin merah akhirnya jadi hijau. Aku diem sebentar, terus senyum sendiri.
>
> Kalau kamu lihat pagi yang begini, itu bukan berarti hari yang buruk. Itu cuma hari kerja biasa.
>
> Pagimu gimana? Tulis di komentar, dan aku penasaran apa yang pertama kamu buka.

**Brief Remotion**
| Waktu | Layout | Teks di layar | Latar | Catatan |
|---|---|---|---|---|
| 0.0-5.0 | split | ATAS: "KATANYA: KOPI, LAPTOP, MUSIK" / BAWAH: "KENYATAANNYA" | #f4f1ea / #0a0a0a | |
| 5.0-14.0 | screen + jam besar | 05:30 / GRUP CHAT KANTOR, BUKAN KOPI | #0a1a3f | foto/rekaman asli `public/V3/pagi-1.jpg` |
| 14.0-22.0 | screen + jam besar | 06:50 / MIKIRIN BUG KEMARIN | #f9d361 | `public/V3/pagi-2.jpg` |
| 22.0-30.0 | screen + jam besar | 08:10 / 3 PESAN: "BISA BANTU BENTAR?" | #3ad1ff | `public/V3/pagi-3.jpg` |
| 30.0-34.0 | bigtext | TAPI TUNGGU. / BELUM NGODING. | #fc1201 | REHOOK |
| 34.0-46.0 | list (3 item) | 09:00 STANDUP / 09:30 NGODING 20 MENIT / RAPAT DADAKAN | #f4f1ea | |
| 46.0-56.0 | split | ATAS: "VERSI MEDIA SOSIAL" / BAWAH: "VERSIKU: KOPI DINGIN, 20 TAB" | #f9d361 / #0a0a0a | foto aslimu di bawah |
| 56.0-66.0 | bigtext | TES MERAH JADI HIJAU. / SENYUM SENDIRI. | #2457ff | |
| 66.0-75.0 | bigtext | PAGIMU GIMANA? / APA YANG PERTAMA KAMU BUKA? | #0a1a3f | CTA, menyambung ke pertanyaan awal |

**Caption:** Pagi developer versi aku, bukan versi estetik. Pagimu gimana? Tulis di komentar.
**Tagar:** `#developer #rutinitaspagi #programmer #kerjait`

---

## V4. Aku Minta AI Bikinin Website, Ini yang Terjadi
- **Jadwal:** Sabtu 14 Nov, 19:00 | **Durasi:** ~85 detik (~195 kata) | **Jenis:** percobaan nyata. Wajib ada rekaman layar asli.
- **STATUS ISI: KARANGAN.** Semua isi di bawah (prompt, hasil, waktu, jumlah percobaan) dikarang untuk contoh. Sebelum direkam, jalankan percobaannya sendiri lalu ganti dengan hasil aslimu. Jangan rekam naskah ini apa adanya kalau kejadiannya tidak benar-benar terjadi.

**Voice-over (contoh karangan)**
> Aku penasaran. Katanya sekarang bikin website cukup minta ke AI.
> Jadi aku coba, dan aku rekam semuanya, termasuk yang gagal.
>
> Aturannya: satu kalimat. Aku cuma ngetik satu kalimat ke AI: "Buatin website portofolio untuk fotografer, tema gelap, ada galeri foto dan form kontak."
>
> Dua puluh detik kemudian, jadi.
>
> Awalnya kelihatan bagus. Layoutnya rapi, warnanya pas, bahkan ada teks contoh yang lumayan masuk akal.
> Aku coba fitur pertama: galeri foto. Jalan. Fotonya bisa di-klik dan membesar.
>
> Tapi tunggu.
>
> Aku coba fitur kedua: form kontak. Dan di situ, tombol "Kirim" kelihatan bisa diklik, tapi nggak ngapa-ngapain. Datanya nggak ke mana-mana.
> Aku minta AI benerin. Percobaan kedua, tombolnya jalan, tapi tampilan di HP jadi berantakan.
> Percobaan ketiga, tampilan HP rapi, tapi sekarang menunya nutupin tulisan.
>
> Total aku butuh empat kali percobaan, sekitar dua puluh lima menit, sampai bener-bener jalan.
>
> Kesimpulanku. Bagus buat: bikin kerangka awal dan teks contoh dengan cepat. Masih butuh manusia buat: cek tombol dan form beneran jalan, dan tampilan di HP.
>
> Jadi AI bukan bikin kerjaan hilang. Dia mengubah kerjaanku jadi lebih banyak cek dan perbaiki.
>
> Kamu pernah coba? Hasilnya gimana? Tulis di komentar, dan kalau mau, aku coba prompt dari kamu di video berikutnya.

**Brief Remotion** (teks di layar sudah mengikuti naskah contoh di atas)
| Waktu | Layout | Teks di layar | Latar | Catatan |
|---|---|---|---|---|
| 0.0-5.0 | bigtext | KATANYA / TINGGAL MINTA KE AI | #0a0a0a | |
| 5.0-9.0 | bigtext | SATU KALIMAT. | #2457ff | |
| 9.0-18.0 | screen | prompt diketik (efek typing): "Buatin website portofolio untuk fotografer, tema gelap, ada galeri foto dan form kontak." | #0a1a3f | `public/V4/prompt.mp4` |
| 18.0-27.0 | screen | hasil website (rekaman asli) | #f4f1ea | stempel "20 DETIK" |
| 27.0-33.0 | screen | galeri foto jalan, centang kuning | #f9d361 | stempel "GALERI: JALAN" |
| 33.0-37.0 | bigtext | TAPI TUNGGU. | #fc1201 | REHOOK |
| 37.0-50.0 | screen + stempel | tombol "Kirim" tidak berfungsi, lingkaran merah | #fc1201 | stempel "TOMBOLNYA PAJANGAN" |
| 50.0-62.0 | list (3 item) | 1 TOMBOL JALAN, HP BERANTAKAN / 2 HP RAPI, MENU NUTUPIN / 3 BERES | #0a1a3f | penghitung percobaan naik |
| 62.0-72.0 | split | ATAS: BAGUS BUAT KERANGKA + TEKS CONTOH / BAWAH: MASIH BUTUH MANUSIA UNTUK FORM + TAMPILAN HP | #f9d361 / #0a0a0a | |
| 72.0-79.0 | quote | "AI mengubah kerjaanku jadi lebih banyak cek dan perbaiki." | #f4f1ea | |
| 79.0-85.0 | bigtext | KAMU PERNAH COBA? / KASIH PROMPT KAMU | #2457ff | CTA |

**Caption:** Aku cuma ngetik satu kalimat ke AI buat bikin website. Ini hasil aslinya, termasuk yang rusak. Kamu pernah coba?
**Tagar:** `#ai #chatgpt #googleai #developer #websiteai`

---

## V5. Error Paling Absurd yang Pernah Kutemui
- **Jadwal:** Selasa 17 Nov, 19:00 | **Durasi:** ~75 detik (~170 kata) | **Jenis:** satu kejadian nyata dari awal sampai ketemu
- **STATUS ISI: KARANGAN.** Semua isi `[isi]` di bawah dikarang untuk contoh. Ganti dengan kejadian nyatamu sebelum direkam; jangan rekam apa adanya kalau tidak benar-benar terjadi.

**Voice-over (contoh karangan)**
> Dua jam. Penyebabnya cuma ini. Tapi sebelum aku kasih tahu, dengerin dulu ceritanya.
>
> Kejadiannya: aplikasi klien tiba-tiba nggak bisa konek ke server. Tapi cuma di satu HP. Di HP lain normal.
> Awalnya kupikir sepele. Aku cek yang pertama: servernya. Normal.
> Aku cek yang kedua: koneksi internetnya. Normal juga.
> Aku cek yang ketiga: versi aplikasinya. Sama persis dengan HP yang jalan.
>
> Satu jam lewat. Aku mulai curiga ke diriku sendiri.
> Aku buka log, aku baca ulang kode koneksinya, aku bandingkan dua HP baris demi baris.
>
> Tapi tunggu. Ini baru jam kedua, dan aku hampir nyerah.
> Aku sudah mau nulis ulang bagian koneksinya dari nol.
>
> Terus ketemu. Tanggal di HP itu salah, mundur setahun. Sertifikat keamanan server dianggap belum berlaku, jadi koneksinya ditolak.
> Reaksiku: diem, terus ketawa sendiri. Dua jam, buat satu tanggal yang salah.
> Perbaikannya: dua detik. Atur tanggal ke otomatis.
>
> Pelajarannya: cek hal yang paling sepele dulu. Dan bandingkan yang jalan dengan yang nggak, selisihnya itu jawabannya.
>
> Sekarang kamu. Error paling absurd yang pernah kamu temui apa? Tulis di komentar.

**Brief Remotion**
| Waktu | Layout | Teks di layar | Latar | Catatan |
|---|---|---|---|---|
| 0.0-5.0 | bigtext | 2 JAM. / PENYEBABNYA CUMA INI. | #0a0a0a | "CUMA INI" kuning |
| 5.0-14.0 | screen / bigtext | APLIKASI NGGAK BISA KONEK / CUMA DI SATU HP | #0a1a3f | screenshot error asli jika ada |
| 14.0-30.0 | list (3 item) | SERVER / INTERNET / VERSI APLIKASI, masing-masing dicoret dan diberi "NORMAL" | #f4f1ea | garis coret merah |
| 30.0-38.0 | bigtext | 1 JAM LEWAT. | #fc1201 | penghitung waktu naik |
| 38.0-44.0 | bigtext | TAPI TUNGGU. / HAMPIR NYERAH. | #0a0a0a | REHOOK |
| 44.0-54.0 | screen / bigtext | BUKA LOG. BANDINGKAN 2 HP. HAMPIR NULIS ULANG. | #3ad1ff | |
| 54.0-62.0 | stamp | "KETEMU." / TANGGAL HP MUNDUR SETAHUN | #f9d361 | stempel hitam |
| 62.0-68.0 | split | ATAS: "2 JAM" / BAWAH: "PERBAIKANNYA: 2 DETIK" | #f4f1ea / #0a0a0a | |
| 68.0-75.0 | bigtext | ERROR TERABSURDMU APA? | #2457ff | CTA |

**Caption:** Dua jam nyari, penyebabnya cuma satu hal kecil. Error paling absurd yang pernah kamu temui apa?
**Tagar:** `#developer #programmer #debugging #kerjait`

---

## V6. Gaji Pertama Developer: Habis ke Mana?
- **Jadwal:** Jumat 20 Nov, 19:00 | **Durasi:** ~75 detik (~170 kata) | **Jenis:** cerita pribadi. Angka boleh dihilangkan; hindari nasihat keuangan.
- **STATUS ISI: KARANGAN.** Semua isi `[isi]` di bawah dikarang untuk contoh. Ganti dengan kejadian nyatamu sebelum direkam; jangan rekam apa adanya kalau tidak benar-benar terjadi.

**Voice-over (contoh karangan)**
> Aku kira gaji pertama bakal sisa banyak. Ternyata nggak begitu.
>
> Hari gajian. Perasaanku campur aduk: senang, tapi deg-degan.
> Aku buka rekening, dan dalam beberapa hari aku sudah bayar beberapa hal.
>
> Pertama: utang kecil-kecil yang numpuk dari masa kuliah.
> Kedua: traktir orang tua makan, karena itu yang paling aku mau.
> Ketiga: kursi yang layak buat kerja, karena punggungku udah protes.
> Keempat: langganan yang aku lupa batalin.
>
> Tapi tunggu, ini yang nggak kepikiran sebelumnya.
> Biaya kecil yang numpuk: ongkos, kopi, paket data. Satu-satu kelihatan sepele, tapi kalau dijumlah, lumayan.
> Dan ada potongan yang nggak kuhitung dari awal.
>
> Akhir bulan, sisanya sedikit.
> Bulan kedua aku mulai nyatet pengeluaran tiap malam. Cuma lima menit.
>
> Kalau aku bisa bilang satu hal ke diriku yang dulu: gaji itu bukan cuma angka, tapi cara kamu mengaturnya.
>
> Ini bukan saran keuangan, ini cuma ceritaku. Gaji pertamamu habis buat apa? Tulis di komentar.

**Brief Remotion**
| Waktu | Layout | Teks di layar | Latar | Catatan |
|---|---|---|---|---|
| 0.0-5.0 | bigtext | AKU KIRA / SISANYA BANYAK. | #f9d361 | |
| 5.0-12.0 | bigtext | HARI GAJIAN. / SENANG. DEG-DEGAN. | #0a1a3f | |
| 12.0-30.0 | list (4 item) | 1 UTANG KECIL KULIAH / 2 TRAKTIR ORANG TUA / 3 KURSI YANG LAYAK / 4 LANGGANAN LUPA DIBATALIN | #f4f1ea | tiap item masuk 4 dtk |
| 30.0-36.0 | bigtext | TAPI TUNGGU. | #fc1201 | REHOOK |
| 36.0-50.0 | stamp x2 | "YANG NGGAK KEPIKIRAN: BIAYA KECIL NUMPUK" / "POTONGAN YANG NGGAK DIHITUNG" | #0a0a0a | |
| 50.0-60.0 | split | ATAS: "AKHIR BULAN: SISANYA SEDIKIT" / BAWAH: "BULAN KEDUA: NYATET 5 MENIT/MALAM" | #f4f1ea / #0a1a3f | |
| 60.0-68.0 | quote | "Gaji itu bukan cuma angka, tapi cara kamu mengaturnya." | #f9d361 | |
| 68.0-75.0 | bigtext | GAJI PERTAMAMU / HABIS BUAT APA? | #2457ff | CTA |

**Caption:** Aku kira gaji pertama bakal sisa banyak. Ternyata begini. Gaji pertamamu habis buat apa?
**Tagar:** `#gajipertama #developer #freshgraduate #kerjait`

---

## V7. Kalian Nanya: Gimana Mulai Belajar Coding?
- **Jadwal:** Senin 23 Nov, 19:00 | **Durasi:** ~85 detik (~195 kata) | **Jenis:** balas komentar. Butuh pertanyaan nyata dari penonton atau DM.
- **STATUS ISI: KARANGAN.** Semua isi `[isi]` di bawah dikarang untuk contoh. Ganti dengan kejadian nyatamu sebelum direkam; jangan rekam apa adanya kalau tidak benar-benar terjadi.
- Tiga komentar di bawah (`@akun_contoh1-3`) juga karangan. Pakai komentar asli dari akunmu; kalau belum ada, tunda video ini sampai ada pertanyaan nyata.

**Voice-over (contoh karangan)**
> Banyak yang nanya di komentar dan DM: gimana mulai belajar coding?
> Aku jawab dari yang kualami, dan aku bacakan beberapa pertanyaan kalian.
>
> Pertanyaan pertama: "Kak, mulai belajar coding dari bahasa apa ya?"
> Jawabku: mulai dari satu bahasa saja, misalnya Python atau JavaScript, dan langsung bikin proyek kecil. Jangan pindah-pindah bahasa di bulan pertama.
>
> Pertanyaan kedua: "Harus jago matematika nggak?"
> Jawabku: nggak harus jago. Yang dipakai tiap hari kebanyakan logika dasar. Matematika yang berat dibutuhkan di bidang tertentu, seperti data science atau grafis.
>
> Tapi tunggu, ini yang paling sering ditanya.
>
> Pertanyaan ketiga: "Belajar dari mana, kursus mahal atau gratis?"
> Jawabku: yang gratis juga cukup. Dokumentasi resmi dan video, asal konsisten dan bikin proyek. Kursus berbayar membantu kalau kamu butuh jadwal dan ada yang nemenin.
>
> Satu hal yang selalu kubilang ke semua orang: bikin sesuatu, sekecil apa pun.
> Dan satu kesalahan yang kulakukan waktu mulai: kebanyakan nonton tutorial tanpa ngetik sendiri.
>
> Aku nggak bilang ini satu-satunya cara. Ini cuma yang berhasil buatku.
>
> Ada pertanyaan lain? Tulis di komentar. Aku jawab di video berikutnya, dan yang paling banyak disukai aku dahulukan.

**Brief Remotion**
| Waktu | Layout | Teks di layar | Latar | Catatan |
|---|---|---|---|---|
| 0.0-5.0 | bigtext | KALIAN NANYA: / MULAI DARI MANA? | #2457ff | |
| 5.0-12.0 | comment | @akun_contoh1: "Kak, mulai belajar coding dari bahasa apa ya?" | #f4f1ea | ganti dengan komentar asli |
| 12.0-24.0 | bigtext | JAWABKU: / SATU BAHASA DULU. BIKIN PROYEK KECIL. | #0a1a3f | |
| 24.0-31.0 | comment | @akun_contoh2: "Harus jago matematika nggak?" | #f9d361 | |
| 31.0-43.0 | bigtext | JAWABKU: / NGGAK HARUS. LOGIKA DASAR CUKUP. | #0a0a0a | |
| 43.0-47.0 | bigtext | TAPI TUNGGU. / YANG PALING SERING DITANYA | #fc1201 | REHOOK |
| 47.0-54.0 | comment | @akun_contoh3: "Belajar dari mana, kursus mahal atau gratis?" | #3ad1ff | |
| 54.0-66.0 | bigtext | JAWABKU: / GRATIS JUGA CUKUP. ASAL KONSISTEN. | #0a1a3f | |
| 66.0-76.0 | stamp x2 | "SATU HAL: BIKIN SESUATU" / "SATU KESALAHANKU: NONTON TUTORIAL TANPA NGETIK" | #f4f1ea | |
| 76.0-85.0 | bigtext | ADA PERTANYAAN LAIN? / ADA DI KOMENTAR | #2457ff | CTA |

**Caption:** Kalian nanya gimana mulai belajar coding. Ini jawabku. Ada pertanyaan lain? Tulis di komentar, aku jawab di video berikutnya.
**Tagar:** `#belajarcoding #programmer #developer #tanyajawab`

---

## V8. Aku Review Kode Buatanku dari Setahun Lalu
- **Jadwal:** Kamis 26 Nov, 19:00 | **Durasi:** ~80 detik (~180 kata) | **Jenis:** review kode lama, humor + belajar. Wajib pakai kode lamamu yang asli di layar (blur bagian rahasia seperti kunci API, nama klien, dan data pribadi).
- **STATUS ISI: KARANGAN.** Semua isi di bawah dikarang untuk contoh. Ganti dengan kejadian nyatamu sebelum direkam; jangan rekam apa adanya kalau tidak benar-benar terjadi.

**Voice-over (contoh karangan)**
> Aku buka kode yang kutulis setahun lalu. Dan aku nggak siap.
>
> Temuan pertama. Nama variabelnya: data, data2, data_baru, data_final. Aku sendiri nggak ngerti mana yang final.
> Temuan kedua. Satu fungsi. Tiga ratus baris. Isinya semua hal.
> Temuan ketiga. Komentarnya cuma satu, dan bunyinya: "jangan disentuh". Nggak ada penjelasan kenapa.
>
> Tapi tunggu, ini belum yang paling parah.
>
> If di dalam if di dalam if. Tujuh tingkat. Aku sempat cari tombol buat mundur.
> Ada angka delapan puluh enam ribu empat ratus di tengah kode, tanpa penjelasan. Setelah mikir lima menit, ternyata itu jumlah detik dalam sehari.
> Dan ada satu bagian yang kutulis tiga kali, copy-paste, dengan satu huruf beda di tiap salinan.
>
> Tapi jujur, ada yang bikin aku tersenyum. Kodenya jalan. Dan masih dipakai sampai sekarang.
>
> Yang kupelajari: kode jelek yang jalan lebih berguna daripada kode bagus yang nggak pernah selesai. Tapi kode yang nggak bisa dibaca bakal bayar mahal nanti.
>
> Kalau kamu buka kodemu setahun lalu dan nggak malu, mungkin kamu belum cukup belajar. Atau kodenya memang bagus, selamat.
>
> Pernah buka kode lamamu? Apa temuan paling memalukan? Tulis di komentar.

**Brief Remotion**
| Waktu | Layout | Teks di layar | Latar | Catatan |
|---|---|---|---|---|
| 0.0-5.0 | bigtext | AKU BUKA KODE / SETAHUN LALU. | #0a0a0a | "SETAHUN LALU" kuning |
| 5.0-14.0 | screen + stempel | TEMUAN 1: data, data2, data_baru, data_final | #0a1a3f | rekaman/foto kode asli `public/V8/kode-1.png`; stempel "YANG MANA FINAL?" |
| 14.0-23.0 | screen + stempel | TEMUAN 2: 1 FUNGSI = 300 BARIS | #f4f1ea | `public/V8/kode-2.png`; penghitung baris naik cepat |
| 23.0-32.0 | screen + stempel | TEMUAN 3: // jangan disentuh | #f9d361 | `public/V8/kode-3.png` |
| 32.0-37.0 | bigtext | TAPI TUNGGU. / BELUM YANG PALING PARAH. | #fc1201 | REHOOK |
| 37.0-47.0 | screen | IF DALAM IF DALAM IF: 7 TINGKAT (kode menjorok makin ke dalam) | #0a0a0a | animasi indentasi bertambah per tingkat |
| 47.0-56.0 | screen + stempel | ANGKA 86400 TANPA PENJELASAN, kunci jawab "detik dalam sehari" | #2457ff | stempel "5 MENIT MIKIR" |
| 56.0-63.0 | split | ATAS: BAGIAN YANG SAMA / BAWAH: 3x COPY-PASTE, 1 HURUF BEDA | #f4f1ea / #0a0a0a | |
| 63.0-72.0 | quote | "Kode jelek yang jalan lebih berguna daripada kode bagus yang nggak pernah selesai." | #f9d361 | |
| 72.0-80.0 | bigtext | KODE LAMAMU / SEPARAH ITU? | #2457ff | CTA, menyambung ke "SETAHUN LALU" |

**Caption:** Aku buka kode buatanku setahun lalu. Reaksinya? Kamu pernah malu lihat kode lamamu? Tulis di komentar.
**Tagar:** `#developer #programmer #codereview #relatable`

---

## V9. Kalian Nanya Lagi: Jawab Komentar Part 2
- **Jadwal:** Minggu 29 Nov, 19:00 | **Durasi:** ~85 detik (~195 kata) | **Jenis:** balas komentar, lanjutan V7. Butuh komentar baru yang nyata; kalau belum ada yang berbeda dari V7, tunda atau ganti dengan topik lain.
- **STATUS ISI: KARANGAN.** Semua isi di bawah dikarang untuk contoh. Ganti dengan kejadian nyatamu sebelum direkam; jangan rekam apa adanya kalau tidak benar-benar terjadi.
- Tiga komentar di bawah (`@akun_contoh1-3`) juga karangan. Pakai komentar asli dari penontonmu.

**Voice-over (contoh karangan)**
> Kalian nanya lagi, dan aku jawab lagi. Ini part dua.
> Dan yang paling banyak disukai, aku dahulukan.
>
> Pertanyaan pertama: "Kak, ambil jurusan IT atau belajar otodidak?"
> Jawabku: dua-duanya bisa. Kuliah memberi dasar dan koneksi. Otodidak lebih fleksibel dan lebih murah. Yang dilihat perusahaan akhirnya bukti kemampuan: apa yang sudah kamu bikin.
>
> Pertanyaan kedua: "Kerja jadi developer itu stres nggak?"
> Jawabku: ada hari yang stres. Biasanya pas deadline atau ada bug di produksi. Yang menolong buatku: punya batas jam kerja dan beneran istirahat.
>
> Tapi tunggu, yang ketiga ini paling sering ditanya.
>
> Pertanyaan ketiga: "Laptop yang cukup buat belajar itu yang kayak apa?"
> Jawabku: nggak perlu yang mahal. Yang penting bisa buka editor kode dan browser dengan lancar. Perhatiin RAM dan penyimpanannya. Sisanya bisa nanti.
>
> Satu hal yang ingin kubilang ke kalian semua: jangan bandingin dirimu dengan orang yang sudah lima tahun di depan. Mulai dari yang kecil, dan terus jalan.
> Satu kesalahanku dulu: nunggu merasa siap. Padahal siap itu datangnya setelah mulai, bukan sebelum.
>
> Aku nggak bilang ini jawaban paling benar. Ini cuma pengalamanku.
>
> Masih ada yang mau ditanya? Tulis di komentar. Part tiga, yang paling banyak disukai aku jawab duluan.

**Brief Remotion**
| Waktu | Layout | Teks di layar | Latar | Catatan |
|---|---|---|---|---|
| 0.0-5.0 | bigtext | KALIAN NANYA LAGI. / PART 2. | #2457ff | |
| 5.0-12.0 | comment | @akun_contoh1: "Kak, ambil jurusan IT atau belajar otodidak?" | #f4f1ea | ganti dengan komentar asli |
| 12.0-25.0 | bigtext | JAWABKU: / DUA-DUANYA BISA. BUKTI KEMAMPUAN YANG DILIHAT. | #0a1a3f | |
| 25.0-32.0 | comment | @akun_contoh2: "Kerja jadi developer itu stres nggak?" | #f9d361 | |
| 32.0-43.0 | bigtext | JAWABKU: / ADA HARI STRES. PUNYA BATAS JAM KERJA. | #0a0a0a | |
| 43.0-48.0 | bigtext | TAPI TUNGGU. / YANG PALING SERING DITANYA | #fc1201 | REHOOK |
| 48.0-55.0 | comment | @akun_contoh3: "Laptop yang cukup buat belajar itu yang kayak apa?" | #3ad1ff | |
| 55.0-66.0 | bigtext | JAWABKU: / NGGAK PERLU MAHAL. CEK RAM DAN PENYIMPANAN. | #0a1a3f | |
| 66.0-77.0 | stamp x2 | "JANGAN BANDINGIN DIRIMU" / "SIAP ITU DATANG SETELAH MULAI" | #f4f1ea | |
| 77.0-85.0 | bigtext | MASIH ADA PERTANYAAN? / PART 3 MENUNGGU | #2457ff | CTA |

**Caption:** Kalian nanya lagi, aku jawab. Ada pertanyaan lain? Tulis di komentar.
**Tagar:** `#tanyajawab #developer #programmer #belajarcoding`

---

## Catatan produksi
- **Rekam suara dulu**, baru Remotion mengikuti. Satu kali ambil per bagian, jangan terlalu rapi; suara yang natural menahan penonton.
- **Panjang naskah:** 150-195 kata per video. Kalau hasil rekamanmu di bawah 60 detik, tambah satu bagian atau jeda 1 detik antar beat, jangan dilambatkan.
- **Hook di 3 detik pertama** harus muncul di suara dan layar sekaligus.
- **Jangan menahan semua kejutan di akhir.** Tiap "TAPI TUNGGU." harus benar-benar berisi hal baru.
- **Lagu trending:** pilih dari tab Songs di Creative Center, volume rendah di bawah suara. Cek lisensi/ketersediaan untuk akunmu.
- **Label konten AI:** kalau video memuat hasil AI yang realistis (V4), cek aturan label di TikTok.
- **Naskah ini tidak final.** Semua isi cerita karangan; ganti dengan kejadian nyata sebelum direkam.
