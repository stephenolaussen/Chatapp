@echo off
REM Familieskatt - Quick Start Script for Windows

echo.
echo ========================================
echo    Familieskatt - Chatapp for familien
echo ========================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js ikke funnet!
    echo.
    echo Vennligst installer Node.js fra: https://nodejs.org
    echo Velg LTS-versjonen.
    echo.
    pause
    exit /b 1
)

echo ✓ Node.js funnet
echo.

REM Check if npm is installed
npm --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: npm ikke funnet!
    pause
    exit /b 1
)

echo ✓ npm funnet
echo.

REM Install dependencies
echo Installerer dependencies...
echo.
call npm install
if errorlevel 1 (
    echo ERROR: npm install feilet!
    pause
    exit /b 1
)

echo.
echo ✓ Dependencies installert!
echo.
echo ========================================
echo Starter Familieskatt...
echo ========================================
echo.
echo Åpne nettleseren på: http://localhost:3000
echo.
echo Trykk Ctrl+C for å stoppe serveren
echo.

REM Start the application
node index.js

pause
