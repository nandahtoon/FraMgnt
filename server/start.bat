@echo off
title FraMgnt — Kroger Sync Server
color 0A
cd /d "%~dp0"

echo.
echo  ============================================
echo    FraMgnt Kroger Sync Server
echo  ============================================
echo.

:: Check if node_modules exists
if not exist "node_modules" (
    echo  [*] Installing dependencies...
    call npm install
    echo.
    echo  [*] Installing Playwright browser (Chromium)...
    call npx playwright install chromium
    echo.
)

echo  [*] Starting server on http://localhost:3131
echo.
node server.js

pause
