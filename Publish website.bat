@echo off
title Bullion Book - Publish website
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed. Install the LTS version from https://nodejs.org and run this again. & pause & exit /b)
echo Step 1: Google sign-in (only the first time). Sign in with harshbhagat186@gmail.com
call npx -y firebase-tools@13 login
echo Step 2: Publishing Bullion Book website...
call npx -y firebase-tools@13 deploy --only hosting --project bullion-book-1276
echo.
echo If you see "Deploy complete!" above, it worked. Press Ctrl+Shift+R in Chrome on the Bullion Book page.
pause
