#!/bin/zsh -l
# Klik dua kali di Finder: jalankan carousel-maker dengan agent AI Gemini.
cd "$(dirname "$0")/.." || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js belum terpasang. Pasang dari https://nodejs.org lalu coba lagi."; read -k1 "?Tekan tombol apa saja..."; exit 1
fi
if ! command -v gemini >/dev/null 2>&1; then
  echo "CLI 'gemini' tidak ketemu. Pasang: brew install gemini-cli (Mac) atau npm i -g @google/gemini-cli."
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

export AGENT_PROVIDER=gemini
echo "Menjalankan carousel-maker (AI: gemini). Tutup jendela ini untuk berhenti."
npm run dev -- --open
read -k1 "?Selesai. Tekan tombol apa saja..."
