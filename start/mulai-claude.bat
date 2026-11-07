@echo off
rem Klik dua kali: jalankan carousel-maker dengan agent AI Claude Code.
cd /d "%~dp0.."

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js belum terpasang. Pasang dari https://nodejs.org lalu coba lagi.
  pause & exit /b 1
)
where claude >nul 2>nul
if errorlevel 1 (
  echo CLI 'claude' tidak ketemu. Pasang Claude Code lalu jalankan 'claude' sekali untuk login.
  echo Editor tetap jalan, tapi fitur AI tidak akan bekerja.
)
if not exist node_modules (
  echo Pertama kali: memasang dependensi...
  call npm install || ( pause & exit /b 1 )
  call npx playwright install chromium || ( pause & exit /b 1 )
)

set AGENT_PROVIDER=claude
echo Menjalankan carousel-maker ^(AI: claude^). Tutup jendela ini untuk berhenti.
call npm run dev -- --open
pause
