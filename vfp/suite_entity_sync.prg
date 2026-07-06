* Hooks de salida Style -> Suite para maestros y transacciones.
* Se llaman tras un TABLEUPDATE() exitoso o desde SuiteAfterEntitySave().
* La cola transporta solo (tabla, id_reg, accion); el agente Node lee el DBF origen completo.
*
* Requiere SuiteEnqueueCola (suite_cola_sync.prg embebido en general.prg) y SuiteColaIsV2Active.
**
FUNCTION SuiteEntityEnsureLoaded
 * No-op si ya embebido en general.prg; en runtime suelto carga el PRG.
 IF TYPE("SuiteEnqueueEntidad")#"U"
    RETURN .T.
 ENDIF
 LOCAL lcPrg
 lcPrg = ""
 IF TYPE("SuiteColaRoot")#"U"
    lcPrg = SuiteColaRoot()+"PROGS\suite_entity_sync.prg"
    IF  .NOT. FILE(lcPrg)
       lcPrg = SuiteColaRoot()+"suite_entity_sync.prg"
    ENDIF
 ENDIF
 IF EMPTY(lcPrg) .OR.  .NOT. FILE(lcPrg)
    RETURN .F.
 ENDIF
 SET PROCEDURE TO (lcPrg) ADDITIVE
 RETURN (TYPE("SuiteEnqueueEntidad")#"U")
ENDFUNC
**
FUNCTION SuiteAfterEntitySave
 * Punto unico para encolar cambios maestros/transaccion hacia Suite (v2).
 PARAMETER tcTabla, tcClave, tcAccion
 LOCAL lcTabla, lcClave, lcAcc
 IF EMPTY(tcTabla) .OR. EMPTY(ALLTRIM(TRANSFORM(tcClave)))
    RETURN .F.
 ENDIF
 TRY
    IF TYPE("SuiteColaIsV2Active")#"U" .AND.  .NOT. SuiteColaIsV2Active()
       RETURN .F.
    ENDIF
    IF TYPE("SuiteEnqueueEntidad")="U"
       = SuiteEntityEnsureLoaded()
    ENDIF
    IF TYPE("SuiteEnqueueEntidad")="U"
       RETURN .F.
    ENDIF
    lcTabla = LOWER(ALLTRIM(tcTabla))
    lcClave = ALLTRIM(TRANSFORM(tcClave))
    lcAcc = NVL(tcAccion, "UPD")
    DO CASE
       CASE lcTabla == "clientes"
          RETURN SuiteEnqueueCliente(lcClave, lcAcc)
       CASE lcTabla == "articulos"
          RETURN SuiteEnqueueArticulo(lcClave, lcAcc)
       CASE lcTabla == "bonoscli"
          RETURN SuiteEnqueueBonoCli(lcClave, lcAcc)
       CASE lcTabla == "albcab"
          RETURN SuiteEnqueueVenta(lcClave, lcAcc)
       CASE lcTabla == "faccab"
          RETURN SuiteEnqueueFactura(lcClave, lcAcc)
       CASE lcTabla == "ciecab"
          RETURN SuiteEnqueueCierre(lcClave, lcAcc)
       OTHERWISE
          RETURN SuiteEnqueueEntidad(lcTabla, lcClave, lcAcc)
    ENDCASE
 CATCH
 ENDTRY
 RETURN .F.
ENDFUNC
**
FUNCTION SuiteAfterEntitySaveCurrent
 * Encola el registro actual del alias indicado (p. ej. "clientes", "articulos").
 PARAMETER tcAlias, tcKeyField, tcAccion
 LOCAL lcKey
 IF  .NOT. USED(tcAlias)
    RETURN .F.
 ENDIF
 lcKey = ""
 IF TYPE(tcAlias + "." + ALLTRIM(tcKeyField)) <> "U"
    lcKey = EVALUATE(tcAlias + "." + tcKeyField)
 ENDIF
 IF EMPTY(ALLTRIM(TRANSFORM(lcKey)))
    RETURN .F.
 ENDIF
 RETURN SuiteAfterEntitySave(LOWER(ALLTRIM(tcAlias)), lcKey, NVL(tcAccion, "UPD"))
ENDFUNC
**
FUNCTION SuiteEnqueueEntidad
 * Encolado generico tabla+clave+accion (solo si v2 activo).
 PARAMETER tcTabla, tcClave, tcAccion
 IF TYPE("SuiteColaIsV2Active")#"U" .AND.  .NOT. SuiteColaIsV2Active()
    RETURN .F.
 ENDIF
 IF EMPTY(tcTabla) .OR. EMPTY(ALLTRIM(TRANSFORM(tcClave)))
    RETURN .F.
 ENDIF
 IF TYPE("SuiteEnqueueCola")="U"
    RETURN .F.
 ENDIF
 RETURN SuiteEnqueueCola(tcTabla, tcClave, tcAccion)
ENDFUNC
**
FUNCTION SuiteEnqueueCliente
 PARAMETER tcCodcli, tcAccion
 RETURN SuiteEnqueueEntidad("clientes", tcCodcli, NVL(tcAccion, "UPD"))
ENDFUNC
**
FUNCTION SuiteEnqueueArticulo
 PARAMETER tcCodart, tcAccion
 RETURN SuiteEnqueueEntidad("articulos", tcCodart, NVL(tcAccion, "UPD"))
ENDFUNC
**
FUNCTION SuiteEnqueueBonoCli
 PARAMETER tcCodboncli, tcAccion
 RETURN SuiteEnqueueEntidad("bonoscli", tcCodboncli, NVL(tcAccion, "UPD"))
ENDFUNC
**
FUNCTION SuiteEnqueueVenta
 PARAMETER tcNumalb, tcAccion
 RETURN SuiteEnqueueEntidad("albcab", tcNumalb, NVL(tcAccion, "UPD"))
ENDFUNC
**
FUNCTION SuiteEnqueueFactura
 PARAMETER tcNumfac, tcAccion
 RETURN SuiteEnqueueEntidad("faccab", tcNumfac, NVL(tcAccion, "UPD"))
ENDFUNC
**
FUNCTION SuiteEnqueueCierre
 PARAMETER tcNumcie, tcAccion
 RETURN SuiteEnqueueEntidad("ciecab", tcNumcie, NVL(tcAccion, "UPD"))
ENDFUNC
