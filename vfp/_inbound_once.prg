LOCAL lcWorker, lcFxp
SET SAFETY OFF
SET ESCAPE OFF
SET NOTIFY OFF
ON ERROR DO InboundOnceError
_SCREEN.Visible = .F.

PUBLIC pcSuiteStyleRoot
pcSuiteStyleRoot = "C:\Duna\Style-Suite-Test\"
SET DEFAULT TO (pcSuiteStyleRoot)

lcWorker = pcSuiteStyleRoot + "PROGS\suite_inbound_worker_sync.prg"
lcFxp = pcSuiteStyleRoot + "PROGS\suite_inbound_worker_sync.fxp"
IF .NOT. FILE(lcWorker)
   STRTOFILE(TTOC(DATETIME()) + " missing " + lcWorker + CHR(13), pcSuiteStyleRoot + "sync\inbound_worker.log", .T.)
   QUIT
ENDIF
IF .NOT. FILE(lcFxp)
   COMPILE (lcWorker)
ELSE
   IF FDATE(lcWorker) > FDATE(lcFxp) .OR. (FDATE(lcWorker) = FDATE(lcFxp) .AND. FTIME(lcWorker) > FTIME(lcFxp))
      COMPILE (lcWorker)
   ENDIF
ENDIF
IF .NOT. FILE(lcFxp)
   STRTOFILE(TTOC(DATETIME()) + " compile failed " + lcWorker + CHR(13), pcSuiteStyleRoot + "sync\inbound_worker.log", .T.)
   QUIT
ENDIF

* DO Procedure IN ProgramFile — no requiere SET PROCEDURE TO ni TYPE().
DO SuiteInboundWorkerRun IN (lcFxp)
QUIT

PROCEDURE InboundOnceError
 LOCAL lcMsg
 lcMsg = ALLTRIM(MESSAGE())
 STRTOFILE(TTOC(DATETIME()) + " _inbound_once error: " + lcMsg + CHR(13), pcSuiteStyleRoot + "sync\inbound_worker.log", .T.)
 CLEAR TYPE "ON ERROR"
 QUIT
ENDPROC
