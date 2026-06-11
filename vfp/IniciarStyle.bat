@echo off
REM Arranque Style — sync via PROGS\suite_full_unlock.fxp + SuiteSync.cfg

cd /d C:\Style-Dunasoft
if defined STYLE_HOME cd /d "%STYLE_HOME%"
if exist Z:\Style-Dunasoft\SuiteSync.cfg cd /d Z:\Style-Dunasoft

if not exist SuiteSync.cfg (
  echo ERROR: falta SuiteSync.cfg en %CD%
  pause
  exit /b 1
)

echo Style: %CD%
echo Sync: PROGS\suite_full_unlock.fxp + SuiteSync.cfg
echo Log:  Usuarios\_suite_sync.log
echo.
echo Si no sincroniza: DO activar_suite_sync.prg  ^(desde ventana VFP^)
echo O pulsa Ctrl+F5 en Style. Test red: TestStyleSync.ps1
echo.

start "" Duna.exe
