* Arranque v2: carga cola sync desde PROGS antes del bootstrap embebido (sin ReFox).
LOCAL lcRoot, lcCola, lcCtrl, lcSavErr, lcErr

lcRoot = ADDBS(SYS(5) + SYS(2003))
IF TYPE("SuiteBootstrapLog")="U" AND FILE(lcRoot + "PROGS\general.prg")
   SET PROCEDURE TO (lcRoot + "PROGS\general.prg") ADDITIVE
ENDIF

IF TYPE("SuiteEnqueuePlan2009")#"U"
   RETURN
ENDIF

lcCola = lcRoot + "PROGS\suite_cola_sync.prg"
lcCtrl = lcRoot + "PROGS\suite_control_sync.prg"
lcSavErr = ON("ERROR")
lcErr = ""

IF FILE(lcCtrl)
   ON ERROR lcErr = MESSAGE()
   SET PROCEDURE TO (lcCtrl) ADDITIVE
   ON ERROR &lcSavErr
ENDIF

IF FILE(lcCola)
   lcErr = ""
   ON ERROR lcErr = MESSAGE()
   SET PROCEDURE TO (lcCola) ADDITIVE
   ON ERROR &lcSavErr
   IF TYPE("SuiteEnqueuePlan2009")#"U"
      IF TYPE("SuiteBootstrapLog")#"U"
         DO SuiteBootstrapLog WITH "[BOOT-06] suite_cola_sync desde STARTUP (v2 PROGS)"
      ENDIF
      RETURN
   ENDIF
ENDIF

IF TYPE("SuiteBootstrapLog")#"U"
   DO SuiteBootstrapLog WITH "[BOOT-06E] STARTUP v2 sin SuiteEnqueuePlan2009 "+lcErr
ENDIF
