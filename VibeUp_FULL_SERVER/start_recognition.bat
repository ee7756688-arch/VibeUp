@echo off
setlocal
cd /d "%~dp0"
if not exist .recognition-venv (
  echo Creating recognition virtual environment...
  py -3 -m venv .recognition-venv || goto :error
)
call .recognition-venv\Scripts\activate.bat
python -m pip install -r recognition\requirements.txt || goto :error
echo.
echo VibeUp recognition service: http://127.0.0.1:8765
python -m uvicorn recognition.recognition_service:app --host 127.0.0.1 --port 8765
exit /b 0
:error
echo Failed to prepare recognition service.
pause
exit /b 1
