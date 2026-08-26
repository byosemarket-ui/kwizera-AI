@echo off
REM KWIZERA AI STUDIO — stable Windows launcher (Phase 7 Step 4)
REM Prefer installed Setup / win-unpacked EXE; fall back to Electron from this repo.
setlocal
cd /d "%~dp0..\.."

set "PROJECT_ROOT=%CD%"
set "UNPACKED=%PROJECT_ROOT%\release\win-unpacked\KWIZERA AI STUDIO.exe"
set "ICON=%PROJECT_ROOT%\electron\assets\icon.ico"

if exist "%UNPACKED%" (
  start "" "%UNPACKED%"
  exit /b 0
)

where npm >nul 2>&1
if errorlevel 1 (
  echo KWIZERA AI STUDIO: npm not found. Install Node.js 20+ or run the Setup EXE.
  pause
  exit /b 1
)

REM Dev / source tree: Electron desktop shell (starts or reuses local API)
call npm run desktop
exit /b %ERRORLEVEL%
