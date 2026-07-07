@echo off
REM Crear control_sincro + cola_sincro v2. Busca VFP9 en rutas habituales.
cd /d "%~dp0"
set "VFP="
if exist "C:\Program Files (x86)\Microsoft Visual FoxPro 9\vfp9.exe" set "VFP=C:\Program Files (x86)\Microsoft Visual FoxPro 9\vfp9.exe"
if exist "C:\Program Files\Microsoft Visual FoxPro 9\vfp9.exe" set "VFP=C:\Program Files\Microsoft Visual FoxPro 9\vfp9.exe"
if defined VFP9_HOME if exist "%VFP9_HOME%\vfp9.exe" set "VFP=%VFP9_HOME%\vfp9.exe"
if not defined VFP (
  echo ERROR: No se encuentra vfp9.exe
  echo Instala VFP9 o define VFP9_HOME apuntando a la carpeta con vfp9.exe
  echo.
  echo Si los DBF ya estan copiados, no hace falta este script.
  pause
  exit /b 1
)
if not exist "PROGS\init_style_v2_dbf.prg" (
  echo ERROR: Falta PROGS\init_style_v2_dbf.prg
  pause
  exit /b 1
)
echo Usando: %VFP%
echo Carpeta: %CD%
"%VFP%" /C "DO PROGS\init_style_v2_dbf.prg"
if exist sync\init_v2_dbf.log (
  echo.
  type sync\init_v2_dbf.log
) else (
  echo AVISO: no se creo sync\init_v2_dbf.log — revisa errores VFP
)
echo.
dir /b control_sincro.dbf cola_sincro.dbf 2>nul
pause
