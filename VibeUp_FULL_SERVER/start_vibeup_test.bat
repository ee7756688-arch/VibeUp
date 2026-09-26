@echo off
setlocal
cd /d "%~dp0"
echo Starting VibeUp backend on port 3000...
node server.js
pause
