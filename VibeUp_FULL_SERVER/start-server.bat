@echo off
cd /d "%~dp0"
echo ===== VibeUp backend =====
set /p VIBEUP_YANDEX_TOKEN=Yandex OAuth token (server only): 
set /p VIBEUP_ADMIN_KEY=Admin key (private): 
set /p VIBEUP_AI_KEY=OpenAI API key (server only, optional): 
set /p VIBEUP_AUDD_TOKEN=AudD token (server only, optional): 
set PORT=3000
echo Backend: http://localhost:%PORT%
echo Admin:   http://localhost:%PORT%/admin
node server.js
pause
