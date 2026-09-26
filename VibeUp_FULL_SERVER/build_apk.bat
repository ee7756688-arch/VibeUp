@echo off
setlocal
cd /d "%~dp0"
echo [1/3] Installing Node dependencies...
npm ci || goto :error
echo [2/3] Syncing Capacitor Android project...
npx cap sync android || goto :error
echo [3/3] Building debug APK...
cd android
gradlew.bat assembleDebug || goto :error
echo.
echo APK created at:
echo android\app\build\outputs\apk\debug\app-debug.apk
pause
exit /b 0
:error
echo.
echo Build failed. Check the error above.
pause
exit /b 1
