LOCAL lcRoot, lcStem, lcLog, lcsav, lnWait
lcRoot = "C:\Duna\ExportZ\"
lcStem = "mscomctlOk"
lcLog = lcRoot + "test_create_project.log"
STRTOFILE("=== TestCreate2 " + TTOC(DATETIME()) + " ===" + CHR(13), lcLog, .F.)
SET DEFAULT TO (lcRoot)
lcsav = ON("ERROR")
ON ERROR STRTOFILE("err: " + MESSAGE() + CHR(13), lcLog, .T.)
CREATE PROJECT mscomctlOk
FOR lnWait = 1 TO 20
   IF FILE(lcRoot + "mscomctlOk.pjx")
      EXIT
   ENDIF
   INKEY(1)
ENDFOR
IF FILE(lcRoot + "mscomctlOk.pjx")
   STRTOFILE("pjx ok" + CHR(13), lcLog, .T.)
   OPEN PROJECT mscomctlOk EXCLUSIVE
   IF TYPE("_VFP.ActiveProject") = "O"
      STRTOFILE("open ok files=" + ALLTRIM(STR(_VFP.ActiveProject.Files.Count)) + CHR(13), lcLog, .T.)
      _VFP.ActiveProject.Close()
   ELSE
      STRTOFILE("open fail after create" + CHR(13), lcLog, .T.)
   ENDIF
ELSE
   STRTOFILE("no pjx file" + CHR(13), lcLog, .T.)
ENDIF
ON ERROR &lcsav
QUIT
