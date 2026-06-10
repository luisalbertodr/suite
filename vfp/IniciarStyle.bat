@echo off
REM Style multisesion + sync Suite. Ejecutar desde C:\Style-Dunasoft
cd /d C:\Style-Dunasoft
if defined STYLE_HOME cd /d "%STYLE_HOME%"

if not exist suite_full_unlock.prg (
  echo ERROR: falta suite_full_unlock.prg en %CD%
  pause
  exit /b 1
)
if not exist SuiteSync.cfg (
  echo ERROR: falta SuiteSync.cfg en %CD%
  echo Copia SuiteSync.cfg con SYNC_URL y SYNC_TOKEN de Postgres.
  pause
  exit /b 1
)

echo Comprueba sync desde esta VM con:
echo   powershell -ExecutionPolicy Bypass -File TestStyleSync.ps1
echo Tras abrir Style, si no sincroniza: DO activar_suite_sync.prg
echo Log: Usuarios\_suite_sync.log

start "" duna.exe
