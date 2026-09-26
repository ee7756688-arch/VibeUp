@echo off
setlocal
cd /d "%~dp0"
if not exist .env (
  echo Creating .env from .env.example...
  copy /Y .env.example .env >nul
  echo.
  echo Open .env and enter your server secrets, then run this file again.
  pause
  exit /b 1
)
echo Starting the complete VibeUp server stack...
docker compose up --build
if errorlevel 1 (
  echo.
  echo Server stack failed to start. Check Docker Desktop and the error above.
  pause
)
