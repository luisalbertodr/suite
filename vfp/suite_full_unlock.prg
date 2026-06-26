* Suite: unlock offline + sync Style (componente embebido en duna.exe via ReFox Replace).
* Solo hace falta SuiteSync.cfg junto al exe. PRG externo = fallback desarrollo.
* Sin PUBLIC aqui: re-ejecutar SET PROCEDURE TO rompe con "Illegal redefinition".
**
PROCEDURE SuiteEnsureSyncGlobals
 * SET PROCEDURE TO .fxp no ejecuta el bloque PUBLIC superior.
 * PUBLIC solo si TYPE="U" (evita "Illegal redefinition" con PRIVATE previo).
 IF TYPE("plSuiteFullUnlock")="U"
    PUBLIC plSuiteFullUnlock
    plSuiteFullUnlock = .T.
 ENDIF
 IF TYPE("pcSuiteSyncUrl")="U"
    PUBLIC pcSuiteSyncUrl
    pcSuiteSyncUrl = ""
 ENDIF
 IF TYPE("pcSuiteSyncToken")="U"
    PUBLIC pcSuiteSyncToken
    pcSuiteSyncToken = ""
 ENDIF
 IF TYPE("pcSuiteSyncMac")="U"
    PUBLIC pcSuiteSyncMac
    pcSuiteSyncMac = "STYLE-VM"
 ENDIF
 IF TYPE("gnSuiteSyncInterval")="U"
    PUBLIC gnSuiteSyncInterval
    gnSuiteSyncInterval = 30
 ELSE
    IF TYPE("gnSuiteSyncInterval")="N" AND gnSuiteSyncInterval < 15
       gnSuiteSyncInterval = 30
    ENDIF
 ENDIF
 IF TYPE("gnSuiteSyncTimerId")="U"
    PUBLIC gnSuiteSyncTimerId
    gnSuiteSyncTimerId = 0
 ENDIF
 IF TYPE("plSuiteSyncBusy")="U"
    PUBLIC plSuiteSyncBusy
    plSuiteSyncBusy = .F.
 ENDIF
 IF TYPE("plSuiteSyncEnabled")="U"
    PUBLIC plSuiteSyncEnabled
    plSuiteSyncEnabled = .F.
 ENDIF
 IF TYPE("pcSuiteStyleRoot")="U"
    PUBLIC pcSuiteStyleRoot
    pcSuiteStyleRoot = ""
 ENDIF
 IF TYPE("gnSuiteInstanceLockHandle")="U"
    PUBLIC gnSuiteInstanceLockHandle
    gnSuiteInstanceLockHandle = 0
 ENDIF
ENDPROC
**
PROCEDURE SuiteEnsurePlan2009SyncFields
 * DBF legacy sin columnas Suite: anadir enviar/enviadoand/idand/macand si faltan.
 LOCAL lcalias, lcpath, llWasOpen
 lcalias = SELECT()
 llWasOpen = USED("plan2009")
 lcpath = SuiteStyleRoot()+"dbf\plan2009"
 IF  .NOT. FILE(lcpath+".dbf") AND FILE(SuiteStyleRoot()+"plan2009.dbf")
    lcpath = SuiteStyleRoot()+"plan2009"
 ENDIF
 IF  .NOT. FILE(lcpath+".dbf")
    RETURN
 ENDIF
 IF  .NOT. llWasOpen
    USE EXCLUSIVE (lcpath) ALIAS plan2009 IN 0
 ENDIF
 SELECT plan2009
 IF FIELD("enviar", "plan2009") = 0
    ALTER TABLE plan2009 ADD COLUMN enviar L
 ENDIF
 IF FIELD("enviadoand", "plan2009") = 0
    ALTER TABLE plan2009 ADD COLUMN enviadoand L
 ENDIF
 IF FIELD("idand", "plan2009") = 0
    ALTER TABLE plan2009 ADD COLUMN idand N (15, 0)
 ENDIF
 IF FIELD("macand", "plan2009") = 0
    ALTER TABLE plan2009 ADD COLUMN macand C (30)
 ENDIF
 IF  .NOT. llWasOpen AND USED("plan2009")
    USE IN plan2009
 ENDIF
 IF  .NOT. EMPTY(lcalias)
    SELECT (lcalias)
 ENDIF
ENDPROC
**
PROCEDURE SuiteEnsureGlobals
 IF TYPE("pcidioma")#"C"
    PUBLIC pcidioma, pcpais, pcversionpais
    pcidioma = "CA"
    pcpais = "ESP"
    pcversionpais = "ESP"
 ENDIF
ENDPROC
**
FUNCTION SuiteStyleRoot
 LOCAL lcb
 IF  .NOT. EMPTY(pcSuiteStyleRoot) AND DIRECTORY(pcSuiteStyleRoot)
    RETURN ADDBS(pcSuiteStyleRoot)
 ENDIF
 IF  .NOT. EMPTY(SYS(16))
    lcb = ADDBS(JUSTPATH(FULLPATH(SYS(16))))
    IF FILE(lcb+"duna.exe") OR FILE(lcb+"Duna.exe") OR FILE(lcb+"EMPRESA.DBF") OR FILE(lcb+"SuiteSync.cfg")
       pcSuiteStyleRoot = lcb
       RETURN lcb
    ENDIF
 ENDIF
 lcb = ADDBS(SYS(5)+SYS(2003))
 IF FILE(lcb+"EMPRESA.DBF") OR FILE(lcb+"duna.exe") OR FILE(lcb+"mscomctl.exe") OR FILE(lcb+"style.exe")
    pcSuiteStyleRoot = lcb
    RETURN lcb
 ENDIF
 IF FILE(lcb+"suite_full_unlock.prg")
    pcSuiteStyleRoot = lcb
    RETURN lcb
 ENDIF
 IF FILE(lcb+"PROGS\suite_full_unlock.prg")
    pcSuiteStyleRoot = lcb
    RETURN lcb
 ENDIF
 IF  .NOT. EMPTY(GETENV("STYLE_HOME")) AND DIRECTORY(GETENV("STYLE_HOME"))
    pcSuiteStyleRoot = ADDBS(GETENV("STYLE_HOME"))
    RETURN pcSuiteStyleRoot
 ENDIF
 IF DIRECTORY("C:\Style-Dunasoft")
    pcSuiteStyleRoot = "C:\Style-Dunasoft\"
    RETURN pcSuiteStyleRoot
 ENDIF
 pcSuiteStyleRoot = lcb
 RETURN lcb
ENDFUNC
**
* Sync embebido en suite_full_unlock (exe). No cargar suite_reservas_sync.prg externo.
FUNCTION SuiteSyncPrgPath
 RETURN ""
ENDFUNC
**
FUNCTION SuiteSyncEnsureLoaded
 IF TYPE("Suite_SyncInit")#"U"
    RETURN .T.
 ENDIF
 IF TYPE("Suite_SyncLog")#"U"
    DO Suite_SyncLog WITH "[BOOT-07] SuiteSyncEnsureLoaded: Suite_SyncInit no definido"
 ENDIF
 RETURN .F.
ENDFUNC
**
FUNCTION Suite_SyncDiag
 * Resumen legible para ? en ventana VFP o log manual
 LOCAL lc
 lc = "Suite_SyncInit="+IIF(TYPE("Suite_SyncInit")="U", "NO", "SI")
 lc = lc+" enabled="+IIF(TYPE("plSuiteSyncEnabled")="L" AND plSuiteSyncEnabled, "SI", "NO")
 lc = lc+" timer="+ALLTRIM(STR(gnSuiteSyncTimerId))
 lc = lc+" url="+IIF(EMPTY(pcSuiteSyncUrl), "(vacio)", LEFT(pcSuiteSyncUrl, 60))
 lc = lc+" root="+SuiteStyleRoot()
 RETURN lc
ENDFUNC
**
FUNCTION SuiteIdUser
 LOCAL lcid, lnAt
 lcid = ID()
 lnAt = AT("#", lcid)
 IF lnAt > 1
    RETURN ALLTRIM(SUBSTR(lcid, 1, lnAt-1))
 ENDIF
 RETURN ALLTRIM(lcid)
ENDFUNC
**
FUNCTION SuiteWindowsUser
 RETURN SuiteIdUser()
ENDFUNC
**
FUNCTION SuiteSyncTryLock
 * Candado entre procesos/sesiones: solo una sync Suite a la vez (varias ventanas Style OK).
 LOCAL lcf, lh, lcb
 lcb = SuiteStyleRoot()
 lcf = lcb+"Usuarios\_suite_sync.lock"
 IF  .NOT. DIRECTORY(lcb+"Usuarios")
    MD (lcb+"Usuarios")
 ENDIF
 IF  .NOT. FILE(lcf)
    STRTOFILE("0", lcf)
 ENDIF
 lh = FOPEN(lcf, 11)
 IF lh < 0
    RETURN 0
 ENDIF
 RETURN lh
ENDFUNC
**
PROCEDURE SuiteSyncReleaseLock
 PARAMETER tnHandle
 IF TYPE("tnHandle")="N" AND tnHandle > 0
    = FCLOSE(tnHandle)
 ENDIF
ENDPROC
**
FUNCTION SuiteSingleInstanceCheck
 * Multisesion permitida (mismo u otro usuario). Sin bloqueo de segunda ventana.
 RETURN .T.
ENDFUNC
**
PROCEDURE SuiteReleaseInstanceLock
 RETURN
ENDPROC
**
FUNCTION SuiteSyncV2Redirect
 PARAMETER tcPhase
 LOCAL lcRoot, lcCola, lcCtrl, llV2, lcSavErr, lcErr
 lcRoot = IIF(TYPE("pcSuiteStyleRoot")="C" .AND. .NOT. EMPTY(pcSuiteStyleRoot), ADDBS(pcSuiteStyleRoot), ADDBS(SYS(5)+SYS(2003)))
 llV2 = .F.
 IF TYPE("SuiteColaIsV2Active")#"U" AND SuiteColaIsV2Active()
    llV2 = .T.
 ELSE
    IF FILE(lcRoot+"control_sincro.dbf")
       lcSavErr = ON("ERROR")
       lcErr = ""
       ON ERROR lcErr = MESSAGE()
       USE (lcRoot+"control_sincro.dbf") IN 0 SHARED ALIAS _ctl_sync
       ON ERROR &lcSavErr
       IF USED("_ctl_sync")
          SELECT _ctl_sync
          llV2 = (ALLTRIM(modo)=="2")
          USE IN _ctl_sync
       ENDIF
    ELSE
       llV2 = .T.
    ENDIF
 ENDIF
 IF  .NOT. llV2
    RETURN .F.
 ENDIF
 lcCtrl = lcRoot+"PROGS\suite_control_sync.prg"
 lcCola = lcRoot+"PROGS\suite_cola_sync.prg"
 IF FILE(lcCtrl)
    SET PROCEDURE TO (lcCtrl) ADDITIVE
 ENDIF
 IF FILE(lcCola)
    lcSavErr = ON("ERROR")
    lcErr = ""
    ON ERROR lcErr = MESSAGE()
    SET PROCEDURE TO (lcCola) ADDITIVE
    ON ERROR &lcSavErr
 ENDIF
 IF TYPE("SuiteEnqueuePlan2009")="U"
    RETURN .F.
 ENDIF
 DO SuiteEnsureSyncGlobals
 plSuiteSyncEnabled = .T.
 IF TYPE("SuiteBootstrapLog")#"U"
    DO SuiteBootstrapLog WITH "[BOOT-06] v2 redirect suite_full_unlock ("+tcPhase+")"
 ENDIF
 IF UPPER(ALLTRIM(tcPhase))=="UNLOCK"
    IF TYPE("SuiteApplyLicenseFlags")#"U"
       DO SuiteApplyLicenseFlags
    ENDIF
 ENDIF
 IF UPPER(ALLTRIM(tcPhase))=="INIT"
    IF TYPE("Suite_SyncLog")#"U"
       DO Suite_SyncLog WITH "[INIT-03] Style sync v2 cola activa (sin HTTP)"
    ENDIF
 ENDIF
 RETURN .T.
ENDFUNC
**
PROCEDURE SuiteShutdown
 TRY
    IF TYPE("Suite_SyncStopTimer")#"U"
       DO Suite_SyncStopTimer
    ENDIF
 CATCH
 ENDTRY
 DO SuiteReleaseInstanceLock
 CLEAR EVENTS
ENDPROC
**
#INCLUDE suite_apply_license_unlock.prg

PROCEDURE SuiteApplyFullUnlock
 IF SuiteSyncV2Redirect("unlock")
    RETURN
 ENDIF
 DO SuiteApplyLicenseFlags
ENDPROC
**
PROCEDURE start_serviciocomunicaciones
 TRY
    DO Suite_SyncLog WITH "[MANUAL] Ctrl+F5 start_serviciocomunicaciones"
    = SuiteSyncEnsureLoaded()
    DO Suite_SyncInit
 CATCH TO oerr
    DO Suite_SyncLog WITH "[MANUAL] start_serviciocomunicaciones error: "+IIF(TYPE("oerr")="O", oerr.message, "?")
 ENDTRY
ENDPROC
**
PROCEDURE stop_serviciocomunicaciones
 TRY
    DO Suite_SyncStopTimer
 CATCH
 ENDTRY
ENDPROC
**
PROCEDURE start_serviciosonline
 RETURN
ENDPROC
**
PROCEDURE Suite_SyncLog
 PARAMETER tcmsg
 LOCAL lcf, lcline, lcb
 lcb = SuiteStyleRoot()
 IF  .NOT. DIRECTORY(lcb+"Usuarios")
    MD (lcb+"Usuarios")
 ENDIF
 lcf = lcb+"Usuarios\_suite_sync.log"
 lcline = TTOC(DATETIME())+" "+ALLTRIM(tcmsg)+CHR(13)+CHR(10)
 STRTOFILE(lcline, lcf, .T.)
ENDPROC
**
PROCEDURE SuiteEnsureUnlockPrgLoaded
 * VFP prefiere .fxp sobre .prg; el FXP no registra DEFINE CLASS.
 LOCAL lcRoot, lcPrg, lcLic
 lcRoot = SuiteStyleRoot()
 lcLic = lcRoot+"PROGS\suite_apply_license_unlock.prg"
 IF FILE(lcLic)
    SET PROCEDURE TO (lcLic) ADDITIVE
 ENDIF
 lcPrg = lcRoot+"PROGS\suite_full_unlock.prg"
 IF  .NOT. FILE(lcPrg)
    lcPrg = lcRoot+"suite_full_unlock.prg"
 ENDIF
 IF FILE(lcPrg)
    SET PROCEDURE TO (lcPrg) ADDITIVE
 ENDIF
ENDPROC
**
PROCEDURE Suite_SyncInit
 IF SuiteSyncV2Redirect("init")
    RETURN
 ENDIF
 LOCAL lcfichero, lcline, lckey, lcval, lccontent, lnlines, i
 DO SuiteEnsureUnlockPrgLoaded
 DO SuiteEnsureSyncGlobals
 DO Suite_SyncLog WITH "[INIT-01] Suite_SyncInit entrada"
 lcfichero = SuiteStyleRoot()+"SuiteSync.cfg"
 IF  .NOT. FILE(lcfichero)
    lcfichero = ADDBS(SYS(5)+SYS(2003))+"SuiteSync.cfg"
 ENDIF
 IF  .NOT. FILE(lcfichero)
    plSuiteSyncEnabled = .F.
    DO Suite_SyncLog WITH "[INIT-02] FALLO: SuiteSync.cfg no encontrado root="+SuiteStyleRoot()+" cwd="+SYS(5)+SYS(2003)
    RETURN
 ENDIF
 IF FILE(lcfichero)
    lccontent = FILETOSTR(lcfichero)
    DIMENSION laSuiteSyncCfg(1)
    lnlines = ALINES(laSuiteSyncCfg, lccontent)
    FOR i = 1 TO lnlines
       lcline = laSuiteSyncCfg(i)
       IF AT("=", lcline) < 2
          LOOP
       ENDIF
       lckey = UPPER(ALLTRIM(LEFT(lcline, AT("=", lcline)-1)))
       lcval = ALLTRIM(SUBSTR(lcline, AT("=", lcline)+1))
       DO CASE
          CASE lckey=="SYNC_URL"
             pcSuiteSyncUrl = lcval
          CASE lckey=="SYNC_TOKEN"
             pcSuiteSyncToken = lcval
          CASE lckey=="SYNC_MAC"
             pcSuiteSyncMac = lcval
          CASE lckey=="SYNC_INTERVAL"
             gnSuiteSyncInterval = MAX(15, VAL(lcval))
       ENDCASE
    ENDFOR
 ENDIF
 IF EMPTY(pcSuiteSyncUrl) OR EMPTY(pcSuiteSyncToken)
    plSuiteSyncEnabled = .F.
    DO Suite_SyncLog WITH "[INIT-04] FALLO: SYNC_URL o SYNC_TOKEN vacios en "+lcfichero
    RETURN
 ENDIF
 plSuiteSyncEnabled = .T.
 DO Suite_SyncLog WITH "[INIT-03] cfg OK url="+pcSuiteSyncUrl+" mac="+pcSuiteSyncMac+" interval="+ALLTRIM(STR(gnSuiteSyncInterval))+" file="+lcfichero
 DO SuiteEnsurePlan2009SyncFields
 DO Suite_SyncStartTimer
 DO Suite_SyncLog WITH "[INIT-05] primer ciclo sync"
 DO Suite_SyncCycle
ENDPROC
**
PROCEDURE Suite_SyncStartTimer
 LOCAL lnsec
 DO SuiteEnsureUnlockPrgLoaded
 DO SuiteEnsureSyncGlobals
 IF  .NOT. plSuiteSyncEnabled
    DO Suite_SyncLog WITH "[INIT-06E] timer omitido: plSuiteSyncEnabled=.F."
    RETURN
 ENDIF
 IF gnSuiteSyncTimerId > 0
    DO Suite_SyncLog WITH "[INIT-06] timer ya activo"
    RETURN
 ENDIF
 lnsec = MAX(gnSuiteSyncInterval, 15)
 IF TYPE("_SCREEN.oSuiteSyncTimer") = "O"
    _SCREEN.oSuiteSyncTimer.Interval = lnsec * 1000
    _SCREEN.oSuiteSyncTimer.Enabled = .T.
    gnSuiteSyncTimerId = 1
    DO Suite_SyncLog WITH "[INIT-06] timer reutilizado interval="+ALLTRIM(STR(lnsec))+"s"
    RETURN
 ENDIF
 _SCREEN.AddObject("oSuiteSyncTimer", "Timer")
 BINDEVENT(_SCREEN.oSuiteSyncTimer, "Timer", "suite_full_unlock", "Suite_SyncCycle")
 _SCREEN.oSuiteSyncTimer.Interval = lnsec * 1000
 _SCREEN.oSuiteSyncTimer.Enabled = .T.
 gnSuiteSyncTimerId = 1
 DO Suite_SyncLog WITH "[INIT-06] timer creado interval="+ALLTRIM(STR(lnsec))+"s"
ENDPROC
**
PROCEDURE Suite_SyncStopTimer
 IF TYPE("_SCREEN.oSuiteSyncTimer") = "O"
    _SCREEN.oSuiteSyncTimer.Enabled = .F.
    _SCREEN.oSuiteSyncTimer.Release()
 ENDIF
 gnSuiteSyncTimerId = 0
ENDPROC
**
FUNCTION Suite_HttpPost
 PARAMETER tcurl, tcbody
 LOCAL loxml, lcresp, lcerr
 lcresp = ""
 TRY
    loxml = CREATEOBJECT("MSXML2.ServerXMLHTTP.6.0")
    loxml.open("POST", tcurl, .F.)
    loxml.setRequestHeader("Content-Type", "application/x-www-form-urlencoded")
    loxml.setTimeouts(30000, 30000, 120000, 180000)
    loxml.send(tcbody)
    lcresp = loxml.responseText
    loxml = .NULL.
 CATCH TO oerr
    lcerr = ""
    IF TYPE("oerr")="O"
       lcerr = oerr.message
    ENDIF
    DO Suite_SyncLog WITH "HTTP error: "+lcerr+" url="+tcurl
 ENDTRY
 RETURN lcresp
ENDFUNC
**
FUNCTION Suite_HttpPostOk
 PARAMETER tcurl, tcbody
 LOCAL lcresp, lcu
 lcresp = Suite_HttpPost(tcurl, tcbody)
 IF EMPTY(lcresp)
    RETURN .F.
 ENDIF
 lcu = UPPER(CHRTRAN(ALLTRIM(lcresp), CHR(13)+CHR(10)+CHR(0), ""))
 IF LEFT(lcu, 5) = "ERROR"
    RETURN .F.
 ENDIF
 RETURN (lcu = "OK" OR LEFT(lcu, 2) = "OK")
ENDFUNC
**
FUNCTION Suite_UrlEncode
 PARAMETER tcvalue
 LOCAL lcraw, lcout, lchex, lch, lnasc, i, llsafe
 lchex = "0123456789ABCDEF"
 lcout = ""
 lcraw = IIF(VARTYPE(tcvalue)="C", tcvalue, TRANSFORM(tcvalue))
 lcraw = STRCONV(lcraw, 9)
 FOR i = 1 TO LEN(lcraw)
    lch = SUBSTR(lcraw, i, 1)
    lnasc = ASC(lch)
    llsafe = (lnasc >= 48 AND lnasc <= 57) OR ;
             (lnasc >= 65 AND lnasc <= 90) OR ;
             (lnasc >= 97 AND lnasc <= 122) OR ;
             lnasc = 45 OR lnasc = 46 OR lnasc = 95 OR lnasc = 126
    DO CASE
       CASE lnasc = 32
          lcout = lcout + "+"
       CASE llsafe
          lcout = lcout + lch
       OTHERWISE
          lcout = lcout + "%" + SUBSTR(lchex, INT(lnasc / 16) + 1, 1) + SUBSTR(lchex, MOD(lnasc, 16) + 1, 1)
    ENDCASE
 ENDFOR
 RETURN lcout
ENDFUNC
**
FUNCTION Suite_FormParam
 PARAMETER tckey, tcvalue
 RETURN ALLTRIM(tckey)+"="+Suite_UrlEncode(ALLTRIM(IIF(VARTYPE(tcvalue)="C", tcvalue, TRANSFORM(tcvalue))))
ENDFUNC
**
PROCEDURE Suite_SyncCycle
 LOCAL lnSyncLock
 DO SuiteEnsureSyncGlobals
 IF  .NOT. plSuiteSyncEnabled
    RETURN
 ENDIF
 IF plSuiteSyncBusy
    RETURN
 ENDIF
 lnSyncLock = SuiteSyncTryLock()
 IF lnSyncLock <= 0
    DO Suite_SyncLog WITH "CYCLE omitido: candado sync ocupado"
    RETURN
 ENDIF
 plSuiteSyncBusy = .T.
 DO Suite_SyncLog WITH "CYCLE inicio"
 TRY
    DO Suite_SyncPush
    DO Suite_SyncPull
 CATCH TO oerr
    lcerr = IIF(TYPE("oerr")="O", oerr.message, "?")
    IF TYPE("oerr")="O" AND  .NOT. EMPTY(oerr.lineNo)
       lcerr = lcerr+" line="+ALLTRIM(STR(oerr.lineNo))
    ENDIF
    DO Suite_SyncLog WITH "CYCLE error: "+lcerr
 ENDTRY
 plSuiteSyncBusy = .F.
 DO SuiteSyncReleaseLock WITH lnSyncLock
 DO Suite_SyncLog WITH "CYCLE fin"
ENDPROC
**
PROCEDURE Suite_SyncAfterIncidencia
 PARAMETER tctipinc, tnidplan
 LOCAL lnSyncLock
 IF  .NOT. plSuiteSyncEnabled
    RETURN
 ENDIF
 IF UPPER(ALLTRIM(tctipinc))=="BORRAR"
    RETURN
 ENDIF
 lnSyncLock = SuiteSyncTryLock()
 IF lnSyncLock <= 0
    RETURN
 ENDIF
 TRY
    DO Suite_SyncPushOne WITH tnidplan
 CATCH TO oerr
 ENDTRY
 DO SuiteSyncReleaseLock WITH lnSyncLock
ENDPROC
**
FUNCTION Suite_BuildServiciosPlan
 PARAMETER tnidplan
 LOCAL lccamposerv, lcalias, llWasUsed
 lcalias = ALIAS()
 lccamposerv = ""
 llWasUsed = USED("planart")
 IF  .NOT. llWasUsed
    USE SHARED dbf/planart AGAIN ALIAS planart IN 0
 ENDIF
 IF USED("planart")
    SELECT planart
    SET ORDER TO idplan
    IF SEEK(STR(tnidplan, 10))
       SCAN REST WHILE planart.idplan = tnidplan
          lccamposerv = lccamposerv + ALLTRIM(planart.codart) + ALLTRIM(planart.hora) + CHR(13)
       ENDSCAN
    ENDIF
 ENDIF
 IF  .NOT. llWasUsed AND USED("planart")
    USE IN planart
 ENDIF
 IF  .NOT. EMPTY(lcalias)
    SELECT (lcalias)
 ENDIF
 RETURN lccamposerv
ENDFUNC
**
FUNCTION Suite_TsToEpoch
 PARAMETER tdt
 LOCAL lt
 IF ISNULL(tdt)
    RETURN 0
 ENDIF
 DO CASE
    CASE TYPE("tdt")="T"
       IF EMPTY(tdt)
          RETURN 0
       ENDIF
       lt = tdt
    CASE TYPE("tdt")="D"
       IF EMPTY(tdt)
          RETURN 0
       ENDIF
       lt = DTOT(tdt)
    CASE TYPE("tdt")="C"
       IF EMPTY(ALLTRIM(tdt))
          RETURN 0
       ENDIF
       lt = CTOT(ALLTRIM(tdt))
       IF EMPTY(lt)
          RETURN 0
       ENDIF
    OTHERWISE
       RETURN 0
 ENDCASE
 RETURN INT((lt - DATETIME(1970, 1, 1, 0, 0, 0)) * 86400)
ENDFUNC
**
FUNCTION Suite_GetPlanLocalModifiedEpoch
 PARAMETER tnidplan
 LOCAL lnMax, lnE, lcalias, llWasUsed
 * Comparar epoch (N), no DateTime vs Date — evita "Operator/operand type mismatch"
 lnMax = 0
 lcalias = SELECT()
 llWasUsed = USED("planinc")
 IF  .NOT. llWasUsed
    USE SHARED dbf/planinc AGAIN ALIAS planinc IN 0
 ENDIF
 SELECT planinc
 SET ORDER TO idplan
 IF SEEK(tnidplan)
    SCAN REST WHILE planinc.idplan = tnidplan
       lnE = Suite_TsToEpoch(planinc.fechorinc)
       IF lnE > lnMax
          lnMax = lnE
       ENDIF
    ENDSCAN
 ENDIF
 IF  .NOT. llWasUsed
    USE IN planinc
 ENDIF
 IF  .NOT. EMPTY(lcalias)
    SELECT (lcalias)
 ENDIF
 RETURN lnMax
ENDFUNC
**
FUNCTION Suite_GetPlanLocalModifiedAt
 PARAMETER tnidplan
 LOCAL lnMax
 lnMax = Suite_GetPlanLocalModifiedEpoch(tnidplan)
 IF lnMax <= 0
    RETURN .NULL.
 ENDIF
 RETURN DATETIME(1970, 1, 1, 0, 0, 0) + lnMax
ENDFUNC
**
FUNCTION Suite_PullShouldApply
 PARAMETER tnidplan, tcsuiteMod
 LOCAL lnLocalEpoch, lnSuiteEpoch
 lnSuiteEpoch = VAL(ALLTRIM(tcsuiteMod))
 IF lnSuiteEpoch <= 0
    RETURN .T.
 ENDIF
 lnLocalEpoch = Suite_GetPlanLocalModifiedEpoch(tnidplan)
 IF lnLocalEpoch <= 0
    RETURN .T.
 ENDIF
 RETURN lnSuiteEpoch >= lnLocalEpoch
ENDFUNC
**
FUNCTION Suite_ParseServiciosToPlanart
 PARAMETER tnidplan, tcservicios, tchorini
 LOCAL lcline, lccodart, lchora, lnbracket, lcalias
 lcalias = ALIAS()
 IF EMPTY(tcservicios)
    IF  .NOT. EMPTY(lcalias)
       SELECT (lcalias)
    ENDIF
    RETURN .T.
 ENDIF
 IF  .NOT. USED("planart")
    USE SHARED dbf/planart AGAIN ALIAS planart IN 0
 ENDIF
 SELECT planart
 SET ORDER TO idplan
 lnbracket = AT("[", tcservicios)
 DO WHILE  .NOT. EMPTY(tcservicios)
    tcservicios = CHRTRAN(tcservicios, CHR(10), CHR(13))
    IF AT(CHR(13), tcservicios) > 0
       lcline = LEFT(tcservicios, AT(CHR(13), tcservicios)-1)
       tcservicios = SUBSTR(tcservicios, AT(CHR(13), tcservicios)+1)
    ELSE
       lcline = tcservicios
       tcservicios = ""
    ENDIF
    lcline = ALLTRIM(lcline)
    IF EMPTY(lcline)
       LOOP
    ENDIF
    IF LEFT(lcline, 1)=="["
       lchora = ALLTRIM(SUBSTR(lcline, 2, AT("]", lcline)-2))
       lccodart = ALLTRIM(LEFT(SUBSTR(lcline, AT("]", lcline)+1), AT("-", SUBSTR(lcline, AT("]", lcline)+1)+"-")-1))
       IF EMPTY(lccodart)
          lccodart = ALLTRIM(SUBSTR(lcline, AT("]", lcline)+1))
       ENDIF
    ELSE
       IF LEN(lcline) >= 10
          lccodart = ALLTRIM(LEFT(lcline, LEN(lcline)-5))
          lchora = ALLTRIM(RIGHT(lcline, 5))
       ELSE
          lccodart = lcline
          lchora = tchorini
       ENDIF
    ENDIF
    IF EMPTY(lccodart)
       LOOP
    ENDIF
    IF RLOCK("0", "planart")
       APPEND BLANK
       REPLACE idplan WITH tnidplan, codart WITH lccodart, hora WITH lchora
       UNLOCK IN planart
    ENDIF
 ENDDO
 IF  .NOT. EMPTY(lcalias)
    SELECT (lcalias)
 ENDIF
 RETURN .T.
ENDFUNC
**
PROCEDURE Suite_SyncPull
 LOCAL lcparams, lcresp, llok, lohttp, lcalias, llPlanArtWasUsed
 LOCAL lnidplan, lnidand, lcfec, lcfact, lcelim
 IF  .NOT. plSuiteSyncEnabled
    RETURN
 ENDIF
 lcparams = Suite_FormParam("id", pcSuiteSyncToken)+"&"+Suite_FormParam("tag", "stylegetreservas")
 lcresp = Suite_HttpPost(pcSuiteSyncUrl, lcparams)
 IF EMPTY(lcresp)
    DO Suite_SyncLog WITH "PULL vacio (sin respuesta HTTP)"
    RETURN
 ENDIF
 IF AT("ERROR", UPPER(lcresp)) > 0
    DO Suite_SyncLog WITH "PULL error servidor: "+LEFT(ALLTRIM(lcresp), 200)
    RETURN
 ENDIF
 llok = -1
 IF AT("<raiz/>", lcresp) > 0
    llok = 0
 ELSE
    IF AT("<raiz>", lcresp) > 0
       llok = 1
    ELSE
       IF AT("ERROR", UPPER(lcresp)) > 0
          RETURN
       ENDIF
    ENDIF
 ENDIF
 IF llok = 0
    RETURN
 ENDIF
 IF llok <> 1
    RETURN
 ENDIF
 CREATE CURSOR cResPull (idplan N(10), idand N(15), macand C(30), codemp C(15), codcli C(15), fecha D, horini C(5), horfin C(5), texto C(250), codrec C(15), nomcli C(80), tel1cli C(20), facturado C(2), servicios M, pendiente C(2), eliminar C(2), collet C(20), colfon C(20), modificado C(20))
 XMLTOCURSOR(lcresp, "cResPull", 8192)
 IF  .NOT. USED("cResPull")
    RETURN
 ENDIF
 IF  .NOT. USED("plan2009")
    USE SHARED dbf/plan2009 AGAIN ALIAS plan2009 IN 0
 ENDIF
 llPlanArtWasUsed = USED("planart")
 IF  .NOT. llPlanArtWasUsed
    USE SHARED dbf/planart AGAIN ALIAS planart IN 0
 ENDIF
 lcalias = SELECT()
 SELECT cResPull
 SCAN
    lnidplan = cResPull.idplan
    lnidand = cResPull.idand
    lcelim = UPPER(ALLTRIM(cResPull.eliminar))=="SI"
    IF  .NOT. lcelim AND  .NOT. Suite_PullShouldApply(lnidplan, cResPull.modificado)
       DO Suite_SyncPushOne WITH lnidplan
    ELSE
    SELECT plan2009
    SET ORDER TO idplan
    IF lcelim
       IF SEEK(lnidplan)
          SELECT planart
          SET ORDER TO idplan
          IF SEEK(STR(lnidplan, 10))
             SCAN REST WHILE planart.idplan = lnidplan
                IF RLOCK("planart")
                   DELETE IN planart
                   UNLOCK IN planart
                ENDIF
             ENDSCAN
          ENDIF
          SELECT plan2009
          IF RLOCK("plan2009")
             DELETE IN plan2009
             UNLOCK IN plan2009
          ENDIF
       ENDIF
    ELSE
       lcfact = IIF(UPPER(ALLTRIM(cResPull.facturado))=="SI", .T., .F.)
       IF SEEK(lnidplan)
          IF RLOCK("plan2009")
             REPLACE codemp WITH cResPull.codemp, codcli WITH cResPull.codcli
             REPLACE fecha WITH cResPull.fecha, horini WITH cResPull.horini, horfin WITH cResPull.horfin
             REPLACE texto WITH cResPull.texto, codrec WITH cResPull.codrec
             REPLACE nomcli WITH cResPull.nomcli, tel1cli WITH cResPull.tel1cli
             REPLACE colfon WITH VAL(cResPull.colfon), collet WITH VAL(cResPull.collet)
             REPLACE facturado WITH lcfact
             REPLACE idand WITH lnidand, macand WITH cResPull.macand
             REPLACE enviadoand WITH .T., enviar WITH .F.
             UNLOCK IN plan2009
          ENDIF
       ELSE
          IF RLOCK("0", "plan2009")
             APPEND BLANK
             REPLACE idplan WITH lnidplan
             REPLACE codemp WITH cResPull.codemp, codcli WITH cResPull.codcli
             REPLACE fecha WITH cResPull.fecha, horini WITH cResPull.horini, horfin WITH cResPull.horfin
             REPLACE texto WITH cResPull.texto, codrec WITH cResPull.codrec
             REPLACE nomcli WITH cResPull.nomcli, tel1cli WITH cResPull.tel1cli
             REPLACE colfon WITH VAL(cResPull.colfon), collet WITH VAL(cResPull.collet)
             REPLACE facturado WITH lcfact
             REPLACE idand WITH lnidand, macand WITH cResPull.macand
             REPLACE enviadoand WITH .T., enviar WITH .F.
             UNLOCK IN plan2009
          ENDIF
       ENDIF
       SELECT planart
       SET ORDER TO idplan
       IF SEEK(STR(lnidplan, 10))
          SCAN REST WHILE planart.idplan = lnidplan
             IF RLOCK("planart")
                DELETE IN planart
                UNLOCK IN planart
             ENDIF
          ENDSCAN
       ENDIF
       =Suite_ParseServiciosToPlanart(lnidplan, cResPull.servicios, cResPull.horini)
    ENDIF
    ENDIF
    lcparams = Suite_FormParam("id", pcSuiteSyncToken)+"&"+Suite_FormParam("tag", "stylereservaok")
    lcparams = lcparams+"&"+Suite_FormParam("macand", cResPull.macand)
    lcparams = lcparams+"&"+Suite_FormParam("idand", STR(lnidand))
    lcparams = lcparams+"&"+Suite_FormParam("idplan", STR(lnidplan))
    lcparams = lcparams+"&"+Suite_FormParam("reservaok", "SI")
    =Suite_HttpPostOk(pcSuiteSyncUrl, lcparams)
 ENDSCAN
 USE IN cResPull
 IF  .NOT. llPlanArtWasUsed AND USED("planart")
    USE IN planart
 ENDIF
 IF  .NOT. EMPTY(lcalias)
    SELECT (lcalias)
 ENDIF
ENDPROC
**
PROCEDURE Suite_SyncPush
 LOCAL lcalias
 IF  .NOT. plSuiteSyncEnabled OR  .NOT. USED("plan2009")
    RETURN
 ENDIF
 lcalias = SELECT()
 SELECT plan2009
 SCAN FOR plan2009.enviar .AND.  .NOT. plan2009.enviadoand .AND.  .NOT. plan2009.facturado
    DO Suite_SyncPushOne WITH plan2009.idplan
 ENDSCAN
 IF  .NOT. EMPTY(lcalias)
    SELECT (lcalias)
 ENDIF
ENDPROC
**
PROCEDURE Suite_SyncPushOne
 PARAMETER tnidplan
 LOCAL lcaccion, lcparams, lcfec, lccamposerv, lcfact, llok, lcresp, lcu
 IF tnidplan <= 0
    DO Suite_SyncLog WITH "PUSH omitido idplan<=0"
    RETURN
 ENDIF
 IF  .NOT. SEEK(tnidplan, "plan2009", "idplan")
    DO Suite_SyncLog WITH "PUSH omitido idplan="+ALLTRIM(STR(tnidplan))+" no en plan2009"
    RETURN
 ENDIF
 IF EMPTY(plan2009.fecha) OR YEAR(plan2009.fecha) < 1980
    DO Suite_SyncLog WITH "PUSH omitido idplan="+ALLTRIM(STR(tnidplan))+" fecha invalida"
    RETURN
 ENDIF
 lccamposerv = Suite_BuildServiciosPlan(tnidplan)
 lcfec = ALLTRIM(STR(YEAR(plan2009.fecha)))+"-"+PADL(ALLTRIM(STR(MONTH(plan2009.fecha))), 2, "0")+"-"+PADL(ALLTRIM(STR(DAY(plan2009.fecha))), 2, "0")
 lcfact = IIF(plan2009.facturado, "SI", "NO")
 IF plan2009.idand = 0
    lcaccion = "ALTA"
 ELSE
    lcaccion = "MODIFICAR"
 ENDIF
 lcparams = Suite_FormParam("id", pcSuiteSyncToken)+"&"+Suite_FormParam("tag", "stylereservas")
 lcparams = lcparams+"&"+Suite_FormParam("accion", lcaccion)
 lcparams = lcparams+"&"+Suite_FormParam("idplan", STR(plan2009.idplan))
 lcparams = lcparams+"&"+Suite_FormParam("codemp", plan2009.codemp)
 lcparams = lcparams+"&"+Suite_FormParam("codcli", plan2009.codcli)
 lcparams = lcparams+"&"+Suite_FormParam("fecha", lcfec)
 lcparams = lcparams+"&"+Suite_FormParam("horini", plan2009.horini)
 lcparams = lcparams+"&"+Suite_FormParam("horfin", plan2009.horfin)
 lcparams = lcparams+"&"+Suite_FormParam("texto", plan2009.texto)
 lcparams = lcparams+"&"+Suite_FormParam("codrec", plan2009.codrec)
 lcparams = lcparams+"&"+Suite_FormParam("nomcli", plan2009.nomcli)
 lcparams = lcparams+"&"+Suite_FormParam("tel1cli", plan2009.tel1cli)
 lcparams = lcparams+"&"+Suite_FormParam("facturado", lcfact)
 lcparams = lcparams+"&"+Suite_FormParam("servicios", lccamposerv)
 lcparams = lcparams+"&"+Suite_FormParam("collet", STR(plan2009.collet))
 lcparams = lcparams+"&"+Suite_FormParam("colfon", STR(plan2009.colfon))
 lcparams = lcparams+"&"+Suite_FormParam("idand", STR(plan2009.idand))
 lcparams = lcparams+"&"+Suite_FormParam("macand", pcSuiteSyncMac)
 lcparams = lcparams+"&"+Suite_FormParam("modificado", STR(Suite_TsToEpoch(DATETIME())))
 lcresp = Suite_HttpPost(pcSuiteSyncUrl, lcparams)
 llok = .F.
 IF  .NOT. EMPTY(lcresp)
    lcu = UPPER(CHRTRAN(ALLTRIM(lcresp), CHR(13)+CHR(10)+CHR(0), ""))
    llok = (LEFT(lcu, 5) <> "ERROR" AND (lcu = "OK" OR LEFT(lcu, 2) = "OK"))
 ENDIF
 IF llok
    DO Suite_SyncLog WITH "PUSH ok idplan="+ALLTRIM(STR(tnidplan))
    IF RLOCK("plan2009")
     REPLACE enviadoand WITH .T., enviar WITH .F.
     UNLOCK IN plan2009
    ENDIF
 ELSE
    DO Suite_SyncLog WITH "PUSH fallo idplan="+ALLTRIM(STR(tnidplan))+" resp="+LEFT(ALLTRIM(lcresp), 120)
 ENDIF
ENDPROC
**
PROCEDURE Suite_SyncPushDelete
 PARAMETER tnidplan, tccodemp, tccodcli, tdfecha, tchorini, tchorfin, pctexto, tccodrec, pcnomcli, pctel1cli, tlfacturado, pccamposerv, tncolfon, tncollet
 LOCAL lcparams, lcfec, lcfact, llok, lnSyncLock
 IF  .NOT. plSuiteSyncEnabled
    RETURN
 ENDIF
 lnSyncLock = SuiteSyncTryLock()
 IF lnSyncLock <= 0
    RETURN
 ENDIF
 lcfec = ALLTRIM(STR(YEAR(tdfecha)))+"-"+PADL(ALLTRIM(STR(MONTH(tdfecha))), 2, "0")+"-"+PADL(ALLTRIM(STR(DAY(tdfecha))), 2, "0")
 lcfact = IIF(tlfacturado, "SI", "NO")
 lcparams = Suite_FormParam("id", pcSuiteSyncToken)+"&"+Suite_FormParam("tag", "stylereservas")
 lcparams = lcparams+"&"+Suite_FormParam("accion", "BORRAR")
 lcparams = lcparams+"&"+Suite_FormParam("idplan", STR(tnidplan))
 lcparams = lcparams+"&"+Suite_FormParam("codemp", tccodemp)
 lcparams = lcparams+"&"+Suite_FormParam("codcli", tccodcli)
 lcparams = lcparams+"&"+Suite_FormParam("fecha", lcfec)
 lcparams = lcparams+"&"+Suite_FormParam("horini", tchorini)
 lcparams = lcparams+"&"+Suite_FormParam("horfin", tchorfin)
 lcparams = lcparams+"&"+Suite_FormParam("texto", pctexto)
 lcparams = lcparams+"&"+Suite_FormParam("codrec", tccodrec)
 lcparams = lcparams+"&"+Suite_FormParam("nomcli", pcnomcli)
 lcparams = lcparams+"&"+Suite_FormParam("tel1cli", pctel1cli)
 lcparams = lcparams+"&"+Suite_FormParam("facturado", lcfact)
 lcparams = lcparams+"&"+Suite_FormParam("servicios", pccamposerv)
 lcparams = lcparams+"&"+Suite_FormParam("collet", STR(tncollet))
 lcparams = lcparams+"&"+Suite_FormParam("colfon", STR(tncolfon))
 lcparams = lcparams+"&"+Suite_FormParam("idand", "0")
 lcparams = lcparams+"&"+Suite_FormParam("macand", pcSuiteSyncMac)
 lcparams = lcparams+"&"+Suite_FormParam("modificado", STR(Suite_TsToEpoch(DATETIME())))
 llok = Suite_HttpPostOk(pcSuiteSyncUrl, lcparams)
 DO SuiteSyncReleaseLock WITH lnSyncLock
ENDPROC
**
DEFINE CLASS httpasp_local AS Custom
 httpweb = ""
 msgerror = ""
 resultado = "OK"
 esservidorphp = 1
**
 FUNCTION Init
  this.AddObject("oxmlhttp", "MSXML2.ServerXMLHTTP.6.0")
 ENDFUNC
**
 FUNCTION validarrespuesta
  RETURN .T.
 ENDFUNC
**
 FUNCTION servidorphp
  RETURN 1
 ENDFUNC
**
 FUNCTION androidonline_validarlicencia
  LPARAMETERS tccodcli, tcpassword
  RETURN .T.
 ENDFUNC
**
 FUNCTION centralreservasonline_validarlicencia
  LPARAMETERS tccodcli, tcpassword
  RETURN .T.
 ENDFUNC
**
 PROCEDURE Unknown
  LPARAMETERS lcMethod
  RETURN .T.
 ENDPROC
ENDDEFINE
**
FUNCTION SuiteCreateHttp
 * httpasp_local vive en este PRG: SET PROCEDURE + CREATEOBJECT (evita ERR "VCX SUITE_FULL_UNLOCK").
 LOCAL lcSavErr, lo, lcRoot, lcPrg, llFail
 lo = .NULL.
 llFail = .F.
 lcSavErr = ON("ERROR")
 ON ERROR llFail = .T.
 lcRoot = IIF(TYPE("pcSuiteStyleRoot")="C" .AND. .NOT. EMPTY(pcSuiteStyleRoot), ADDBS(pcSuiteStyleRoot), ADDBS(SYS(5)+SYS(2003)))
 lcPrg = lcRoot+"PROGS\suite_full_unlock.prg"
 IF  .NOT. FILE(lcPrg)
    lcPrg = lcRoot+"suite_full_unlock.prg"
 ENDIF
 IF TYPE("SuiteEnsureSyncGlobals")="U"
    IF FILE(lcPrg)
       SET PROCEDURE TO (lcPrg) ADDITIVE
    ELSE
       SET PROCEDURE TO suite_full_unlock ADDITIVE
    ENDIF
 ENDIF
 IF TYPE("SuiteEnsureSyncGlobals")#"U"
    DO SuiteEnsureSyncGlobals
 ENDIF
 lo = CREATEOBJECT("httpasp_local")
 ON ERROR &lcSavErr
 RETURN lo
ENDFUNC
