 IF  .NOT. c_abrir_tabla("c_mandia", "c_mandia", 1, "diario", "")
    RETURN .F.
 ENDIF
 SELECT c_mandia
 IF  .NOT. SEEK("00")
    INSERT INTO c_mandia (diario, desdia) VALUES ("00", "Diario General")
 ENDIF
 IF  .NOT. SEEK("01")
    INSERT INTO c_mandia (diario, desdia) VALUES ("01", "Diario Ventas")
 ENDIF
 IF  .NOT. SEEK("02")
    INSERT INTO c_mandia (diario, desdia) VALUES ("02", "Diario Compras")
 ENDIF
 IF  .NOT. SEEK("03")
    INSERT INTO c_mandia (diario, desdia) VALUES ("03", "Cobros y Pagos")
 ENDIF
 IF  .NOT. SEEK("97")
    INSERT INTO c_mandia (diario, desdia) VALUES ("97", "Diario de Apertura")
 ENDIF
 IF  .NOT. SEEK("98")
    INSERT INTO c_mandia (diario, desdia) VALUES ("98", "Diario de Regularización")
 ENDIF
 IF  .NOT. SEEK("99")
    INSERT INTO c_mandia (diario, desdia) VALUES ("99", "Diario de Cierre")
 ENDIF
 c_cerrar_tabla("c_mandia")
 IF  .NOT. c_abrir_tabla("c_cuentas", "c_cuentas", 1, "", "")
    RETURN .F.
 ENDIF
 SELECT c_cuentas
 IF EOF()
    IF c_abrir_maestros("c_maestro", "c_maestro", 1, "", "")
       SELECT c_cuentas
       APPEND FROM DBF("c_maestro")
       c_cerrar_tabla("c_maestro")
    ENDIF
 ENDIF
 c_cerrar_tabla("c_cuentas")
 IF FILE("DBF/PANTALLAS.DBF")
    USE DBF/PANTALLAS ALIAS pantallas IN 0
    SELECT pantallas
    SET ORDER TO CODPAN
    IF  .NOT. SEEK("7CONTABILIDAD")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("7CONTABILIDAD", "MENU - Contabilidad")
    ENDIF
    IF  .NOT. SEEK("C_DIARIO")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("C_DIARIO", "Diario Contable")
    ENDIF
    IF  .NOT. SEEK("C_ASIPRE")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("C_ASIPRE", "Asientos Predefinidos")
    ENDIF
    IF  .NOT. SEEK("C_CUENTAS")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("C_CUENTAS", "Cuentas Contables")
    ENDIF
    IF  .NOT. SEEK("C_MANDIA")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("C_MANDIA", "Mantenimiento de Diarios")
    ENDIF
    IF  .NOT. SEEK("C_NUMREG")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("C_NUMREG", "Contadores de Contabilidad")
    ENDIF
    IF  .NOT. SEEK("C_RENUM")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("C_RENUM", "Contadores de Contabilidad")
    ENDIF
    IF  .NOT. SEEK("C_TRASCLIPRO")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("C_TRASCLIPRO", "Traspaso de Cuentas de Proveedores y Clientes")
    ENDIF
    IF  .NOT. SEEK("C_IMPIVA300")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("C_IMPIVA300", "Listado de Iva (Modelo 300)")
    ENDIF
    IF  .NOT. SEEK("C_IMPIVADET")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("C_IMPIVADET", "Listado de Iva Detallado")
    ENDIF
    IF  .NOT. SEEK("C_IMPIVA347")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("C_IMPIVA347", "Modelo 347")
    ENDIF
    IF  .NOT. SEEK("C_MOD347")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("C_MOD347", "Modelo 347")
    ENDIF
    IF  .NOT. SEEK("C_IMPDIA")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("C_IMPDIA", "Listado de Diario Contable")
    ENDIF
    IF  .NOT. SEEK("C_IMPCUE")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("C_IMPCUE", "Listado de Cuentas Contables")
    ENDIF
    IF  .NOT. SEEK("C_IMPMAY")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("C_IMPMAY", "Libro de Mayor")
    ENDIF
    IF  .NOT. SEEK("C_IMPSUMSAL")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("C_IMPSUMSAL", "Balance de Sumas y Saldos")
    ENDIF
    IF  .NOT. SEEK("C_IMPBALSIT")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("C_IMPBALSIT", "Balance de Situación")
    ENDIF
    IF  .NOT. SEEK("C_IMPBALPYG")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("C_IMPBALPYG", "Balance de Pérdidas y Ganancias")
    ENDIF
    IF  .NOT. SEEK("C_REGUL")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("C_REGUL", "Proceso de Regularización")
    ENDIF
    IF  .NOT. SEEK("C_CIERRE")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("C_CIERRE", "Proceso de Cierre y Apertura")
    ENDIF
    IF  .NOT. SEEK("C_ELICIEREG")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("C_ELICIEREG", "Eliminar Regularización y Cierre/Apertura")
    ENDIF
    IF  .NOT. SEEK("C_VALIDAR")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("C_VALIDAR", "Validar Asientos")
    ENDIF
    USE IN pantallas
    USE DBF/REPORTS ALIAS reports IN 0
    SELECT reports
    SET ORDER TO NOMFRX
    IF  .NOT. SEEK("C_IMPIVA3001")
       INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("C_IMPIVA300", "C_IMPIVA3001", "Listado de IVA (Modelo 300)", .T., .T.)
    ENDIF
    IF  .NOT. SEEK("C_IMPIVADET1")
       INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("C_IMPIVADET", "C_IMPIVADET1", "Listado de IVA Detallado", .T., .T.)
    ENDIF
    IF  .NOT. SEEK("C_IMPIVADET2")
       INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("C_IMPIVADET", "C_IMPIVADET2", "Listado de IVA (a presentar)", .T., .F.)
    ENDIF
    IF  .NOT. SEEK("C_IMPDET3471")
       INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("C_IMPDET347", "C_IMPDET3471", "Detalle Modelo 347", .T., .T.)
    ENDIF
    IF  .NOT. SEEK("C_IMPRES3471")
       INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("C_IMPRES347", "C_IMPRES3471", "Resumen Modelo 347", .T., .T.)
    ENDIF
    IF  .NOT. SEEK("C_IMPDIA1")
       INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("C_IMPDIA", "C_IMPDIA1", "Listado de Diario Contable", .T., .T.)
    ENDIF
    IF  .NOT. SEEK("C_IMPCUE1")
       INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("C_IMPCUE", "C_IMPCUE1", "Listado de Cuentas Contables", .T., .T.)
    ENDIF
    IF  .NOT. SEEK("C_IMPMAY1")
       INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("C_IMPMAY", "C_IMPMAY1", "Libro de Mayor", .T., .T.)
    ENDIF
    IF  .NOT. SEEK("C_IMPSUMSAL1")
       INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("C_IMPSUMSAL", "C_IMPSUMSAL1", "Balance de Sumas y Saldos", .T., .T.)
    ENDIF
    IF  .NOT. SEEK("C_IMPBALSIT1")
       INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("C_IMPBALSIT", "C_IMPBALSIT1", "Balance de Situación", .T., .T.)
    ENDIF
    IF  .NOT. SEEK("C_IMPBALSITDET1")
       INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("C_IMPBALSITDET", "C_IMPBALSITDET1", "Balance de Situación Detallado", .T., .T.)
    ENDIF
    IF  .NOT. SEEK("C_IMPBALPYG1")
       INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("C_IMPBALPYG", "C_IMPBALPYG1", "Balance de Pérdidas y Ganancias", .T., .T.)
    ENDIF
    USE IN reports
 ENDIF
ENDFUNC
**
