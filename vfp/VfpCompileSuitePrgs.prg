* Compila PRGs Suite para ReFox Replace (v2: cola sync, sin suite_full_unlock).
LOCAL lcRoot, lcProgs, lcLog, lcList, lnI, lcBase, lcErrTxt, lcSav, lcStem, lcHere, llRepair

lcHere = FULLPATH(SYS(16))
IF EMPTY(lcHere)
   lcHere = FULLPATH("VfpCompileSuitePrgs.prg")
ENDIF
lcProgs = ADDBS(JUSTPATH(lcHere))
IF RIGHT(LOWER(lcProgs), 6) <> "progs\"
   lcProgs = ADDBS(JUSTPATH(lcProgs)) + "PROGS\"
ENDIF

SET SAFETY OFF
DO (lcProgs + "VfpLoadRepairLib.prg")

lcRoot = VfpExportRootFromProgs(lcProgs)
lcStem = VfpBootstrapProjectStem(lcRoot)
llRepair = VfpLoadRepairLib(lcProgs)
IF llRepair .AND. TYPE("SuiteResolveExportRoot")#"U"
   lcRoot = SuiteResolveExportRoot(lcProgs)
   lcStem = SuiteResolveProjectStem(lcRoot)
ENDIF

SET DEFAULT TO (lcRoot)
lcLog = lcRoot + "build_" + lcStem + ".log"
STRTOFILE("=== VfpCompileSuitePrgs "+TTOC(DATETIME())+" root="+lcRoot+" ==="+CHR(13), lcLog, .F.)

lcList = "general,funciones,suite_cola_sync,suite_control_sync,export_build_stubs"
FOR lnI = 1 TO GETWORDCOUNT(lcList, ",")
   lcBase = GETWORDNUM(lcList, lnI, ",")
   IF .NOT. FILE(lcProgs + lcBase + ".prg")
      STRTOFILE("SKIP "+lcBase+" (no existe)"+CHR(13), lcLog, .T.)
      LOOP
   ENDIF
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
      DO VfpBuildExit WITH .T., "Error compilando "+lcBase+CHR(13)+lcErrTxt
   ENDIF
ENDFOR

FOR lnI = 1 TO GETWORDCOUNT("suite_full_unlock", ",")
   lcBase = "suite_full_unlock"
   IF FILE(lcProgs + lcBase + ".fxp")
      ERASE (lcProgs + lcBase + ".fxp")
   ENDIF
   IF FILE(lcProgs + lcBase + ".FXP")
      ERASE (lcProgs + lcBase + ".FXP")
   ENDIF
ENDFOR

STRTOFILE("Suite PRGs listos para ReFox Replace."+CHR(13), lcLog, .T.)
DO VfpBuildExit WITH .F., "Compilacion Suite OK (general, funciones, suite_cola_sync)."+CHR(13)+CHR(13)+"Siguiente: ReFox Replace en Duna.exe"+CHR(13)+CHR(13)+"Log: "+lcLog
