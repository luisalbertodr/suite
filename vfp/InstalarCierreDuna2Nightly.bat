@echo off
REM Registra tarea diaria 01:00: cerrar Duna2.exe + hard sync. Requiere administrador.
setlocal
set "ROOT=%~dp0"
cd /d "%ROOT%"
set "PS1=%ROOT%install-style-close-duna2-scheduler.ps1"
if not exist "%PS1%" (
  echo ERROR: falta install-style-close-duna2-scheduler.ps1 en %ROOT%
  pause & exit /b 1
)
if not exist "%ROOT%close-duna2-nightly.ps1" (
  echo ERROR: falta close-duna2-nightly.ps1 en %ROOT%
  pause & exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -StyleRoot "%CD%"
if errorlevel 1 (
  echo.
  echo Si ves "Acceso denegado", clic derecho en este .bat -^> Ejecutar como administrador.
  pause & exit /b 1
)
echo.
echo Tarea SuiteStyleCloseDuna2Nightly registrada.
pause
