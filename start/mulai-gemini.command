#!/bin/zsh -l
# Klik dua kali di Finder: jalankan carousel-maker dengan agent AI Gemini.
cd "$(dirname "$0")/.." || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js belum terpasang. Pasang dari https://nodejs.org lalu coba lagi."; read -k1 "?Tekan tombol apa saja..."; exit 1
fi
if ! command -v gemini >/dev/null 2>&1; then
  echo "CLI 'gemini' tidak ketemu. Pasang: npm i -g @google/gemini-cli."
  echo "Editor tetap jalan, tapi fitur AI tidak akan bekerja."
fi
if [ ! -d node_modules ]; then
  echo "Pertama kali: memasang dependensi..."
  npm install && npx playwright install chromium || { read -k1 "?Gagal. Tekan tombol apa saja..."; exit 1; }
fi

if [ -z "$GEMINI_API_KEY" ]; then
  echo "GEMINI_API_KEY belum diset (buat di https://aistudio.google.com/apikey)."
  printf "Tempel API key lalu Enter (kosongkan kalau sudah login lain): "
  read -rs GEMINI_API_KEY; echo
  export GEMINI_API_KEY
fi

# Pilih model (lewati menu kalau GEMINI_MODEL sudah diset). Pilihan terakhir diingat di start/.gemini-model.
if [ -z "$GEMINI_MODEL" ]; then
  models=(gemini-3.5-flash-lite gemini-3-flash-preview gemini-3.8-flash gemini-3.1-pro-preview gemini-2.5-pro)
  last=""; [ -f start/.gemini-model ] && last="$(cat start/.gemini-model)"
  echo
  echo "Pilih model Gemini (kuota gratis dihitung per model; kalau habis, pilih yang lain):"
  i=1; for m in $models; do
    mark=""; [ "$m" = "$last" ] && mark="  <- terakhir dipakai"
    echo "  $i) $m$mark"; i=$((i+1))
  done
  echo "  $i) ketik nama model sendiri"
  echo "  Enter) ${last:-${models[1]}}"
  printf "Pilihan: "; read -r pick
  if [ -z "$pick" ]; then GEMINI_MODEL="${last:-${models[1]}}"
  elif [ "$pick" = "$i" ]; then printf "Nama model: "; read -r GEMINI_MODEL
  elif [ "$pick" -ge 1 ] 2>/dev/null && [ "$pick" -lt "$i" ]; then GEMINI_MODEL="${models[$pick]}"
  else GEMINI_MODEL="$pick"; fi
  [ -n "$GEMINI_MODEL" ] && echo "$GEMINI_MODEL" > start/.gemini-model
fi
export GEMINI_MODEL

export AGENT_PROVIDER=gemini
echo "Menjalankan carousel-maker (AI: gemini, model: ${GEMINI_MODEL:-bawaan}). Tutup jendela ini untuk berhenti."
npm run dev -- --open
read -k1 "?Selesai. Tekan tombol apa saja..."
