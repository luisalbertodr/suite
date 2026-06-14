@echo off
setlocal
set "ROOT=C:\Duna\Export"
set "BAK=%ROOT%\backup_pjx"
set "REPO=C:\Users\OportoW11\Suite\suite"

echo === Reparar mscomctl.pjt corrupto ===
echo.

taskkill /IM vfp9.exe /F >nul 2>&1
ping -n 3 127.0.0.1 >nul

if not exist "%BAK%" mkdir "%BAK%"
if exist "%ROOT%\mscomctl.pjt" if not exist "%BAK%\mscomctl-bad.pjt" copy /Y "%ROOT%\mscomctl.pjt" "%BAK%\mscomctl-bad.pjt" >nul
if exist "%ROOT%\mscomctl.pjx" if not exist "%BAK%\mscomctl-before-repair.pjx" copy /Y "%ROOT%\mscomctl.pjx" "%BAK%\mscomctl-before-repair.pjx" >nul

echo Borrando mscomctl.pjx/pjt rotos (backup ya guardado)...
del /F /Q "%ROOT%\mscomctl.pjt" "%ROOT%\mscomctl.pjx" 2>nul
echo El script RepairMscomctlFromLfn creara el proyecto en VFP (CREATE PROJECT).

echo Generando lista desde mscomctl.lfn ...
python "%REPO%\scripts\repair_mscomctl_pjx.py"
if errorlevel 1 (echo ERROR python & exit /b 1)

echo Copiando scripts VFP corregidos...
copy /Y "%REPO%\vfp\RepairMscomctlFromLfn.prg" "%ROOT%\PROGS\" >nul
copy /Y "%REPO%\vfp\suite_repair_lib.prg" "%ROOT%\PROGS\" >nul
copy /Y "%REPO%\vfp\VfpBuildProject.prg" "%ROOT%\PROGS\" >nul
del /F /Q "%ROOT%\PROGS\RepairMscomctlFromLfn.fxp" "%ROOT%\PROGS\suite_repair_lib.fxp" "%ROOT%\PROGS\VfpBuildProject.fxp" 2>nul
del /F /Q "%ROOT%\PROGS\RepairMscomctlFromPjx.fxp" 2>nul
del /F /Q "%ROOT%\PROGS\*.ERR" 2>nul
copy /Y "%REPO%\vfp\RepairMscomctlFromPjx.prg" "%ROOT%\PROGS\" >nul

echo.
echo PASO MANUAL en VFP (File ^> New ^> Project):
echo   Nombre: mscomctl
echo   Carpeta: C:\Duna\Export
echo.
echo Luego en Ctrl+F2:
echo   DO PROGS\RepairMscomctlFromLfn.prg
echo.
echo El script tambien puede pedirte crear el proyecto si falta mscomctl.pjx.
echo.
pause
start "" "C:\Program Files (x86)\Microsoft Visual FoxPro 9\vfp9.exe"
exit /b 0
