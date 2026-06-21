* Diagnostico OPEN PROJECT ExportZ
LOCAL lcRoot, lcStem, lcName, lcLog, lcsav, lcerr, lcOld
lcRoot = "C:\Duna\ExportZ\"
lcStem = "mscomctlOk"
lcLog = lcRoot + "test_open_project.log"
STRTOFILE("=== TestOpenProject " + TTOC(DATETIME()) + " ===" + CHR(13), lcLog, .F.)

lcsav = ON("ERROR")
lcerr = ""

ON ERROR lcerr = MESSAGE()
STRTOFILE("try1 stem only" + CHR(13), lcLog, .T.)
lcOld = SET("DEFAULT")
SET DEFAULT TO (lcRoot)
OPEN PROJECT (lcStem) EXCLUSIVE
SET DEFAULT TO (lcOld)
IF TYPE("_VFP.ActiveProject") = "O"
   STRTOFILE("try1 OK ActiveProject=" + _VFP.ActiveProject.Name + CHR(13), lcLog, .T.)
   _VFP.ActiveProject.Close()
ELSE
   STRTOFILE("try1 fail: " + lcerr + CHR(13), lcLog, .T.)
ENDIF

lcerr = ""
ON ERROR lcerr = MESSAGE()
STRTOFILE("try2 full path" + CHR(13), lcLog, .T.)
lcName = lcRoot + lcStem
OPEN PROJECT (lcName) EXCLUSIVE
IF TYPE("_VFP.ActiveProject") = "O"
   STRTOFILE("try2 OK" + CHR(13), lcLog, .T.)
   _VFP.ActiveProject.Close()
ELSE
   STRTOFILE("try2 fail: " + lcerr + CHR(13), lcLog, .T.)
ENDIF

lcerr = ""
ON ERROR lcerr = MESSAGE()
STRTOFILE("try3 pjx path" + CHR(13), lcLog, .T.)
OPEN PROJECT (lcName + ".pjx") EXCLUSIVE
IF TYPE("_VFP.ActiveProject") = "O"
   STRTOFILE("try3 OK" + CHR(13), lcLog, .T.)
   _VFP.ActiveProject.Close()
ELSE
   STRTOFILE("try3 fail: " + lcerr + CHR(13), lcLog, .T.)
ENDIF

ON ERROR &lcsav
STRTOFILE("done" + CHR(13), lcLog, .T.)
QUIT
