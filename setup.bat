@echo off
echo ========================================
echo Agro Distribution System - Setup
echo ========================================
echo.

echo [1/3] Installing dependencies...
call npm install
if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo [2/3] Initializing database...
call node scripts/init-db.js
if errorlevel 1 (
    echo ERROR: Failed to initialize database
    pause
    exit /b 1
)

echo.
echo [3/3] Setup complete!
echo.
echo ========================================
echo You can now start the server with:
echo   npm run dev
echo.
echo Or run: start-server.bat
echo ========================================
pause
