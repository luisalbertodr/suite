* Suite: unlock offline + sync Style embebido (un solo PRG externo).
* Copiar a la raiz Style-Dunasoft junto a duna.exe y SuiteSync.cfg

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
FUNCTION SuiteSyncPrgPath
 LOCAL lcb, lcsync
 lcb = SuiteStyleRoot()
 SET DEFAULT TO (lcb)
 SET PATH TO (lcb) ADDITIVE
 SET PATH TO (lcb+"PROGS") ADDITIVE
 lcsync = FULLPATH("suite_reservas_sync.prg")
 IF  .NOT. EMPTY(lcsync) AND FILE(lcsync)
    RETURN lcsync
 ENDIF
 RETURN ""
ENDFUNC
**
FUNCTION SuiteSyncEnsureLoaded
 LOCAL lcb, lcUnlock, lcsync
 IF TYPE("Suite_SyncInit")#"U"
    RETURN .T.
 ENDIF
 lcb = SuiteStyleRoot()
 lcUnlock = lcb+"suite_full_unlock.prg"
 IF  .NOT. FILE(lcUnlock)
    lcUnlock = lcb+"PROGS\suite_full_unlock.prg"
 ENDIF
 IF FILE(lcUnlock)
    SET PROCEDURE TO (lcUnlock) ADDITIVE
    IF TYPE("Suite_SyncInit")#"U"
       RETURN .T.
    ENDIF
 ENDIF
 lcsync = SuiteSyncPrgPath()
 IF  .NOT. EMPTY(lcsync)
    SET PROCEDURE TO (lcsync) ADDITIVE
 ENDIF
 RETURN TYPE("Suite_SyncInit")#"U"
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
    = SuiteSyncEnsureLoaded()
    DO Suite_SyncInit
 CATCH
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
 lcfichero = SuiteStyleRoot()+"SuiteSync.cfg"
 IF  .NOT. FILE(lcfichero)
    lcfichero = ADDBS(SYS(5)+SYS(2003))+"SuiteSync.cfg"
 ENDIF
 IF FILE(lcfichero)
    lccontent = FILETOSTR(lcfichero)
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
    DO Suite_SyncLog WITH "INIT fallo: falta SYNC_URL o SYNC_TOKEN en "+lcfichero
    RETURN
 ENDIF
 plSuiteSyncEnabled = .T.
 DO Suite_SyncLog WITH "INIT ok url="+pcSuiteSyncUrl+" cfg="+lcfichero
 DO Suite_SyncStartTimer
 DO Suite_SyncCycle
ENDPROC
**
PROCEDURE Suite_SyncStartTimer
 IF  .NOT. plSuiteSyncEnabled
    RETURN
 ENDIF
 IF gnSuiteSyncTimerId > 0
    RETURN
 ENDIF
 IF TYPE("_SCREEN.oSuiteSyncTimer") = "O"
    _SCREEN.oSuiteSyncTimer.Interval = MAX(gnSuiteSyncInterval, 15) * 1000
    _SCREEN.oSuiteSyncTimer.Enabled = .T.
    gnSuiteSyncTimerId = 1
    RETURN
 ENDIF
 _SCREEN.AddObject("oSuiteSyncTimer", "SuiteSyncTimer")
 _SCREEN.oSuiteSyncTimer.Interval = MAX(gnSuiteSyncInterval, 15) * 1000
 _SCREEN.oSuiteSyncTimer.Enabled = .T.
 gnSuiteSyncTimerId = 1
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
 LOCAL lccamposerv, lcalias
 lcalias = ALIAS()
 lccamposerv = ""
 IF USED("planart")
    SELECT planart
    SET ORDER TO idplan
    IF SEEK(STR(tnidplan, 10))
       SCAN REST WHILE planart.idplan = tnidplan
          lccamposerv = lccamposerv + ALLTRIM(planart.codart) + ALLTRIM(planart.hora) + CHR(13)
       ENDSCAN
    ENDIF
 ENDIF
 IF  .NOT. EMPTY(lcalias)
    SELECT (lcalias)
 ENDIF
 RETURN lccamposerv
ENDFUNC
**
FUNCTION Suite_TsToEpoch
 PARAMETER tdt
 IF EMPTY(tdt) OR TYPE("tdt")#"T"
    RETURN 0
 ENDIF
 RETURN INT((tdt - DATETIME(1970, 1, 1, 0, 0, 0)) * 86400)
ENDFUNC
**
FUNCTION Suite_GetPlanLocalModifiedAt
 PARAMETER tnidplan
 LOCAL ldAt, lcalias, llWasUsed
 ldAt = {}
 lcalias = SELECT()
 llWasUsed = USED("planinc")
 IF  .NOT. llWasUsed
    USE SHARED dbf/planinc AGAIN ALIAS planinc IN 0
 ENDIF
 SELECT planinc
 SET ORDER TO idplan
 IF SEEK(tnidplan)
    SCAN REST WHILE planinc.idplan = tnidplan
       IF TYPE("planinc.fechorinc")="T" AND planinc.fechorinc > ldAt
          ldAt = planinc.fechorinc
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
 LOCAL lcparams, lcresp, llok, lohttp, lcalias
 LOCAL lnidplan, lnidand, lcfec, lcfact, lcelim
 IF  .NOT. plSuiteSyncEnabled
    RETURN
 ENDIF
 lcparams = "id="+ALLTRIM(pcSuiteSyncToken)+"&tag=stylegetreservas"
 lcresp = Suite_HttpPost(pcSuiteSyncUrl, lcparams)
 IF EMPTY(lcresp)
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
    lcparams = "id="+ALLTRIM(pcSuiteSyncToken)+"&tag=stylereservaok"
    lcparams = lcparams+"&macand="+ALLTRIM(cResPull.macand)
    lcparams = lcparams+"&idand="+ALLTRIM(STR(lnidand))
    lcparams = lcparams+"&idplan="+ALLTRIM(STR(lnidplan))
    lcparams = lcparams+"&reservaok=SI"
    =Suite_HttpPostOk(pcSuiteSyncUrl, lcparams)
 ENDSCAN
 USE IN cResPull
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
 lcparams = "id="+ALLTRIM(pcSuiteSyncToken)+"&tag=stylereservas"
 lcparams = lcparams+"&accion="+lcaccion
 lcparams = lcparams+"&idplan="+ALLTRIM(STR(plan2009.idplan))
 lcparams = lcparams+"&codemp="+ALLTRIM(plan2009.codemp)
 lcparams = lcparams+"&codcli="+ALLTRIM(plan2009.codcli)
 lcparams = lcparams+"&fecha="+lcfec
 lcparams = lcparams+"&horini="+ALLTRIM(plan2009.horini)
 lcparams = lcparams+"&horfin="+ALLTRIM(plan2009.horfin)
 lcparams = lcparams+"&texto="+ALLTRIM(plan2009.texto)
 lcparams = lcparams+"&codrec="+ALLTRIM(plan2009.codrec)
 lcparams = lcparams+"&nomcli="+ALLTRIM(plan2009.nomcli)
 lcparams = lcparams+"&tel1cli="+ALLTRIM(plan2009.tel1cli)
 lcparams = lcparams+"&facturado="+lcfact
 lcparams = lcparams+"&servicios="+ALLTRIM(lccamposerv)
 lcparams = lcparams+"&collet="+ALLTRIM(STR(plan2009.collet))
 lcparams = lcparams+"&colfon="+ALLTRIM(STR(plan2009.colfon))
 lcparams = lcparams+"&idand="+ALLTRIM(STR(plan2009.idand))
 lcparams = lcparams+"&macand="+ALLTRIM(pcSuiteSyncMac)
 lcparams = lcparams+"&modificado="+ALLTRIM(STR(Suite_TsToEpoch(Suite_GetPlanLocalModifiedAt(tnidplan))))
 llok = Suite_HttpPostOk(pcSuiteSyncUrl, lcparams)
 IF llok
    IF RLOCK("plan2009")
     REPLACE enviadoand WITH .T., enviar WITH .F.
     UNLOCK IN plan2009
    ENDIF
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
 lcparams = "id="+ALLTRIM(pcSuiteSyncToken)+"&tag=stylereservas"
 lcparams = lcparams+"&accion=BORRAR"
 lcparams = lcparams+"&idplan="+ALLTRIM(STR(tnidplan))
 lcparams = lcparams+"&codemp="+ALLTRIM(tccodemp)
 lcparams = lcparams+"&codcli="+ALLTRIM(tccodcli)
 lcparams = lcparams+"&fecha="+lcfec
 lcparams = lcparams+"&horini="+ALLTRIM(tchorini)
 lcparams = lcparams+"&horfin="+ALLTRIM(tchorfin)
 lcparams = lcparams+"&texto="+ALLTRIM(pctexto)
 lcparams = lcparams+"&codrec="+ALLTRIM(tccodrec)
 lcparams = lcparams+"&nomcli="+ALLTRIM(pcnomcli)
 lcparams = lcparams+"&tel1cli="+ALLTRIM(pctel1cli)
 lcparams = lcparams+"&facturado="+lcfact
 lcparams = lcparams+"&servicios="+ALLTRIM(pccamposerv)
 lcparams = lcparams+"&collet="+ALLTRIM(STR(tncollet))
 lcparams = lcparams+"&colfon="+ALLTRIM(STR(tncolfon))
 lcparams = lcparams+"&idand=0"
 lcparams = lcparams+"&macand="+ALLTRIM(pcSuiteSyncMac)
 lcparams = lcparams+"&modificado="+ALLTRIM(STR(Suite_TsToEpoch(DATETIME())))
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
