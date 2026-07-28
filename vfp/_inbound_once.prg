LOCAL lcWorker, lcFxp, lcEnv, lcRoot, lnSlash, lcShare, lcRest
SET SAFETY OFF
SET ESCAPE OFF
SET NOTIFY OFF
ON ERROR DO InboundOnceError
_SCREEN.Visible = .F.

* NUNCA abrir DBFs por \\host\c$\... si Style usa C:\... : dos rutas al mismo
* fichero rompen el CDX y cuelgan el alta de cliente (damenumero + SEEK).
PUBLIC pcSuiteStyleRoot
lcEnv = ALLTRIM(GETENV("STYLE_HOME"))
IF  .NOT. EMPTY(lcEnv)
   lcRoot = ADDBS(lcEnv)
ELSE
   lcRoot = ADDBS(SYS(5)+SYS(2003))
ENDIF
* \\SERVIDOR\c$\Style-Dunasoft\  ->  C:\Style-Dunasoft\
IF LEFT(lcRoot, 2) == "\\"
   lnSlash = AT(SUBSTR(lcRoot, 3), "\")
   IF lnSlash > 0
      lcShare = SUBSTR(lcRoot, 3 + lnSlash, 2)
      IF LEN(lcShare) = 2 .AND. SUBSTR(lcShare, 2, 1) = "$" .AND. ISALPHA(LEFT(lcShare, 1))
         lcRest = SUBSTR(lcRoot, 3 + lnSlash + 2)
         IF LEFT(lcRest, 1) = "\"
            lcRest = SUBSTR(lcRest, 2)
         ENDIF
         lcRoot = ADDBS(UPPER(LEFT(lcShare, 1)) + ":\" + lcRest)
      ENDIF
   ENDIF
ENDIF
pcSuiteStyleRoot = lcRoot
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
