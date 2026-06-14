@echo off
REM Compilar en la VM Style (C:\Style-Dunasoft\PROGS). NO usar C:\Duna\Export aqui.
setlocal
set "ROOT=C:\Style-Dunasoft"
set "VFP=C:\Program Files (x86)\Microsoft Visual FoxPro 9\vfp9.exe"
if not exist "%VFP%" set "VFP=C:\Program Files (x86)\Microsoft Visual FoxPro\VFP9\vfp9.exe"

if not exist "%ROOT%\PROGS\general.prg" (
  echo ERROR: Falta %ROOT%\PROGS\general.prg
  echo Copia desde el PC de desarrollo C:\Duna\Export\PROGS\
  pause
  exit /b 1
)

copy /Y "%~dp0_compile_style_vm.prg" "%ROOT%\PROGS\_compile_style_vm.prg" >nul 2>nul
if not exist "%ROOT%\PROGS\_compile_style_vm.prg" (
  echo ERROR: Falta _compile_style_vm.prg en %ROOT%\PROGS\
  pause
  exit /b 1
)

cd /d "%ROOT%\PROGS"
echo Compilando en %CD% ...
"%VFP%" "%ROOT%\PROGS\_compile_style_vm.prg"
pause
