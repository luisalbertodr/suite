* Hooks de salida Style -> Suite para maestros y transacciones.
* Se llaman tras un TABLEUPDATE() exitoso en la tabla correspondiente.
* La cola transporta solo (tabla, id_reg, accion); el agente Node lee el DBF origen completo.
*
* Requiere SuiteEnqueueCola (suite_cola_sync.prg / general.prg) y SuiteColaIsV2Active.
**
FUNCTION SuiteEnqueueEntidad
 * Encolado genérico tabla+clave+accion (solo si v2 activo).
 PARAMETER tcTabla, tcClave, tcAccion
 IF  .NOT. SuiteColaIsV2Active()
    RETURN .F.
 ENDIF
 IF EMPTY(tcTabla) .OR. EMPTY(ALLTRIM(TRANSFORM(tcClave)))
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
