@echo off
setlocal EnableDelayedExpansion
REM Arranque Style. Siempre usa la carpeta de este .bat (test, Z:, VM).
REM Sync v2: agente Node + drenaje inbound antes de Duna (wedb libre).

cd /d "%~dp0"
set "STYLE_HOME=%CD%"

set "SYNCSCRIPT=%STYLE_HOME%\ensure-style-sync.ps1"
if not exist "%SYNCSCRIPT%" set "SYNCSCRIPT=%STYLE_HOME%\PROGS\ensure-style-sync.ps1"
if exist "%SYNCSCRIPT%" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%SYNCSCRIPT%" -StyleRoot "%STYLE_HOME%" -EnsureAgent -DrainInboundBeforeStart
) else (
  echo AVISO: falta ensure-style-sync.ps1 - agente Node no se arrancara automaticamente
)

set "DBCSCRIPT=%STYLE_HOME%\ensure-style-dbc.ps1"
if "%STYLE_LEGACY%"=="1" (
  if exist "%DBCSCRIPT%" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%DBCSCRIPT%" -StyleRoot "%STYLE_HOME%" -LegacyTableLinks
  ) else (
    call :link_wedb_root
  )
)

if exist "%STYLE_HOME%\PROGS\suite_full_unlock.fxp" ren "%STYLE_HOME%\PROGS\suite_full_unlock.fxp" suite_full_unlock.fxp.bak >nul 2>&1
if exist "%STYLE_HOME%\PROGS\suite_full_unlock.FXP" ren "%STYLE_HOME%\PROGS\suite_full_unlock.FXP" suite_full_unlock.fxp.bak >nul 2>&1
rem NO renombrar funciones.fxp: PROGS\funciones.prg (hook cola v2) debe prevalecer via STARTUP
if exist "%STYLE_HOME%\PROGS\general.fxp" ren "%STYLE_HOME%\PROGS\general.fxp" general.fxp.bak >nul 2>&1
if exist "%STYLE_HOME%\PROGS\general.FXP" ren "%STYLE_HOME%\PROGS\general.FXP" general.fxp.bak >nul 2>&1

set "EXE="
if exist "%STYLE_HOME%\Duna2.exe" set "EXE=%STYLE_HOME%\Duna2.exe"
if not defined EXE if exist "%STYLE_HOME%\Duna.exe" set "EXE=%STYLE_HOME%\Duna.exe"
if not defined EXE if exist "%STYLE_HOME%\mscomctl.exe" set "EXE=%STYLE_HOME%\mscomctl.exe"

if not exist "%STYLE_HOME%\SuiteSync.cfg" (
  echo ERROR: falta SuiteSync.cfg en %STYLE_HOME%
  pause
  exit /b 1
)

if not defined EXE (
  echo ERROR: falta Duna.exe / Duna2.exe en %STYLE_HOME%
  pause
  exit /b 1
)

for %%F in ("%EXE%") do echo Arrancando: %%~fF  %%~zF bytes  %%~tF
echo Style: %STYLE_HOME%
echo Log sync: %STYLE_HOME%\Usuarios\_suite_sync_boot.log
if "%STYLE_LEGACY%"=="1" echo Modo STYLE_LEGACY=1 ^(enlaces raiz para exe.bak^)
echo.

start "" /D "%STYLE_HOME%" "%EXE%"
exit /b 0

:link_wedb_root
if exist "dbf\wedb.dbc" if not exist "wedb.dbc" (
  mklink /H "wedb.dbc" "dbf\wedb.dbc" >nul 2>&1
  if errorlevel 1 copy /Y "dbf\wedb.dbc" "wedb.dbc" >nul
)
if exist "dbf\WEDB.DCT" if not exist "WEDB.DCT" (
  mklink /H "WEDB.DCT" "dbf\WEDB.DCT" >nul 2>&1
  if errorlevel 1 copy /Y "dbf\WEDB.DCT" "WEDB.DCT" >nul
)
if exist "dbf\WEDB.DCX" if not exist "WEDB.DCX" (
  mklink /H "WEDB.DCX" "dbf\WEDB.DCX" >nul 2>&1
  if errorlevel 1 copy /Y "dbf\WEDB.DCX" "WEDB.DCX" >nul
)
exit /b 0
