LOCAL lcLog
lcLog = 'C:\Duna\ExportZ\test_open.log'
STRTOFILE('=== '+TTOC(DATETIME())+' ==='+CHR(13), lcLog, .F.)
SET DEFAULT TO C:\Duna\ExportZ\
MODIFY PROJECT mscomctl NOWAIT
FOR lnI = 1 TO 60
   IF TYPE('_VFP.ActiveProject')='O'
      EXIT
   ENDIF
   =INKEY(0.5,'H')
ENDFOR
IF TYPE('_VFP.ActiveProject')='O'
   STRTOFILE('OK files='+ALLTRIM(STR(_VFP.ActiveProject.Files.Count))+CHR(13), lcLog, .T.)
ELSE
   STRTOFILE('FAIL timeout'+CHR(13), lcLog, .T.)
ENDIF
QUIT
