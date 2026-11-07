@echo off
rem Klik dua kali: jalankan carousel-maker dengan agent AI Codex.
cd /d "%~dp0.."

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js belum terpasang. Pasang dari https://nodejs.org lalu coba lagi.
  pause & exit /b 1
)
where codex >nul 2>nul
if errorlevel 1 (
  echo CLI 'codex' tidak ketemu. Pasang: brew install codex (Mac) atau npm i -g @openai/codex, lalu 'codex login'.
  echo Editor tetap jalan, tapi fitur AI tidak akan bekerja.
)
if not exist node_modules (
  echo Pertama kali: memasang dependensi...
  call npm install || ( pause & exit /b 1 )
  call npx playwright install chromium || ( pause & exit /b 1 )
)

set AGENT_PROVIDER=codex
echo Menjalankan carousel-maker ^(AI: codex^). Tutup jendela ini untuk berhenti.
call npm run dev -- --open
pause
