#!/bin/zsh -l
# Klik dua kali di Finder: jalankan carousel-maker dengan agent AI Claude Code.
cd "$(dirname "$0")/.." || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js belum terpasang. Pasang dari https://nodejs.org lalu coba lagi."; read -k1 "?Tekan tombol apa saja..."; exit 1
fi
if ! command -v claude >/dev/null 2>&1; then
  echo "CLI 'claude' tidak ketemu. Pasang Claude Code lalu jalankan 'claude' sekali untuk login."
  echo "Editor tetap jalan, tapi fitur AI tidak akan bekerja."
fi
if [ ! -d node_modules ]; then
  echo "Pertama kali: memasang dependensi..."
  npm install && npx playwright install chromium || { read -k1 "?Gagal. Tekan tombol apa saja..."; exit 1; }
fi

export AGENT_PROVIDER=claude
echo "Menjalankan carousel-maker (AI: claude). Tutup jendela ini untuk berhenti."
npm run dev -- --open
read -k1 "?Selesai. Tekan tombol apa saja..."
