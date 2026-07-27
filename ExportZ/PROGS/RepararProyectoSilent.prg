* Reparar proyecto VFP sin MESSAGEBOX (mscomctlok en raiz ExportZ).
LOCAL lcRoot, lcLog, lcProgs, lcStem, lcHere

lcHere = FULLPATH(SYS(16))
IF EMPTY(lcHere)
   lcHere = FULLPATH("RepararProyectoSilent.prg")
ENDIF
lcProgs = ADDBS(JUSTPATH(lcHere))
IF RIGHT(LOWER(lcProgs), 6) <> "progs\"
   lcProgs = ADDBS(JUSTPATH(lcProgs)) + "PROGS\"
ENDIF

SET SAFETY OFF
SET DEFAULT TO (lcProgs)
SET PROCEDURE TO (lcProgs+"suite_repair_lib.prg") ADDITIVE
lcRoot = SuiteResolveExportRoot(lcProgs)
lcStem = SuiteResolveProjectStem(lcRoot)
SET DEFAULT TO (lcRoot)
lcLog = lcRoot + "build_" + lcStem + ".log"

STRTOFILE("=== RepararProyectoSilent " + TTOC(DATETIME()) + " stem=" + lcStem + " root=" + lcRoot + " ===" + CHR(13), lcLog, .F.)

IF  .NOT. FILE(lcRoot + lcStem + ".pjx")
   STRTOFILE("ERROR: falta " + lcStem + ".pjx en " + lcRoot + CHR(13), lcLog, .T.)
   QUIT
ENDIF
IF  .NOT. FILE(lcRoot + "PROGS\suite_cola_sync.prg")
   STRTOFILE("ERROR: falta suite_cola_sync.prg" + CHR(13), lcLog, .T.)
   QUIT
ENDIF
IF  .NOT. FILE(lcRoot + "PROGS\export_build_stubs.prg")
   STRTOFILE("ERROR: falta export_build_stubs.prg" + CHR(13), lcLog, .T.)
   QUIT
ENDIF
IF  .NOT. FILE(lcRoot + "PROGS\suite_control_sync.prg")
   STRTOFILE("ERROR: falta suite_control_sync.prg" + CHR(13), lcLog, .T.)
   QUIT
ENDIF

DO SuiteRepairMscomctlProject WITH lcRoot, lcLog

IF OCCURS("ERROR: no se pudo abrir", FILETOSTR(lcLog)) > 0 ;
   OR OCCURS("ERROR open:", FILETOSTR(lcLog)) > 0
   STRTOFILE("Reparar FALLO stem=" + lcStem + " (revisa log)" + CHR(13), lcLog, .T.)
   QUIT
ENDIF

STRTOFILE("Reparar OK stem=" + lcStem + CHR(13), lcLog, .T.)
QUIT
