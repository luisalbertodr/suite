* Test CREATE PROJECT ExportZ
LOCAL lcRoot, lcStem, lcLog, lcsav
lcRoot = "C:\Duna\ExportZ\"
lcStem = "mscomctlOk"
lcLog = lcRoot + "test_create_project.log"
STRTOFILE("=== TestCreateProject " + TTOC(DATETIME()) + " ===" + CHR(13), lcLog, .F.)
SET DEFAULT TO (lcRoot)
lcsav = ON("ERROR")
ON ERROR STRTOFILE("create err: " + MESSAGE() + CHR(13), lcLog, .T.)
CREATE PROJECT (lcStem) NOWAIT
INKEY(3)
IF FILE(lcRoot + lcStem + ".pjx")
   STRTOFILE("pjx created bytes=" + ALLTRIM(STR(FILE(lcRoot + lcStem + ".pjx"))) + CHR(13), lcLog, .T.)
   IF TYPE("_VFP.ActiveProject") = "O"
      STRTOFILE("active project OK" + CHR(13), lcLog, .T.)
      _VFP.ActiveProject.Close()
   ENDIF
ELSE
   STRTOFILE("pjx NOT created" + CHR(13), lcLog, .T.)
ENDIF
ON ERROR &lcsav
QUIT
