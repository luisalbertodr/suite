* Reparar mscomctl.pjx + Build completo (sin dialogos).
LOCAL lcRoot, lcProj, lcStubs, lcErr, lcLog, lcSavErr, lnErrSize, lnRemoved

lcRoot = "C:\Duna\Export\"
lcProj = lcRoot + "mscomctl"
lcStubs = lcRoot + "PROGS\export_build_stubs.prg"
lcErr = lcRoot + "mscomctl.ERR"
lcLog = lcRoot + "build_mscomctl.log"
lnRemoved = 0

STRTOFILE("=== RunBuildExport " + TTOC(DATETIME()) + " ===" + CHR(13), lcLog, .F.)

IF  .NOT. FILE(lcProj + ".pjx")
   STRTOFILE("ERROR: falta mscomctl.pjx" + CHR(13), lcLog, .T.)
   RETURN
ENDIF

SET PROCEDURE TO (lcRoot + "PROGS\suite_repair_lib.prg") ADDITIVE
DO SuiteRepairMscomctlProject WITH lcRoot, lcLog, @lnRemoved
STRTOFILE("Reparar OK removed=" + ALLTRIM(STR(lnRemoved)) + CHR(13), lcLog, .T.)

lcSavErr = ON("ERROR")
ON ERROR STRTOFILE("ERROR build: " + MESSAGE() + CHR(13), lcLog, .T.)

SET DEFAULT TO (lcRoot)
SET PATH TO ;
   (lcRoot + "PROGS"), ;
   (lcRoot + "vcx"), ;
   (lcRoot + "scx"), ;
   (lcRoot + "MENUS"), ;
   (lcRoot + "gestion-dunasoft\gestion\vcx") ;
   ADDITIVE
SET PROCEDURE TO (lcStubs) ADDITIVE

OPEN PROJECT (lcProj) EXCLUSIVE
STRTOFILE("Build iniciado: " + TTOC(DATETIME()) + CHR(13), lcLog, .T.)
BUILD PROJECT (lcProj) REBUILD
DO SuiteCloseProject

ON ERROR &lcSavErr

lnErrSize = 0
IF FILE(lcErr)
   lnErrSize = FILE(lcErr)
ENDIF
STRTOFILE("Build fin. ERR bytes=" + ALLTRIM(STR(lnErrSize)) + CHR(13), lcLog, .T.)
QUIT
