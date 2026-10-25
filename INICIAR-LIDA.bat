@echo off
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo No se encontro Python. Instala Python 3 o ejecuta: npx serve .
  pause
  exit /b 1
)
start "" http://localhost:8000
python -m http.server 8000
pause
