@echo off
chcp 65001 >nul
setlocal
title Gestion Multi-comptes - Creation du .exe
cd /d "%~dp0"

echo.
echo  ==========================================================
echo   Creation de l'application Windows (.exe)
echo  ==========================================================
echo.
echo  Deux fichiers seront crees dans le dossier "dist" :
echo    - Gestion-Multi-comptes-Installation-1.0.0.exe
echo      (installateur classique, raccourci sur le Bureau)
echo    - Gestion-Multi-comptes-Portable-1.0.0.exe
echo      (aucune installation, se lance directement)
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

echo  [1/2] Installation des composants...
call npm install
if errorlevel 1 (
  echo.
  echo  [ERREUR] L'installation a echoue. Verifiez votre connexion Internet.
  echo.
  pause
  exit /b 1
)

echo.
echo  [2/2] Fabrication des fichiers .exe (patientez, 2 a 5 minutes)...
call npm run dist
if errorlevel 1 (
  echo.
  echo  [ERREUR] La fabrication a echoue.
  echo  Fermez l'application si elle est ouverte, puis reessayez.
  echo.
  pause
  exit /b 1
)

echo.
echo  ==========================================================
echo   Termine ! Les fichiers sont dans le dossier "dist".
echo  ==========================================================
echo.
start "" "%~dp0dist"
pause
endlocal
