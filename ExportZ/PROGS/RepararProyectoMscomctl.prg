* Repara mscomctl.pjx para Build completo desde VFP9.
LOCAL lcRoot, lcLog, lnRemoved, lcSavErr

lcRoot = "C:\Duna\Export\"
lcLog = ""
lnRemoved = 0

IF  .NOT. FILE(lcRoot + "mscomctl.pjx")
   MESSAGEBOX("No se encuentra " + lcRoot + "mscomctl.pjx", 16, "Reparar proyecto")
   RETURN
ENDIF
IF  .NOT. FILE(lcRoot + "PROGS\suite_full_unlock.prg")
   MESSAGEBOX("No se encuentra suite_full_unlock.prg", 16, "Reparar proyecto")
   RETURN
ENDIF
IF  .NOT. FILE(lcRoot + "PROGS\export_build_stubs.prg")
   MESSAGEBOX("No se encuentra export_build_stubs.prg." + CHR(13) + "Ejecuta PrepararExportBuild.bat primero.", 16, "Reparar proyecto")
   RETURN
ENDIF

SET PROCEDURE TO (lcRoot + "PROGS\suite_repair_lib.prg") ADDITIVE

lcSavErr = ON("ERROR")
ON ERROR MESSAGEBOX("Cierra el Project Manager (mscomctl) y vuelve a ejecutar." + CHR(13) + CHR(13) + MESSAGE(), 16, "Reparar proyecto")
DO SuiteRepairMscomctlProject WITH lcRoot, lcLog
ON ERROR &lcSavErr

MESSAGEBOX("Proyecto reparado." + CHR(13) + CHR(13) + ;
   "Referencias eliminadas/corregidas: " + ALLTRIM(STR(lnRemoved)) + CHR(13) + ;
   "Stubs: export_build_stubs.prg" + CHR(13) + ;
   "Sync: suite_full_unlock.prg" + CHR(13) + CHR(13) + ;
   "Siguiente paso: CompilarMscomctl.bat o Build en VFP.", 64, "Reparar proyecto")
QUIT
