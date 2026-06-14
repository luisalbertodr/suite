* Reparar mscomctl.pjx + BUILD PROJECT (headless VFP9).
LOCAL lcRoot, lcProj, lcStubs, lcErr, lcLog, lcSavErr, lnErrSize, lnRemoved, lcExeBefore, lcExeAfter

lcRoot = "C:\Duna\Export\"
lcProj = lcRoot+"mscomctl"
lcStubs = lcRoot+"PROGS\export_build_stubs.prg"
lcErr = lcRoot+"mscomctl.ERR"
lcLog = lcRoot+"build_mscomctl.log"
lnRemoved = 0

STRTOFILE("=== RunBuildExport "+TTOC(DATETIME())+" ==="+CHR(13), lcLog, .F.)

IF  .NOT. FILE(lcProj+".pjx")
   STRTOFILE("ERROR: falta mscomctl.pjx"+CHR(13), lcLog, .T.)
   QUIT
ENDIF

SET SAFETY OFF
SET EXCLUSIVE ON
SET MULTILOCKS ON
_SCREEN.Visible = .F.

SET PROCEDURE TO (lcRoot+"PROGS\suite_repair_lib.prg") ADDITIVE
DO SuiteRepairMscomctlProject WITH lcRoot, lcLog

lcSavErr = ON("ERROR")
ON ERROR STRTOFILE("ERROR build: "+MESSAGE()+CHR(13), lcLog, .T.)

SET DEFAULT TO (lcRoot)
SET PATH TO ;
   (lcRoot+"PROGS"), ;
   (lcRoot+"vcx"), ;
   (lcRoot+"scx"), ;
   (lcRoot+"MENUS"), ;
   (lcRoot+"gestion-dunasoft\gestion\vcx") ;
   ADDITIVE
SET PROCEDURE TO (lcStubs) ADDITIVE

lcExeBefore = IIF(FILE(lcRoot+"mscomctl.exe"), FILEDATE(lcRoot+"mscomctl.exe"), {})

DO SuiteCloseProject IN suite_repair_lib
OPEN PROJECT (lcProj) EXCLUSIVE
IF TYPE("_VFP.ActiveProject")#"O"
   STRTOFILE("ERROR: no ActiveProject antes de BUILD"+CHR(13), lcLog, .T.)
   ON ERROR &lcSavErr
   QUIT
ENDIF

STRTOFILE("Build iniciado: "+TTOC(DATETIME())+CHR(13), lcLog, .T.)
BUILD PROJECT (lcProj) REBUILD
DO SuiteCloseProject IN suite_repair_lib

ON ERROR &lcSavErr

lcExeAfter = IIF(FILE(lcRoot+"mscomctl.exe"), FILEDATE(lcRoot+"mscomctl.exe"), {})
lnErrSize = 0
IF FILE(lcErr)
   lnErrSize = FILESIZE(lcErr)
ENDIF
STRTOFILE("Build fin. ERR bytes="+ALLTRIM(STR(lnErrSize))+;
   " exe_changed="+IIF(lcExeAfter<>lcExeBefore, "SI", "NO")+CHR(13), lcLog, .T.)
QUIT
