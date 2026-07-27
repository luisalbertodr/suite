* Prueba apertura mscomctlOk tras borrar .pjt corrupto.
LOCAL lcRoot, lcLog, lcStem, lcProgs, lcHere, lnFiles, lnWait
lcRoot = "C:\Duna\ExportZ\"
lcStem = "mscomctlOk"
lcLog = lcRoot + "test_open_after_pjt_fix.log"
STRTOFILE("=== "+TTOC(DATETIME())+" ==="+CHR(13), lcLog, .F.)
SET DEFAULT TO (lcRoot)
lcSav = ON("ERROR")
ON ERROR STRTOFILE("ERR: "+MESSAGE()+CHR(13), lcLog, .T.)
MODIFY PROJECT (lcStem) NOWAIT
FOR lnWait = 1 TO 40
   IF TYPE("_VFP.ActiveProject")="O"
      EXIT
   ENDIF
   = INKEY(0.25, "H")
ENDFOR
IF TYPE("_VFP.ActiveProject")="O"
   lnFiles = _VFP.ActiveProject.Files.Count
   STRTOFILE("OK ActiveProject files="+ALLTRIM(STR(lnFiles))+CHR(13), lcLog, .T.)
   IF FILE(lcRoot+lcStem+".pjt")
      STRTOFILE("OK pjt recreado bytes="+ALLTRIM(STR(FILE(lcRoot+lcStem+".pjt")))+CHR(13), lcLog, .T.)
   ELSE
      STRTOFILE("AVISO: sin .pjt aun"+CHR(13), lcLog, .T.)
   ENDIF
ELSE
   STRTOFILE("FAIL sin ActiveProject"+CHR(13), lcLog, .T.)
ENDIF
ON ERROR &lcSav
QUIT
