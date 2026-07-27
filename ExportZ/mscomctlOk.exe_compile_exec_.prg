CLOSE ALL
CLEAR ALL
CLEAR
WAIT WINDOW 'COMPILING - please wait' NOWAIT
DO "C:\Duna\ExportZ\mscomctlOk.exe_compile_data_.prg"
SET BELL TO ('C:\Windows\Media\tada.wav')
?? CHR(7)
WAIT WINDOW 'FINISHED'
QUIT
