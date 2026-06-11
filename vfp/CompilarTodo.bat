@echo off
setlocal
set ROOT=C:\Duna\Export
set REPO=%~dp0
set VFP=C:\Program Files (x86)\Microsoft Visual FoxPro 9\vfp9.exe

echo === Compilar todo mscomctl (reparar + build) ===
echo Cierra el Project Manager de VFP antes de continuar.
echo.
pause

call "%REPO%PrepararExportBuild.bat"
if errorlevel 1 exit /b 1

"%VFP%" "%ROOT%\PROGS\RunBuildExport.prg"

echo.
echo --- build_mscomctl.log ---
if exist "%ROOT%\build_mscomctl.log" type "%ROOT%\build_mscomctl.log"
echo.
if exist "%ROOT%\mscomctl.ERR" (
  echo --- mscomctl.ERR ---
  type "%ROOT%\mscomctl.ERR"
)
echo.
pause
