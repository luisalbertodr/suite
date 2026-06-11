@echo off
REM Arranque Style desde C:\Style-Dunasoft (sync embebida en duna.exe + SuiteSync.cfg)
cd /d C:\Style-Dunasoft
if defined STYLE_HOME cd /d "%STYLE_HOME%"

if not exist SuiteSync.cfg (
  echo ERROR: falta SuiteSync.cfg en %CD%
  echo Solo hace falta SuiteSync.cfg ^(sync va dentro de duna.exe tras ReFox Replace^).
  pause
  exit /b 1
)

echo Sync: embebida en duna.exe. Config: SuiteSync.cfg
echo Log: Usuarios\_suite_sync.log
echo Test red: TestStyleSync.bat

start "" duna.exe
