@echo off
chcp 65001 > nul
title Guge Scholarship System - Github Push Tool
echo =====================================================================
echo  [Guge Scholarship] One-click Git Push to GitHub
echo =====================================================================
echo.

echo [1/5] Initializing local Git repository...
git init
if %errorlevel% neq 0 goto :error

:: Auto-configure local repository identity to bypass "Please tell me who you are" git error
git config --local user.email "brotherku1010@example.com"
git config --local user.name "brotherku1010"
if %errorlevel% neq 0 goto :error

echo [2/5] Setting remote repository origin...
git remote remove origin 2>nul
git remote add origin https://github.com/brotherku1010/LimitedScholarshipSystem.git
git branch -M main
if %errorlevel% neq 0 goto :error

echo [3/5] Adding all files to git staging...
git add .
if %errorlevel% neq 0 goto :error

echo [4/5] Committing changes...
git commit -m "Initialize Google Apps Script Serverless Scholarship System"
if %errorlevel% neq 0 goto :error

echo [5/5] Pushing to GitHub...
echo * Note: If a login popup appears, please complete the GitHub authorization...
git push -u origin main
if %errorlevel% neq 0 goto :error

echo.
echo =====================================================================
echo Push completed successfully! Closing in 5 seconds...
timeout /t 5 > nul
exit

:error
echo.
echo ---------------------------------------------------------------------
echo [ERROR] Git command execution failed. Please check the error message above.
echo ---------------------------------------------------------------------
echo.
pause
exit /b
