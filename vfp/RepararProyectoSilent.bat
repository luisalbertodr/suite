@echo off
setlocal
set VFP=C:\Program Files (x86)\Microsoft Visual FoxPro 9\vfp9.exe
set ROOT=C:\Duna\Export

echo === Reparar mscomctl.pjx (sin dialogos) ===
echo Cierra el Project Manager antes de continuar.
pause

"%VFP%" "%ROOT%\PROGS\RepararProyectoSilent.prg"
if exist "%ROOT%\build_mscomctl.log" type "%ROOT%\build_mscomctl.log"
pause
