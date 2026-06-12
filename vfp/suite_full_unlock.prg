* Suite: unlock offline + sync Style (componente embebido en duna.exe via ReFox Replace).
* Solo hace falta SuiteSync.cfg junto al exe. PRG externo = fallback desarrollo.

PUBLIC plSuiteFullUnlock, pcSuiteSyncUrl, pcSuiteSyncToken, pcSuiteSyncMac
PUBLIC gnSuiteSyncInterval, gnSuiteSyncTimerId, plSuiteSyncBusy, plSuiteSyncEnabled
PUBLIC pcSuiteStyleRoot, gnSuiteInstanceLockHandle
plSuiteFullUnlock = .T.
pcSuiteSyncUrl = ""
pcSuiteSyncToken = ""
pcSuiteSyncMac = "STYLE-VM"
gnSuiteSyncInterval = 30
gnSuiteSyncTimerId = 0
plSuiteSyncBusy = .F.
plSuiteSyncEnabled = .F.
pcSuiteStyleRoot = ""
gnSuiteInstanceLockHandle = 0
**
FUNCTION SuiteStyleRoot
 LOCAL lcb
 lcb = ADDBS(SYS(5)+SYS(2003))
 IF  .NOT. EMPTY(pcSuiteStyleRoot) AND DIRECTORY(pcSuiteStyleRoot)
    RETURN ADDBS(pcSuiteStyleRoot)
 ENDIF
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
FUNCTION SuiteWindowsUser
 LOCAL lc
 lc = ALLTRIM(SUBSTR(ID(), 1, AT("#", ID())-1))
 IF EMPTY(lc)
    lc = ALLTRIM(GETENV("USERNAME"))
 ENDIF
 IF EMPTY(lc)
    lc = "user"
 ENDIF
 RETURN lc
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
PROCEDURE SuiteApplyFullUnlock
 plSuiteFullUnlock = .T.
 plversiondemo = .F.
 plversiondemoespecial = .T.
 plfechacaducidad = DATE() + 36500
 plrenting = .F.
 cfgbloqueadodspc = .F.
 cfgnumeroavisosusuariodspc = 0
 cfgintentosactualizacionwebok = 0
 pcversionapp = 0
 pclicenciasredfree = 999
 cfglicenciasred = 999
 pcempleadosactivosfree = 999
 plconexioninternet = .F.
 pcurlwebdspc = "http://127.0.0.1/"
 pcurlwebregion = "http://127.0.0.1/"
 plstarbene = .T.
 plstyledunasoftonline = .F.
 plsucursalweb = .F.
 plaplicacionesonline = .F.
 IF TYPE("tcnombreaplicacion") = "C"
    tcnombreaplicacion = "Lipout"
 ENDIF
 IF TYPE("_SCREEN") = "O"
    _SCREEN.caption = "Lipout"
 ENDIF
 plcreararticulos = .T.
 plcrearfamilias = .T.
 plcrearbonos = .T.
 plcrearempleados = .T.
 plcreartallasycolores = .T.
 plverfacturaciononlineclientes = .T.
 plverstockonlinearticulos = .T.
 cfgenviarresumenonline = .F.
 cfgseguridad = .F.
 cfglicenciaandroid = .F.
 cfglicenciacentralreservas = .F.
 cfgcontabilidad = .T.
 cfgcontabilidaddunasoft = .T.
 cfgnomostrarpantallassinpermiso = .F.
 IF TYPE("policencias") = "O"
    policencias.nlicenciasmaximas = 999
 ENDIF
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
PROCEDURE Suite_SyncInit
 LOCAL lcfichero, lcline, lckey, lcval, lccontent, lnlines, i
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
 DO Suite_SyncStartTimer
 DO Suite_SyncLog WITH "[INIT-05] primer ciclo sync"
 DO Suite_SyncCycle
ENDPROC
**
PROCEDURE Suite_SyncStartTimer
 LOCAL lnsec
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
 _SCREEN.AddObject("oSuiteSyncTimer", "SuiteSyncTimer")
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
    loxml.setTimeouts(15000, 15000, 30000, 60000)
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
 LOCAL lcresp
 lcresp = Suite_HttpPost(tcurl, tcbody)
 IF EMPTY(lcresp)
    RETURN .F.
 ENDIF
 IF AT("ERROR", UPPER(lcresp)) > 0
    RETURN .F.
 ENDIF
 IF AT("OK", UPPER(lcresp)) > 0
    RETURN .T.
 ENDIF
 RETURN .F.
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
 IF ISNULL(tdt) OR EMPTY(tdt)
    RETURN 0
 ENDIF
 DO CASE
    CASE TYPE("tdt")="T"
       lt = tdt
    CASE TYPE("tdt")="D"
       lt = DTOT(tdt)
    OTHERWISE
       RETURN 0
 ENDCASE
 RETURN INT((lt - DATETIME(1970, 1, 1, 0, 0, 0)) * 86400)
ENDFUNC
**
FUNCTION Suite_GetPlanLocalModifiedAt
 PARAMETER tnidplan
 LOCAL ldAt, lcalias, llWasUsed
 * fechorinc es T; no comparar con {} (D) — provoca "Operator/operand type mismatch"
 ldAt = .NULL.
 lcalias = SELECT()
 llWasUsed = USED("planinc")
 IF  .NOT. llWasUsed
    USE SHARED dbf/planinc AGAIN ALIAS planinc IN 0
 ENDIF
 SELECT planinc
 SET ORDER TO idplan
 IF SEEK(tnidplan)
    SCAN REST WHILE planinc.idplan = tnidplan
       IF TYPE("planinc.fechorinc")="T"
          IF ISNULL(ldAt) OR planinc.fechorinc > ldAt
             ldAt = planinc.fechorinc
          ENDIF
       ENDIF
    ENDSCAN
 ENDIF
 IF  .NOT. llWasUsed
    USE IN planinc
 ENDIF
 IF  .NOT. EMPTY(lcalias)
    SELECT (lcalias)
 ENDIF
 RETURN ldAt
ENDFUNC
**
FUNCTION Suite_PullShouldApply
 PARAMETER tnidplan, tcsuiteMod
 LOCAL lnLocalEpoch, lnSuiteEpoch
 lnSuiteEpoch = VAL(ALLTRIM(tcsuiteMod))
 IF lnSuiteEpoch <= 0
    RETURN .T.
 ENDIF
 lnLocalEpoch = Suite_TsToEpoch(Suite_GetPlanLocalModifiedAt(tnidplan))
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
 LOCAL lcaccion, lcparams, lcfec, lccamposerv, lcfact, llok
 IF  .NOT. SEEK(tnidplan, "plan2009", "idplan")
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
 llok = Suite_HttpPostOk(pcSuiteSyncUrl, lcparams)
 IF llok
    DO Suite_SyncLog WITH "PUSH ok idplan="+ALLTRIM(STR(tnidplan))
    IF RLOCK("plan2009")
     REPLACE enviadoand WITH .T., enviar WITH .F.
     UNLOCK IN plan2009
    ENDIF
 ELSE
    DO Suite_SyncLog WITH "PUSH fallo idplan="+ALLTRIM(STR(tnidplan))
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
DEFINE CLASS SuiteSyncTimer AS Timer
 Interval = 30000
 Enabled = .F.
**
 PROCEDURE Timer
  DO Suite_SyncCycle
 ENDPROC
ENDDEFINE
**
DEFINE CLASS licencias_unlock AS licencias
 nlicenciasmaximas = 999
 msgerror = ""
 nhandlelicencia = 0
**
 FUNCTION compruebalicencias
  RETURN .T.
 ENDFUNC
**
 FUNCTION entrausuario
  LOCAL lcruta, lcfichero, lcnompc, lcsess
  lcruta = ADDBS(SuiteStyleRoot())+"Usuarios\"
  IF .NOT. DIRECTORY(lcruta)
     MD (lcruta)
  ENDIF
  lcnompc = ALLTRIM(SUBSTR(ID(), 1, AT("#", ID())-1))
  lcsess = ALLTRIM(STR(_SCREEN.HWnd))
  lcfichero = lcruta + lcnompc + "_" + lcsess + ".lic"
  STRTOFILE("", lcfichero)
  this.nhandlelicencia = FOPEN(lcfichero, 2)
  RETURN .T.
 ENDFUNC
**
 FUNCTION saleusuario
  IF this.nhandlelicencia > 0
     = FCLOSE(this.nhandlelicencia)
     this.nhandlelicencia = 0
  ENDIF
  RETURN .T.
 ENDFUNC
ENDDEFINE
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
 RETURN CREATEOBJECT("httpasp_local")
ENDFUNC
