@echo off
setlocal
cd /d "%~dp0..\.."

set KWIZERA_STORAGE_ROOT=D:\KWIZERA-AI-STUDIO
set KWIZERA_PERSISTENT_MODE=1
set KWIZERA_AUTO_START=1
set KWIZERA_DEV_PORT=5173

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0launch-persistent.ps1"
exit /b %ERRORLEVEL%
