* Dispatcher inbound Suite -> Style para maestros/transacciones (entity_type).
* Coexiste con suite_inbound_worker.prg (citas plan2009). Los ficheros de entidad
* se llaman e<outbox_id>.json y generan ack e<outbox_id>.ok con style_key asignado.
*
* Reutiliza SuiteGetObj / SuiteJsonParse / SuiteInboundOpenTable / SuiteInboundLog /
* SuitePlanFieldExists de suite_inbound_worker.prg (mismo ambito compilado).
**
FUNCTION SuiteEntityFieldExists
 PARAMETER tcAlias, tcField
 IF  .NOT. USED(tcAlias)
    RETURN .F.
 ENDIF
 RETURN (TYPE(tcAlias + "." + ALLTRIM(tcField)) <> "U")
ENDFUNC
**
FUNCTION SuiteEntityIvaStyleCode
 * Style ivaart: codigo 0-3 (no porcentaje 21/10/4).
 PARAMETER tnPct
 LOCAL ln
 ln = VAL(ALLTRIM(STR(tnPct)))
 DO CASE
 CASE ln >= 15
    RETURN 1
 CASE ln >= 8
    RETURN 2
 CASE ln >= 3
    RETURN 3
 OTHERWISE
    RETURN 0
 ENDCASE
ENDFUNC
**
PROCEDURE SuiteEntityWriteAck
 PARAMETER tnOutboxId, tcStyleKey, llOk, tcErr, tcAckDir
 LOCAL lcAck
 IF tnOutboxId <= 0
    RETURN
 ENDIF
 lcAck = "ok=" + IIF(llOk, "1", "0")
 lcAck = lcAck + ";style_key=" + ALLTRIM(NVL(tcStyleKey, ""))
 IF  .NOT. llOk .AND.  .NOT. EMPTY(NVL(tcErr, ""))
    lcAck = lcAck + ";error=" + ALLTRIM(tcErr)
 ENDIF
 STRTOFILE(lcAck, ADDBS(tcAckDir) + "e" + ALLTRIM(STR(tnOutboxId)) + ".ok", .F.)
ENDPROC
**
FUNCTION SuiteEntityNextCodcli
 * Siguiente codcli numerico (max+1) si Suite no envio clave (caso raro).
 LOCAL lnMax, lcAlias
 lcAlias = SELECT()
 lnMax = 0
 IF USED("clientes")
    SELECT clientes
    GO TOP
    SCAN
       IF VAL(ALLTRIM(NVL(clientes.codcli, "0"))) > lnMax
          lnMax = VAL(ALLTRIM(NVL(clientes.codcli, "0")))
       ENDIF
    ENDSCAN
 ENDIF
 IF  .NOT. EMPTY(lcAlias)
    SELECT (lcAlias)
 ENDIF
 RETURN PADL(ALLTRIM(STR(lnMax + 1)), 6, "0")
ENDFUNC
**
FUNCTION SuiteEntityApplyCliente
 PARAMETER toMsg
 LOCAL lcCodcli, lcNom, lcApe1, lcTel1, lcTel2, lcEmail, lcDni, lcDir
 LOCAL lcCodpos, lcPob, lcPro, lcPais, lcPercon, lcObs, lcFecnac, ldFecnac
 IF  .NOT. SuiteInboundOpenTable("clientes")
    RETURN ""
 ENDIF
 lcCodcli = ALLTRIM(SuiteGetObj(toMsg, "codcli", ""))
 IF EMPTY(lcCodcli)
    lcCodcli = SuiteEntityNextCodcli()
 ENDIF
 lcNom = ALLTRIM(SuiteGetObj(toMsg, "nomcli", ""))
 lcApe1 = ALLTRIM(SuiteGetObj(toMsg, "ape1cli", ""))
 lcTel1 = ALLTRIM(SuiteGetObj(toMsg, "tel1cli", ""))
 lcTel2 = ALLTRIM(SuiteGetObj(toMsg, "tel2cli", ""))
 lcEmail = ALLTRIM(SuiteGetObj(toMsg, "email", ""))
 lcDni = ALLTRIM(SuiteGetObj(toMsg, "dnicli", ""))
 lcDir = ALLTRIM(SuiteGetObj(toMsg, "dircli", ""))
 lcCodpos = ALLTRIM(SuiteGetObj(toMsg, "codposcli", ""))
 lcPob = ALLTRIM(SuiteGetObj(toMsg, "pobcli", ""))
 lcPro = ALLTRIM(SuiteGetObj(toMsg, "procli", ""))
 lcPais = ALLTRIM(SuiteGetObj(toMsg, "pais", ""))
 lcPercon = ALLTRIM(SuiteGetObj(toMsg, "percon", ""))
 lcObs = ALLTRIM(SuiteGetObj(toMsg, "obscli", ""))
 lcFecnac = LEFT(ALLTRIM(SuiteGetObj(toMsg, "fecnac", "")), 10)
 ldFecnac = {}
 IF LEN(lcFecnac) >= 10 .AND. SUBSTR(lcFecnac, 5, 1) == "-"
    ldFecnac = DATE(VAL(LEFT(lcFecnac, 4)), VAL(SUBSTR(lcFecnac, 6, 2)), VAL(SUBSTR(lcFecnac, 9, 2)))
 ENDIF

 SELECT clientes
 IF  .NOT. EMPTY(ORDER())
    * codcli suele estar indexado; si no, busqueda secuencial.
 ENDIF
 LOCATE FOR ALLTRIM(codcli) == lcCodcli
 IF  .NOT. FOUND()
    IF RLOCK("0", "clientes")
       APPEND BLANK
       REPLACE codcli WITH lcCodcli
       UNLOCK IN clientes
    ENDIF
 ENDIF

 IF RLOCK("clientes")
    REPLACE nomcli WITH lcNom
    IF SuiteEntityFieldExists("clientes", "ape1cli")
       REPLACE ape1cli WITH lcApe1
    ENDIF
    IF SuiteEntityFieldExists("clientes", "tel1cli")
       REPLACE tel1cli WITH lcTel1
    ENDIF
    IF SuiteEntityFieldExists("clientes", "tel2cli")
       REPLACE tel2cli WITH lcTel2
    ENDIF
    IF SuiteEntityFieldExists("clientes", "email")
       REPLACE email WITH lcEmail
    ENDIF
    IF SuiteEntityFieldExists("clientes", "dnicli")
       REPLACE dnicli WITH lcDni
    ENDIF
    IF SuiteEntityFieldExists("clientes", "dircli")
       REPLACE dircli WITH lcDir
    ENDIF
    IF SuiteEntityFieldExists("clientes", "codposcli")
       REPLACE codposcli WITH lcCodpos
    ENDIF
    IF SuiteEntityFieldExists("clientes", "pobcli")
       REPLACE pobcli WITH lcPob
    ENDIF
    IF SuiteEntityFieldExists("clientes", "procli")
       REPLACE procli WITH lcPro
    ENDIF
    IF SuiteEntityFieldExists("clientes", "pais")
       REPLACE pais WITH lcPais
    ENDIF
    IF SuiteEntityFieldExists("clientes", "percon")
       REPLACE percon WITH lcPercon
    ENDIF
    IF SuiteEntityFieldExists("clientes", "obscli")
       REPLACE obscli WITH lcObs
    ENDIF
    IF  .NOT. EMPTY(ldFecnac) .AND. SuiteEntityFieldExists("clientes", "fecnac")
       REPLACE fecnac WITH ldFecnac
    ENDIF
    UNLOCK IN clientes
 ENDIF

 RETURN lcCodcli
ENDFUNC
**
FUNCTION SuiteEntityApplyArticulo
 * Suite -> Style: alta/edicion de articulo nativo Suite (solo si trae codart).
 PARAMETER toMsg
 LOCAL lcCodart, lcDes, lcFam, lnPvpa, lnCoste, lnStock, lnIva, llObs
 IF  .NOT. SuiteInboundOpenTable("articulos")
    RETURN ""
 ENDIF
 lcCodart = ALLTRIM(SuiteGetObj(toMsg, "codart", ""))
 IF EMPTY(lcCodart)
    RETURN ""
 ENDIF
 lcDes = ALLTRIM(SuiteGetObj(toMsg, "desart", ""))
 lcFam = ALLTRIM(SuiteGetObj(toMsg, "familia1", ""))
 lnPvpa = VAL(ALLTRIM(SuiteGetObj(toMsg, "pvpa", "0")))
 lnCoste = VAL(ALLTRIM(SuiteGetObj(toMsg, "coste", "0")))
 lnStock = VAL(ALLTRIM(SuiteGetObj(toMsg, "stock", "0")))
 lnIva = SuiteEntityIvaStyleCode(VAL(ALLTRIM(SuiteGetObj(toMsg, "iva", "21"))))
 llObs = (UPPER(ALLTRIM(SuiteGetObj(toMsg, "obsoleto", "NO"))) == "SI")

 SELECT articulos
 LOCATE FOR ALLTRIM(codart) == lcCodart
 IF  .NOT. FOUND()
    IF RLOCK("0", "articulos")
       APPEND BLANK
       REPLACE codart WITH lcCodart
       UNLOCK IN articulos
    ENDIF
 ENDIF
 IF RLOCK("articulos")
    IF SuiteEntityFieldExists("articulos", "desart")
       REPLACE desart WITH lcDes
    ENDIF
    IF  .NOT. EMPTY(lcFam) .AND. SuiteEntityFieldExists("articulos", "familia1")
       REPLACE familia1 WITH lcFam
    ENDIF
    IF SuiteEntityFieldExists("articulos", "pvpa")
       REPLACE pvpa WITH lnPvpa
    ENDIF
    IF SuiteEntityFieldExists("articulos", "coste")
       REPLACE coste WITH lnCoste
    ENDIF
    IF SuiteEntityFieldExists("articulos", "stock")
       REPLACE stock WITH lnStock
    ENDIF
    IF SuiteEntityFieldExists("articulos", "ivaart")
       REPLACE ivaart WITH lnIva
    ENDIF
    IF SuiteEntityFieldExists("articulos", "obsoleto")
       REPLACE obsoleto WITH llObs
    ENDIF
    UNLOCK IN articulos
 ENDIF
 RETURN lcCodart
ENDFUNC
**
FUNCTION SuiteEntityApplyLineasAlblin
 * Aplica lineas JSON (array) del payload inbound a alblin.dbf.
 PARAMETER tnNumalb, toMsg
 LOCAL lcJson, loArr, lnI, lnCnt, lcCodart, lcDes, lnCant, lnPrecio, lnTotal
 IF tnNumalb <= 0
    RETURN
 ENDIF
 IF  .NOT. SuiteInboundOpenTable("alblin")
    RETURN
 ENDIF
 lcJson = ALLTRIM(SuiteGetObj(toMsg, "lineas", ""))
 IF EMPTY(lcJson) .OR. LEFT(ALLTRIM(lcJson), 1) <> "["
    RETURN
 ENDIF
 loArr = SuiteJsonParse(lcJson)
 IF TYPE("loArr") <> "O"
    RETURN
 ENDIF
 lnCnt = 0
 TRY
    lnCnt = EVALUATE("loArr.length")
 CATCH
    lnCnt = 0
 ENDTRY
 FOR lnI = 0 TO lnCnt - 1
    LOCAL loLn
    loLn = .NULL.
    TRY
       loLn = EVALUATE("loArr[" + ALLTRIM(STR(lnI)) + "]")
    CATCH
       LOOP
    ENDTRY
    IF TYPE("loLn") <> "O"
       LOOP
    ENDIF
    lcCodart = ALLTRIM(SuiteGetObj(loLn, "codart", ""))
    lcDes = ALLTRIM(SuiteGetObj(loLn, "desart", ""))
    lnCant = SuiteGetObjNum(loLn, "cantidad", 1)
    IF lnCant = 0
       lnCant = SuiteGetObjNum(loLn, "cant", 1)
    ENDIF
    lnPrecio = SuiteGetObjNum(loLn, "precio", 0)
    lnTotal = SuiteGetObjNum(loLn, "total", 0)
    IF lnTotal = 0
       lnTotal = SuiteGetObjNum(loLn, "subtot", lnCant * lnPrecio)
    ENDIF
    SELECT alblin
    IF RLOCK("0", "alblin")
       APPEND BLANK
       IF SuiteEntityFieldExists("alblin", "numalb")
          REPLACE numalb WITH tnNumalb
       ENDIF
       IF SuiteEntityFieldExists("alblin", "codart")
          REPLACE codart WITH lcCodart
       ENDIF
       IF SuiteEntityFieldExists("alblin", "desart")
          REPLACE desart WITH lcDes
       ENDIF
       IF SuiteEntityFieldExists("alblin", "cant")
          REPLACE cant WITH lnCant
       ENDIF
       IF SuiteEntityFieldExists("alblin", "cantidad")
          REPLACE cantidad WITH lnCant
       ENDIF
       IF SuiteEntityFieldExists("alblin", "preven")
          REPLACE preven WITH lnPrecio
       ENDIF
       IF SuiteEntityFieldExists("alblin", "precio")
          REPLACE precio WITH lnPrecio
       ENDIF
       IF SuiteEntityFieldExists("alblin", "subtot")
          REPLACE subtot WITH lnTotal
       ENDIF
       IF SuiteEntityFieldExists("alblin", "total")
          REPLACE total WITH lnTotal
       ENDIF
       UNLOCK IN alblin
    ENDIF
 ENDFOR
ENDFUNC
**
FUNCTION SuiteEntityApplyLineasFaclin
 * Aplica lineas JSON (array) del payload inbound a faclin.dbf.
 PARAMETER tnNumfac, toMsg
 LOCAL lcJson, loArr, lnI, lnCnt, lcCodart, lcDes, lnCant, lnPrecio, lnSubtot, lnIvaPct
 IF tnNumfac <= 0
    RETURN
 ENDIF
 IF  .NOT. SuiteInboundOpenTable("faclin")
    RETURN
 ENDIF
 lcJson = ALLTRIM(SuiteGetObj(toMsg, "lineas", ""))
 IF EMPTY(lcJson) .OR. LEFT(ALLTRIM(lcJson), 1) <> "["
    RETURN
 ENDIF
 loArr = SuiteJsonParse(lcJson)
 IF TYPE("loArr") <> "O"
    RETURN
 ENDIF
 lnCnt = 0
 TRY
    lnCnt = EVALUATE("loArr.length")
 CATCH
    lnCnt = 0
 ENDTRY
 FOR lnI = 0 TO lnCnt - 1
    LOCAL loLn
    loLn = .NULL.
    TRY
       loLn = EVALUATE("loArr[" + ALLTRIM(STR(lnI)) + "]")
    CATCH
       LOOP
    ENDTRY
    IF TYPE("loLn") <> "O"
       LOOP
    ENDIF
    lcCodart = ALLTRIM(SuiteGetObj(loLn, "codart", ""))
    lcDes = ALLTRIM(SuiteGetObj(loLn, "desart", ""))
    lnCant = SuiteGetObjNum(loLn, "cantidad", 1)
    lnPrecio = SuiteGetObjNum(loLn, "precio", 0)
    lnSubtot = SuiteGetObjNum(loLn, "subtot", lnCant * lnPrecio)
    lnIvaPct = SuiteGetObjNum(loLn, "taniva", 21)
    SELECT faclin
    IF RLOCK("0", "faclin")
       APPEND BLANK
       IF SuiteEntityFieldExists("faclin", "numfac")
          REPLACE numfac WITH tnNumfac
       ENDIF
       IF SuiteEntityFieldExists("faclin", "codart")
          REPLACE codart WITH lcCodart
       ENDIF
       IF SuiteEntityFieldExists("faclin", "desart")
          REPLACE desart WITH lcDes
       ENDIF
       IF SuiteEntityFieldExists("faclin", "cant")
          REPLACE cant WITH lnCant
       ENDIF
       IF SuiteEntityFieldExists("faclin", "preven")
          REPLACE preven WITH lnPrecio
       ENDIF
       IF SuiteEntityFieldExists("faclin", "subtot")
          REPLACE subtot WITH lnSubtot
       ENDIF
       IF SuiteEntityFieldExists("faclin", "taniva")
          REPLACE taniva WITH lnIvaPct
       ENDIF
       UNLOCK IN faclin
    ENDIF
 ENDFOR
ENDFUNC
**
FUNCTION SuiteEntityApplyBono
 * Suite -> Style: actualiza saldo/consumo de un bono de cliente.
 PARAMETER toMsg
 LOCAL lcCodboncli, lnSes, lnCons, llObs
 IF  .NOT. SuiteInboundOpenTable("bonoscli")
    RETURN ""
 ENDIF
 lcCodboncli = ALLTRIM(SuiteGetObj(toMsg, "codboncli", ""))
 IF EMPTY(lcCodboncli)
    RETURN ""
 ENDIF
 lnSes = VAL(ALLTRIM(SuiteGetObj(toMsg, "sesiones", "0")))
 lnCons = VAL(ALLTRIM(SuiteGetObj(toMsg, "consumidas", "0")))
 llObs = (UPPER(ALLTRIM(SuiteGetObj(toMsg, "obsoleto", "NO"))) == "SI")

 SELECT bonoscli
 LOCATE FOR ALLTRIM(codboncli) == lcCodboncli
 IF  .NOT. FOUND()
    IF RLOCK("0", "bonoscli")
       APPEND BLANK
       REPLACE codboncli WITH lcCodboncli
       IF SuiteEntityFieldExists("bonoscli", "codcli")
          REPLACE codcli WITH ALLTRIM(SuiteGetObj(toMsg, "codcli", ""))
       ENDIF
       IF SuiteEntityFieldExists("bonoscli", "desbon")
          REPLACE desbon WITH ALLTRIM(SuiteGetObj(toMsg, "desbon", ""))
       ENDIF
       UNLOCK IN bonoscli
    ELSE
       RETURN ""
    ENDIF
 ENDIF
 IF RLOCK("bonoscli")
    IF SuiteEntityFieldExists("bonoscli", "sesiones")
       REPLACE sesiones WITH lnSes
    ENDIF
    IF SuiteEntityFieldExists("bonoscli", "consumi")
       REPLACE consumi WITH lnCons
    ENDIF
    IF SuiteEntityFieldExists("bonoscli", "consumidas")
       REPLACE consumidas WITH lnCons
    ENDIF
    IF SuiteEntityFieldExists("bonoscli", "obsoleto")
       REPLACE obsoleto WITH llObs
    ENDIF
    UNLOCK IN bonoscli
 ENDIF
 RETURN lcCodboncli
ENDFUNC
**
FUNCTION SuiteEntityNextNum
 * Siguiente numero (max+1) de un campo numerico/char de la tabla abierta.
 PARAMETER tcAlias, tcCampo
 LOCAL lnMax, lcAlias
 lcAlias = SELECT()
 lnMax = 0
 IF USED(tcAlias)
    SELECT (tcAlias)
    GO TOP
    SCAN
       IF VAL(ALLTRIM(TRANSFORM(EVALUATE(tcAlias + "." + tcCampo)))) > lnMax
          lnMax = VAL(ALLTRIM(TRANSFORM(EVALUATE(tcAlias + "." + tcCampo))))
       ENDIF
    ENDSCAN
 ENDIF
 IF  .NOT. EMPTY(lcAlias)
    SELECT (lcAlias)
 ENDIF
 RETURN lnMax + 1
ENDFUNC
**
FUNCTION SuiteEntityApplyVenta
 * Suite -> Style: alta de ticket TPV en albcab (cabecera). Lineas alblin en iteracion posterior.
 PARAMETER toMsg
 LOCAL lcCodcli, lnTotal, ldFecha, lcFechaIso, lnNumalb
 IF  .NOT. SuiteInboundOpenTable("albcab")
    RETURN ""
 ENDIF
 lcCodcli = ALLTRIM(SuiteGetObj(toMsg, "codcli", ""))
 lnTotal = VAL(ALLTRIM(SuiteGetObj(toMsg, "total", "0")))
 lcFechaIso = LEFT(ALLTRIM(SuiteGetObj(toMsg, "fecha", "")), 10)
 ldFecha = DATE()
 IF LEN(lcFechaIso) >= 10 .AND. SUBSTR(lcFechaIso, 5, 1) == "-"
    ldFecha = DATE(VAL(LEFT(lcFechaIso, 4)), VAL(SUBSTR(lcFechaIso, 6, 2)), VAL(SUBSTR(lcFechaIso, 9, 2)))
 ENDIF

 SELECT albcab
 lnNumalb = SuiteEntityNextNum("albcab", "numalb")
 IF RLOCK("0", "albcab")
    APPEND BLANK
    IF SuiteEntityFieldExists("albcab", "numalb")
       REPLACE numalb WITH lnNumalb
    ENDIF
    IF SuiteEntityFieldExists("albcab", "codcli")
       REPLACE codcli WITH lcCodcli
    ENDIF
    IF SuiteEntityFieldExists("albcab", "fecha")
       REPLACE fecha WITH ldFecha
    ENDIF
    IF SuiteEntityFieldExists("albcab", "total")
       REPLACE total WITH lnTotal
    ENDIF
    IF SuiteEntityFieldExists("albcab", "totalalb")
       REPLACE totalalb WITH lnTotal
    ENDIF
    UNLOCK IN albcab
 ENDIF
 = SuiteEntityApplyLineasAlblin(lnNumalb, toMsg)
 RETURN ALLTRIM(STR(lnNumalb))
ENDFUNC
**
FUNCTION SuiteEntityApplyFactura
 * Suite -> Style: alta de factura en faccab (cabecera + faclin).
 PARAMETER toMsg
 LOCAL lcCodcli, lnBase, lnIva, lnTotal, ldFecha, lcFechaIso, lnNumfac
 IF  .NOT. SuiteInboundOpenTable("faccab")
    RETURN ""
 ENDIF
 lcCodcli = ALLTRIM(SuiteGetObj(toMsg, "codcli", ""))
 lnBase = VAL(ALLTRIM(SuiteGetObj(toMsg, "baseimp", "0")))
 lnIva = VAL(ALLTRIM(SuiteGetObj(toMsg, "iva", "0")))
 lnTotal = VAL(ALLTRIM(SuiteGetObj(toMsg, "total", "0")))
 lcFechaIso = LEFT(ALLTRIM(SuiteGetObj(toMsg, "fecha", "")), 10)
 ldFecha = DATE()
 IF LEN(lcFechaIso) >= 10 .AND. SUBSTR(lcFechaIso, 5, 1) == "-"
    ldFecha = DATE(VAL(LEFT(lcFechaIso, 4)), VAL(SUBSTR(lcFechaIso, 6, 2)), VAL(SUBSTR(lcFechaIso, 9, 2)))
 ENDIF

 SELECT faccab
 lnNumfac = SuiteEntityNextNum("faccab", "numfac")
 IF RLOCK("0", "faccab")
    APPEND BLANK
    IF SuiteEntityFieldExists("faccab", "numfac")
       REPLACE numfac WITH lnNumfac
    ENDIF
    IF SuiteEntityFieldExists("faccab", "codcli")
       REPLACE codcli WITH lcCodcli
    ENDIF
    IF SuiteEntityFieldExists("faccab", "fecha")
       REPLACE fecha WITH ldFecha
    ENDIF
    IF SuiteEntityFieldExists("faccab", "baseimp")
       REPLACE baseimp WITH lnBase
    ENDIF
    IF SuiteEntityFieldExists("faccab", "iva")
       REPLACE iva WITH lnIva
    ENDIF
    IF SuiteEntityFieldExists("faccab", "total")
       REPLACE total WITH lnTotal
    ENDIF
    IF SuiteEntityFieldExists("faccab", "totalfac")
       REPLACE totalfac WITH lnTotal
    ENDIF
    UNLOCK IN faccab
 ENDIF
 = SuiteEntityApplyLineasFaclin(lnNumfac, toMsg)
 RETURN ALLTRIM(STR(lnNumfac))
ENDFUNC
**
FUNCTION SuiteEntityApplyCierre
 * Suite -> Style: cierre de caja en ciecab (cabecera).
 PARAMETER toMsg
 LOCAL lnEfec, lnTarj, lnTotal, ldFecha, lcFechaIso, lnNumcie
 IF  .NOT. SuiteInboundOpenTable("ciecab")
    RETURN ""
 ENDIF
 lnEfec = VAL(ALLTRIM(SuiteGetObj(toMsg, "efectivo", "0")))
 lnTarj = VAL(ALLTRIM(SuiteGetObj(toMsg, "tarjeta", "0")))
 lnTotal = VAL(ALLTRIM(SuiteGetObj(toMsg, "total", "0")))
 lcFechaIso = LEFT(ALLTRIM(SuiteGetObj(toMsg, "fecha", "")), 10)
 ldFecha = DATE()
 IF LEN(lcFechaIso) >= 10 .AND. SUBSTR(lcFechaIso, 5, 1) == "-"
    ldFecha = DATE(VAL(LEFT(lcFechaIso, 4)), VAL(SUBSTR(lcFechaIso, 6, 2)), VAL(SUBSTR(lcFechaIso, 9, 2)))
 ENDIF

 SELECT ciecab
 lnNumcie = SuiteEntityNextNum("ciecab", "numcie")
 IF RLOCK("0", "ciecab")
    APPEND BLANK
    IF SuiteEntityFieldExists("ciecab", "numcie")
       REPLACE numcie WITH lnNumcie
    ENDIF
    IF SuiteEntityFieldExists("ciecab", "fecha")
       REPLACE fecha WITH ldFecha
    ENDIF
    IF SuiteEntityFieldExists("ciecab", "efectivo")
       REPLACE efectivo WITH lnEfec
    ENDIF
    IF SuiteEntityFieldExists("ciecab", "efec")
       REPLACE efec WITH lnEfec
    ENDIF
    IF SuiteEntityFieldExists("ciecab", "tarjeta")
       REPLACE tarjeta WITH lnTarj
    ENDIF
    IF SuiteEntityFieldExists("ciecab", "tarj")
       REPLACE tarj WITH lnTarj
    ENDIF
    IF SuiteEntityFieldExists("ciecab", "total")
       REPLACE total WITH lnTotal
    ENDIF
    IF SuiteEntityFieldExists("ciecab", "totalcie")
       REPLACE totalcie WITH lnTotal
    ENDIF
    UNLOCK IN ciecab
 ENDIF
 RETURN ALLTRIM(STR(lnNumcie))
ENDFUNC
**
PROCEDURE SuiteEntityApplyOne
 PARAMETER toMsg, tcInboundFile, tcAckDir
 LOCAL lcType, lnOutboxId, lcKey, llOk, lcErr
 lcType = LOWER(ALLTRIM(SuiteGetObj(toMsg, "entity_type", "")))
 lnOutboxId = VAL(ALLTRIM(SuiteGetObj(toMsg, "outbox_id", "0")))
 lcKey = ""
 llOk = .T.
 lcErr = ""

 DO CASE
    CASE lcType == "customer"
       lcKey = SuiteEntityApplyCliente(toMsg)
       llOk = ( .NOT. EMPTY(lcKey))
    CASE lcType == "article"
       lcKey = SuiteEntityApplyArticulo(toMsg)
       llOk = ( .NOT. EMPTY(lcKey))
    CASE lcType == "bono"
       lcKey = SuiteEntityApplyBono(toMsg)
       llOk = ( .NOT. EMPTY(lcKey))
    CASE lcType == "sale"
       lcKey = SuiteEntityApplyVenta(toMsg)
       llOk = ( .NOT. EMPTY(lcKey))
    CASE lcType == "invoice"
       lcKey = SuiteEntityApplyFactura(toMsg)
       llOk = ( .NOT. EMPTY(lcKey))
    CASE lcType == "cash_session"
       lcKey = SuiteEntityApplyCierre(toMsg)
       llOk = ( .NOT. EMPTY(lcKey))
    OTHERWISE
       * Entidad aun no implementada en inbound: ack OK para no bloquear la cola.
       DO SuiteInboundLog WITH "entity inbound sin handler: " + lcType
       lcKey = ALLTRIM(SuiteGetObj(toMsg, "style_key", ""))
       llOk = .T.
 ENDCASE

 DO SuiteEntityWriteAck WITH lnOutboxId, lcKey, llOk, lcErr, tcAckDir

 IF FILE(tcInboundFile)
    ERASE (tcInboundFile)
 ENDIF
ENDPROC
