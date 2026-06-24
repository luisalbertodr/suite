* Cola de sincronizacion local Style -> agente Node.js (sin HTTP en VFP).
* Insertar en cola_sincro.dbf tras TABLEUPDATE() exitoso (< 1 ms).
**
FUNCTION SuiteColaRoot
 LOCAL lcb
 lcb = ""
 IF TYPE("pcSuiteStyleRoot")="C" .AND. .NOT. EMPTY(pcSuiteStyleRoot)
    lcb = ADDBS(pcSuiteStyleRoot)
 ENDIF
 IF EMPTY(lcb)
    lcb = ADDBS(SYS(5)+SYS(2003))
 ENDIF
 RETURN lcb
ENDFUNC
**
PROCEDURE SuiteEnsureColaSincro
 LOCAL lcpath, lcalias, llWasOpen, llExclusive
 lcpath = SuiteColaRoot()+"cola_sincro"
 llWasOpen = USED("cola_sincro")
 IF FILE(lcpath+".dbf")
    llExclusive = .F.
    IF  .NOT. llWasOpen
       * Intentar EXCLUSIVE: la migracion de esquema (ALTER TABLE) lo exige.
       TRY
          USE EXCLUSIVE (lcpath) ALIAS cola_sincro IN 0
          llExclusive = .T.
       CATCH
       ENDTRY
       IF  .NOT. USED("cola_sincro")
          USE SHARED (lcpath) ALIAS cola_sincro IN 0
       ENDIF
    ENDIF
    DO SuiteMigrarColaSincroInline
    IF llExclusive
       * Reabrir compartido para no bloquear al agente Node.
       USE IN cola_sincro
       USE SHARED (lcpath) ALIAS cola_sincro IN 0
    ENDIF
    RETURN
 ENDIF
 * Campos <=10 chars y servicios C(254) (tabla FREE legible por dbf-reader Node; no memo, no nombres largos).
 CREATE TABLE (lcpath) FREE ;
    (id N(10,0), tabla C(40), id_reg C(30), accion C(3), ;
     procesado L, creado T, ;
     codemp C(15), codcli C(15), fecha D, fechaiso C(10), horini C(5), horfin C(5), ;
     texto C(250), codrec C(15), nomcli C(80), tel1cli C(20), ;
     facturado L, servicios C(254), colfon N(10,0), collet N(10,0), ;
     modif C(20), version N(15,0))
 INDEX ON procesado TAG proc
 INDEX ON id TAG idpk
 USE
 USE SHARED (lcpath) ALIAS cola_sincro IN 0
ENDPROC
**
FUNCTION SuiteColaFieldExists
 PARAMETER tcAlias, tcField
 IF  .NOT. USED(tcAlias)
    RETURN .F.
 ENDIF
 * FIELD() espera numero de campo; para comprobar por NOMBRE usamos TYPE("alias.campo").
 RETURN (TYPE(tcAlias + "." + ALLTRIM(tcField)) <> "U")
ENDFUNC
**
PROCEDURE SuiteMigrarColaSincroInline
 LOCAL lcalias
 lcalias = SELECT()
 IF  .NOT. USED("cola_sincro")
    RETURN
 ENDIF
 SELECT cola_sincro
 * ALTER TABLE exige acceso exclusivo; si la cola se abrio compartida, evitamos el crash.
 * (El agente Node tolera columnas ausentes; el cutover recrea la cola con el esquema nuevo.)
 TRY
 IF  .NOT. SuiteColaFieldExists("cola_sincro", "codemp")
    ALTER TABLE cola_sincro ADD COLUMN codemp C(15)
 ENDIF
 IF  .NOT. SuiteColaFieldExists("cola_sincro", "codcli")
    ALTER TABLE cola_sincro ADD COLUMN codcli C(15)
 ENDIF
 IF  .NOT. SuiteColaFieldExists("cola_sincro", "fecha")
    ALTER TABLE cola_sincro ADD COLUMN fecha D
 ENDIF
 IF  .NOT. SuiteColaFieldExists("cola_sincro", "fechaiso")
    ALTER TABLE cola_sincro ADD COLUMN fechaiso C(10)
 ENDIF
 IF  .NOT. SuiteColaFieldExists("cola_sincro", "horini")
    ALTER TABLE cola_sincro ADD COLUMN horini C(5)
 ENDIF
 IF  .NOT. SuiteColaFieldExists("cola_sincro", "horfin")
    ALTER TABLE cola_sincro ADD COLUMN horfin C(5)
 ENDIF
 IF  .NOT. SuiteColaFieldExists("cola_sincro", "texto")
    ALTER TABLE cola_sincro ADD COLUMN texto C(250)
 ENDIF
 IF  .NOT. SuiteColaFieldExists("cola_sincro", "codrec")
    ALTER TABLE cola_sincro ADD COLUMN codrec C(15)
 ENDIF
 IF  .NOT. SuiteColaFieldExists("cola_sincro", "nomcli")
    ALTER TABLE cola_sincro ADD COLUMN nomcli C(80)
 ENDIF
 IF  .NOT. SuiteColaFieldExists("cola_sincro", "tel1cli")
    ALTER TABLE cola_sincro ADD COLUMN tel1cli C(20)
 ENDIF
 IF  .NOT. SuiteColaFieldExists("cola_sincro", "facturado")
    ALTER TABLE cola_sincro ADD COLUMN facturado L
 ENDIF
 IF  .NOT. SuiteColaFieldExists("cola_sincro", "servicios")
    ALTER TABLE cola_sincro ADD COLUMN servicios C(254)
 ENDIF
 IF  .NOT. SuiteColaFieldExists("cola_sincro", "colfon")
    ALTER TABLE cola_sincro ADD COLUMN colfon N(10, 0)
 ENDIF
 IF  .NOT. SuiteColaFieldExists("cola_sincro", "collet")
    ALTER TABLE cola_sincro ADD COLUMN collet N(10, 0)
 ENDIF
 IF  .NOT. SuiteColaFieldExists("cola_sincro", "modif")
    ALTER TABLE cola_sincro ADD COLUMN modif C(20)
 ENDIF
 IF  .NOT. SuiteColaFieldExists("cola_sincro", "version")
    ALTER TABLE cola_sincro ADD COLUMN version N(15, 0)
 ENDIF
 CATCH
    * Cola abierta en modo compartido: no se pudo migrar esquema. Se recreara en el cutover.
 ENDTRY
 IF  .NOT. EMPTY(lcalias)
    SELECT (lcalias)
 ENDIF
ENDPROC
**
FUNCTION SuiteColaJsonEscape
 PARAMETER tc
 LOCAL lc, lnI, lcCh, lnAsc, lcOut
 lc = NVL(tc, "")
 lcOut = ""
 FOR lnI = 1 TO LEN(lc)
    lcCh = SUBSTR(lc, lnI, 1)
    lnAsc = ASC(lcCh)
    DO CASE
       CASE lcCh == "\"
          lcOut = lcOut + "\\"
       CASE lcCh == '"'
          lcOut = lcOut + '\"'
       CASE lnAsc = 8
          lcOut = lcOut + "\b"
       CASE lnAsc = 9
          lcOut = lcOut + "\t"
       CASE lnAsc = 10
          lcOut = lcOut + "\n"
       CASE lnAsc = 12
          lcOut = lcOut + "\f"
       CASE lnAsc = 13
          lcOut = lcOut + "\r"
       CASE lnAsc < 32
          * Otros controles: omitir (evita JSON invalido)
       OTHERWISE
          lcOut = lcOut + lcCh
    ENDCASE
 ENDFOR
 RETURN lcOut
ENDFUNC
**
FUNCTION SuiteColaEpochNow
 RETURN INT((DATETIME() - DATETIME(1970, 1, 1, 0, 0, 0)) * 86400)
ENDFUNC
**
FUNCTION SuiteBuildServiciosJson
 PARAMETER tnIdPlan
 LOCAL lcJson, lccod, lchora, lcalias, llWasUsed
 lcJson = "["
 lcalias = SELECT()
 llWasUsed = USED("planart")
 IF  .NOT. llWasUsed
    IF FILE(SuiteColaRoot()+"dbf\planart.dbf")
       USE SHARED (SuiteColaRoot()+"dbf\planart") ALIAS planart IN 0
    ELSE
       IF FILE(SuiteColaRoot()+"planart.dbf")
          USE SHARED (SuiteColaRoot()+"planart") ALIAS planart IN 0
       ENDIF
    ENDIF
 ENDIF
 IF USED("planart")
    SELECT planart
    SET ORDER TO idplan
    IF SEEK(STR(tnIdPlan, 10))
       SCAN REST WHILE planart.idplan = tnIdPlan
          lccod = ""
          lchora = ""
          IF TYPE("planart.codart")="C"
             lccod = ALLTRIM(planart.codart)
          ENDIF
          IF TYPE("planart.hora")="C"
             lchora = ALLTRIM(planart.hora)
          ENDIF
          IF  .NOT. EMPTY(lccod)
             IF LEN(lcJson) > 1
                lcJson = lcJson + ","
             ENDIF
             lcJson = lcJson + '{"servicio":"'+SuiteColaJsonEscape(lccod)+'","hora":"'+SuiteColaJsonEscape(lchora)+'"}'
          ENDIF
       ENDSCAN
    ENDIF
 ENDIF
 lcJson = lcJson + "]"
 IF  .NOT. llWasUsed AND USED("planart")
    USE IN planart
 ENDIF
 IF  .NOT. EMPTY(lcalias)
    SELECT (lcalias)
 ENDIF
 RETURN lcJson
ENDFUNC
**
FUNCTION SuiteLoadControlSync
 * Incluido en general.prg (#INCLUDE); no SET PROCEDURE externo en exe compilado.
 IF TYPE("SuiteEnsureControlSincro")#"U"
    RETURN .T.
 ENDIF
 RETURN .F.
ENDFUNC
**
FUNCTION SuiteEnqueueCola
 PARAMETER tcTabla, tcIdRegistro, tcAccion
 LOCAL lcalias, lnId, lcacc
 IF EMPTY(tcTabla)
    RETURN .F.
 ENDIF
 tcTabla = LOWER(ALLTRIM(tcTabla))
 tcIdRegistro = ALLTRIM(TRANSFORM(tcIdRegistro))
 lcacc = UPPER(LEFT(ALLTRIM(NVL(tcAccion, "UPD")), 3))
 DO CASE
    CASE lcacc="INS" OR lcacc="ADD"
       lcacc = "INS"
    CASE lcacc="DEL" OR lcacc="BOR"
       lcacc = "DEL"
    OTHERWISE
       lcacc = "UPD"
 ENDCASE
 lcalias = SELECT()
 DO SuiteEnsureColaSincro
 SELECT cola_sincro
 lnId = 0
 IF RECCOUNT("cola_sincro") > 0
    GO BOTTOM
    lnId = cola_sincro.id
 ENDIF
 APPEND BLANK
 REPLACE id WITH lnId+1, tabla WITH tcTabla, id_reg WITH tcIdRegistro, ;
         accion WITH lcacc, procesado WITH .F., creado WITH DATETIME()
 IF  .NOT. EMPTY(lcalias)
    SELECT (lcalias)
 ENDIF
 RETURN .T.
ENDFUNC
**
FUNCTION SuiteColaIsV2Active
 LOCAL lcpath, lcalias, lcmodo, llWasOpen
 = SuiteLoadControlSync()
 IF EVALUATE('TYPE("SuiteSyncModoV2Active")')#"U"
    RETURN EVALUATE('SuiteSyncModoV2Active()')
 ENDIF
 lcpath = SuiteColaRoot()+"control_sincro"
 llWasOpen = USED("control_sincro")
 IF FILE(lcpath+".dbf")
    IF  .NOT. llWasOpen
       USE SHARED (lcpath) ALIAS control_sincro IN 0
    ENDIF
    lcalias = SELECT()
    SELECT control_sincro
    lcmodo = ALLTRIM(NVL(control_sincro.modo, "2"))
    IF  .NOT. EMPTY(lcalias)
       SELECT (lcalias)
    ENDIF
    IF  .NOT. llWasOpen AND USED("control_sincro")
       USE IN control_sincro
    ENDIF
    RETURN (lcmodo=="2")
 ENDIF
 RETURN .T.
ENDFUNC
**
FUNCTION SuiteEnqueuePlan2009
 PARAMETER tnIdPlan, tcAccion
 LOCAL lcalias, llPlanWasUsed, llPlanArtWasUsed, lcServicios, lcId, lcacc
 LOCAL lcCodemp, lcCodcli, ldFecha, lcHorini, lcHorfin, lcTexto, lcCodrec, lcNomcli, lcTel1cli
 LOCAL llFact, lnColfon, lnCollet, lcMod, lnVersion

 IF  .NOT. SuiteColaIsV2Active()
    RETURN .F.
 ENDIF
 lcacc = UPPER(LEFT(ALLTRIM(NVL(tcAccion, "UPD")), 3))
 DO CASE
    CASE lcacc="INS" OR lcacc="ADD"
       lcacc = "INS"
    CASE lcacc="DEL" OR lcacc="BOR"
       lcacc = "DEL"
    OTHERWISE
       lcacc = "UPD"
 ENDCASE

 lcalias = SELECT()
 llPlanWasUsed = USED("plan2009")
 llPlanArtWasUsed = USED("planart")
 lcServicios = ""

 * Snapshot desde DBF local (evita lecturas posteriores desde Docker/SMB).
 IF  .NOT. llPlanWasUsed
    IF FILE(SuiteColaRoot()+"dbf\plan2009.dbf")
       USE SHARED (SuiteColaRoot()+"dbf\plan2009") ALIAS plan2009 IN 0
    ELSE
       IF FILE(SuiteColaRoot()+"plan2009.dbf")
          USE SHARED (SuiteColaRoot()+"plan2009") ALIAS plan2009 IN 0
       ENDIF
    ENDIF
 ENDIF
 IF  .NOT. llPlanArtWasUsed
    IF FILE(SuiteColaRoot()+"dbf\planart.dbf")
       USE SHARED (SuiteColaRoot()+"dbf\planart") ALIAS planart IN 0
    ELSE
       IF FILE(SuiteColaRoot()+"planart.dbf")
          USE SHARED (SuiteColaRoot()+"planart") ALIAS planart IN 0
       ENDIF
    ENDIF
 ENDIF

 lcCodemp = ""
 lcCodcli = ""
 ldFecha = {}
 lcHorini = ""
 lcHorfin = ""
 lcTexto = ""
 lcCodrec = ""
 lcNomcli = ""
 lcTel1cli = ""
 llFact = .F.
 lnColfon = 0
 lnCollet = 0
 lcMod = ""
 lnVersion = SuiteColaEpochNow()

 lcId = TRANSFORM(tnIdPlan)

 IF USED("plan2009")
    SELECT plan2009
    SET ORDER TO idplan
    IF SEEK(VAL(lcId))
       lcCodemp = ALLTRIM(NVL(plan2009.codemp, ""))
       lcCodcli = ALLTRIM(NVL(plan2009.codcli, ""))
       ldFecha = plan2009.fecha
       lcHorini = ALLTRIM(NVL(plan2009.horini, ""))
       lcHorfin = ALLTRIM(NVL(plan2009.horfin, ""))
       lcTexto = LEFT(ALLTRIM(NVL(plan2009.texto, "")), 250)
       lcCodrec = ALLTRIM(NVL(plan2009.codrec, ""))
       lcNomcli = ALLTRIM(NVL(plan2009.nomcli, ""))
       lcTel1cli = ALLTRIM(NVL(plan2009.tel1cli, ""))
       llFact = IIF(TYPE("plan2009.facturado")="L", plan2009.facturado, .F.)
       lnColfon = IIF(TYPE("plan2009.colfon")="N", plan2009.colfon, 0)
       lnCollet = IIF(TYPE("plan2009.collet")="N", plan2009.collet, 0)
       lcMod = TRANSFORM(lnVersion)
    ENDIF
 ENDIF

 lcServicios = SuiteBuildServiciosJson(VAL(lcId))

 * Fecha tambien como cadena ISO YYYY-MM-DD: el dbf-reader del agente Node malinterpreta
 * el campo D (mes 1-based como indice 0-based + desfase TZ). El agente usa fechaiso.
 LOCAL lcFechaIso
 lcFechaIso = ""
 IF  .NOT. EMPTY(ldFecha)
    lcFechaIso = STR(YEAR(ldFecha), 4) + "-" + PADL(ALLTRIM(STR(MONTH(ldFecha))), 2, "0") + "-" + PADL(ALLTRIM(STR(DAY(ldFecha))), 2, "0")
 ENDIF

 DO SuiteEnsureColaSincro
 SELECT cola_sincro
 LOCAL lnId
 lnId = 0
 IF RECCOUNT("cola_sincro") > 0
    GO BOTTOM
    lnId = cola_sincro.id
 ENDIF
 APPEND BLANK
 REPLACE id WITH lnId+1, tabla WITH "plan2009", id_reg WITH lcId, ;
         accion WITH lcacc, procesado WITH .F., creado WITH DATETIME(), ;
         codemp WITH lcCodemp, codcli WITH lcCodcli, fecha WITH ldFecha, ;
         fechaiso WITH lcFechaIso, ;
         horini WITH lcHorini, horfin WITH lcHorfin, texto WITH lcTexto, ;
         codrec WITH lcCodrec, nomcli WITH lcNomcli, tel1cli WITH lcTel1cli, ;
         facturado WITH llFact, servicios WITH LEFT(lcServicios, 254), colfon WITH lnColfon, ;
         collet WITH lnCollet, modif WITH LEFT(ALLTRIM(lcMod), 20), ;
         version WITH lnVersion

 IF  .NOT. llPlanWasUsed AND USED("plan2009")
    USE IN plan2009
 ENDIF
 IF  .NOT. llPlanArtWasUsed AND USED("planart")
    USE IN planart
 ENDIF
 IF  .NOT. EMPTY(lcalias)
    SELECT (lcalias)
 ENDIF
 RETURN .T.
ENDFUNC

**
* Suite_SyncInit / Suite_SyncLog: solo en general.prg (evita sombra si SET PROCEDURE TO suite_cola_sync).
