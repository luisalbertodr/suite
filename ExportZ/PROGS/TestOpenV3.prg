LOCAL lcLog, lcsav, lcerr, loP
lcLog = "C:\Duna\ExportZ\test_open_v3.log"
STRTOFILE("=== " + TTOC(DATETIME()) + " ===" + CHR(13), lcLog, .F.)
SET DEFAULT TO C:\Duna\Export\
lcsav = ON("ERROR")
lcerr = ""
ON ERROR lcerr = MESSAGE()
STRTOFILE("modify project" + CHR(13), lcLog, .T.)
MODIFY PROJECT mscomctl NOWAIT
INKEY(2)
IF TYPE("_VFP.ActiveProject") = "O"
   STRTOFILE("modify OK files=" + ALLTRIM(STR(_VFP.ActiveProject.Files.Count)) + CHR(13), lcLog, .T.)
ELSE
   STRTOFILE("modify fail " + lcerr + CHR(13), lcLog, .T.)
ENDIF
lcerr = ""
IF TYPE("_VFP.Projects") = "O"
   STRTOFILE("projects count=" + ALLTRIM(STR(_VFP.Projects.Count)) + CHR(13), lcLog, .T.)
   IF _VFP.Projects.Count > 0
      loP = _VFP.Projects(1)
      IF TYPE("loP") = "O"
         STRTOFILE("proj1 name=" + loP.Name + CHR(13), lcLog, .T.)
      ENDIF
   ENDIF
ENDIF
ON ERROR &lcsav
QUIT
