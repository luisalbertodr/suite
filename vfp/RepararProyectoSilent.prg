* Reparar mscomctl.pjx sin MESSAGEBOX.
LOCAL lcRoot, lcLog, lnRemoved

lcRoot = "C:\Duna\Export\"
lcLog = lcRoot + "build_mscomctl.log"
lnRemoved = 0

STRTOFILE("=== RepararProyectoSilent " + TTOC(DATETIME()) + " ===" + CHR(13), lcLog, .F.)

IF  .NOT. FILE(lcRoot + "mscomctl.pjx")
   STRTOFILE("ERROR: falta mscomctl.pjx" + CHR(13), lcLog, .T.)
   RETURN
ENDIF
IF  .NOT. FILE(lcRoot + "PROGS\suite_full_unlock.prg")
   STRTOFILE("ERROR: falta suite_full_unlock.prg" + CHR(13), lcLog, .T.)
   RETURN
ENDIF
IF  .NOT. FILE(lcRoot + "PROGS\export_build_stubs.prg")
   STRTOFILE("ERROR: falta export_build_stubs.prg" + CHR(13), lcLog, .T.)
   RETURN
ENDIF

SET PROCEDURE TO (lcRoot + "PROGS\suite_repair_lib.prg") ADDITIVE
DO SuiteRepairMscomctlProject WITH lcRoot, lcLog, @lnRemoved

STRTOFILE("Reparar OK removed=" + ALLTRIM(STR(lnRemoved)) + CHR(13), lcLog, .T.)
QUIT
