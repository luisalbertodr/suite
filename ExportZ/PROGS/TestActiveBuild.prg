LOCAL lcLog, ln
lcLog = 'C:\Duna\ExportZ\test_active.log'
STRTOFILE('=== '+TTOC(DATETIME())+' ==='+CHR(13), lcLog, .F.)
DO SuiteRepairMscomctlProject IN PROGS\suite_repair_lib.prg WITH 'C:\Duna\ExportZ\', lcLog
ln = 0
IF TYPE('_VFP.ActiveProject')='O'
   ln = _VFP.ActiveProject.Files.Count
   STRTOFILE('after repair active files='+ALLTRIM(STR(ln))+CHR(13), lcLog, .T.)
   _VFP.ActiveProject.Build('C:\Duna\ExportZ\', .T.)
   STRTOFILE('Build llamado'+CHR(13), lcLog, .T.)
ELSE
   STRTOFILE('sin ActiveProject tras repair'+CHR(13), lcLog, .T.)
ENDIF
QUIT
