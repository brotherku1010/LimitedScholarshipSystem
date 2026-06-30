@echo off
chcp 65001 > nul
cd /d "%~dp0."
title Guge Scholarship - GAS Push Tool

echo ===================================================
echo  Preparing to upload files to Google Apps Script...
echo ===================================================
echo.

:: Add local portable node folder to PATH so clasp can be found
set "PATH=%~dp0node-portable\node-v20.12.2-win-x64;%PATH%"

call clasp push -f

echo.
echo ===================================================
echo  Upload completed successfully!
echo ===================================================
echo.
pause