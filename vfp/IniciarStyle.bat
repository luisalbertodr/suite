@echo off
setlocal EnableDelayedExpansion
REM Arranque Style. Exe NUEVO: abre dbf\wedb solo (general.prg). Exe VIEJO (.bak): enlaces legacy.

cd /d C:\Style-Dunasoft
if defined STYLE_HOME cd /d "%STYLE_HOME%"
if exist Z:\Style-Dunasoft\SuiteSync.cfg cd /d Z:\Style-Dunasoft

set "DBCSCRIPT=%~dp0ensure-style-dbc.ps1"
if "%STYLE_LEGACY%"=="1" (
  if exist "%DBCSCRIPT%" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%DBCSCRIPT%" -StyleRoot "%CD%" -LegacyTableLinks
  ) else (
    call :link_wedb_root
  )
)

set "EXE="
if exist "%CD%\Duna2.exe" set "EXE=%CD%\Duna2.exe"
if not defined EXE if exist "%CD%\Duna.exe" set "EXE=%CD%\Duna.exe"
if not defined EXE if exist "%CD%\mscomctl.exe" set "EXE=%CD%\mscomctl.exe"

if not exist "%CD%\SuiteSync.cfg" (
  echo ERROR: falta SuiteSync.cfg en %CD%
  pause
  exit /b 1
)

if not defined EXE (
  echo ERROR: falta Duna2.exe / Duna.exe en %CD%
  pause
  exit /b 1
)

for %%F in ("%EXE%") do echo Arrancando: %%~fF  %%~zF bytes  %%~tF
echo Log sync: %CD%\Usuarios\_suite_sync.log
if "%STYLE_LEGACY%"=="1" echo Modo STYLE_LEGACY=1 ^(enlaces raiz para exe.bak^)
echo.

start "" "%EXE%"
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
