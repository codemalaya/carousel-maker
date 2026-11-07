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
  echo CLI 'gemini' tidak ketemu. Pasang: npm i -g @google/gemini-cli.
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

if not "%GEMINI_MODEL%"=="" goto :modelok
set LAST=
if exist "start\.gemini-model" set /p LAST=<"start\.gemini-model"
echo.
echo Pilih model Gemini ^(kuota gratis dihitung per model; kalau habis, pilih yang lain^):
echo   1) gemini-3.5-flash-lite
echo   2) gemini-3-flash-preview
echo   3) gemini-3.8-flash
echo   4) gemini-3.1-pro-preview
echo   5) gemini-2.5-pro
echo   6) ketik nama model sendiri
if not "%LAST%"=="" (echo   Enter = %LAST% ^(terakhir dipakai^)) else (echo   Enter = gemini-3.5-flash-lite)
set PICK=
set /p PICK=Pilihan: 
if "%PICK%"=="" ( if not "%LAST%"=="" (set GEMINI_MODEL=%LAST%) else (set GEMINI_MODEL=gemini-3.5-flash-lite) )
if "%PICK%"=="1" set GEMINI_MODEL=gemini-3.5-flash-lite
if "%PICK%"=="2" set GEMINI_MODEL=gemini-3-flash-preview
if "%PICK%"=="3" set GEMINI_MODEL=gemini-3.8-flash
if "%PICK%"=="4" set GEMINI_MODEL=gemini-3.1-pro-preview
if "%PICK%"=="5" set GEMINI_MODEL=gemini-2.5-pro
if "%PICK%"=="6" set /p GEMINI_MODEL=Nama model: 
if "%GEMINI_MODEL%"=="" set GEMINI_MODEL=%PICK%
>"start\.gemini-model" echo %GEMINI_MODEL%
:modelok

set AGENT_PROVIDER=gemini
echo Menjalankan carousel-maker ^(AI: gemini, model: %GEMINI_MODEL%^). Tutup jendela ini untuk berhenti.
call npm run dev -- --open
pause
