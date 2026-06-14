* Fallback manual si el exe no lleva suite_full_unlock embebido.

LOCAL lcb
lcb = ADDBS(SYS(5)+SYS(2003))
ON ERROR *
SET PROCEDURE TO suite_full_unlock ADDITIVE
IF TYPE("SuiteApplyFullUnlock")="U"
   IF FILE(lcb+"suite_full_unlock.prg")
      SET PROCEDURE TO (lcb+"suite_full_unlock.prg") ADDITIVE
   ELSE
      IF FILE(lcb+"PROGS\suite_full_unlock.prg")
         SET PROCEDURE TO (lcb+"PROGS\suite_full_unlock.prg") ADDITIVE
      ENDIF
   ENDIF
ENDIF
ON ERROR
IF TYPE("SuiteApplyFullUnlock")="U"
   MESSAGEBOX("No sync embebida ni suite_full_unlock.prg en "+lcb+CHR(13)+CHR(13)+"Recompila Duna.exe con suite_full_unlock.prg en el proyecto.", 16, "Suite sync")
   RETURN
ENDIF
DO SuiteStartSyncIfReady
IF TYPE("SuiteStartSyncIfReady")="U"
   DO SuiteApplyFullUnlock
   DO Suite_SyncInit
ENDIF
WAIT WINDOW NOWAIT "Suite sync activado. Log: Usuarios\_suite_sync.log"
