@echo off
rem Klik dua kali: jalankan carousel-maker dengan agent AI Gemini.
cd /d "%~dp0.."

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js belum terpasang. Pasang dari https://nodejs.org lalu coba lagi.
  pause & exit /b 1
)
where gemini >nul 2>nul
if errorlevel 1 (
  echo CLI 'gemini' tidak ketemu. Pasang: brew install gemini-cli (Mac) atau npm i -g @google/gemini-cli.
  echo Editor tetap jalan, tapi fitur AI tidak akan bekerja.
)
if not exist node_modules (
  echo Pertama kali: memasang dependensi...
  call npm install || ( pause & exit /b 1 )
  call npx playwright install chromium || ( pause & exit /b 1 )
)

if "%GEMINI_API_KEY%"=="" (
  echo GEMINI_API_KEY belum diset ^(buat di https://aistudio.google.com/apikey^).
  set /p GEMINI_API_KEY=Tempel API key lalu Enter: 
)

set AGENT_PROVIDER=gemini
echo Menjalankan carousel-maker ^(AI: gemini^). Tutup jendela ini untuk berhenti.
call npm run dev -- --open
pause
