* Compila los 3 PRGs embebidos en Duna.exe (VFP9 BUILD mscomctl.pjx).
LOCAL lcProgs, lcErr, lclog, lcList, lnI, lcBase

lcProgs = "C:\Duna\Export\PROGS\"
IF  .NOT. DIRECTORY(lcProgs)
   lcProgs = ADDBS(JUSTPATH(SYS(16)))
ENDIF
SET DEFAULT TO (lcProgs)

lclog = lcProgs + "_compile_suite_sync.log"
STRTOFILE("=== compile "+TTOC(DATETIME())+" ==="+CHR(13)+CHR(10), lclog, .F.)

lcList = "general,funciones,suite_full_unlock"
FOR lnI = 1 TO GETWORDCOUNT(lcList, ",")
   lcBase = GETWORDNUM(lcList, lnI, ",")
   lcErr = ""
   ON ERROR lcErr = ALLTRIM(STR(ERROR()))+": "+MESSAGE()
   COMPILE (lcProgs + lcBase + ".prg")
   ON ERROR
   STRTOFILE(lcBase+" err="+IIF(EMPTY(lcErr), "OK", lcErr)+;
      " size="+ALLTRIM(STR(IIF(FILE(lcProgs+lcBase+".fxp"), FILESIZE(lcProgs+lcBase+".fxp"), 0)))+CHR(13)+CHR(10), lclog, .T.)
   IF  .NOT. EMPTY(lcErr)
      MESSAGEBOX("Error compilando "+lcBase+CHR(13)+lcErr, 16, "Compilar Suite")
      RETURN
   ENDIF
ENDFOR

STRTOFILE("done OK"+CHR(13)+CHR(10), lclog, .T.)
QUIT
