# FraMgnt — Kroger Sync Server Startup Script
# Run with: powershell -ExecutionPolicy Bypass -File start.ps1

$host.UI.RawUI.WindowTitle = "FraMgnt — Kroger Sync Server"

Write-Host ""
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host "    FraMgnt Kroger Sync Server" -ForegroundColor Cyan
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "  [ERROR] Node.js is not installed." -ForegroundColor Red
    Write-Host "  Please install from https://nodejs.org" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

$nodeVersion = node --version
Write-Host "  Node.js: $nodeVersion" -ForegroundColor Green

# Install dependencies if needed
if (-not (Test-Path "node_modules")) {
    Write-Host ""
    Write-Host "  [*] Installing npm dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [ERROR] npm install failed" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }

    Write-Host ""
    Write-Host "  [*] Installing Playwright browser (Chromium)..." -ForegroundColor Yellow
    npx playwright install chromium
}

Write-Host ""
Write-Host "  [*] Starting server on http://localhost:3131" -ForegroundColor Green
Write-Host "  [*] Keep this window open while using FraMgnt." -ForegroundColor Gray
Write-Host "  [*] Press Ctrl+C to stop." -ForegroundColor Gray
Write-Host ""

node server.js
