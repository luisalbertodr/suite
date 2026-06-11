@echo off
setlocal
set ROOT=C:\Duna\Export
set REPO=%~dp0
set VFP=C:\Program Files (x86)\Microsoft Visual FoxPro 9\vfp9.exe

echo === Preparar export ReFox para Build VFP9 ===
echo.

if not exist "%ROOT%\mscomctl.pjx" (
  echo ERROR: No existe %ROOT%\mscomctl.pjx
  exit /b 1
)

echo Copiando scripts Suite a PROGS...
copy /Y "%REPO%export_build_stubs.prg" "%ROOT%\PROGS\" >nul
copy /Y "%REPO%suite_repair_lib.prg" "%ROOT%\PROGS\" >nul
copy /Y "%REPO%RepararProyectoMscomctl.prg" "%ROOT%\PROGS\" >nul
copy /Y "%REPO%RepararProyectoSilent.prg" "%ROOT%\PROGS\" >nul
copy /Y "%REPO%RunBuildExport.prg" "%ROOT%\PROGS\" >nul
copy /Y "%REPO%BuildMscomctl.prg" "%ROOT%\PROGS\" >nul
copy /Y "%REPO%BuildMscomctlSilent.prg" "%ROOT%\PROGS\" >nul
if exist "%REPO%suite_full_unlock.prg" copy /Y "%REPO%suite_full_unlock.prg" "%ROOT%\PROGS\" >nul

echo Copiando CONTA / tiendaonline a vcx\...
if exist "%ROOT%\gestion-dunasoft\gestion\vcx\conta.vcx" (
  copy /Y "%ROOT%\gestion-dunasoft\gestion\vcx\conta.vcx" "%ROOT%\vcx\" >nul
  copy /Y "%ROOT%\gestion-dunasoft\gestion\vcx\conta.vct" "%ROOT%\vcx\" >nul
)
if exist "%ROOT%\gestion-dunasoft\gestion\vcx\tiendaonline.vcx" (
  copy /Y "%ROOT%\gestion-dunasoft\gestion\vcx\tiendaonline.vcx" "%ROOT%\vcx\" >nul
  copy /Y "%ROOT%\gestion-dunasoft\gestion\vcx\tiendaonline.vct" "%ROOT%\vcx\" >nul
)

echo Creando forms stub saldos / seleccioncentros...
if not exist "%ROOT%\scx\saldos.scx" if exist "%ROOT%\scx\saldos_tactil.scx" (
  copy /Y "%ROOT%\scx\saldos_tactil.scx" "%ROOT%\scx\saldos.scx" >nul
  copy /Y "%ROOT%\scx\saldos_tactil.sct" "%ROOT%\scx\saldos.sct" >nul
)
if not exist "%ROOT%\scx\seleccioncentros.scx" if exist "%ROOT%\scx\saldos_tactil.scx" (
  copy /Y "%ROOT%\scx\saldos_tactil.scx" "%ROOT%\scx\seleccioncentros.scx" >nul
  copy /Y "%ROOT%\scx\saldos_tactil.sct" "%ROOT%\scx\seleccioncentros.sct" >nul
)

copy /Y "%REPO%RepararProyecto.bat" "%ROOT%\" >nul 2>nul
copy /Y "%REPO%CompilarMscomctl.bat" "%ROOT%\" >nul 2>nul
copy /Y "%REPO%CompilarTodo.bat" "%ROOT%\" >nul 2>nul

echo.
echo Listo. Cierra el Project Manager de VFP y ejecuta:
echo   %REPO%CompilarTodo.bat
echo   (o %ROOT%\RepararProyecto.bat + CompilarMscomctl.bat)
echo.
exit /b 0
