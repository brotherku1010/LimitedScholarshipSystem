@echo off
chcp 65001 > nul
title Guge Scholarship System - GAS Deploy Tool
echo =====================================================================
echo  [Guge Scholarship] One-click Deploy to Google Apps Script
echo =====================================================================
echo.

:: 1. Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo.
    echo Please download and install Node.js (LTS version) from:
    echo https://nodejs.org/
    echo.
    pause
    exit /b
)

:: 2. Check clasp login status
set "CLASP_RC=%USERPROFILE%\.clasprc.json"
if not exist "%CLASP_RC%" (
    echo [INFO] Google Apps Script credentials not found.
    echo Launching login process. Please authorize in your browser...
    echo ---------------------------------------------------------------------
    call npx @google/clasp login
    if %errorlevel% neq 0 goto :error
    echo ---------------------------------------------------------------------
    echo.
)

:: 3. Push files to Google Apps Script
echo [INFO] Pushing files to Google Apps Script project...
echo ---------------------------------------------------------------------
call npx @google/clasp push -f
if %errorlevel% neq 0 goto :error
echo ---------------------------------------------------------------------

echo.
echo Deploy completed successfully!
echo You can refresh your Google Apps Script editor to see the changes.
echo Closing in 5 seconds...
timeout /t 5 > nul
exit

:error
echo.
echo ---------------------------------------------------------------------
echo [ERROR] Deploy to Google Apps Script failed.
echo Please review the error message above.
echo ---------------------------------------------------------------------
echo.
pause
exit /b
