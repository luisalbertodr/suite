* suite_reservas_sync.prg — sync embebido en suite_full_unlock.prg; este fichero es copia opcional.
* Multisesion: candado _suite_sync.lock entre procesos.

PUBLIC pcSuiteSyncUrl, pcSuiteSyncToken, pcSuiteSyncMac, gnSuiteSyncInterval, gnSuiteSyncTimerId
PUBLIC plSuiteSyncBusy, plSuiteSyncEnabled

pcSuiteSyncUrl = ""
pcSuiteSyncToken = ""
pcSuiteSyncMac = "STYLE-VM"
gnSuiteSyncInterval = 30
gnSuiteSyncTimerId = 0
plSuiteSyncBusy = .F.
plSuiteSyncEnabled = .F.

**
FUNCTION SuiteSyncTryLock
 LOCAL lcf, lh, lcb
 lcb = ADDBS(SYS(5)+SYS(2003))
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
PROCEDURE Suite_SyncInit
 LOCAL lcfichero, lcline, lckey, lcval, lccontent, lnlines, i
 lcfichero = ADDBS(SYS(5)+SYS(2003))+"SuiteSync.cfg"
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
    RETURN
 ENDIF
 plSuiteSyncEnabled = .T.
 DO Suite_SyncStartTimer
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
 LOCAL loxml, lcresp
 loxml = CREATEOBJECT("MSXML2.ServerXMLHTTP.6.0")
 loxml.open("POST", tcurl, .F.)
 loxml.setRequestHeader("Content-Type", "application/x-www-form-urlencoded")
 loxml.send(tcbody)
 lcresp = loxml.responseText
 loxml = .NULL.
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
    RETURN
 ENDIF
 plSuiteSyncBusy = .T.
 TRY
    DO Suite_SyncPull
    DO Suite_SyncPush
 CATCH TO oerr
 ENDTRY
 plSuiteSyncBusy = .F.
 DO SuiteSyncReleaseLock WITH lnSyncLock
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
 CREATE CURSOR cResPull (idplan N(10), idand N(15), macand C(30), codemp C(15), codcli C(15), fecha D, horini C(5), horfin C(5), texto C(250), codrec C(15), nomcli C(80), tel1cli C(20), facturado C(2), servicios M, pendiente C(2), eliminar C(2), collet C(20), colfon C(20))
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
