* Compila general + funciones + suite_full_unlock en PROGS\ (headless).
* Uso: vfp9.exe -C "DO compile_suite_prgs_headless WITH 'C:\Duna\Style-Suite-Test\'"
LOCAL lcRoot, lcProgs, lclog, lcErr, lcSav

IF PCOUNT() < 1 OR EMPTY(m.tcStyleRoot)
   lcRoot = ADDBS(SYS(5)+SYS(2003))
ELSE
   lcRoot = ADDBS(m.tcStyleRoot)
ENDIF
lcProgs = lcRoot + "PROGS\"
IF  .NOT. DIRECTORY(lcProgs)
   STRTOFILE("ERROR: no existe "+lcProgs+CHR(13), lcRoot+"Usuarios\_compile_suite.log", .F.)
   QUIT
ENDIF

SET SAFETY OFF
SET DEFAULT TO (lcRoot)
lclog = lcRoot + "Usuarios\_compile_suite.log"
IF  .NOT. DIRECTORY(lcRoot + "Usuarios")
   MD (lcRoot + "Usuarios")
ENDIF
STRTOFILE("=== compile_suite_prgs "+TTOC(DATETIME())+" root="+lcRoot+CHR(13), lclog, .F.)

lcSav = ON("ERROR")
ON ERROR lcErr = ALLTRIM(STR(ERROR()))+": "+MESSAGE()

LOCAL lcList, lnI, lcBase
lcList = "general,funciones,suite_full_unlock"
FOR lnI = 1 TO GETWORDCOUNT(lcList, ",")
   lcBase = GETWORDNUM(lcList, lnI, ",")
   lcErr = ""
   IF FILE(lcProgs + lcBase + ".ERR")
      ERASE (lcProgs + lcBase + ".ERR")
   ENDIF
   IF  .NOT. FILE(lcProgs + lcBase + ".prg")
      STRTOFILE("SKIP "+lcBase+" (sin .prg)"+CHR(13), lclog, .T.)
      LOOP
   ENDIF
   COMPILE (lcProgs + lcBase + ".prg")
   IF FILE(lcProgs + lcBase + ".ERR")
      lcErr = FILETOSTR(lcProgs + lcBase + ".ERR")
   ENDIF
   STRTOFILE("COMPILE "+lcBase+" "+IIF(EMPTY(lcErr), "OK", "FAIL "+lcErr)+CHR(13), lclog, .T.)
   IF  .NOT. EMPTY(lcErr)
      ON ERROR &lcSav
      QUIT
   ENDIF
ENDFOR

* .fxp de unlock rompe DEFINE CLASS (error 1732); solo .prg en runtime
IF FILE(lcProgs + "suite_full_unlock.fxp")
   ERASE (lcProgs + "suite_full_unlock.fxp")
   STRTOFILE("borrado suite_full_unlock.fxp"+CHR(13), lclog, .T.)
ENDIF
IF FILE(lcProgs + "suite_full_unlock.FXP")
   ERASE (lcProgs + "suite_full_unlock.FXP")
   STRTOFILE("borrado suite_full_unlock.FXP"+CHR(13), lclog, .T.)
ENDIF

STRTOFILE("done OK"+CHR(13), lclog, .T.)
ON ERROR &lcSav
QUIT
