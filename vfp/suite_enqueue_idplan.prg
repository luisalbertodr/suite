* Encolar manualmente un idplan en cola_sincro (si el hook no disparo).
* Uso en VFP: DO PROGS\suite_enqueue_idplan.prg WITH 111923, "INS"
PARAMETERS tnIdPlan, tcAccion
LOCAL lcRoot, lcAcc
lcRoot = ADDBS(SYS(5)+SYS(2003))
IF TYPE("pcSuiteStyleRoot")="C" AND .NOT. EMPTY(pcSuiteStyleRoot)
   lcRoot = ADDBS(pcSuiteStyleRoot)
ENDIF
IF TYPE("SuiteEnqueuePlan2009")="U"
   IF FILE(lcRoot+"PROGS\suite_cola_sync.prg")
      SET PROCEDURE TO (lcRoot+"PROGS\suite_cola_sync.prg") ADDITIVE
   ENDIF
ENDIF
IF TYPE("SuiteEnqueuePlan2009")="U"
   MESSAGEBOX("SuiteEnqueuePlan2009 no disponible", 16, "Enqueue")
   RETURN .F.
ENDIF
lcAcc = IIF(EMPTY(tcAccion), "INS", tcAccion)
= SuiteEnqueuePlan2009(tnIdPlan, lcAcc)
RETURN .T.
