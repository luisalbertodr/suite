* Compila general + funciones (headless OK desde CMD).
LOCAL lcRoot, lcProgs, lcLog, lcList, lnI, lcBase, lcErrTxt, lcSav, lcStem, lcHere, llRepair

lcHere = FULLPATH(SYS(16))
IF EMPTY(lcHere)
   lcHere = FULLPATH("VfpCompilePrgs.prg")
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

STRTOFILE("=== VfpCompilePrgs "+TTOC(DATETIME())+" root="+lcRoot+" stem="+lcStem+" repair="+IIF(llRepair, "1", "0")+" ==="+CHR(13), lcLog, .F.)

lcList = "general,funciones"
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
      DO VfpBuildExit WITH .T., "Error compilando "+lcBase+CHR(13)+lcErrTxt+CHR(13)+CHR(13)+"Log: "+lcLog
   ENDIF
ENDFOR

* VFP prefiere FXP sobre PRG: limpiar compilados obsoletos.
IF FILE(lcProgs + "suite_full_unlock.fxp")
   ERASE (lcProgs + "suite_full_unlock.fxp")
ENDIF
IF FILE(lcProgs + "suite_full_unlock.FXP")
   ERASE (lcProgs + "suite_full_unlock.FXP")
ENDIF
IF FILE(lcProgs + "suite_cola_sync.fxp")
   ERASE (lcProgs + "suite_cola_sync.fxp")
ENDIF
IF FILE(lcProgs + "suite_cola_sync.FXP")
   ERASE (lcProgs + "suite_cola_sync.FXP")
ENDIF
STRTOFILE("FXP obsoletos borrados (suite_full_unlock/suite_cola_sync)"+CHR(13), lcLog, .T.)
STRTOFILE("PRGs listos. Siguiente: DO PROGS\VfpBuildProject en VFP (PM abierto)"+CHR(13), lcLog, .T.)
DO VfpBuildExit WITH .F., "Compilacion OK (general + funciones)."+CHR(13)+CHR(13)+"Siguiente paso:"+CHR(13)+"DO PROGS\VfpBuildProject.prg"+CHR(13)+CHR(13)+"Log: "+lcLog
