* Activar sync Suite manualmente (si duna.exe aun no lleva general.prg parcheado).
* En Style, ventana de comandos VFP: DO activar_suite_sync.prg

LOCAL lcb
lcb = ADDBS(SYS(5)+SYS(2003))
IF FILE(lcb+"suite_full_unlock.prg")
   SET PROCEDURE TO (lcb+"suite_full_unlock.prg") ADDITIVE
ELSE
   IF FILE(lcb+"PROGS\suite_full_unlock.prg")
      SET PROCEDURE TO (lcb+"PROGS\suite_full_unlock.prg") ADDITIVE
   ELSE
      MESSAGEBOX("No se encuentra suite_full_unlock.prg en "+lcb, 16, "Suite sync")
      RETURN
   ENDIF
ENDIF
IF TYPE("SuiteApplyFullUnlock")#"U"
   DO SuiteApplyFullUnlock
ENDIF
DO Suite_SyncInit
WAIT WINDOW NOWAIT "Suite sync activado. Log: Usuarios\_suite_sync.log"
