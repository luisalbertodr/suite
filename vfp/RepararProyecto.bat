@echo off
setlocal
set ROOT=C:\Duna\Export
set VFP=C:\Program Files (x86)\Microsoft Visual FoxPro 9\vfp9.exe

echo === Reparar mscomctl.pjx ===
echo Cierra el Project Manager antes de continuar.
echo.
pause

"%VFP%" "%ROOT%\PROGS\RepararProyectoMscomctl.prg"
pause
