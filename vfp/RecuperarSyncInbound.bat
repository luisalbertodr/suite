@echo off
REM Recuperacion inbound: cierra Duna si bloquea wedb, ejecuta worker, comprueba JSON pendiente.
setlocal
set "ROOT=%~dp0"
cd /d "%ROOT%"
set "PS1=%ROOT%ensure-style-sync.ps1"
if not exist "%PS1%" set "PS1=%ROOT%PROGS\ensure-style-sync.ps1"
if not exist "%PS1%" (
  echo ERROR: falta ensure-style-sync.ps1
  pause & exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -StyleRoot "%CD%" -RecoverInboundLock -ForceRecover
echo Ver log: Usuarios\_suite_sync_boot.log
pause
