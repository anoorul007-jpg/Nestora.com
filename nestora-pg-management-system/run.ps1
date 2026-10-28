# Nestora PG Management System - PowerShell Launcher
Set-Location -Path $PSScriptRoot

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "   Nestora PG Management System - Startup Script" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

If (-Not (Test-Path ".venv")) {
    Write-Host "Creating Python virtual environment (.venv)..." -ForegroundColor Yellow
    python -m venv .venv
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    & .\.venv\Scripts\pip install -r requirements.txt
}

Write-Host "Initializing and seeding database..." -ForegroundColor Green
& .\.venv\Scripts\python seed_data.py

Write-Host "`nStarting Web Server on http://127.0.0.1:5000" -ForegroundColor Green
Write-Host "Opening web browser..." -ForegroundColor Cyan

Start-Process "http://127.0.0.1:5000"

& .\.venv\Scripts\python app.py
