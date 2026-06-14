* Compila general + funciones + suite_full_unlock (headless OK desde CMD).
LOCAL lcRoot, lcProgs, lcLog, lcList, lnI, lcBase, lcErrTxt, lcSav

lcRoot = "C:\Duna\Export\"
lcProgs = lcRoot + "PROGS\"
lcLog = lcRoot + "build_mscomctl.log"

SET SAFETY OFF
SET DEFAULT TO (lcRoot)
STRTOFILE("=== VfpCompilePrgs "+TTOC(DATETIME())+" ==="+CHR(13), lcLog, .F.)

lcList = "general,funciones,suite_full_unlock"
FOR lnI = 1 TO GETWORDCOUNT(lcList, ",")
   lcBase = GETWORDNUM(lcList, lnI, ",")
   IF FILE(lcProgs + lcBase + ".ERR")
      ERASE (lcProgs + lcBase + ".ERR")
   ENDIF
   lcErrTxt = ""
   lcSav = ON("ERROR")
   ON ERROR lcErrTxt = ALLTRIM(STR(ERROR()))+": "+MESSAGE()
   COMPILE (lcProgs + lcBase + ".prg")
   ON ERROR &lcSav
   IF FILE(lcProgs + lcBase + ".ERR")
      lcErrTxt = lcErrTxt + CHR(13) + FILETOSTR(lcProgs + lcBase + ".ERR")
   ENDIF
   STRTOFILE("COMPILE "+lcBase+" "+IIF(EMPTY(lcErrTxt), "OK", "FAIL")+" "+lcErrTxt+CHR(13), lcLog, .T.)
   IF .NOT. EMPTY(lcErrTxt)
      STRTOFILE("ABORT: compile "+lcBase+CHR(13), lcLog, .T.)
      QUIT
   ENDIF
ENDFOR
STRTOFILE("PRGs listos. Siguiente: DO PROGS\VfpBuildProject en VFP (BUILD-DUNA-INTERACTIVO.bat)"+CHR(13), lcLog, .T.)
QUIT
