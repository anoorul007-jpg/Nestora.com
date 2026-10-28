@echo off
echo ========================================================
echo   Nestora PG Management System - Windows Launcher
echo ========================================================
echo.

cd /d "%~dp0"

if not exist .venv (
    echo Creating Python virtual environment (.venv)...
    python -m venv .venv
    echo Installing dependencies from requirements.txt...
    .venv\Scripts\pip install -r requirements.txt
)

echo Initializing and seeding Nestora database...
.venv\Scripts\python seed_data.py

echo.
echo Starting Nestora PG Management Web Application...
echo Access URL: http://127.0.0.1:5000
echo.

start http://127.0.0.1:5000

.venv\Scripts\python app.py
pause
