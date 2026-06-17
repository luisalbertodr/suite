@echo off
REM Style Dunasoft portable — raiz = carpeta de este .bat (STYLE_HOME)
setlocal
set "STYLE_HOME=%~dp0"
cd /d "%STYLE_HOME%"

if not exist SuiteSync.cfg (
  echo ERROR: falta SuiteSync.cfg en %CD%
  pause
  exit /b 1
)

if not exist Duna.exe (
  echo ERROR: falta Duna.exe en %CD%
  pause
  exit /b 1
)

if not exist dbf\wedb.dbc (
  echo AVISO: falta dbf\wedb.dbc — Style puede no arrancar.
)

if not exist Usuarios mkdir Usuarios 2>nul

echo Style portable: %CD%
echo Log: Usuarios\_suite_sync.log
echo.

REM /D fija el directorio de trabajo (critico: EMPRESA.DBF, dbf\, SuiteSync.cfg)
start "" /D "%STYLE_HOME%" "%STYLE_HOME%Duna.exe"
