* Worker inbound Suite -> Style (VFP9).
* Lee JSON en sync\inbound\*.json, aplica a plan2009/planart y genera ack en sync\inbound_ack\{queue_id}.ok

FUNCTION SuiteInboundRoot
 LOCAL lcRoot
 lcRoot = ""
 IF TYPE("pcSuiteStyleRoot")="C" .AND. .NOT. EMPTY(pcSuiteStyleRoot)
    lcRoot = ADDBS(pcSuiteStyleRoot)
 ENDIF
 IF EMPTY(lcRoot)
    lcRoot = ADDBS(SYS(5)+SYS(2003))
 ENDIF
 RETURN lcRoot
ENDFUNC

PROCEDURE SuiteInboundEnsureWedb
 PARAMETER tcRoot
 LOCAL lcDbfRoot, lcSav, lcErr
 IF EMPTY(tcRoot)
    RETURN
 ENDIF
 lcDbfRoot = ADDBS(tcRoot) + "dbf\"
 IF  .NOT. FILE(lcDbfRoot + "wedb.dbc")
    RETURN
 ENDIF
 SET DEFAULT TO (ADDBS(tcRoot))
 SET EXCLUSIVE OFF
 IF DIRECTORY(lcDbfRoot)
    SET PATH TO (lcDbfRoot) ADDITIVE
 ENDIF
 lcSav = ON("ERROR")
 lcErr = ""
 ON ERROR lcErr = MESSAGE()
 IF  .NOT. DBUSED("wedb")
    OPEN DATABASE (lcDbfRoot + "wedb") SHARED
 ENDIF
 ON ERROR &lcSav
 IF  .NOT. EMPTY(lcErr)
    DO SuiteInboundLog WITH "wedb SHARED fail: "+lcErr
 ENDIF
ENDPROC

FUNCTION SuiteInboundOpenTable
 PARAMETER tcTable
 LOCAL lcRoot, lcPath, lcSav, lcErr
 lcRoot = SuiteInboundRoot()
 DO SuiteInboundEnsureWedb WITH lcRoot
 IF USED(tcTable)
    RETURN .T.
 ENDIF
 lcPath = lcRoot + "dbf\" + ALLTRIM(tcTable) + ".dbf"
 lcSav = ON("ERROR")
 lcErr = ""
 ON ERROR lcErr = MESSAGE()
 IF FILE(lcPath)
    USE (lcPath) IN 0 SHARED ALIAS (tcTable)
 ELSE
    USE SHARED ("dbf/" + tcTable) AGAIN IN 0 ALIAS (tcTable)
 ENDIF
 ON ERROR &lcSav
 IF  .NOT. EMPTY(lcErr)
    DO SuiteInboundLog WITH "open "+tcTable+" fail: "+lcErr
    RETURN .F.
 ENDIF
 RETURN USED(tcTable)
ENDFUNC

FUNCTION SuiteJsonParse
 PARAMETER tcJson
 LOCAL loSC, loObj, lcSav, llFail
 loObj = .NULL.
 IF EMPTY(NVL(tcJson, ""))
    RETURN .NULL.
 ENDIF
 llFail = .F.
 lcSav = ON("ERROR")
 ON ERROR llFail = .T.
 loSC = CREATEOBJECT("MSScriptControl.ScriptControl")
 loSC.Language = "JScript"
 loObj = loSC.Eval("(" + tcJson + ")")
 ON ERROR &lcSav
 IF llFail
    RETURN .NULL.
 ENDIF
 RETURN loObj
ENDFUNC

FUNCTION SuiteGetObj
 PARAMETER toObj, tcKey, tcDefault
 LOCAL lc
 lc = tcDefault
 IF TYPE("toObj")#"O"
    RETURN tcDefault
 ENDIF
 IF TYPE("toObj."+tcKey)="U"
    RETURN tcDefault
 ENDIF
 lc = TRANSFORM(EVALUATE("toObj."+tcKey))
 IF EMPTY(lc)
    RETURN tcDefault
 ENDIF
 RETURN lc
ENDFUNC

FUNCTION SuiteGetObjNum
 PARAMETER toObj, tcKey, tnDefault
 LOCAL lc
 lc = SuiteGetObj(toObj, tcKey, "")
 IF EMPTY(lc)
    RETURN tnDefault
 ENDIF
 RETURN VAL(ALLTRIM(lc))
ENDFUNC

FUNCTION SuiteGetObjBoolSi
 PARAMETER toObj, tcKey
 LOCAL lc
 lc = UPPER(ALLTRIM(SuiteGetObj(toObj, tcKey, "NO")))
 RETURN (lc=="SI" .OR. lc=="Y" .OR. lc=="T" .OR. lc=="TRUE")
ENDFUNC

FUNCTION Suite_ParseServiciosToPlanart_Local
 PARAMETER tnidplan, tcservicios, tchorini
 LOCAL lcline, lccodart, lchora, lcalias
 lcalias = ALIAS()
 IF EMPTY(NVL(tcservicios, ""))
    IF  .NOT. EMPTY(lcalias)
       SELECT (lcalias)
    ENDIF
    RETURN .T.
 ENDIF
 IF  .NOT. USED("planart")
    IF  .NOT. SuiteInboundOpenTable("planart")
       IF  .NOT. EMPTY(lcalias)
          SELECT (lcalias)
       ENDIF
       RETURN .F.
    ENDIF
 ENDIF
 SELECT planart
 SET ORDER TO idplan
 tcservicios = CHRTRAN(tcservicios, CHR(10), CHR(13))
 DO WHILE  .NOT. EMPTY(tcservicios)
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

PROCEDURE SuiteInboundLog
 PARAMETER tcMsg
 LOCAL lcLog
 lcLog = SuiteInboundRoot() + "sync\inbound_worker.log"
 STRTOFILE(TTOC(DATETIME()) + " " + ALLTRIM(tcMsg) + CHR(13), lcLog, .T.)
ENDPROC

#DEFINE WORKER_VERSION "1.1.1"

FUNCTION SuiteInboundFileAgeSec
 PARAMETER tcFile
 LOCAL la[1], lnN, ltMod, ltNow, ldD, lnT, lcT
 lnN = ADIR(la, tcFile)
 IF lnN < 1
    RETURN 0
 ENDIF
 ltNow = DATETIME()
 ldD = la(1, 3)
 lnT = la(1, 4)
 DO CASE
    CASE VARTYPE(ldD) = "D" .AND. VARTYPE(lnT) = "C" .AND. !EMPTY(lnT)
       ltMod = DATETIME(ldD, lnT)
    CASE VARTYPE(ldD) = "D" .AND. VARTYPE(lnT) = "N"
       ltMod = ldD + (lnT / 86400)
    CASE VARTYPE(ldD) = "T"
       ltMod = ldD
    OTHERWISE
       RETURN 0
 ENDCASE
 RETURN MAX(0, INT((ltNow - ltMod) * 86400))
ENDFUNC

PROCEDURE SuiteInboundHeartbeat
 LOCAL lcHb, lcSync
 lcSync = SuiteInboundRoot() + "sync\"
 IF  .NOT. DIRECTORY(lcSync)
    MD (lcSync)
 ENDIF
 lcHb = lcSync + "heartbeat.txt"
 STRTOFILE(TTOC(DATETIME())+"|worker="+WORKER_VERSION+CHR(13), lcHb, .F.)
ENDPROC

FUNCTION SuiteLoadControlSync
 LOCAL lcPrg
 lcPrg = SuiteInboundRoot()+"PROGS\suite_control_sync.prg"
 IF FILE(lcPrg)
    SET PROCEDURE TO (lcPrg) ADDITIVE
    RETURN .T.
 ENDIF
 RETURN .F.
ENDFUNC

PROCEDURE SuiteLoadEntityInbound
 * Carga el dispatcher de entidades (clientes, articulos, ...) si no esta ya compilado.
 LOCAL lcPrg
 IF TYPE("SuiteEntityApplyOne") <> "U"
    RETURN
 ENDIF
 lcPrg = SuiteInboundRoot()+"PROGS\suite_entity_inbound.prg"
 IF FILE(lcPrg)
    SET PROCEDURE TO (lcPrg) ADDITIVE
 ENDIF
ENDPROC

FUNCTION SuitePlanFieldExists
 PARAMETER tcAlias, tcField
 IF  .NOT. USED(tcAlias)
    RETURN .F.
 ENDIF
 * FIELD() espera numero de campo; para comprobar por NOMBRE usamos TYPE("alias.campo").
 RETURN (TYPE(tcAlias + "." + ALLTRIM(tcField)) <> "U")
ENDFUNC

PROCEDURE SuiteEnsurePlan2009SyncVersion
 IF  .NOT. USED("plan2009")
    RETURN
 ENDIF
 IF SuitePlanFieldExists("plan2009", "sync_version")
    RETURN
 ENDIF
 * ALTER TABLE exige acceso exclusivo; el worker corre con plan2009 compartido (coexiste con Style).
 * Si no se puede anadir la columna (tabla compartida), el LWW usa idand como fallback. La columna
 * sync_version debe anadirse una vez de forma exclusiva en la preparacion del cutover.
 SELECT plan2009
 TRY
    ALTER TABLE plan2009 ADD COLUMN sync_version N(15, 0)
 CATCH
 ENDTRY
ENDPROC

FUNCTION SuiteGetPlanSyncVersion
 PARAMETER tnIdPlan
 LOCAL lnVer, lcalias
 lcalias = SELECT()
 lnVer = 0
 IF  .NOT. USED("plan2009")
    RETURN 0
 ENDIF
 SELECT plan2009
 SET ORDER TO idplan
 IF SEEK(tnIdPlan)
    IF SuitePlanFieldExists("plan2009", "sync_version")
       lnVer = NVL(plan2009.sync_version, 0)
    ELSE
       IF SuitePlanFieldExists("plan2009", "idand")
          lnVer = NVL(plan2009.idand, 0)
       ENDIF
    ENDIF
 ENDIF
 IF  .NOT. EMPTY(lcalias)
    SELECT (lcalias)
 ENDIF
 RETURN lnVer
ENDFUNC

FUNCTION SuiteInboundResolveVersion
 PARAMETER toMsg
 LOCAL lnVer
 lnVer = SuiteGetObjNum(toMsg, "version", 0)
 IF lnVer <= 0
    lnVer = VAL(ALLTRIM(SuiteGetObj(toMsg, "modificado", "0")))
 ENDIF
 RETURN lnVer
ENDFUNC

FUNCTION SuiteInboundShouldApply
 PARAMETER tnIdPlan, tnIncomingVer, llDelete
 LOCAL lnLocal, llExists
 lnLocal = SuiteGetPlanSyncVersion(tnIdPlan)
 llExists = .F.
 IF USED("plan2009")
    SELECT plan2009
    SET ORDER TO idplan
    llExists = SEEK(tnIdPlan)
 ENDIF
 IF  .NOT. llExists
    RETURN .T.
 ENDIF
 IF tnIncomingVer <= 0
    RETURN .T.
 ENDIF
 RETURN (tnIncomingVer > lnLocal)
ENDFUNC

FUNCTION SuiteApplyServiciosFromPayload
 PARAMETER tnidplan, tcservicios, tchorini
 LOCAL loArr, lnI, lnN, lccod, lchora, lcalias
 lcalias = ALIAS()
 tcservicios = ALLTRIM(NVL(tcservicios, ""))
 IF EMPTY(tcservicios)
    RETURN .T.
 ENDIF
 IF LEFT(tcservicios, 1)=="["
    loArr = SuiteJsonParse(tcservicios)
    IF TYPE("loArr")="O"
       lnN = 0
       TRY
          lnN = loArr.length
       CATCH
          lnN = 0
       ENDTRY
       FOR lnI = 0 TO lnN-1
          lccod = ""
          lchora = tchorini
          TRY
             lccod = TRANSFORM(loArr(lnI).servicio)
             IF TYPE("loArr(lnI).hora")#"U"
                lchora = TRANSFORM(loArr(lnI).hora)
             ENDIF
          CATCH
          ENDTRY
          IF  .NOT. EMPTY(ALLTRIM(lccod))
             IF  .NOT. USED("planart")
                = SuiteInboundOpenTable("planart")
             ENDIF
             SELECT planart
             IF RLOCK("0", "planart")
                APPEND BLANK
                REPLACE idplan WITH tnidplan, codart WITH ALLTRIM(lccod), hora WITH ALLTRIM(lchora)
                UNLOCK IN planart
             ENDIF
          ENDIF
       ENDFOR
       IF  .NOT. EMPTY(lcalias)
          SELECT (lcalias)
       ENDIF
       RETURN .T.
    ENDIF
 ENDIF
 RETURN Suite_ParseServiciosToPlanart_Local(tnidplan, tcservicios, tchorini)
ENDFUNC

PROCEDURE SuiteInboundWriteAck
 PARAMETER lnQueueId, lnidand, lnidplan, lcMac, lnIncomingVer, llApplied, tcAckDir
 LOCAL lcAck
 IF lnQueueId <= 0
    RETURN
 ENDIF
 lcAck = "idand="+ALLTRIM(STR(lnidand))+";idplan="+ALLTRIM(STR(lnidplan))
 lcAck = lcAck+";macand="+lcMac+";ok=1;version="+ALLTRIM(STR(lnIncomingVer))
 lcAck = lcAck+";applied="+IIF(llApplied, "1", "0")
 STRTOFILE(lcAck, ADDBS(tcAckDir)+ALLTRIM(STR(lnQueueId))+".ok", .F.)
ENDPROC

PROCEDURE SuiteInboundApplyOne
 PARAMETER toMsg, tcInboundFile, tcAckDir
 LOCAL lnidplan, lnidand, lcMac, llDelete, ldFecha, lcfact
 LOCAL lchorini, lchorfin, lctexto, lccodemp, lccodcli, lccodrec, lcnomcli, lctel1cli
 LOCAL lnColfon, lnCollet, lcServicios, lnQueueId, lnIncomingVer, llApply, llApplied

 lnidplan = SuiteGetObjNum(toMsg, "idplan", 0)
 lnQueueId = SuiteGetObjNum(toMsg, "queue_id", 0)
 lnidand = SuiteGetObjNum(toMsg, "idand", 0)
 IF lnidand <= 0 .AND. lnQueueId > 0
    lnidand = lnQueueId
 ENDIF
 lcMac = ALLTRIM(SuiteGetObj(toMsg, "macand", "SUITE-STYLE"))
 llDelete = (UPPER(ALLTRIM(SuiteGetObj(toMsg, "eliminar", "NO")))=="SI")
 lnIncomingVer = SuiteInboundResolveVersion(toMsg)
 llApplied = .F.

 lccodemp = ALLTRIM(SuiteGetObj(toMsg, "codemp", ""))
 lccodcli = ALLTRIM(SuiteGetObj(toMsg, "codcli", ""))
 lccodrec = ALLTRIM(SuiteGetObj(toMsg, "codrec", ""))
 lchorini = ALLTRIM(SuiteGetObj(toMsg, "horini", ""))
 lchorfin = ALLTRIM(SuiteGetObj(toMsg, "horfin", ""))
 lctexto = LEFT(ALLTRIM(SuiteGetObj(toMsg, "texto", "")), 250)
 lcnomcli = ALLTRIM(SuiteGetObj(toMsg, "nomcli", ""))
 lctel1cli = ALLTRIM(SuiteGetObj(toMsg, "tel1cli", ""))
 lnColfon = VAL(ALLTRIM(SuiteGetObj(toMsg, "colfon", "0")))
 lnCollet = VAL(ALLTRIM(SuiteGetObj(toMsg, "collet", "0")))
 lcServicios = SuiteGetObj(toMsg, "servicios", "")
 lcfact = SuiteGetObjBoolSi(toMsg, "facturado")

 ldFecha = {}
 LOCAL lcFechaIso
 lcFechaIso = LEFT(ALLTRIM(SuiteGetObj(toMsg, "fecha", "")), 10)
 IF  .NOT. EMPTY(lcFechaIso)
    * Suite envia ISO yyyy-mm-dd; DATE() es independiente de SET DATE (CTOD fallaba con formato americano).
    IF LEN(lcFechaIso) >= 10 .AND. SUBSTR(lcFechaIso, 5, 1) == "-"
       ldFecha = DATE(VAL(LEFT(lcFechaIso, 4)), VAL(SUBSTR(lcFechaIso, 6, 2)), VAL(SUBSTR(lcFechaIso, 9, 2)))
    ELSE
       ldFecha = CTOD(lcFechaIso)
    ENDIF
 ENDIF

 IF  .NOT. USED("plan2009")
    IF  .NOT. SuiteInboundOpenTable("plan2009")
       RETURN
    ENDIF
 ENDIF
 DO SuiteEnsurePlan2009SyncVersion

 llApply = SuiteInboundShouldApply(lnidplan, lnIncomingVer, llDelete)
 IF  .NOT. llApply
    DO SuiteInboundLog WITH "LWW skip idplan="+ALLTRIM(STR(lnidplan))+" in="+ALLTRIM(STR(lnIncomingVer))
    DO SuiteInboundWriteAck WITH lnQueueId, lnidand, lnidplan, lcMac, lnIncomingVer, .F., tcAckDir
    IF FILE(tcInboundFile)
       ERASE (tcInboundFile)
    ENDIF
    RETURN
 ENDIF

 IF  .NOT. USED("planart")
    IF  .NOT. SuiteInboundOpenTable("planart")
       RETURN
    ENDIF
 ENDIF

 SELECT plan2009
 SET ORDER TO idplan
 IF llDelete
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
    IF SEEK(lnidplan)
       IF RLOCK("plan2009")
          REPLACE codemp WITH lccodemp, codcli WITH lccodcli
          IF  .NOT. EMPTY(ldFecha)
             REPLACE fecha WITH ldFecha
          ENDIF
          REPLACE horini WITH lchorini, horfin WITH lchorfin
          REPLACE texto WITH lctexto, codrec WITH lccodrec
          REPLACE nomcli WITH lcnomcli, tel1cli WITH lctel1cli
          REPLACE colfon WITH lnColfon, collet WITH lnCollet
          REPLACE facturado WITH lcfact
          IF SuitePlanFieldExists("plan2009", "idand")
             REPLACE idand WITH lnidand
          ENDIF
          IF SuitePlanFieldExists("plan2009", "macand")
             REPLACE macand WITH lcMac
          ENDIF
          IF SuitePlanFieldExists("plan2009", "enviadoand")
             REPLACE enviadoand WITH .T.
          ENDIF
          IF SuitePlanFieldExists("plan2009", "enviar")
             REPLACE enviar WITH .F.
          ENDIF
          IF SuitePlanFieldExists("plan2009", "sync_version")
             REPLACE sync_version WITH lnIncomingVer
          ENDIF
          UNLOCK IN plan2009
          llApplied = .T.
       ENDIF
    ELSE
       IF RLOCK("0", "plan2009")
          APPEND BLANK
          REPLACE idplan WITH lnidplan
          REPLACE codemp WITH lccodemp, codcli WITH lccodcli
          IF  .NOT. EMPTY(ldFecha)
             REPLACE fecha WITH ldFecha
          ENDIF
          REPLACE horini WITH lchorini, horfin WITH lchorfin
          REPLACE texto WITH lctexto, codrec WITH lccodrec
          REPLACE nomcli WITH lcnomcli, tel1cli WITH lctel1cli
          REPLACE colfon WITH lnColfon, collet WITH lnCollet
          REPLACE facturado WITH lcfact
          IF SuitePlanFieldExists("plan2009", "idand")
             REPLACE idand WITH lnidand
          ENDIF
          IF SuitePlanFieldExists("plan2009", "macand")
             REPLACE macand WITH lcMac
          ENDIF
          IF SuitePlanFieldExists("plan2009", "enviadoand")
             REPLACE enviadoand WITH .T.
          ENDIF
          IF SuitePlanFieldExists("plan2009", "enviar")
             REPLACE enviar WITH .F.
          ENDIF
          IF SuitePlanFieldExists("plan2009", "sync_version")
             REPLACE sync_version WITH lnIncomingVer
          ENDIF
          UNLOCK IN plan2009
          llApplied = .T.
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
    = SuiteApplyServiciosFromPayload(lnidplan, lcServicios, lchorini)
 ENDIF

 * ACK siempre (recibido y procesado; LWW skip ya retorno arriba)
 DO SuiteInboundWriteAck WITH lnQueueId, lnidand, lnidplan, lcMac, lnIncomingVer, llApplied, tcAckDir

 IF FILE(tcInboundFile)
    ERASE (tcInboundFile)
 ENDIF
ENDPROC

PROCEDURE SuiteInboundRecycleFailed
 LOCAL lcFailed, lcInbound, lnN, lnI, lcFile, lcDest, lnAgeSec
 LOCAL ARRAY laFiles[1]
 TRY
 lcFailed = SuiteInboundRoot() + "sync\archive\failed\"
 lcInbound = SuiteInboundRoot() + "sync\inbound\"
 IF  .NOT. DIRECTORY(lcFailed)
    RETURN
 ENDIF
 lnN = ADIR(laFiles, lcFailed + "*.json")
 FOR lnI = 1 TO lnN
    lcFile = lcFailed + laFiles(lnI, 1)
    lnAgeSec = SuiteInboundFileAgeSec(lcFile)
    IF lnAgeSec < 3600
       LOOP
    ENDIF
    lcDest = lcInbound + laFiles(lnI, 1)
    TRY
       COPY FILE (lcFile) TO (lcDest)
       ERASE (lcFile)
       DO SuiteInboundLog WITH "recycle failed -> inbound: "+laFiles(lnI, 1)
    CATCH
    ENDTRY
 ENDFOR
 CATCH TO oRecycle
    DO SuiteInboundLog WITH "recycle omitido: "+ALLTRIM(oRecycle.Message)
 ENDTRY
ENDPROC

PROCEDURE SuiteInboundWorkerRun
 LOCAL lcRoot, lcInbound, lcAck, lnN, lnI, lcFile, lcJson, loMsg, lcerr, lnCycle
 LOCAL ARRAY laFiles[1]

 SET SAFETY OFF
 SET ESCAPE OFF
 IF UPPER(ALLTRIM(GETENV("SUITE_INBOUND_HEADLESS"))) == "1" ;
    .OR. UPPER(ALLTRIM(GETENV("SUITE_VFP_HEADLESS"))) == "1"
    _SCREEN.Visible = .F.
 ENDIF

 = SuiteLoadControlSync()
 DO SuiteLoadEntityInbound
 IF TYPE("SuiteEnsureControlSincro") <> "U"
    DO SuiteEnsureControlSincro
 ENDIF
 IF TYPE("SuiteSyncModoV2Active") <> "U" .AND. .NOT. SuiteSyncModoV2Active()
    RETURN
 ENDIF

 lcRoot = SuiteInboundRoot()
 * Abrir wedb SHARED (misma logica que general.prg) para coexistir con Duna.exe.
 DO SuiteInboundEnsureWedb WITH lcRoot

 lcInbound = lcRoot + "sync\inbound\"
 lcAck = lcRoot + "sync\inbound_ack\"
 IF  .NOT. DIRECTORY(lcRoot + "sync\")
    MD (lcRoot + "sync\")
 ENDIF
 DO SuiteInboundHeartbeat
 IF  .NOT. DIRECTORY(lcInbound)
    MD (lcInbound)
 ENDIF
 IF  .NOT. DIRECTORY(lcAck)
    MD (lcAck)
 ENDIF

 lnCycle = 0
 IF FILE(lcRoot + "sync\worker_cycle.txt")
    lnCycle = VAL(FILETOSTR(lcRoot + "sync\worker_cycle.txt"))
 ENDIF
 lnCycle = lnCycle + 1
 STRTOFILE(ALLTRIM(STR(lnCycle)), lcRoot + "sync\worker_cycle.txt", .F.)
 IF MOD(lnCycle, 100) = 0
    DO SuiteInboundRecycleFailed
 ENDIF

 lnN = ADIR(laFiles, lcInbound + "*.json")
 IF lnN <= 0
    RETURN
 ENDIF

 FOR lnI = 1 TO lnN
    lcFile = lcInbound + laFiles(lnI, 1)
    IF  .NOT. FILE(lcFile)
       LOOP
    ENDIF
    lcJson = FILETOSTR(lcFile)
    loMsg = SuiteJsonParse(lcJson)
    IF TYPE("loMsg")#"O"
       DO SuiteInboundLog WITH "JSON invalido: "+lcFile
       LOOP
    ENDIF
    lcerr = ""
    LOCAL lcEType
    lcEType = LOWER(ALLTRIM(SuiteGetObj(loMsg, "entity_type", "")))
    TRY
       IF  .NOT. EMPTY(lcEType) .AND. lcEType <> "plan2009"
          DO SuiteEntityApplyOne WITH loMsg, lcFile, lcAck
       ELSE
          DO SuiteInboundApplyOne WITH loMsg, lcFile, lcAck
       ENDIF
    CATCH TO oerr
       lcerr = ALLTRIM(oerr.message)
       DO SuiteInboundLog WITH "error "+lcFile+": "+lcerr
    ENDTRY
 ENDFOR
 IF UPPER(ALLTRIM(GETENV("SUITE_INBOUND_HEADLESS"))) == "1" ;
    .OR. UPPER(ALLTRIM(GETENV("SUITE_VFP_HEADLESS"))) == "1"
    QUIT
 ENDIF
ENDPROC

