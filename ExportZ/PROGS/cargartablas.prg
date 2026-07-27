 USE DBF/CLIENTES ALIAS clientes IN 0
 SELECT clientes
 SET ORDER TO CODCLI
 IF  .NOT. pltpvbar
    IF  .NOT. SEEK("9999998")
       INSERT INTO CLIENTES (codcli, nomcli, foto, forpagcli, tarifa, sexo, dnicli, enviar) VALUES ("9999998", traducir(pcidioma, "CLIENTE CONTADO (HOMBRE)"), "BMP\CLIENTEHOMBRE.JPG", "EFECTIVO", "A", "H", IIF(pcversionpais=="MEX" .OR. pcpais=="MEX", "XAXX010101000", ""), .T.)
    ENDIF
 ENDIF
 IF  .NOT. SEEK("9999999")
    INSERT INTO CLIENTES (codcli, nomcli, foto, forpagcli, tarifa, sexo, dnicli, enviar) VALUES ("9999999", IIF(pltpvbar, traducir(pcidioma, "CLIENTE CONTADO"), traducir(pcidioma, "CLIENTE CONTADO (MUJER)")), IIF(pltpvbar, "BMP\CLIENTEHOMBRE.JPG", "BMP\CLIENTEMUJER.JPG"), "EFECTIVO", "A", IIF(pltpvbar, "H", "M"), IIF(pcversionpais=="MEX" .OR. pcpais=="MEX", "XAXX010101000", ""), .T.)
 ENDIF
 USE IN clientes
 USE DBF/TIPCLI ALIAS tipcli IN 0
 SELECT tipcli
 SET ORDER TO IDTIPCLI
 IF pltpvpeluqueria .AND.  .NOT. pltpvbar
    IF  .NOT. SEEK("000001")
       INSERT INTO TIPCLI (idtipcli, destipcli) VALUES ("000001", traducir(pcidioma, "SECTOR PELUQUERÍA"))
    ENDIF
    IF  .NOT. SEEK("000002")
       INSERT INTO TIPCLI (idtipcli, destipcli) VALUES ("000002", traducir(pcidioma, "SECTOR ESTÉTICA"))
    ENDIF
 ENDIF
 USE IN tipcli
 USE DBF/PROCEDENCIA ALIAS procedencia IN 0
 SELECT procedencia
 SET ORDER TO CODPROCE
 IF pltpvpeluqueria .AND.  .NOT. pltpvbar
    IF  .NOT. SEEK("999999")
       INSERT INTO PROCEDENCIA (codproce, desproce) VALUES ("999999", traducir(pcidioma, "WEB/AGENDA ONLINE"))
    ENDIF
 ENDIF
 USE IN procedencia
 USE DBF/ARTICULOS ALIAS articulos IN 0
 SELECT articulos
 SET ORDER TO CODART
 IF  .NOT. SEEK("9999999999")
    INSERT INTO ARTICULOS (codart, desart, familia1, obsart, ivaart, matpri, enviar, vender) VALUES ("9999999999", traducir(pcidioma, "Bonos Cliente"), "9999999999", traducir(pcidioma, "Este artículo ha sido creado automáticamente por la Aplicación. No se debe borrar."), 1, 2, .T., .T.)
 ENDIF
 USE IN articulos
 USE DBF/FAMILIA1 ALIAS familia1 IN 0
 SELECT familia1
 SET ORDER TO CODFAM1
 IF  .NOT. SEEK("9999999999")
    INSERT INTO FAMILIA1 (codfam1, desfam1, enviar, vender, foto) VALUES ("9999999999", traducir(pcidioma, "Bonos Cliente"), .T., .T., "BMP\BONOS.JPG")
 ENDIF
 USE IN familia1
 USE DBF/EMPLEADOS ALIAS empleados IN 0
 SELECT empleados
 SET ORDER TO CODEMP
 IF  .NOT. SEEK("9999999")
    INSERT INTO EMPLEADOS (codemp, nomemp, foto, enviar) VALUES ("9999999", traducir(pcidioma, "EMPLEADO TPV"), "BMP\EMPLEADOTPV.JPG", .T.)
 ENDIF
 USE IN empleados
 USE DBF/CONCEPTOS ALIAS conceptos IN 0
 SELECT conceptos
 SET ORDER TO IDCONCEPTO
 IF  .NOT. SEEK(99999)
    INSERT INTO CONCEPTOS (idconcepto, desconcep) VALUES (99999, traducir(pcidioma, "VENTAS CONTADO"))
 ENDIF
 USE IN conceptos
 USE DBF/FORPAG ALIAS forpag IN 0
 SELECT forpag
 SET ORDER TO CODFP
 IF  .NOT. SEEK("EFECTIVO")
    INSERT INTO FORPAG (codfp, des, foto, serie, enviar, fpefac) VALUES ("EFECTIVO", traducir(pcidioma, "EFECTIVO"), "BMP/EFECTIVO.JPG", cfgserie, .T., "01")
 ENDIF
 IF  .NOT. SEEK("TARJETA")
    INSERT INTO FORPAG (codfp, des, foto, serie, enviar, fpefac) VALUES ("TARJETA", traducir(pcidioma, "TARJETA"), "BMP/TARJETA.JPG", cfgserie, .T., "04")
 ENDIF
 IF  .NOT. SEEK("BONOS")
    INSERT INTO FORPAG (codfp, des, foto, serie, enviar, fpefac) VALUES ("BONOS", traducir(pcidioma, "BONOS CLIENTE"), "BMP/BONOS.JPG", cfgserie, .T., "")
 ENDIF
 IF  .NOT. SEEK("CASHDRO")
    INSERT INTO FORPAG (codfp, des, foto, serie, enviar, fpefac) VALUES ("CASHDRO", traducir(pcidioma, "CASHDRO"), "BMP/CASHDRO.JPG", cfgserie, .T., "01")
 ENDIF
 USE IN forpag
 USE DBF/GRUPOS ALIAS grupos IN 0
 SELECT grupos
 SET ORDER TO CODGRU
 IF  .NOT. SEEK("Administrador")
    INSERT INTO GRUPOS (codgru, desgru, ladmin) VALUES ("Administrador", traducir(pcidioma, "Grupo Administrador"), .T.)
 ENDIF
 USE IN grupos
 USE DBF/USUARIOS ALIAS usuarios IN 0
 SELECT usuarios
 SET ORDER TO CODUSU
 IF  .NOT. SEEK("Administrador")
    INSERT INTO USUARIOS (codusu, nomusu, codgru) VALUES ("Administrador", traducir(pcidioma, "Usuario Administrador"), "Administrador")
 ENDIF
 USE IN usuarios
 USE DBF/SERIES ALIAS series IN 0
 SELECT series
 SET ORDER TO SERIE
 IF  .NOT. SEEK("A ")
    INSERT INTO SERIES (serie, desser) VALUES ("A ", traducir(pcidioma, "Serie de Facturación A"))
 ENDIF
 IF  .NOT. SEEK("00")
    INSERT INTO SERIES (serie, desser) VALUES ("00", traducir(pcidioma, "Serie exclusiva para BONOS Clientes"))
 ENDIF
 USE IN series
 USE DBF/CODPOS ALIAS codpos IN 0
 SELECT codpos
 GOTO TOP
 IF EOF()
    WAIT WINDOW NOCLEAR NOWAIT traducir(pcidioma, "Importando Códigos Postales...")
    importar_codigos_postales()
    WAIT CLEAR
 ENDIF
 USE IN codpos
 USE DBF/EDADPESO ALIAS edadpeso IN 0
 SELECT edadpeso
 GOTO TOP
 IF EOF()
    WAIT WINDOW NOCLEAR NOWAIT traducir(pcidioma, "Importando Parametros 1...")
    importar_edadpeso()
    WAIT CLEAR
 ENDIF
 USE IN edadpeso
 USE DBF/ALTPESO ALIAS altpeso IN 0
 SELECT altpeso
 GOTO TOP
 IF EOF()
    WAIT WINDOW NOCLEAR NOWAIT traducir(pcidioma, "Importando Parametros 2...")
    importar_altpeso()
    WAIT CLEAR
 ENDIF
 USE IN altpeso
 USE DBF/MESAS ALIAS mesas IN 0
 SELECT mesas
 SET ORDER TO IDMESA
 IF  .NOT. SEEK("Barra")
    INSERT INTO MESAS (idmesa, nommesa) VALUES ("Barra", traducir(pcidioma, "Barra"))
 ENDIF
 USE IN mesas
 USE DBF/TIENDAS ALIAS tiendas IN 0
 SELECT tiendas
 SET ORDER TO IDTIENDA
 IF  .NOT. SEEK("999")
    INSERT INTO TIENDAS (idtienda, nomtie, central, obstie, serie, tipcom) VALUES ("999", traducir(pcidioma, "Tienda Central"), .T., traducir(pcidioma, "No eliminar"), "99", 2)
 ENDIF
 USE IN tiendas
 USE DBF/PLANSMS ALIAS plansms IN 0
 SELECT plansms
 SET ORDER TO IDSMS
 IF  .NOT. SEEK("999998")
    lctexto = traducir(pcidioma, "Estimado/a [@nombre,15],")+CHR(13)+CHR(10)+traducir(pcidioma, "Le recordamos que el proximo dia [@fecha,10] a las [@hora,5] tiene una visita en nuestro centro.")+CHR(13)+CHR(10)+traducir(pcidioma, "Gracias.")
    INSERT INTO PLANSMS (idsms, dessms, texto, tipsms) VALUES ("999998", traducir(pcidioma, "Recordatorio de Visita AGENDA"), lctexto, 2)
 ENDIF
 IF  .NOT. SEEK("999999")
    lctexto = traducir(pcidioma, "Estimado/a [@nombre,15],")+CHR(13)+CHR(10)+traducir(pcidioma, "Le recordamos que el proximo dia [@fecha,10] a las [@hora,5] tiene una visita en nuestro centro.")+CHR(13)+CHR(10)+traducir(pcidioma, "Gracias.")
    INSERT INTO PLANSMS (idsms, dessms, texto, tipsms) VALUES ("999999", traducir(pcidioma, "Recordatorio de Visita PLANIFICADOR"), lctexto, 3)
 ENDIF
 USE IN plansms
 USE DBF/PANTALLAS ALIAS pantallas IN 0
 SELECT pantallas
 SET ORDER TO CODPAN
 IF  .NOT. SEEK("ALBPRO")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("ALBPRO", traducir(pcidioma, "Albaranes de Compra"))
 ENDIF
 IF  .NOT. SEEK("ARTICULOS")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("ARTICULOS", traducir(pcidioma, "Articulos"))
 ENDIF
 IF  .NOT. SEEK("BANCOS")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("BANCOS", traducir(pcidioma, "Bancos"))
 ENDIF
 IF  .NOT. SEEK("CAMEJESER")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("CAMEJESER", traducir(pcidioma, "Cambio de Ejercicio y Serie"))
 ENDIF
 IF  .NOT. SEEK("CLIENTES")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("CLIENTES", traducir(pcidioma, "Clientes"))
 ENDIF
 IF  .NOT. SEEK("CLICON")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("CLICON", traducir(pcidioma, "Consentimientos de Clientes"))
 ENDIF
 IF  .NOT. SEEK("XIMPCLICON")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("XIMPCLICON", traducir(pcidioma, "Impresión de Consentimiento Cliente"))
 ENDIF
 IF  .NOT. SEEK("IMPCONSEN")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPCONSEN", traducir(pcidioma, "Impresión de Consentimientos"))
 ENDIF
 IF  .NOT. SEEK("CODPOS")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("CODPOS", traducir(pcidioma, "Códigos Postales"))
 ENDIF
 IF  .NOT. SEEK("CONFIG")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("CONFIG", traducir(pcidioma, "Configuración de la Aplicación"))
 ENDIF
 IF  .NOT. SEEK("EMPLEADOS")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("EMPLEADOS", traducir(pcidioma, "Empleados"))
 ENDIF
 IF  .NOT. SEEK("ENVIOMAIL")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("ENVIOMAIL", traducir(pcidioma, "Envío de Mails"))
 ENDIF
 IF  .NOT. SEEK("FACTURAS")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("FACTURAS", traducir(pcidioma, "Tickets y Facturas de Clientes"))
 ENDIF
 IF  .NOT. SEEK("PRESUPUESTOS")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("PRESUPUESTOS", traducir(pcidioma, "Presupuestos de Clientes"))
 ENDIF
 IF  .NOT. SEEK("ALBARANES")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("ALBARANES", traducir(pcidioma, "Albaranes de Clientes"))
 ENDIF
 IF  .NOT. SEEK("FAMILIA1")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("FAMILIA1", traducir(pcidioma, "Familias"))
 ENDIF
 IF  .NOT. SEEK("FORPAG")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("FORPAG", traducir(pcidioma, "Formas de Pago"))
 ENDIF
 IF  .NOT. SEEK("GRUPOS")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("GRUPOS", traducir(pcidioma, "Grupos de Usuarios"))
 ENDIF
 IF  .NOT. SEEK("IMPALBP")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPALBP", traducir(pcidioma, "Impresión de Albaranes de Compra"))
 ENDIF
 IF  .NOT. SEEK("IMPPRE")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPPRE", traducir(pcidioma, "Impresión de Presupuestos de Venta"))
 ENDIF
 IF  .NOT. SEEK("IMPXPRE")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPXPRE", traducir(pcidioma, "Listado de Presupuestos de Venta"))
 ENDIF
 IF  .NOT. SEEK("XIMPALB")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("XIMPALB", traducir(pcidioma, "Impresión de Albaranes de Venta"))
 ENDIF
 IF  .NOT. SEEK("IMPXALB")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPXALB", traducir(pcidioma, "Listado de Albaranes de Venta"))
 ENDIF
 IF  .NOT. SEEK("IMPALBXP")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPALBXP", traducir(pcidioma, "Listado de Albaranes de Compra por Proveedor"))
 ENDIF
 IF  .NOT. SEEK("IMPART")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPART", traducir(pcidioma, "Listado de Artículos"))
 ENDIF
 IF  .NOT. SEEK("IMPCLI")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPCLI", traducir(pcidioma, "Listado de Clientes"))
 ENDIF
 IF  .NOT. SEEK("IMPCOB")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPCOB", traducir(pcidioma, "Listado de Cobros de Clientes"))
 ENDIF
 IF  .NOT. SEEK("IMPCOMALB")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPCOMALB", traducir(pcidioma, "Listado de Albaranes de Compra"))
 ENDIF
 IF  .NOT. SEEK("IMPCOMPED")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPCOMPED", traducir(pcidioma, "Listado de Pedidos de Compra"))
 ENDIF
 IF  .NOT. SEEK("IMPVENREP")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPVENREP", traducir(pcidioma, "Listado de Comisiones por Comercial"))
 ENDIF
 IF  .NOT. SEEK("IMPDIAVEN")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPDIAVEN", traducir(pcidioma, "Listado de Diario de Ventas"))
 ENDIF
 IF  .NOT. SEEK("IMPEMP")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPEMP", traducir(pcidioma, "Listado de Empleados"))
 ENDIF
 IF  .NOT. SEEK("IMPFAC")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPFAC", traducir(pcidioma, "Impresión de Factura de Venta"))
 ENDIF
 IF  .NOT. SEEK("IMPFAM")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPFAM", traducir(pcidioma, "Listado de Familias"))
 ENDIF
 IF  .NOT. SEEK("IMPGRU")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPGRU", traducir(pcidioma, "Listado de Grupos de Usuarios"))
 ENDIF
 IF  .NOT. SEEK("IMPINV")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPINV", traducir(pcidioma, "Listado de Inventario"))
 ENDIF
 IF  .NOT. SEEK("IMPPEDP")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPPEDP", traducir(pcidioma, "Impresión de Pedidos de Compra"))
 ENDIF
 IF  .NOT. SEEK("IMPPEDXP")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPPEDXP", traducir(pcidioma, "Listado de Pedidos de Compra por Proveedor"))
 ENDIF
 IF  .NOT. SEEK("IMPPREVEN")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPPREVEN", traducir(pcidioma, "Listado de Presupuestos de Venta"))
 ENDIF
 IF  .NOT. SEEK("IMPPRO")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPPRO", traducir(pcidioma, "Listado de Proveedores"))
 ENDIF
 IF  .NOT. SEEK("IMPUSU")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPUSU", traducir(pcidioma, "Listado de Usuarios"))
 ENDIF
 IF  .NOT. SEEK("IMPVENART")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPVENART", traducir(pcidioma, "Listado de Ventas por Artículo"))
 ENDIF
 IF  .NOT. SEEK("IMPVENCLI")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPVENCLI", traducir(pcidioma, "Listado de Ventas por Cliente"))
 ENDIF
 IF  .NOT. SEEK("INDEXAR")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("INDEXAR", traducir(pcidioma, "Reindexación de Datos"))
 ENDIF
 IF  .NOT. SEEK("INVENTARIO")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("INVENTARIO", traducir(pcidioma, "Inventario de Artículos"))
 ENDIF
 IF  .NOT. SEEK("MAILING")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("MAILING", traducir(pcidioma, "Mailing a Contactos, Clientes y Proveedores"))
 ENDIF
 IF  .NOT. SEEK("MINIFOX")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("MINIFOX", traducir(pcidioma, "Depurador de la Aplicación"))
 ENDIF
 IF  .NOT. SEEK("NUMREG")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("NUMREG", traducir(pcidioma, "Contadores de Facturas, Pedidos..."))
 ENDIF
 IF  .NOT. SEEK("PEDPRO")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("PEDPRO", traducir(pcidioma, "Pedidos de Compra"))
 ENDIF
 IF  .NOT. SEEK("PERMISOS")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("PERMISOS", traducir(pcidioma, "Permisos de Acceso a Pantallas"))
 ENDIF
 IF  .NOT. SEEK("USUARIOS")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("USUARIOS", traducir(pcidioma, "Usuarios"))
 ENDIF
 IF  .NOT. SEEK("1MANTENIMIENTOS")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("1MANTENIMIENTOS", traducir(pcidioma, "MENU - Mantenimientos"))
 ENDIF
 IF  .NOT. SEEK("2VENTAS")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("2VENTAS", traducir(pcidioma, "MENU - Ventas"))
 ENDIF
 IF  .NOT. SEEK("3COMPRAS")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("3COMPRAS", traducir(pcidioma, "MENU - Compras"))
 ENDIF
 IF  .NOT. SEEK("4SEGURIDAD")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("4SEGURIDAD", traducir(pcidioma, "MENU - Seguridad"))
 ENDIF
 IF  .NOT. SEEK("5UTILIDADES")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("5UTILIDADES", traducir(pcidioma, "MENU - Utilidades"))
 ENDIF
 IF  .NOT. SEEK("6COMUNICACIONES")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("6COMUNICACIONES", traducir(pcidioma, "MENU - Comunicaciones"))
 ENDIF
 IF  .NOT. SEEK("CODIGOART")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("CODIGOART", traducir(pcidioma, "Cambio de Código de Artículos"))
 ENDIF
 IF  .NOT. SEEK("CODIGOCLI")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("CODIGOCLI", traducir(pcidioma, "Cambio de Código de Clientes"))
 ENDIF
 IF  .NOT. SEEK("CODIGOPRO")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("CODIGOPRO", traducir(pcidioma, "Cambio de Código de Proveedores"))
 ENDIF
 IF  .NOT. SEEK("SERIES")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("SERIES", traducir(pcidioma, "Mantenimiento de Series de Facturación"))
 ENDIF
 IF  .NOT. SEEK("CIERRE")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("CIERRE", traducir(pcidioma, "Arqueo y Cierre Diario"))
 ENDIF
 IF  .NOT. SEEK("COMUNICACIONES")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("COMUNICACIONES", traducir(pcidioma, "Envío y Recepción de Datos"))
 ENDIF
 IF  .NOT. SEEK("ENTSAL")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("ENTSAL", traducir(pcidioma, "Movimientos de Caja"))
 ENDIF
 IF  .NOT. SEEK("HORARIO")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("HORARIO", traducir(pcidioma, "Agenda"))
 ENDIF
 IF  .NOT. SEEK("IMPAGE")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPAGE", traducir(pcidioma, "Listado de Agenda"))
 ENDIF
 IF  .NOT. SEEK("IMPPLA")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPPLA", traducir(pcidioma, "Listado de Planificador"))
 ENDIF
 IF  .NOT. SEEK("IMPOBSPLAN")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPOBSPLAN", traducir(pcidioma, "Listado de Observaciones Planificador"))
 ENDIF
 IF  .NOT. SEEK("IMPCIE")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPCIE", traducir(pcidioma, "Impresión de Arqueos y Cierres de Caja"))
 ENDIF
 IF  .NOT. SEEK("IMPCIEDET")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPCIEDET", traducir(pcidioma, "Impresión de Cierre Detallado"))
 ENDIF
 IF  .NOT. SEEK("IMPMOV")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPMOV", traducir(pcidioma, "Listado de Movimientos de Caja"))
 ENDIF
 IF  .NOT. SEEK("MANCIE")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("MANCIE", traducir(pcidioma, "Mantenimiento de Arqueos y Cierres"))
 ENDIF
 IF  .NOT. SEEK("TIENDAS")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("TIENDAS", traducir(pcidioma, "Mantenimiento de Tiendas"))
 ENDIF
 IF  .NOT. SEEK("COPIAS")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("COPIAS", traducir(pcidioma, "Copias de Seguridad"))
 ENDIF
 IF  .NOT. SEEK("TRASPASAR")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("TRASPASAR", traducir(pcidioma, "Traspaso de Tickets / Facturas"))
 ENDIF
 IF  .NOT. SEEK("IMP3000C")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMP3000C", traducir(pcidioma, "Listado Modelo 347 Ventas"))
 ENDIF
 IF  .NOT. SEEK("IMP3000P")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMP3000P", traducir(pcidioma, "Listado Modelo 347 Compras"))
 ENDIF
 IF  .NOT. SEEK("CONCEPTOS")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("CONCEPTOS", traducir(pcidioma, "Mantenimiento de Conceptos de Facturación"))
 ENDIF
 IF  .NOT. SEEK("IMPCFAC")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPCFAC", traducir(pcidioma, "Listado Conceptos de Facturación"))
 ENDIF
 IF  .NOT. SEEK("IMPIVAREP")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPIVAREP", traducir(pcidioma, "Listado IVA Repercutido (Modelo 300)"))
 ENDIF
 IF  .NOT. SEEK("IMPIVASOP")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPIVASOP", traducir(pcidioma, "Listado IVA Soportado (Modelo 300)"))
 ENDIF
 IF  .NOT. SEEK("IMPVENANU")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPVENANU", traducir(pcidioma, "Listado Ventas Anuales por Empleado"))
 ENDIF
 IF  .NOT. SEEK("FACPRO")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("FACPRO", traducir(pcidioma, "Facturas de Compra"))
 ENDIF
 IF  .NOT. SEEK("IMPPFAC")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPPFAC", traducir(pcidioma, "Impresión de Factura de Compra"))
 ENDIF
 IF  .NOT. SEEK("IMPCOMFAC")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPCOMFAC", traducir(pcidioma, "Listado de Facturas de Compra"))
 ENDIF
 IF  .NOT. SEEK("IMPFACXP")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPFACXP", traducir(pcidioma, "Listado de Facturas de Compra por Proveedor"))
 ENDIF
 IF  .NOT. SEEK("CARCLI")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("CARCLI", traducir(pcidioma, "Gestión Avanzada de Deudas"))
 ENDIF
 IF  .NOT. SEEK("IMPCARCLI")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPCARCLI", traducir(pcidioma, "Listado de Deudas"))
 ENDIF
 IF  .NOT. SEEK("DEUDAS")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("DEUDAS", traducir(pcidioma, "Liquidación de Deudas"))
 ENDIF
 IF  .NOT. SEEK("MULTICOBRO")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("MULTICOBRO", traducir(pcidioma, "Cobrar Multiples Tickets"))
 ENDIF
 IF  .NOT. SEEK("IMPORTARCODPOS")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPORTARCODPOS", traducir(pcidioma, "Importar Códigos Postales"))
 ENDIF
 IF  .NOT. SEEK("BONOS")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("BONOS", traducir(pcidioma, "Bonos Cliente"))
 ENDIF
 IF  .NOT. SEEK("XBONOSCLI")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("XBONOSCLI", traducir(pcidioma, "Bonos Emitidos a Clientes"))
 ENDIF
 IF  .NOT. SEEK("IMPBON")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPBON", traducir(pcidioma, "Listado de Bonos Cliente"))
 ENDIF
 IF  .NOT. SEEK("IMPBONDET")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPBONDET", traducir(pcidioma, "Listado de Bonos Detallado"))
 ENDIF
 IF  .NOT. SEEK("IMPBONCLIDET")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPBONCLIDET", traducir(pcidioma, "Listado de Bonos de Cliente Detallado"))
 ENDIF
 IF  .NOT. SEEK("XIMPBONCLI")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("XIMPBONCLI", traducir(pcidioma, "Listado de Bonos Emitidos a Clientes"))
 ENDIF
 IF  .NOT. SEEK("IMPETIART")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPETIART", traducir(pcidioma, "Impresión de Etiquetas de Productos y Servicios"))
 ENDIF
 IF  .NOT. SEEK("MESAS")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("MESAS", traducir(pcidioma, "Mesas"))
 ENDIF
 IF  .NOT. SEEK("IMPMES")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPMES", traducir(pcidioma, "Impresión de Mesas"))
 ENDIF
 IF  .NOT. SEEK("IMPETICOM")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPETICOM", traducir(pcidioma, "Impresión de Etiquetas desde Entrada de Material"))
 ENDIF
 IF  .NOT. SEEK("IMPDIAFAM")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPDIAFAM", traducir(pcidioma, "Listado de Ventas por Día y Familia"))
 ENDIF
 IF  .NOT. SEEK("IMPDIAFAMP")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPDIAFAMP", traducir(pcidioma, "Listado de Compras por Día y Familia"))
 ENDIF
 IF  .NOT. SEEK("IMPDIAPFAM")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPDIAPFAM", traducir(pcidioma, "Listado de Compras por Día Proveedor y Familia"))
 ENDIF
 IF  .NOT. SEEK("TARIFAS")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("TARIFAS", traducir(pcidioma, "Actualización Masiva de Tarifas de Venta"))
 ENDIF
 IF  .NOT. SEEK("ACTPUNTOS")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("ACTPUNTOS", traducir(pcidioma, "Actualización Masiva de Puntos Promoción"))
 ENDIF
 IF  .NOT. SEEK("IMPDIACOM")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPDIACOM", traducir(pcidioma, "Impresión de Diario de Compras"))
 ENDIF
 IF  .NOT. SEEK("CLIENTESLOPD")
    INSERT INTO PANTALLAS (codpan, despan, lopd) VALUES ("CLIENTESLOPD", traducir(pcidioma, "Datos de Clientes Protegidos por la LOPD"), .T.)
 ENDIF
 IF  .NOT. SEEK("IMPLOPD")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPLOPD", traducir(pcidioma, "Listado de Accesos a Datos Protegidos LOPD"))
 ENDIF
 IF  .NOT. SEEK("IMPORTARDATOS")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPORTARDATOS", traducir(pcidioma, "Importar Datos"))
 ENDIF
 IF  .NOT. SEEK("IMPORTARCOMPRA")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPORTARCOMPRA", traducir(pcidioma, "Importar Factura de Compra"))
 ENDIF
 IF  .NOT. SEEK("IMPCARPRO")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPCARPRO", traducir(pcidioma, "Listado de Cartera de Proveedores"))
 ENDIF
 IF  .NOT. SEEK("CARPRO")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("CARPRO", traducir(pcidioma, "Cartera de Proveedores"))
 ENDIF
 IF  .NOT. SEEK("FESTIVOS")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("FESTIVOS", traducir(pcidioma, "Días Festivos"))
 ENDIF
 IF  .NOT. SEEK("IMPVENTIPART")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPVENTIPART", traducir(pcidioma, "Estadística de Ventas por Servicios y Productos"))
 ENDIF
 IF  .NOT. SEEK("IMPVENTIPART2")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPVENTIPART2", traducir(pcidioma, "Listado de Ventas por Tipo de Artículo"))
 ENDIF
 IF  .NOT. SEEK("IMPVENPROCE")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPVENPROCE", traducir(pcidioma, "Listado de Ventas por Procedencia"))
 ENDIF
 IF  .NOT. SEEK("IMPVENTIPARTD")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPVENTIPARTD", traducir(pcidioma, "Estadística de Ventas por Día de Servicios y Productos"))
 ENDIF
 IF  .NOT. SEEK("IMPRESDIA")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPRESDIA", traducir(pcidioma, "Listado Resumen Diario"))
 ENDIF
 IF  .NOT. SEEK("IMPRESDIA2")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPRESDIA2", traducir(pcidioma, "Listado Resumen Diario por Tipo de Artículo"))
 ENDIF
 IF  .NOT. SEEK("BAREMOS")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("BAREMOS", traducir(pcidioma, "Mantenimiento de Baremos de Comisiones"))
 ENDIF
 IF  .NOT. SEEK("IMPVENREP2")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPVENREP2", traducir(pcidioma, "Impresión de Comisiones por Baremos"))
 ENDIF
 IF  .NOT. SEEK("PROVEEDOR")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("PROVEEDOR", traducir(pcidioma, "Mantenimiento de Proveedores"))
 ENDIF
 IF  .NOT. SEEK("IMPSER")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPSER", traducir(pcidioma, "Listado de Series de Facturación"))
 ENDIF
 IF  .NOT. SEEK("CONSUMO")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("CONSUMO", traducir(pcidioma, "Gasto Interno"))
 ENDIF
 IF  .NOT. SEEK("IMPMOVART")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPMOVART", traducir(pcidioma, "Listado de Movimientos de Artículos"))
 ENDIF
 IF  .NOT. SEEK("ASISTENTE")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("ASISTENTE", traducir(pcidioma, "Asistente de Configuración"))
 ENDIF
 IF pltpvpeluqueria .OR. pltpvbar
    IF  .NOT. SEEK("RECURSOS")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("RECURSOS", traducir(pcidioma, "Mantenimiento de Recursos"))
    ENDIF
    IF  .NOT. SEEK("IMPPLAREC")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPPLAREC", traducir(pcidioma, "Impresión de Planificador de Recursos"))
    ENDIF
    IF  .NOT. SEEK("IMPREC")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPREC", traducir(pcidioma, "Listado de Recursos"))
    ENDIF
    IF  .NOT. SEEK("PLANREC")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("PLANREC", traducir(pcidioma, "Planificador de Recursos"))
    ENDIF
 ENDIF
 IF  .NOT. SEEK("PLANIFICADOR")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("PLANIFICADOR", traducir(pcidioma, "Planificador de Empleados"))
 ENDIF
 IF  .NOT. SEEK("CONTAB")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("CONTAB", traducir(pcidioma, "Traspaso a Contabilidad"))
 ENDIF
 IF  .NOT. SEEK("ESTVENART")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("ESTVENART", traducir(pcidioma, "Estadística - Artículos Más Vendidos"))
 ENDIF
 IF  .NOT. SEEK("ESTVENDIA")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("ESTVENDIA", traducir(pcidioma, "Estadística - Resumen Ventas por Día"))
 ENDIF
 IF  .NOT. SEEK("ESTVENCLI")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("ESTVENCLI", traducir(pcidioma, "Estadística - Clientes / Última Venta"))
 ENDIF
 IF  .NOT. SEEK("TIPCLI")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("TIPCLI", traducir(pcidioma, "Tipos de Cliente"))
 ENDIF
 IF  .NOT. SEEK("TIPART")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("TIPART", traducir(pcidioma, "Tipos de Artículo"))
 ENDIF
 IF  .NOT. SEEK("PROCEDENCIA")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("PROCEDENCIA", traducir(pcidioma, "Procedencia de Clientes"))
 ENDIF
 IF  .NOT. SEEK("IMPPROCE")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPPROCE", traducir(pcidioma, "Listado de Procedencia de Clientes"))
 ENDIF
 IF  .NOT. SEEK("TIPMOV")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("TIPMOV", traducir(pcidioma, "Tipos de Movimientos de Caja"))
 ENDIF
 IF  .NOT. SEEK("CONSEN")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("CONSEN", traducir(pcidioma, "Consentimientos"))
 ENDIF
 IF  .NOT. SEEK("IMPCONSEN")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPCONSEN", traducir(pcidioma, "Impresión de Consentimientos"))
 ENDIF
 IF  .NOT. SEEK("IMPTIPMOV")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPTIPMOV", traducir(pcidioma, "Listado de Tipos de Movimientos de Caja"))
 ENDIF
 IF  .NOT. SEEK("IMPSMS")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPSMS", traducir(pcidioma, "Listado de SMS Enviados"))
 ENDIF
 IF  .NOT. SEEK("IMPEMAIL")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPEMAIL", traducir(pcidioma, "Listado de Emails Enviados"))
 ENDIF
 IF  .NOT. SEEK("ENVIOSMS")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("ENVIOSMS", traducir(pcidioma, "Envío de SMS"))
 ENDIF
 IF  .NOT. SEEK("ARTMAS")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("ARTMAS", traducir(pcidioma, "Modificación Masiva de Artículos"))
 ENDIF
 IF  .NOT. SEEK("ARTFAMSUC")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("ARTFAMSUC", traducir(pcidioma, "Visibilidad de Familias, Productos y Servicios en Ventas"))
 ENDIF
 IF  .NOT. SEEK("IMPTIENDAS")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPTIENDAS", traducir(pcidioma, "Listado de Tiendas"))
 ENDIF
 IF  .NOT. SEEK("IMPVENALU")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPVENALU", traducir(pcidioma, "Listado de Prácticas por Alumno"))
 ENDIF
 IF  .NOT. SEEK("IMPCONINT")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPCONINT", traducir(pcidioma, "Listado de Consumo Interno"))
 ENDIF
 IF  .NOT. SEEK("ESTVENHORA")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("ESTVENHORA", traducir(pcidioma, "Estadística Ventas por Franja Horaria"))
 ENDIF
 IF  .NOT. SEEK("FACPER")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("FACPER", traducir(pcidioma, "Definición de Facturas Periódicas"))
 ENDIF
 IF  .NOT. SEEK("EMIFACPER")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("EMIFACPER", traducir(pcidioma, "Emisión de Facturas Periódicas"))
 ENDIF
 IF  .NOT. SEEK("IMPFACPER")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPFACPER", traducir(pcidioma, "Listado de Facturas Periódicas"))
 ENDIF
 IF  .NOT. SEEK("REMESAS")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("REMESAS", traducir(pcidioma, "Generación de Remesas Bancarias"))
 ENDIF
 IF  .NOT. SEEK("MANTREM")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("MANTREM", traducir(pcidioma, "Mantenimiento de Remesas Bancarias"))
 ENDIF
 IF  .NOT. SEEK("FACMAS")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("FACMAS", traducir(pcidioma, "Facturación Masiva de Albaranes"))
 ENDIF
 IF  .NOT. SEEK("IMPREM")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPREM", traducir(pcidioma, "Listado de Remesas Bancarias"))
 ENDIF
 IF  .NOT. SEEK("ESTCLIHAB")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("ESTCLIHAB", traducir(pcidioma, "Estadística - Clientes Habituales"))
 ENDIF
 IF  .NOT. SEEK("ESTCLIFAC")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("ESTCLIFAC", traducir(pcidioma, "Estadística - Clientes con Más Ventas"))
 ENDIF
 IF  .NOT. SEEK("ESTCLIFACEMP")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("ESTCLIFACEMP", traducir(pcidioma, "Estadística - Clientes con Más Ventas por Empleado"))
 ENDIF
 IF  .NOT. SEEK("ESTCLIHABEMP")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("ESTCLIHABEMP", traducir(pcidioma, "Estadística - Clientes Habituales de Empleado"))
 ENDIF
 IF  .NOT. SEEK("GRAVENEMPMES")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("GRAVENEMPMES", traducir(pcidioma, "Gráfico Ven. - Ventas Mensuales por Empleado"))
 ENDIF
 IF  .NOT. SEEK("GRAVENFAMMES")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("GRAVENFAMMES", traducir(pcidioma, "Gráfico Ven. - Ventas Mensuales por Familia"))
 ENDIF
 IF  .NOT. SEEK("GRAVENMES")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("GRAVENMES", traducir(pcidioma, "Gráfico Ven. - Ventas Mensuales Comparativo"))
 ENDIF
 IF  .NOT. SEEK("GRACOMMES")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("GRACOMMES", traducir(pcidioma, "Gráfico Com. - Compras Mensuales Comparativo"))
 ENDIF
 IF  .NOT. SEEK("GRABENMES")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("GRABENMES", traducir(pcidioma, "Gráfico Est. - Beneficios Mensuales Comparativo"))
 ENDIF
 IF  .NOT. SEEK("GRAVENCOMBEN")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("GRAVENCOMBEN", traducir(pcidioma, "Gráfico Est. - Ventas / Compras / Beneficios Mensual"))
 ENDIF
 IF  .NOT. SEEK("GRAVENPYSMES")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("GRAVENPYSMES", traducir(pcidioma, "Gráfico Ven. - Ventas por Productos y Servicios"))
 ENDIF
 IF  .NOT. SEEK("GRAVENSEXOMES")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("GRAVENSEXOMES", traducir(pcidioma, "Gráfico Ven. - Ventas Mensuales por Sexo"))
 ENDIF
 IF  .NOT. SEEK("GRAVENCOMBEN2")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("GRAVENCOMBEN2", traducir(pcidioma, "Gráfico Est. - Ventas / Compras / Beneficios"))
 ENDIF
 IF  .NOT. SEEK("GRACLIPESO")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("GRACLIPESO", traducir(pcidioma, "Gráfico Evolución Peso Cliente"))
 ENDIF
 IF  .NOT. SEEK("GALERIAS")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("GALERIAS", traducir(pcidioma, "Galería de Imágenes"))
 ENDIF
 IF  .NOT. SEEK("BLOG")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("BLOG", traducir(pcidioma, "Blog de Noticias"))
 ENDIF
 IF  .NOT. SEEK("IMPPLANINC")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPPLANINC", traducir(pcidioma, "Listado de Incidencias Planificador"))
 ENDIF
 IF  .NOT. SEEK("SAFTPT")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("SAFTPT", traducir(pcidioma, "Generación de fichero SAFT-PT"))
 ENDIF
 IF  .NOT. SEEK("SMSAUTO")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("SMSAUTO", traducir(pcidioma, "Envío de SMS Automáticos"))
 ENDIF
 IF  .NOT. SEEK("IMPNUMSER")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPNUMSER", traducir(pcidioma, "Listado de Números de Serie"))
 ENDIF
 IF  .NOT. SEEK("ESTNUMSER")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("ESTNUMSER", traducir(pcidioma, "Informe Mensual de Números de Serie"))
 ENDIF
 IF  .NOT. SEEK("EFACTURA")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("EFACTURA", traducir(pcidioma, "Consulta de Facturas Electrónicas"))
 ENDIF
 IF  .NOT. SEEK("OFERTAS")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("OFERTAS", traducir(pcidioma, "Mantenimiento de Ofertas"))
 ENDIF
 IF  .NOT. SEEK("IMPDASHBOARD")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPDASHBOARD", traducir(pcidioma, "Cuadro de Mandos"))
 ENDIF
 IF  .NOT. SEEK("ESTFAMART")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("ESTFAMART", traducir(pcidioma, "Ventas por Año / Familia / Artículo"))
 ENDIF
 IF  .NOT. SEEK("IMPIVAREPDET")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPIVAREPDET", traducir(pcidioma, "Listado IVA Repercutido Detallado"))
 ENDIF
 IF  .NOT. SEEK("IMPINVFEC")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPINVFEC", traducir(pcidioma, "Listado de Inventario a Fecha"))
 ENDIF
 IF  .NOT. SEEK("SALDOINICIO")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("SALDOINICIO", traducir(pcidioma, "Saldo Inicial"))
 ENDIF
 IF  .NOT. SEEK("PRESTASHOP")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("PRESTASHOP", traducir(pcidioma, "Exportación a Prestashop"))
 ENDIF
 IF  .NOT. SEEK("CATEMP")
    INSERT INTO PANTALLAS (codpan, despan) VALUES ("CATEMP", traducir(pcidioma, "Categorías Empleados"))
 ENDIF
 IF plcntfranquicia=="franquicia_newlook"
    IF  .NOT. SEEK("PROCLIEMP")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("PROCLIEMP", traducir(pcidioma, "Procedencias Cliente - Empleado"))
    ENDIF
    IF  .NOT. SEEK("IMPVPROCLIEMP")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPVPROCLIEMP", traducir(pcidioma, "Reservas por Procedencia Cliente - Empleado"))
    ENDIF
 ENDIF
 IF pltpvbar
    IF  .NOT. SEEK("PUESTOS")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("PUESTOS", traducir(pcidioma, "Mantenimiento de Puestos"))
    ENDIF
    IF  .NOT. SEEK("IMPPUESTOS")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPPUESTOS", traducir(pcidioma, "Listado de Puestos"))
    ENDIF
    IF  .NOT. SEEK("EXPORTARPDA")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("EXPORTARPDA", traducir(pcidioma, "Exportar Datos a PDA"))
    ENDIF
    IF  .NOT. SEEK("MENUS")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("MENUS", traducir(pcidioma, "Mantenimiento de Menús"))
    ENDIF
    IF  .NOT. SEEK("IMPMENUS")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPMENUS", traducir(pcidioma, "Impresión de Menús"))
    ENDIF
 ENDIF
 IF  .NOT. pltpvpeluqueria .OR. pltpvbar
    IF  .NOT. SEEK("PREDEF")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("PREDEF", traducir(pcidioma, "Mantenimiento de Lotes"))
    ENDIF
 ENDIF
 IF cfggestionescuela
    IF  .NOT. SEEK("CURSOS")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("CURSOS", traducir(pcidioma, "Mantenimiento de Cursos"))
    ENDIF
    IF  .NOT. SEEK("IMPCUR")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPCUR", traducir(pcidioma, "Impresión de Cursos"))
    ENDIF
    IF  .NOT. SEEK("CUREJE")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("CUREJE", traducir(pcidioma, "Mantenimiento de Definición de Cursos"))
    ENDIF
    IF  .NOT. SEEK("IMPCUREJE")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPCUREJE", traducir(pcidioma, "Impresión de Definición de Cursos"))
    ENDIF
    IF  .NOT. SEEK("ALUMNOS")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("ALUMNOS", traducir(pcidioma, "Mantenimiento de Alumnos"))
    ENDIF
    IF  .NOT. SEEK("IMPALU")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPALU", traducir(pcidioma, "Impresión de Alumnos"))
    ENDIF
    IF  .NOT. SEEK("PROFESORES")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("PROFESORES", traducir(pcidioma, "Mantenimiento de Profesores"))
    ENDIF
    IF  .NOT. SEEK("IMPPROF")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPPROF", traducir(pcidioma, "Impresión de Profesores"))
    ENDIF
    IF  .NOT. SEEK("CURASI")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("CURASI", traducir(pcidioma, "Control de Asistencia a Cursos"))
    ENDIF
    IF  .NOT. SEEK("IMPCURASI")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPCURASI", traducir(pcidioma, "Impresión de Asistencia a Cursos"))
    ENDIF
    IF  .NOT. SEEK("GRUALU")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("GRUALU", traducir(pcidioma, "Mantenimiento Grupos de Alumnos"))
    ENDIF
    IF  .NOT. SEEK("IMPGRUALU")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPGRUALU", traducir(pcidioma, "Impresión de Grupos de Alumnos"))
    ENDIF
 ENDIF
 IF cfgcontrolpresencia
    IF  .NOT. SEEK("MOTSAL")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("MOTSAL", traducir(pcidioma, "Mantenimiento de Motivos de Salida"))
    ENDIF
    IF  .NOT. SEEK("IMPMOTSAL")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPMOTSAL", traducir(pcidioma, "Impresión de Motivos de Salida"))
    ENDIF
    IF  .NOT. SEEK("CONPRE")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("CONPRE", traducir(pcidioma, "Control de Presencia"))
    ENDIF
    IF  .NOT. SEEK("IMPCONPRE")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPCONPRE", traducir(pcidioma, "Impresión de Control de Presencia"))
    ENDIF
    IF  .NOT. SEEK("IMPCONPREH")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPCONPREH", traducir(pcidioma, "Control Presencia Agrupado por Día"))
    ENDIF
    IF  .NOT. SEEK("MANPRES")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("MANPRES", traducir(pcidioma, "Mantenimiento de Control de Presencia"))
    ENDIF
 ENDIF
 IF pltpvpeluqueria
    IF  .NOT. SEEK("ESTVENMEN")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("ESTVENMEN", traducir(pcidioma, "Estadística Ventas Mensual"))
    ENDIF
    IF  .NOT. SEEK("EDADPESO")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("EDADPESO", traducir(pcidioma, "Mantenimiento Edad Sexo y Corrección Peso"))
    ENDIF
    IF  .NOT. SEEK("ALTPESO")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("ALTPESO", traducir(pcidioma, "Mantenimiento Altura y Peso"))
    ENDIF
    IF  .NOT. SEEK("IMPTURNO")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPTURNO", traducir(pcidioma, "Imprimir Turno"))
    ENDIF
    IF  .NOT. SEEK("IMPTRACLI")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPTRACLI", traducir(pcidioma, "Listado de Tratamientos"))
    ENDIF
 ENDIF
 IF plcentral
    IF  .NOT. SEEK("CFACTUSOL")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("CFACTUSOL", traducir(pcidioma, "Recepción/Exportación de Pedidos FACTUSOL"))
    ENDIF
 ENDIF
 IF cfgmoduloproveedores
    IF  .NOT. SEEK("PEDPROONLINE")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("PEDPROONLINE", traducir(pcidioma, "Pedidos Online a Proveedores"))
    ENDIF
 ENDIF
 IF cfgmodulotallasycolores
    IF  .NOT. SEEK("TALLASGRU")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("TALLASGRU", traducir(pcidioma, "Grupos de Tallas"))
    ENDIF
    IF  .NOT. SEEK("TALLAS")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("TALLAS", traducir(pcidioma, "Tallas"))
    ENDIF
    IF  .NOT. SEEK("COLORES")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("COLORES", traducir(pcidioma, "Colores"))
    ENDIF
    IF  .NOT. SEEK("IMPARTTYC")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPARTTYC", traducir(pcidioma, "Listado de Tallas y Colores"))
    ENDIF
    IF  .NOT. SEEK("IMPETIARTTYC")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("IMPETIARTTYC", traducir(pcidioma, "Impresión de Etiquetas de Tallas y Colores"))
    ENDIF
 ENDIF
 IF  .NOT. pltpvbar
    IF  .NOT. SEEK("PLANSMS")
       INSERT INTO PANTALLAS (codpan, despan) VALUES ("PLANSMS", traducir(pcidioma, "Plantillas SMS"))
    ENDIF
 ENDIF
 USE IN pantallas
 USE DBF/REPORTS ALIAS reports IN 0
 SELECT reports
 SET ORDER TO NOMFRX
 SET EXACT ON
 IF  .NOT. SEEK("IMPALBP1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPALBP", "IMPALBP1", traducir(pcidioma, "Albarán Proveedor"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPALBXP1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPALBXP", "IMPALBXP1", traducir(pcidioma, "Listado de Albaranes por Proveedor"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPART1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPART", "IMPART1", traducir(pcidioma, "Listado Artículos"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPART2")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPART", "IMPART2", traducir(pcidioma, "Listado Artículos Valorado"), .T., .F.)
 ENDIF
 IF  .NOT. SEEK("IMPCARCLI1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPCARCLI", "IMPCARCLI1", traducir(pcidioma, "Listado Cartera Clientes"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("RECIBO1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPCARCLI", "RECIBO1", traducir(pcidioma, "Impresión de Recibo"), .T., .F.)
 ENDIF
 IF  .NOT. SEEK("IMPCIE1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPCIE", "IMPCIE1", traducir(pcidioma, "Impresión de Arqueos y Cierres"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPCIEDET1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPCIEDET", "IMPCIEDET1", traducir(pcidioma, "Impresión de Cierre Detallado"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPCLI1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPCLI", "IMPCLI1", traducir(pcidioma, "Listado Clientes"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPCLICON1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPCLICON", "IMPCLICON1", traducir(pcidioma, "Impresión de Consentimiento Cliente"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPCONSEN1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPCONSEN", "IMPCONSEN1", traducir(pcidioma, "Impresión de Consentimientos"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPCOMALB1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPCOMALB", "IMPCOMALB1", traducir(pcidioma, "Listado de Albaranes de Compra"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPCOMPED1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPCOMPED", "IMPCOMPED1", traducir(pcidioma, "Listado de Pedidos de Compra"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPDIAVEN1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPDIAVEN", "IMPDIAVEN1", traducir(pcidioma, "Listado Diario de Ventas"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPDIAVEN2")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet, orden) VALUES ("IMPDIAVEN", "IMPDIAVEN2", traducir(pcidioma, "Listado Diario de Ventas por Día"), .T., .F., "fecfac")
 ENDIF
 IF  .NOT. SEEK("IMPEMP1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPEMP", "IMPEMP1", traducir(pcidioma, "Listado de Empleados"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPFAC1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPFAC", "IMPFAC1", traducir(pcidioma, "Impresión de Factura"), .T., .F.)
 ENDIF
 IF  .NOT. SEEK("IMPFAC2")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPFAC", "IMPFAC2", traducir(pcidioma, "Impresión de Factura con Código de Barras Bidimensional"), .T., .F.)
 ENDIF
 IF  .NOT. SEEK("IMPFAC3") .AND. pcpais=="MEX"
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPFAC", "IMPFAC3", traducir(pcidioma, "Impresión de Factura Electrónica (CFDI)"), .T., .F.)
 ENDIF
 IF  .NOT. SEEK("IMPTIC1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPFAC", "IMPTIC1", traducir(pcidioma, "Impresión Ticket de Venta"), .T., IIF(pcversionpais=="MEX" .OR. pcpais=="MEX", .F., .T.))
 ELSE
    IF ALLTRIM(idgrupo)<>"IMPFAC"
       REPLACE idgrupo WITH "IMPFAC"
    ENDIF
 ENDIF
 IF  .NOT. SEEK("IMPTIC2")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPFAC", "IMPTIC2", traducir(pcidioma, "Impresión Ticket con Código de Barras Bidimensional"), .T., IIF(pcversionpais=="MEX" .OR. pcpais=="MEX", .T., .F.))
 ENDIF
 IF  .NOT. SEEK("IMPPRE1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPPRE", "IMPPRE1", traducir(pcidioma, "Impresión Presupuesto"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPPRE2")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPPRE", "IMPPRE2", traducir(pcidioma, "Impresión Presupuesto Folio"), .T., .F.)
 ENDIF
 IF  .NOT. SEEK("IMPXPRE1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPXPRE", "IMPXPRE1", traducir(pcidioma, "Listado de Presupuestos"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPALB1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPALB", "IMPALB1", traducir(pcidioma, "Impresión Albarán"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPALB2")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPALB", "IMPALB2", traducir(pcidioma, "Impresión Albarán Folio"), .T., .F.)
 ENDIF
 IF  .NOT. SEEK("IMPXALB1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPXALB", "IMPXALB1", traducir(pcidioma, "Listado Albaranes"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPFAM1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPFAM", "IMPFAM1", traducir(pcidioma, "Listado de Familias"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPGRU1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPGRU", "IMPGRU1", traducir(pcidioma, "Listado de Grupos de Usuarios"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPINV1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPINV", "IMPINV1", traducir(pcidioma, "Impresión de Inventario"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPMOV1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPMOV", "IMPMOV1", traducir(pcidioma, "Impresión de Movimientos de Caja"), .T., .F.)
 ENDIF
 IF  .NOT. SEEK("IMPDEU1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPMOV", "IMPDEU1", traducir(pcidioma, "Impresión de Deuda"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPENTSAL1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPENTSAL", "IMPENTSAL1", traducir(pcidioma, "Impresión de Entrada o Salida de Caja"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPPEDP1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPPEDP", "IMPPEDP1", traducir(pcidioma, "Impresión de Pedido de Compras"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPPEDXP1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPPEDXP", "IMPPEDXP1", traducir(pcidioma, "Listado de Pedidos de Compras"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPPRO1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPPRO", "IMPPRO1", traducir(pcidioma, "Listado de Proveedores"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPSER1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPSER", "IMPSER1", traducir(pcidioma, "Listado de Series de Facturación"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPUSU1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPUSU", "IMPUSU1", traducir(pcidioma, "Listado de Usuarios"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPVENART1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPVENART", "IMPVENART1", traducir(pcidioma, "Listado de Ventas por Artículo"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPVENART2")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPVENART", "IMPVENART2", traducir(pcidioma, "Listado Última Venta de Artículos"), .T., .F.)
 ENDIF
 IF  .NOT. SEEK("IMPVENCLI1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPVENCLI", "IMPVENCLI1", traducir(pcidioma, "Listado de Ventas por Cliente"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPVENREP1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPVENREP", "IMPVENREP1", traducir(pcidioma, "Listado de Ventas por Empleado"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPVENREP2")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPVENREP2", "IMPVENREP2", traducir(pcidioma, "Impresión de Comisiones por Baremos "), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPVENREP3")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPVENREP", "IMPVENREP3", traducir(pcidioma, "Comisiones Totales por Empleado "), .T., .F.)
 ENDIF
 IF  .NOT. SEEK("IMPVENREP4")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPVENREP2", "IMPVENREP4", traducir(pcidioma, "Comisiones Totales por Baremos"), .T., .F.)
 ENDIF
 IF  .NOT. SEEK("IMPAGE1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPAGE", "IMPAGE1", traducir(pcidioma, "Listado de Agenda"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPPLA1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPPLA", "IMPPLA1", traducir(pcidioma, "Listado de Planificador"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPOBSPLAN1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPOBSPLAN", "IMPOBSPLAN1", traducir(pcidioma, "Listado de Observaciones Planificador"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPPLAN20091")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPPLAN2009", "IMPPLAN20091", traducir(pcidioma, "Listado de Planificador de Empleados"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPPLANNOTA1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPPLANNOTA", "IMPPLANNOTA1", traducir(pcidioma, "Impresión Nota Planificador"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPPLANINC1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPPLANINC", "IMPPLANINC1", traducir(pcidioma, "Listado de Incidencias Planificador"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPPLAN2009R1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPPLAN2009R", "IMPPLAN2009R1", traducir(pcidioma, "Listado de Planificador de Recursos"), .T., .T.)
 ENDIF
 IF pltpvpeluqueria .OR. pltpvbar
    IF  .NOT. SEEK("IMPPLAREC1")
       INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPPLAREC", "IMPPLAREC1", traducir(pcidioma, "Listado de Planificador de Recursos"), .T., .T.)
    ENDIF
 ENDIF
 IF  .NOT. SEEK("IMP3000C1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMP3000C", "IMP3000C1", traducir(pcidioma, "Listado Modelo 347 Ventas"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMP3000P1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMP3000P", "IMP3000P1", traducir(pcidioma, "Listado Modelo 347 Compras"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPCFAC1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPCFAC", "IMPCFAC1", traducir(pcidioma, "Listado Conceptos de Facturación"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPIVAREP1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPIVAREP", "IMPIVAREP1", traducir(pcidioma, "Listado IVA Repercutido (Modelo 300)"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPIVAREP2")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPIVAREP", "IMPIVAREP2", traducir(pcidioma, "Listado IVA Repercutido por Día (Modelo 300)"), .T., .F.)
 ENDIF
 IF  .NOT. SEEK("IMPIVASOP1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPIVASOP", "IMPIVASOP1", traducir(pcidioma, "Listado IVA Soportado (Modelo 300)"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPVENANU1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPVENANU", "IMPVENANU1", traducir(pcidioma, "Listado Ventas Anuales por Empleado"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPPFAC1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPPFAC", "IMPPFAC1", traducir(pcidioma, "Factura de Compra"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPCOMFAC1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPCOMFAC", "IMPCOMFAC1", traducir(pcidioma, "Listado de Facturas de Compra"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPFACXP1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPFACXP", "IMPFACXP1", traducir(pcidioma, "Listado de Facturas por Proveedor"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("COBRO1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPCOB", "COBRO1", traducir(pcidioma, "Impresion Cobro"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPBON1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPBON", "IMPBON1", traducir(pcidioma, "Listado de Bonos Cliente"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPBONDET1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPBONDET", "IMPBONDET1", traducir(pcidioma, "Listado de Bonos Detallado"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPBONDET2")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPBONDET", "IMPBONDET2", traducir(pcidioma, "Bonos Detallado (Formato ticket)"), .T., .F.)
 ENDIF
 IF  .NOT. SEEK("IMPBONCLIDET1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPBONCLIDET", "IMPBONCLIDET1", traducir(pcidioma, "Listado de Bonos Cliente Detallado"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPBONCLIDET2")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPBONCLIDET", "IMPBONCLIDET2", traducir(pcidioma, "Bonos Cliente Detallado (Formato ticket)"), .T., .F.)
 ENDIF
 IF  .NOT. SEEK("XIMPBONCLI1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("XIMPBONCLI", "XIMPBONCLI1", traducir(pcidioma, "Listado de Bonos Emitidos a Clientes"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPETIART1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPETIART", "IMPETIART1", traducir(pcidioma, "Impresión de Etiquetas de Productos y Servicios"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPMES1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPMES", "IMPMES1", traducir(pcidioma, "Impresión de Mesas"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPDIAFAM1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPDIAFAM", "IMPDIAFAM1", traducir(pcidioma, "Listado de Ventas por Día y Familia"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPDIAFAMP1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPDIAFAMP", "IMPDIAFAMP1", traducir(pcidioma, "Listado de Compras por Día y Familia"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPDIAPFAM1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPDIAPFAM", "IMPDIAPFAM1", traducir(pcidioma, "Listado de Compras por Día Proveedor y Familia"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPDIACOM1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPDIACOM", "IMPDIACOM1", traducir(pcidioma, "Impresión de Diario de Compras"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPLOPD1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPLOPD", "IMPLOPD1", traducir(pcidioma, "Listado de Accesos a Datos Protegidos LOPD"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPCARPRO1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPCARPRO", "IMPCARPRO1", traducir(pcidioma, "Listado de Cartera de Proveedores"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPVENTIPART1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPVENTIPART", "IMPVENTIPART1", traducir(pcidioma, "Estadística de Ventas por Servicios y Productos"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPVENTIPART21")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPVENTIPART2", "IMPVENTIPART21", traducir(pcidioma, "Listado de Ventas por Tipo de Artículo"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPVENPROCE1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPVENPROCE", "IMPVENPROCE1", traducir(pcidioma, "Listado de Ventas por Procedencia"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPVENTIPARTD1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPVENTIPARTD", "IMPVENTIPARTD1", traducir(pcidioma, "Estadística de Ventas por Día de Servicios y Productos"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPRESDIA1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPRESDIA", "IMPRESDIA1", traducir(pcidioma, "Listado Resumen Diario"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPRESDIA21")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPRESDIA2", "IMPRESDIA21", traducir(pcidioma, "Listado Resumen Diario por Tipo de Artículo"), .T., .T.)
 ENDIF
 IF pltpvpeluqueria .OR. pltpvbar
    IF  .NOT. SEEK("IMPREC1")
       INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPREC", "IMPREC1", traducir(pcidioma, "Listado de Recursos"), .T., .T.)
    ENDIF
 ENDIF
 IF  .NOT. SEEK("ESTVENART1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("ESTVENART", "ESTVENART1", traducir(pcidioma, "Estadística - Artículo Más Vendido"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("ESTVENCLI1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("ESTVENCLI", "ESTVENCLI1", traducir(pcidioma, "Estadística - Clientes / Última Venta"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPGAS1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPGAS", "IMPGAS1", traducir(pcidioma, "Impresión de Gasto Interno"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPCLILOPD1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPCLILOPD", "IMPCLILOPD1", traducir(pcidioma, "Impresión de Datos LOPD de Clientes"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPCLI2LOPD2")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPCLI2LOPD", "IMPCLI2LOPD2", traducir(pcidioma, "Impresión de Datos Depilación Láser"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPCLICAV1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPCLICAV", "IMPCLICAV1", traducir(pcidioma, "Impresión Ficha Cavitación"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPCLIFICCON1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPCLIFICCON", "IMPCLIFICCON1", traducir(pcidioma, "Impresión Ficha Control"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPCLIFICCON2")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPCLIFICCON", "IMPCLIFICCON2", traducir(pcidioma, "Impresión Ficha Control [Vacía]"), .T., .F.)
 ENDIF
 IF  .NOT. SEEK("IMPPROCE1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPPROCE", "IMPPROCE1", traducir(pcidioma, "Listado de Procedencias de Clientes"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPTIPMOV1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPTIPMOV", "IMPTIPMOV1", traducir(pcidioma, "Listado de Movmientos de Caja"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPCONSEN1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPCONSEN", "IMPCONSEN1", traducir(pcidioma, "Impresión de Consentimientos"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPSMS1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPSMS", "IMPSMS1", traducir(pcidioma, "Listado de SMS Enviados"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPEMAIL1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPEMAIL", "IMPEMAIL1", traducir(pcidioma, "Listado de Emails Enviados"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPTIENDAS1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPTIENDAS", "IMPTIENDAS1", traducir(pcidioma, "Listado de Tiendas"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPVENALU1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPVENALU", "IMPVENALU1", traducir(pcidioma, "Listado de Prácticas por Alumno"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPCONINT1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPCONINT", "IMPCONINT1", traducir(pcidioma, "Listado de Consumo Interno"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("ESTVENHORA1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("ESTVENHORA", "ESTVENHORA1", traducir(pcidioma, "Estadística Ventas por Franja Horaria"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPFACPER1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPFACPER", "IMPFACPER1", traducir(pcidioma, "Listado de Facturas Periódicas"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPREM1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPREM", "IMPREM1", traducir(pcidioma, "Listado de Remesas Bancarias"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("ESTCLIHAB1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("ESTCLIHAB", "ESTCLIHAB1", traducir(pcidioma, "Estadística - Clientes Habituales"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("ESTCLIFAC1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("ESTCLIFAC", "ESTCLIFAC1", traducir(pcidioma, "Estadística - Clientes con Más Ventas"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("ESTCLIFACEMP1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("ESTCLIFACEMP", "ESTCLIFACEMP1", traducir(pcidioma, "Estadística - Clientes con Más Ventas por Empleado"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("ESTCLIHABEMP1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("ESTCLIHABEMP", "ESTCLIHABEMP1", traducir(pcidioma, "Estadística - Clientes Habituales de Empleado"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPCLIPESO1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPCLIPESO", "IMPCLIPESO1", traducir(pcidioma, "Impresión Control de Peso"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPCLITRA1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPCLITRA", "IMPCLITRA1", traducir(pcidioma, "Impresión Tratamiento"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPMOVART1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPMOVART", "IMPMOVART1", traducir(pcidioma, "Listado de Movimientos de Artículos"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("ESTVENDIA1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("ESTVENDIA", "ESTVENDIA1", traducir(pcidioma, "Estadística - Resumen Ventas por Día"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPNUMSER1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPNUMSER", "IMPNUMSER1", traducir(pcidioma, "Informe Mensual de Números de Serie"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("ESTNUMSER1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("ESTNUMSER", "ESTNUMSER1", traducir(pcidioma, "Listado de Números de Serie"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPDASHBOARD1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPDASHBOARD", "IMPDASHBOARD1", traducir(pcidioma, "Cuadro de Mandos"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("ESTFAMART1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("ESTFAMART", "ESTFAMART1", traducir(pcidioma, "Ventas por Año / Familia / Artículo"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPIVAREPDET1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPIVAREPDET", "IMPIVAREPDET1", traducir(pcidioma, "Listado IVA Repercutido Detallado"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPINVFEC1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPINVFEC", "IMPINVFEC1", traducir(pcidioma, "Listado de Inventario a Fecha"), .T., .T.)
 ENDIF
 IF  .NOT. SEEK("IMPCLIFAMILIA1")
    INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPCLIFAMILIA", "IMPCLIFAMILIA1", traducir(pcidioma, "Impresión Ficha Familia Cliente"), .T., .T.)
 ENDIF
 IF cfgcreditosarticulos
    IF  .NOT. SEEK("IMPVENALU2")
       INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPVENALU", "IMPVENALU2", traducir(pcidioma, "Listado de Créditos por Alumno"), .T., .F.)
    ENDIF
 ENDIF
 IF plcntfranquicia=="franquicia_newlook"
    IF  .NOT. SEEK("IMPVPROCLIEMP1")
       INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPVPROCLIEMP", "IMPVPROCLIEMP1", traducir(pcidioma, "Reservas por Procedencia Cliente - Empleado"), .T., .T.)
    ENDIF
 ENDIF
 IF pltpvbar
    IF  .NOT. SEEK("IMPPUESTOS1")
       INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPPUESTOS", "IMPPUESTOS1", traducir(pcidioma, "Listado de Puestos"), .T., .T.)
    ENDIF
    IF  .NOT. SEEK("COMANDAS1")
       INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("COMANDAS", "COMANDAS1", traducir(pcidioma, "Impresión de Comandas Cocina"), .T., .T.)
    ENDIF
    IF  .NOT. SEEK("IMPMENUS1")
       INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPMENUS", "IMPMENUS1", traducir(pcidioma, "Impresión de Menús"), .T., .T.)
    ENDIF
 ENDIF
 IF cfggestionescuela
    IF  .NOT. SEEK("IMPCUR1")
       INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPCUR", "IMPCUR1", traducir(pcidioma, "Listado de Cursos"), .T., .T.)
    ENDIF
    IF  .NOT. SEEK("IMPALU1")
       INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPALU", "IMPALU1", traducir(pcidioma, "Listado de Alumnos"), .T., .T.)
    ENDIF
    IF  .NOT. SEEK("IMPALU2")
       INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPALU", "IMPALU2", traducir(pcidioma, "Listado de Cursos por Alumno"), .T., .F.)
    ENDIF
    IF  .NOT. SEEK("IMPPROF1")
       INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPPROF", "IMPPROF1", traducir(pcidioma, "Listado de Profesores"), .T., .T.)
    ENDIF
    IF  .NOT. SEEK("IMPPROF2")
       INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPPROF", "IMPPROF2", traducir(pcidioma, "Listado de Cursos por Profesor"), .T., .F.)
    ENDIF
    IF  .NOT. SEEK("IMPCUREJE1")
       INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPCUREJE", "IMPCUREJE1", traducir(pcidioma, "Listado de Cursos Definidos"), .T., .T.)
    ENDIF
    IF  .NOT. SEEK("IMPCUREJE2")
       INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPCUREJE", "IMPCUREJE2", traducir(pcidioma, "Listado de Cursos Detallado"), .T., .F.)
    ENDIF
    IF  .NOT. SEEK("IMPCURASI1")
       INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPCURASI", "IMPCURASI1", traducir(pcidioma, "Listado de Asistencia a Cursos"), .T., .T.)
    ENDIF
    IF  .NOT. SEEK("IMPGRUALU1")
       INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPGRUALU", "IMPGRUALU1", traducir(pcidioma, "Listado de Grupos de Usuarios"), .T., .T.)
    ENDIF
 ENDIF
 IF cfgcontrolpresencia
    IF  .NOT. SEEK("IMPMOTSAL1")
       INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPMOTSAL", "IMPMOTSAL1", traducir(pcidioma, "Listado de Motivos de Salida"), .T., .T.)
    ENDIF
    IF  .NOT. SEEK("IMPCONPRE1")
       INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPCONPRE", "IMPCONPRE1", traducir(pcidioma, "Listado de Control de Presencia"), .T., .T.)
    ENDIF
    IF  .NOT. SEEK("IMPCONPREH1")
       INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPCONPREH", "IMPCONPREH1", traducir(pcidioma, "Control Presencia Agrupado por Día"), .T., .T.)
    ENDIF
 ENDIF
 IF pltpvpeluqueria
    IF  .NOT. SEEK("ESTVENMEN1")
       INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("ESTVENMEN", "ESTVENMEN1", traducir(pcidioma, "Estadística Ventas Mensual"), .T., .T.)
    ENDIF
    IF  .NOT. SEEK("IMPTURNO1")
       INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPTURNO", "IMPTURNO1", traducir(pcidioma, "Imprimir Turno"), .T., .T.)
    ENDIF
    IF  .NOT. SEEK("IMPCLIPEL1")
       INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPCLIPEL", "IMPCLIPEL1", traducir(pcidioma, "Impresión Ficha Peluquería"), .T., .T.)
    ENDIF
    IF  .NOT. SEEK("IMPTRACLI1")
       INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPTRACLI", "IMPTRACLI1", traducir(pcidioma, "Listado de Tratamientos"), .T., .T.)
    ENDIF
 ENDIF
 IF cfgmodulotallasycolores
    IF  .NOT. SEEK("IMPARTTYC1")
       INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPARTTYC", "IMPARTTYC1", traducir(pcidioma, "Listado de Tallas y Colores"), .T., .T.)
    ENDIF
    IF  .NOT. SEEK("IMPETIARTTYC1")
       INSERT INTO REPORTS (idgrupo, nomfrx, nomrep, interno, predet) VALUES ("IMPETIARTTYC", "IMPETIARTTYC1", traducir(pcidioma, "Impresión de Etiquetas de Tallas y Colores"), .T., .T.)
    ENDIF
 ENDIF
 USE IN reports
 SET EXACT OFF
ENDPROC
**
