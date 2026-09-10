@echo off
REM One-command way to run Anomaly Hunt locally on Windows.
REM
REM Usage: double-click this file, or run it from Command Prompt / PowerShell.
REM
REM This is the ONLY thing you need to run to play the game locally.
REM Data for both game modes (Anomaly Hunt and Forecast Call) is generated
REM live in the browser -- there's no separate data-build step, and no
REM Python step required to play.

cd /d "%~dp0web"

echo Installing dependencies (only takes a while the first time)...
call npm install

echo.
echo Starting Anomaly Hunt...
call npm run dev

pause
