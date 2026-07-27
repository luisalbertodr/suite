LOCAL lcLog, lcsav
lcLog = 'C:\Duna\ExportZ\test_modify_exportz.log'
STRTOFILE('=== modify ExportZ ==='+CHR(13), lcLog, .F.)
SET DEFAULT TO C:\Duna\ExportZ\
MODIFY PROJECT mscomctlOk NOWAIT
INKEY(2)
IF TYPE('_VFP.ActiveProject')='O'
   STRTOFILE('OK files='+ALLTRIM(STR(_VFP.ActiveProject.Files.Count))+CHR(13), lcLog, .T.)
   _VFP.ActiveProject.Close()
ELSE
   STRTOFILE('FAIL'+CHR(13), lcLog, .T.)
ENDIF
QUIT
