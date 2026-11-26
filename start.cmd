@echo off
setlocal enabledelayedexpansion
title Quran Studio

cd /d "%~dp0"

echo ========================================================
echo                 Quran Studio Runner
echo ========================================================
echo.

:: ──────────────────────────────────────────────────────────
:: 1) Detect the package runner — Bun is strongly preferred
::    (this project ships bun.lock + bun-specific package.json
::     fields). Node.js/npm is a best-effort fallback.
:: ──────────────────────────────────────────────────────────
set "RUNNER="
set "RUNNER_KIND="

if exist "%USERPROFILE%\.bun\bin\bun.exe" (
    set "RUNNER=%USERPROFILE%\.bun\bin\bun.exe"
    set "RUNNER_KIND=bun"
)

if not defined RUNNER (
    where bun.exe >nul 2>nul
    if not errorlevel 1 (
        set "RUNNER=bun"
        set "RUNNER_KIND=bun"
    )
)

if not defined RUNNER (
    :: npm fallback — resolve the GLOBAL npm only. We must NOT pick up a
    :: broken local node_modules\.bin\npm.cmd shim (a common Windows trap
    :: when a previous install crashed midway and left node_modules\npm\
    :: without bin\npm-cli.js). `where npm.cmd` may return the local shim
    :: first, so we filter to a path outside the project's node_modules.
    set "NPM_GLOBAL="
    for /f "delims=" %%P in ('where npm.cmd 2^>nul') do (
        set "CAND=%%P"
        echo !CAND! | findstr /i /c:"node_modules\.bin" >nul
        if errorlevel 1 (
            if not defined NPM_GLOBAL set "NPM_GLOBAL=!CAND!"
        )
    )
    if defined NPM_GLOBAL (
        set "RUNNER=!NPM_GLOBAL!"
        set "RUNNER_KIND=npm"
    )
)

if not defined RUNNER (
    echo [ERROR] Neither Bun nor Node.js/npm was found on your system.
    echo.
    echo This project is designed for Bun. Install it with:
    echo    powershell -c "irm bun.sh/install.ps1 ^| iex"
    echo Or install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo [INFO] Using runner: %RUNNER% (%RUNNER_KIND%)
echo.

:: ──────────────────────────────────────────────────────────
:: 2) Add FFmpeg to PATH if installed via WinGet (needed for export)
:: ──────────────────────────────────────────────────────────
set "FFMPEG_DIR=%LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.1-full_build\bin"
if exist "%FFMPEG_DIR%" (
    set "PATH=%FFMPEG_DIR%;%PATH%"
    echo [INFO] FFmpeg found via WinGet — added to PATH.
) else (
    if exist "C:\ffmpeg\bin\ffmpeg.exe" (
        set "PATH=C:\ffmpeg\bin;%PATH%"
        echo [INFO] FFmpeg found at C:\ffmpeg\bin — added to PATH.
    )
)

:: ──────────────────────────────────────────────────────────
:: 3) Ensure .env.local exists
:: ──────────────────────────────────────────────────────────
if not exist ".env.local" (
    if exist ".env.example" (
        echo [INFO] Copying .env.example to .env.local...
        copy ".env.example" ".env.local" >nul
    )
)

:: ──────────────────────────────────────────────────────────
:: 4) Verify node_modules is COMPLETE — not just present.
::    A partial install (e.g. crashed midway) leaves node_modules\npm\
::    without bin\npm-cli.js, so the npm shim self-crashes. We check for
::    the critical `next` package; if missing, wipe and reinstall clean.
:: ──────────────────────────────────────────────────────────
set "NEEDS_INSTALL=0"
if not exist "node_modules\" (
    set "NEEDS_INSTALL=1"
)
if exist "node_modules\" (
    if not exist "node_modules\next\package.json" (
        set "NEEDS_INSTALL=1"
        echo [WARN] node_modules is incomplete (missing 'next') — cleaning...
    )
    :: Detect the specific broken-npm-shim case and purge it so the global
    :: npm is used instead of the corrupt local one.
    if exist "node_modules\.bin\npm.cmd" (
        if not exist "node_modules\npm\bin\npm-cli.js" (
            set "NEEDS_INSTALL=1"
            echo [WARN] Broken local npm shim detected — cleaning node_modules...
        )
    )
)

if "%NEEDS_INSTALL%"=="1" (
    if exist "node_modules\" (
        echo [INFO] Removing incomplete node_modules...
        rmdir /s /q "node_modules" 2>nul
    )
    echo [INFO] Installing project dependencies with %RUNNER_KIND%...
    "%RUNNER%" install
    if errorlevel 1 (
        echo.
        echo [ERROR] Dependency installation failed!
        echo.
        echo If this persists, install Bun ^(recommended^):
        echo    powershell -c "irm bun.sh/install.ps1 ^| iex"
        echo Then close this window and run start.cmd again.
        echo.
        pause
        exit /b 1
    )
)

:: ──────────────────────────────────────────────────────────
:: 5) Launch the dev server (cross-platform: node scripts/dev.mjs)
:: ──────────────────────────────────────────────────────────
echo.
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

endlocal
