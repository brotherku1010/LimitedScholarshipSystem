@echo off
chcp 65001 > nul
title Guge Scholarship System - GAS Deploy Tool

echo =====================================================================
echo  [Guge Scholarship] One-click Deploy to Google Apps Script
echo =====================================================================
echo.

:: 1. Check if global Node.js exists
where node >nul 2>nul
if errorlevel 1 goto :check_local
goto :do_push

:check_local
:: 2. Check if local portable Node.js exists in the batch script directory
if exist "%~dp0node-portable\node.exe" goto :setup_local_path

echo [INFO] Node.js is not installed on this system.
echo 🚀 Automatically downloading and setting up portable Node.js LTS...
echo    This may take 10-30 seconds depending on your network. Please wait...
echo ---------------------------------------------------------------------

:: Download zip to batch directory
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.12.2/node-v20.12.2-win-x64.zip' -OutFile '%~dp0node.zip'"
if errorlevel 1 goto :download_error

:: Extract zip in batch directory
echo [INFO] Extracting Node.js package...
powershell -Command "Expand-Archive -Path '%~dp0node.zip' -DestinationPath '%~dp0node-temp' -Force"
if errorlevel 1 goto :extract_error

:: Move to node-portable and clean up in batch directory
move "%~dp0node-temp\node-v20.12.2-win-x64" "%~dp0node-portable" >nul
del "%~dp0node.zip" >nul
rd /s /q "%~dp0node-temp" >nul
echo [INFO] Node.js portable setup complete!
echo ---------------------------------------------------------------------
echo.

:setup_local_path
:: 3. Add local portable node folder to current CMD path
set "PATH=%~dp0node-portable;%PATH%"

:do_push
:: 4. Check clasp login status
set "CLASP_RC=%USERPROFILE%\.clasprc.json"
if exist "%CLASP_RC%" goto :push_code

echo [INFO] Google Apps Script credentials not found.
echo Launching login process. Please authorize in your browser...
echo ---------------------------------------------------------------------
call npx @google/clasp login
if errorlevel 1 goto :error
echo ---------------------------------------------------------------------
echo.

:push_code
:: 5. Push files to Google Apps Script
echo [INFO] Pushing files to Google Apps Script project...
echo ---------------------------------------------------------------------
call npx @google/clasp push -f
if errorlevel 1 goto :error
echo ---------------------------------------------------------------------

echo.
echo Deploy completed successfully!
echo You can refresh your Google Apps Script editor to see the changes.
echo Closing in 5 seconds...
timeout /t 5 > nul
exit

:download_error
echo.
echo [ERROR] Failed to download Node.js from official website.
echo Please check your internet connection or install Node.js manually.
echo.
if exist "%~dp0node.zip" del "%~dp0node.zip"
pause
exit /b

:extract_error
echo.
echo [ERROR] Failed to extract Node.js zip package.
echo.
if exist "%~dp0node.zip" del "%~dp0node.zip"
if exist "%~dp0node-temp" rd /s /q "%~dp0node-temp"
pause
exit /b

:error
echo.
echo ---------------------------------------------------------------------
echo [ERROR] Deploy to Google Apps Script failed.
echo ---------------------------------------------------------------------
echo.
pause
exit /b
