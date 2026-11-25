@echo off
title Quran Studio

cd /d "%~dp0"

echo ========================================================
echo                 Quran Studio Runner
echo ========================================================
echo.

set "RUNNER="
if exist "%USERPROFILE%\.bun\bin\bun.exe" (
    set "RUNNER=%USERPROFILE%\.bun\bin\bun.exe"
)

if not defined RUNNER (
    where bun >nul 2>nul
    if not errorlevel 1 (
        set "RUNNER=bun"
    )
)

if not defined RUNNER (
    where npm >nul 2>nul
    if not errorlevel 1 (
        set "RUNNER=npm"
    )
)

if not defined RUNNER (
    echo [ERROR] Neither Bun nor Node.js was found on your system!
    echo Please ensure Bun or Node.js is installed.
    echo.
    pause
    exit /b 1
)

:: Add FFmpeg to PATH if installed via WinGet
if exist "%LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.1-full_build\bin" (
    set "PATH=%LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.1-full_build\bin;%PATH%"
)

if not exist ".env.local" (
    if exist ".env.example" (
        echo Copying .env.example to .env.local...
        copy ".env.example" ".env.local" >nul
    )
)

if not exist "node_modules\" (
    echo Installing project dependencies...
    "%RUNNER%" install
    if errorlevel 1 (
        echo [ERROR] Dependency installation failed!
        pause
        exit /b 1
    )
)

echo Starting dev server...
echo Local address: http://localhost:3000
echo.
echo Opening browser in 3 seconds...
start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:3000"
echo.
echo Press Ctrl+C to stop the server anytime.
echo ========================================================
echo.

"%RUNNER%" run dev

if errorlevel 1 (
    echo.
    echo [ERROR] The server stopped with an error.
    pause
)
