LOCAL lcLog, lcsav, lcerr
lcLog = "C:\Duna\ExportZ\test_open_export.log"
STRTOFILE("=== open Export mscomctl ===" + CHR(13), lcLog, .F.)
SET DEFAULT TO C:\Duna\Export\
lcsav = ON("ERROR")
lcerr = ""
ON ERROR lcerr = MESSAGE()
OPEN PROJECT mscomctl EXCLUSIVE
IF TYPE("_VFP.ActiveProject") = "O"
   STRTOFILE("OK files=" + ALLTRIM(STR(_VFP.ActiveProject.Files.Count)) + CHR(13), lcLog, .T.)
   _VFP.ActiveProject.Close()
ELSE
   STRTOFILE("FAIL " + lcerr + CHR(13), lcLog, .T.)
ENDIF
ON ERROR &lcsav
QUIT
