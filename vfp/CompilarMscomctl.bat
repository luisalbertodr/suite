@echo off
setlocal
set ROOT=C:\Duna\Export
set VFP=C:\Program Files (x86)\Microsoft Visual FoxPro 9\vfp9.exe

echo === Build mscomctl.pjx (VFP9) ===
echo Cierra el Project Manager antes de continuar.
echo.
pause

"%VFP%" "%ROOT%\PROGS\BuildMscomctl.prg"
echo.
if exist "%ROOT%\mscomctl.ERR" (
  echo --- mscomctl.ERR ---
  type "%ROOT%\mscomctl.ERR"
)
echo.
pause
