#!/bin/zsh -l
# Klik dua kali di Finder: jalankan carousel-maker dengan agent AI Codex.
cd "$(dirname "$0")/.." || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js belum terpasang. Pasang dari https://nodejs.org lalu coba lagi."; read -k1 "?Tekan tombol apa saja..."; exit 1
fi
if ! command -v codex >/dev/null 2>&1; then
  echo "CLI 'codex' tidak ketemu. Pasang: brew install codex (Mac) atau npm i -g @openai/codex, lalu 'codex login'."
  echo "Editor tetap jalan, tapi fitur AI tidak akan bekerja."
fi
if [ ! -d node_modules ]; then
  echo "Pertama kali: memasang dependensi..."
  npm install && npx playwright install chromium || { read -k1 "?Gagal. Tekan tombol apa saja..."; exit 1; }
fi

export AGENT_PROVIDER=codex
echo "Menjalankan carousel-maker (AI: codex). Tutup jendela ini untuk berhenti."
npm run dev -- --open
read -k1 "?Selesai. Tekan tombol apa saja..."
