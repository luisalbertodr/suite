* Aviso no intrusivo: JSON inbound pendientes (Suite -> Style) con Duna abierto.
* Timer en _SCREEN; una alerta cada ~30 min max si sigue pendiente.

PROCEDURE SuiteSyncPendingWatcherStart
 IF TYPE("plSuiteSyncEnabled")#"L" OR .NOT. plSuiteSyncEnabled
    RETURN
 ENDIF
 IF TYPE("_SCREEN.oSuitePendingTimer")="O"
    _SCREEN.oSuitePendingTimer.Enabled = .T.
    RETURN
 ENDIF
 LOCAL lcPrg, lcSav, lcErr
 lcPrg = SuitePendingRoot()+"PROGS\suite_sync_pending_alert.prg"
 IF .NOT. FILE(lcPrg)
    lcPrg = SuitePendingRoot()+"suite_sync_pending_alert.prg"
 ENDIF
 IF FILE(lcPrg)
    lcSav = ON("ERROR")
    lcErr = ""
    ON ERROR lcErr = MESSAGE()
    SET PROCEDURE TO (lcPrg) ADDITIVE
    ON ERROR &lcSav
 ENDIF
 TRY
    _SCREEN.AddObject("oSuitePendingTimer", "Timer")
    BINDEVENT(_SCREEN.oSuitePendingTimer, "Timer", "suite_sync_pending_alert", "SuiteSyncPendingWatcherTick")
    _SCREEN.oSuitePendingTimer.Interval = 120000
    _SCREEN.oSuitePendingTimer.Enabled = .T.
    IF TYPE("SuiteBootstrapLog")#"U"
       DO SuiteBootstrapLog WITH "[SYNC-WATCH] timer inbound pendiente activo"
    ENDIF
 CATCH TO oerr
    IF TYPE("SuiteBootstrapLog")#"U"
       DO SuiteBootstrapLog WITH "[SYNC-WATCH] timer no iniciado: "+TRANSFORM(oerr.message)
    ENDIF
 ENDTRY
ENDPROC

PROCEDURE SuiteSyncPendingWatcherStop
 IF TYPE("_SCREEN.oSuitePendingTimer")="O"
    _SCREEN.oSuitePendingTimer.Enabled = .F.
    _SCREEN.oSuitePendingTimer.Release()
 ENDIF
ENDPROC

PROCEDURE SuiteSyncPendingWatcherTick
 LOCAL lnPending, llWedbErr, lcRoot, lcFlag, ldLast, lnGap
 IF TYPE("plSuiteSyncEnabled")#"L" OR .NOT. plSuiteSyncEnabled
    DO SuiteSyncPendingWatcherStop
    RETURN
 ENDIF
 lcRoot = SuitePendingRoot()
 lnPending = SuitePendingInboundCount(lcRoot)
 IF lnPending <= 0
    RETURN
 ENDIF
 llWedbErr = SuitePendingRecentWedbError(lcRoot)
 lcFlag = lcRoot+"Usuarios\_sync_pending_alert.txt"
 ldLast = {}
 IF FILE(lcFlag)
    ldLast = CTOT(FILETOSTR(lcFlag))
 ENDIF
 lnGap = 1800
 IF .NOT. EMPTY(ldLast)
    IF (DATETIME() - ldLast) < lnGap
       RETURN
    ENDIF
 ENDIF
 STRTOFILE(TTOC(DATETIME()), lcFlag)
 LOCAL lcmsg
 lcmsg = "Hay "+ALLTRIM(STR(lnPending))+" cambio(s) de Suite pendientes de aplicar en Style."
 IF llWedbErr
    lcmsg = lcmsg+CHR(13)+CHR(13)+"El worker no pudo abrir wedb (Style en uso)."
    lcmsg = lcmsg+CHR(13)+"Al cerrar Style se sincronizaran solos."
    lcmsg = lcmsg+CHR(13)+"O ejecuta RecuperarSyncInbound.bat en la carpeta de Style."
 ELSE
    lcmsg = lcmsg+CHR(13)+CHR(13)+"El worker los aplicara en breve (scheduler o agente)."
 ENDIF
 MESSAGEBOX(lcmsg, 48, "Suite - sincronizacion pendiente")
ENDPROC

FUNCTION SuitePendingRoot
 LOCAL lcRoot
 lcRoot = ""
 IF TYPE("pcSuiteStyleRoot")="C" AND .NOT. EMPTY(pcSuiteStyleRoot)
    lcRoot = ADDBS(pcSuiteStyleRoot)
 ENDIF
 IF EMPTY(lcRoot)
    lcRoot = ADDBS(GETENV("STYLE_HOME"))
 ENDIF
 IF EMPTY(lcRoot)
    lcRoot = ADDBS(SYS(5)+SYS(2003))
 ENDIF
 RETURN lcRoot
ENDFUNC

FUNCTION SuitePendingInboundCount
 PARAMETER tcRoot
 LOCAL lnN, laArr
 lnN = 0
 IF .NOT. DIRECTORY(tcRoot+"sync\inbound")
    RETURN 0
 ENDIF
 lnN = ADIR(laArr, tcRoot+"sync\inbound\*.json")
 RETURN MAX(lnN, 0)
ENDFUNC

FUNCTION SuitePendingRecentWedbError
 PARAMETER tcRoot
 LOCAL lcLog, lcTail, ln
 lcLog = tcRoot+"sync\inbound_worker.log"
 IF .NOT. FILE(lcLog)
    RETURN .F.
 ENDIF
 lcTail = ""
 ln = 0
 LOCAL lnH
 lnH = FOPEN(lcLog, 0)
 IF lnH < 0
    RETURN .F.
 ENDIF
 FSEEK(lnH, 0, 2)
 LOCAL lnSize, lnStart, lcChunk
 lnSize = FSEEK(lnH, 0, 1)
 lnStart = MAX(0, lnSize - 8192)
 FSEEK(lnH, lnStart, 0)
 lcChunk = FREAD(lnH, MIN(8192, lnSize))
 = FCLOSE(lnH)
 lcTail = UPPER(lcChunk)
 RETURN ("WEDB" $ lcTail) AND (("ACCESS DENIED" $ lcTail) OR ("SHARED FAIL" $ lcTail) OR ("DENEGADO" $ lcTail))
ENDFUNC
