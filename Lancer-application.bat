@echo off
chcp 65001 >nul
setlocal
title Gestion Multi-comptes - Demarrage
cd /d "%~dp0"

echo.
echo  ============================================
echo   Gestion Multi-comptes - demarrage
echo  ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo  [ERREUR] Node.js n'est pas installe sur ce PC.
  echo  Telechargez la version LTS sur https://nodejs.org
  echo  puis relancez ce fichier.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\electron\dist\electron.exe" (
  echo  Premier demarrage : installation des composants...
  echo  ^(quelques minutes, connexion Internet requise^)
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo  [ERREUR] L'installation a echoue. Verifiez votre connexion Internet.
    echo.
    pause
    exit /b 1
  )
)

echo  Ouverture de l'application...
call npm start
if errorlevel 1 (
  echo.
  echo  [ERREUR] L'application ne s'est pas lancee.
  echo.
  pause
  exit /b 1
)
endlocal
