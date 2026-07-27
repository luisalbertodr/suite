LOCAL lcLog
lcLog = 'C:\Duna\ExportZ\test_copy_export.log'
STRTOFILE('=== '+TTOC(DATETIME())+' ==='+CHR(13), lcLog, .F.)
SET DEFAULT TO C:\Duna\ExportZ\
MODIFY PROJECT mscomctl NOWAIT
INKEY(3)
IF TYPE('_VFP.ActiveProject')='O'
   STRTOFILE('OK files='+ALLTRIM(STR(_VFP.ActiveProject.Files.Count))+CHR(13), lcLog, .T.)
   _VFP.ActiveProject.Close()
ELSE
   STRTOFILE('FAIL'+CHR(13), lcLog, .T.)
ENDIF
QUIT
