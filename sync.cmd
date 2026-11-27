@echo off
setlocal enabledelayedexpansion
title Quran Studio — GitHub Sync ^& Run
chcp 65001 >nul

cd /d "%~dp0"

echo ========================================================
echo        Quran Studio — Sync with GitHub + Run
echo ========================================================
echo.

:: ──────────────────────────────────────────────────────────
:: 1) Ensure git exists
:: ──────────────────────────────────────────────────────────
where git.exe >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Git was not found. Install it from https://git-scm.com/
    pause
    exit /b 1
)

:: ──────────────────────────────────────────────────────────
:: 2) Verify we are inside a git repository
:: ──────────────────────────────────────────────────────────
git rev-parse --is-inside-work-tree >nul 2>nul
if errorlevel 1 (
    echo [ERROR] This folder is not a git repository.
    echo          Clone the project first:
    echo            git clone https://github.com/MeDoMeXo/mushaf-studio.git
    pause
    exit /b 1
)

:: ──────────────────────────────────────────────────────────
:: 3) Ask for a GitHub token ONCE per clone, then store it in
::    the local git credential helper (no echo of the token).
::    Already-stored credentials are reused silently.
:: ──────────────────────────────────────────────────────────
git config credential.helper manager-core >nul 2>nul

:: Quick connectivity check — fall back to a clear message.
git ls-remote --heads origin >nul 2>nul
if errorlevel 1 (
    echo [WARN] Could not reach GitHub — continuing with local run only.
    echo        ^(Check internet, or run: git remote -v^)
    goto :run
)

:: ──────────────────────────────────────────────────────────
:: 4) Save local changes (if any) → pull → restore them
:: ──────────────────────────────────────────────────────────
set "HAD_STASH=0"
git stash push -m "sync-autostash" >nul 2>nul
if not errorlevel 1 (
    git stash list 2>nul | findstr /c:"sync-autostash" >nul
    if not errorlevel 1 set "HAD_STASH=1"
)

echo [INFO] Pulling latest changes from GitHub...
git pull --rebase --autostash origin main
if errorlevel 1 (
    echo [ERROR] git pull failed. Fix conflicts manually, then run sync.cmd again.
    if "%HAD_STASH%"=="1" (
        echo        Your local changes are safely stored in: git stash list
    )
    pause
    exit /b 1
)

if "%HAD_STASH%"=="1" (
    echo [INFO] Restoring your local changes...
    git stash pop
    if errorlevel 1 (
        echo [WARN] Could not auto-restore local changes — run manually:
        echo          git stash list
        echo          git stash pop
    )
)

:: Show where we are now
for /f "delims=" %%H in ('git rev-parse --short HEAD 2^>nul') do set "HEAD_SHA=%%H"
echo [OK] Up to date at commit !HEAD_SHA!
echo.

:: ──────────────────────────────────────────────────────────
:: 5) Dependencies changed? Install when node_modules is missing
::    OR bun.lock was updated by the pull (marker-file comparison).
:: ──────────────────────────────────────────────────────────
set "NEEDS_INSTALL=0"
if not exist "node_modules\next\package.json" set "NEEDS_INSTALL=1"

if "%NEEDS_INSTALL%"=="0" (
    if not exist ".deps-stamp" set "NEEDS_INSTALL=1"
)

if "%NEEDS_INSTALL%"=="0" (
    :: الختم يختلف عن bun.lock الحالي = التبعيات تغيّرت مع السحب
    fc /b "bun.lock" ".deps-stamp" >nul 2>nul
    if errorlevel 1 set "NEEDS_INSTALL=1"
)

:: ──────────────────────────────────────────────────────────
:: 6) Install dependencies when needed (start.cmd also verifies),
::    refresh the stamp, then launch the project via start.cmd
:: ──────────────────────────────────────────────────────────
:run
if "%NEEDS_INSTALL%"=="1" (
    echo [INFO] Dependencies changed — installing...
    where bun.exe >nul 2>nul
    if not errorlevel 1 (
        bun install
    ) else (
        where npm.cmd >nul 2>nul
        if not errorlevel 1 (
            call npm install
        ) else (
            echo [WARN] Neither Bun nor npm found — start.cmd will retry.
        )
    )
    if exist "bun.lock" copy /y "bun.lock" ".deps-stamp" >nul
)

echo Starting the project via start.cmd ...
echo ========================================================
echo.

call "%~dp0start.cmd"

endlocal
