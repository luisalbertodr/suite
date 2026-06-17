* Arranque automatico sync (CONFIG.FPW STARTUP) para portable sin unlock embebido.
LOCAL lcRoot, lcSavErr, lcerr
lcRoot = ADDBS(JUSTPATH(SYS(16)))
IF TYPE("pcSuiteStyleRoot")#"C"
   PUBLIC pcSuiteStyleRoot
ENDIF
pcSuiteStyleRoot = lcRoot
SET DEFAULT TO (lcRoot)
SET PATH TO (lcRoot+"PROGS") ADDITIVE

IF TYPE("Suite_SyncInit")#"U" AND TYPE("plSuiteSyncEnabled")="L" AND plSuiteSyncEnabled
   RETURN
ENDIF

lcSavErr = ON("ERROR")
lcerr = ""
ON ERROR lcerr = MESSAGE()

IF TYPE("Suite_SyncInit")="U"
   IF FILE(lcRoot+"PROGS\suite_full_unlock.fxp")
      SET PROCEDURE TO (lcRoot+"PROGS\suite_full_unlock.fxp") ADDITIVE
   ENDIF
   IF TYPE("Suite_SyncInit")="U" AND FILE(lcRoot+"PROGS\suite_full_unlock.prg")
      SET PROCEDURE TO (lcRoot+"PROGS\suite_full_unlock.prg") ADDITIVE
   ENDIF
   IF TYPE("Suite_SyncInit")="U" AND FILE(lcRoot+"suite_full_unlock.prg")
      SET PROCEDURE TO (lcRoot+"suite_full_unlock.prg") ADDITIVE
   ENDIF
ENDIF

ON ERROR &lcSavErr

IF TYPE("SuiteApplyFullUnlock")#"U"
   DO SuiteApplyFullUnlock
ENDIF

IF TYPE("Suite_SyncInit")#"U"
   DO Suite_SyncInit
ENDIF
