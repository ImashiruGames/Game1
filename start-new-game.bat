@echo off
cd /d "%~dp0"
echo Game1 1.14.9 - http://127.0.0.1:5184/next/
call npm.cmd run dev -- --port 5184 --strictPort --open /next/
pause
