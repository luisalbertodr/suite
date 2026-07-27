LOCAL lcLog, lcsav, lcerr
lcLog = "C:\Duna\ExportZ\test_open_v2.log"
STRTOFILE("=== " + TTOC(DATETIME()) + " ===" + CHR(13), lcLog, .F.)
SET DEFAULT TO C:\Duna\Export\
lcsav = ON("ERROR")
lcerr = ""
ON ERROR lcerr = MESSAGE()
STRTOFILE("A: open sin exclusive" + CHR(13), lcLog, .T.)
OPEN PROJECT mscomctl
IF TYPE("_VFP.ActiveProject") = "O"
   STRTOFILE("A OK" + CHR(13), lcLog, .T.)
   _VFP.ActiveProject.Close()
ELSE
   STRTOFILE("A FAIL " + lcerr + CHR(13), lcLog, .T.)
ENDIF
lcerr = ""
ON ERROR lcerr = MESSAGE()
STRTOFILE("B: open con parentesis" + CHR(13), lcLog, .T.)
OPEN PROJECT (FULLPATH("mscomctl.pjx"))
IF TYPE("_VFP.ActiveProject") = "O"
   STRTOFILE("B OK" + CHR(13), lcLog, .T.)
   _VFP.ActiveProject.Close()
ELSE
   STRTOFILE("B FAIL " + lcerr + CHR(13), lcLog, .T.)
ENDIF
ON ERROR &lcsav
QUIT
