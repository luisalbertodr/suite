 displaystatus('Creating database...')
 CLOSE DATABASES ALL
 CREATE DATABASE 'WEDB.DBC'
 displaystatus('Creating table ALBPROC...')
 maketable_albproc()
 displaystatus('Creating table ALBPROL...')
 maketable_albprol()
 displaystatus('Creating table ARTICULOS...')
 maketable_articulos()
 displaystatus('Creating table BANCOS...')
 maketable_bancos()
 displaystatus('Creating table CARCLI...')
 maketable_carcli()
 displaystatus('Creating table CLIENTES...')
 maketable_clientes()
 displaystatus('Creating table COBROS...')
 maketable_cobros()
 displaystatus('Creating table EMPLEADOS...')
 maketable_empleados()
 displaystatus('Creating table FACCAB...')
 maketable_faccab()
 displaystatus('Creating table FACLIN...')
 maketable_faclin()
 displaystatus('Creating table FAMILIA1...')
 maketable_familia1()
 displaystatus('Creating table FORPAG...')
 maketable_forpag()
 displaystatus('Creating table PEDPROC...')
 maketable_pedproc()
 displaystatus('Creating table PEDPROL...')
 maketable_pedprol()
 displaystatus('Creating table PROVEEDOR...')
 maketable_proveedor()
 displaystatus('Creating table REGISTROS...')
 maketable_registros()
 displaystatus('Creating table CIEENTSAL...')
 maketable_cieentsal()
 displaystatus('Creating table CIECAB...')
 maketable_ciecab()
 displaystatus('Creating table CIELIN...')
 maketable_cielin()
 displaystatus('Creating table KITS...')
 maketable_kits()
 displaystatus('Creating table TIENDAS...')
 maketable_tiendas()
 displaystatus('Creating table FOTOS...')
 maketable_fotos()
 displaystatus('Creating table USUARIOS...')
 maketable_usuarios()
 displaystatus('Creating table ACCESOS...')
 maketable_accesos()
 displaystatus('Creating table GRUPOS...')
 maketable_grupos()
 displaystatus('Creating table PANTALLAS...')
 maketable_pantallas()
 displaystatus('Creating table REPORTS...')
 maketable_reports()
 displaystatus('Creating table SERIES...')
 maketable_series()
 displaystatus('Creating table CONCEPTOS...')
 maketable_conceptos()
 displaystatus('Creating table FACPROC...')
 maketable_facproc()
 displaystatus('Creating table FACPROL...')
 maketable_facprol()
 displaystatus('Creating table PLANIFICADOR...')
 maketable_planificador()
 displaystatus('Creating table CODPOS...')
 maketable_codpos()
 displaystatus('Creating table EMPFAM...')
 maketable_empfam()
 displaystatus('Creating table EMPART...')
 maketable_empart()
 displaystatus('Creating table BONOS...')
 maketable_bonos()
 displaystatus('Creating table BONOSFAM...')
 maketable_bonosfam()
 displaystatus('Creating table BONOSART...')
 maketable_bonosart()
 displaystatus('Creating table BONOSCLI...')
 maketable_bonoscli()
 displaystatus('Creating table MESAS...')
 maketable_mesas()
 displaystatus('Creating table LOPD...')
 maketable_lopd()
 displaystatus('Creating table CARPRO...')
 maketable_carpro()
 displaystatus('Creating table PAGOS...')
 maketable_pagos()
 displaystatus('Creating table FESTIVOS...')
 maketable_festivos()
 displaystatus('Creating table EMPFEST...')
 maketable_empfest()
 displaystatus('Creating table PUESTOS...')
 maketable_puestos()
 displaystatus('Creating table FACLINTMP...')
 maketable_faclintmp()
 displaystatus('Creating table FOTOSTMP...')
 maketable_fotostmp()
 displaystatus('Creating table FACCABTMP...')
 maketable_faccabtmp()
 displaystatus('Creating table IMPRESORAS...')
 maketable_impresoras()
 displaystatus('Creating table BAREMOS...')
 maketable_baremos()
 displaystatus('Creating table RANGOS...')
 maketable_rangos()
 displaystatus('Creating table MENUS...')
 maketable_menus()
 displaystatus('Creating table MENUDET...')
 maketable_menudet()
 displaystatus('Creating table CLILOPD...')
 maketable_clilopd()
 displaystatus('Creating table TICKETPREC...')
 maketable_ticketprec()
 displaystatus('Creating table TICKETPREL...')
 maketable_ticketprel()
 displaystatus('Creating table AGENDA...')
 maketable_agenda()
 displaystatus('Creating table RECURSOS...')
 maketable_recursos()
 displaystatus('Creating table ALUMNOS...')
 maketable_alumnos()
 displaystatus('Creating table PROFESORES...')
 maketable_profesores()
 displaystatus('Creating table CURSOS...')
 maketable_cursos()
 displaystatus('Creating table CUREJE...')
 maketable_cureje()
 displaystatus('Creating table CURALU...')
 maketable_curalu()
 displaystatus('Creating table CURPROF...')
 maketable_curprof()
 displaystatus('Creating table CURASI...')
 maketable_curasi()
 displaystatus('Creating table MOTSAL...')
 maketable_motsal()
 displaystatus('Creating table PRESENCIA...')
 maketable_presencia()
 displaystatus('Creating table TIPCLI...')
 maketable_tipcli()
 displaystatus('Creating table GASCAB...')
 maketable_gascab()
 displaystatus('Creating table GASLIN...')
 maketable_gaslin()
 displaystatus('Creating table PROCEDENCIA...')
 maketable_procedencia()
 displaystatus('Creating table TIPMOV...')
 maketable_tipmov()
 displaystatus('Creating table SMS...')
 maketable_sms()
 displaystatus('Creating table CBARRAS...')
 maketable_cbarras()
 displaystatus('Creating table GRUALU...')
 maketable_grualu()
 displaystatus('Creating table BONOSART1...')
 maketable_bonosart1()
 displaystatus('Creating table BONOSART2...')
 maketable_bonosart2()
 displaystatus('Creating table PLANART...')
 maketable_planart()
 displaystatus('Creating table FACCABPER...')
 maketable_faccabper()
 displaystatus('Creating table FACLINPER...')
 maketable_faclinper()
 displaystatus('Creating table REMESAS...')
 maketable_remesas()
 displaystatus('Creating table CLIPESO...')
 maketable_clipeso()
 displaystatus('Creating table EDADPESO...')
 maketable_edadpeso()
 displaystatus('Creating table ALTPESO...')
 maketable_altpeso()
 displaystatus('Creating table CLITRA...')
 maketable_clitra()
 displaystatus('Creating table TALLASGRU...')
 maketable_tallasgru()
 displaystatus('Creating table TALLAS...')
 maketable_tallas()
 displaystatus('Creating table COLORES...')
 maketable_colores()
 displaystatus('Creating table TALLASART...')
 maketable_tallasart()
 displaystatus('Creating table GALERIAS...')
 maketable_galerias()
 displaystatus('Creating table AGENDAART...')
 maketable_agendaart()
 displaystatus('Creating table PLAN2009...')
 maketable_plan2009()
 displaystatus('Creating table PLANSMS...')
 maketable_plansms()
 displaystatus('Creating table PLANINC...')
 maketable_planinc()
 displaystatus('Creating table EMAIL...')
 maketable_email()
 displaystatus('Creating table TIPART...')
 maketable_tipart()
 displaystatus('Creating table CLICAV...')
 maketable_clicav()
 displaystatus('Creating table FAVORITOS...')
 maketable_favoritos()
 displaystatus('Creating table SMSAUTO...')
 maketable_smsauto()
 displaystatus('Creating table SMSAUTOREG...')
 maketable_smsautoreg()
 displaystatus('Creating table PRELIN...')
 maketable_prelin()
 displaystatus('Creating table PRECAB...')
 maketable_precab()
 displaystatus('Creating table ACUENTA...')
 maketable_acuenta()
 displaystatus('Creating table ALBCAB...')
 maketable_albcab()
 displaystatus('Creating table ALBLIN...')
 maketable_alblin()
 displaystatus('Creating table CONSEN...')
 maketable_consen()
 displaystatus('Creating table FIRMAS...')
 maketable_firmas()
 displaystatus('Creating table CLICON...')
 maketable_clicon()
 displaystatus('Creating table NUMSER...')
 maketable_numser()
 displaystatus('Creating table CLISESLAS...')
 maketable_cliseslas()
 displaystatus('Creating table RESUMENDIA...')
 maketable_resumendia()
 displaystatus('Creating table OFERTAS...')
 maketable_ofertas()
 displaystatus('Creating table OFERTASART...')
 maketable_ofertasart()
 displaystatus('Creating table OFERTASFAM...')
 maketable_ofertasfam()
 displaystatus('Creating table TURNOS...')
 maketable_turnos()
 displaystatus('Creating table PLANTMP...')
 maketable_plantmp()
 displaystatus('Creating table CLIPEL...')
 maketable_clipel()
 displaystatus('Creating table INVENTARIO...')
 maketable_inventario()
 displaystatus('Creating table PROCLIEMP...')
 maketable_procliemp()
 displaystatus('Creating table REMREC...')
 maketable_remrec()
 displaystatus('Creating table BLOG...')
 maketable_blog()
 displaystatus('Creating table CLIFAMILIA...')
 maketable_clifamilia()
 displaystatus('Creating table CATEMP...')
 maketable_catemp()
 displaystatus('Creating table OBSPLAN...')
 maketable_obsplan()
 displaystatus('Finished.')
ENDPROC
**
PROCEDURE MakeTable_ALBPROC
 CREATE TABLE 'ALBPROC.DBF' NAME 'ALBPROC' (seralb C (4) NOT NULL, ejealb N (4, 0) NOT NULL, numalb N (10, 0) NOT NULL, fecalb D NOT NULL, serped C (4) NOT NULL, ejeped N (4, 0) NOT NULL, numped N (10, 0) NOT NULL, sualb C (20) NOT NULL, codpro C (15) NOT NULL, obsalb M NOT NULL, impbas1 B (6) NOT NULL, impbas2 B (6) NOT NULL, impbas3 B (6) NOT NULL, impbas4 B (6) NOT NULL, impiva1 B (6) NOT NULL, impiva2 B (6) NOT NULL, impiva3 B (6) NOT NULL, impiva4 B (6) NOT NULL, iva1 N (5, 2) NOT NULL, iva2 N (5, 2) NOT NULL, iva3 N (5, 2) NOT NULL, iva4 N (5, 2) NOT NULL, totimpbas B (6) NOT NULL, totimpdto B (6) NOT NULL, totimpiva B (6) NOT NULL, totalb B (6) NOT NULL, lineas N (5, 0) NOT NULL, impresa L NOT NULL, forpag C (10) NOT NULL, fijo1 N (3, 0) NOT NULL, fijo2 N (3, 0) NOT NULL, fijo3 N (3, 0) NOT NULL, numpag N (3, 0) NOT NULL, pripag N (3, 0) NOT NULL, entpag N (3, 0) NOT NULL, dtopp N (5, 2) NOT NULL, dto1 N (5, 2) NOT NULL, facturado L NOT NULL, enviar L NOT NULL, idconcepto N (5, 0) NOT NULL, actrec L NOT NULL, rec1 N (5, 2) NOT NULL, rec2 N (5, 2) NOT NULL, rec3 N (5, 2) NOT NULL, rec4 N (5, 2) NOT NULL, imprec1 B (6) NOT NULL, imprec2 B (6) NOT NULL, imprec3 B (6) NOT NULL, imprec4 B (6) NOT NULL, totimprec B (6) NOT NULL, actirpfp L NOT NULL, irpfp N (5, 2) NOT NULL, impirpfp B (6) NOT NULL, codban C (20) NOT NULL, cueban C (23) NOT NULL)
 INDEX ON STR(ejealb, 4)+seralb+STR(numalb, 10) TAG numalb COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_ALBPROL
 CREATE TABLE 'ALBPROL.DBF' NAME 'ALBPROL' (seralb C (4) NOT NULL, ejealb N (4, 0) NOT NULL, numalb N (10, 0) NOT NULL, linalb N (5, 0) NOT NULL, serped C (4) NOT NULL, ejeped N (4, 0) NOT NULL, numped N (10, 0) NOT NULL, linped N (5, 0) NOT NULL, codart C (15) NOT NULL, desart C (100) NOT NULL, preven B (6) NOT NULL, canser B (6) NOT NULL, subtot B (6) NOT NULL, descuento N (5, 2) NOT NULL, taniva N (1, 0) NOT NULL, obser M NOT NULL, idtalla C (15) NOT NULL, idcolor C (15) NOT NULL, numser C (30) NOT NULL)
 INDEX ON STR(ejealb, 4)+seralb+STR(numalb, 10)+STR(linalb, 5) TAG linalb COLLATE 'MACHINE'
 INDEX ON codart TAG codart COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_ARTICULOS
 CREATE TABLE 'ARTICULOS.DBF' NAME 'ARTICULOS' (codart C (15) NOT NULL, codartdos C (20) NOT NULL, desart C (100) NOT NULL, familia1 C (10) NOT NULL, foto C (254) NOT NULL, tipart C (20) NOT NULL, codpro C (15) NOT NULL, coste B (4) NOT NULL, pvpa B (4) NOT NULL, pvpb B (4) NOT NULL, pvpc B (4) NOT NULL, pvpd B (4) NOT NULL, pvpe B (4) NOT NULL, stock B (4) NOT NULL, pedido B (4) NOT NULL, obsart M NOT NULL, ivaart N (1, 0) NOT NULL, matpri N (1, 0) NOT NULL, enviar L NOT NULL, vender L NOT NULL, porpvpa N (6, 2) NOT NULL DEFAULT 0.00 , porpvpb N (6, 2) NOT NULL DEFAULT 0.00 , porpvpc N (6, 2) NOT NULL DEFAULT 0.00 , porpvpd N (6, 2) NOT NULL DEFAULT 0.00 , porpvpe N (6, 2) NOT NULL DEFAULT 0.00 , pvpvar L NOT NULL, avichgpvp L NOT NULL, desartcort C (25) NOT NULL, obsoleto L NOT NULL, tiempo C (3) NOT NULL, idpuesto C (15) NOT NULL, bascula L NOT NULL, orden N (5, 0) NOT NULL, ntickets N (6, 2) NOT NULL, codcuev C (10) NOT NULL, codcuec C (10) NOT NULL, pedpvp L NOT NULL, peddes L NOT NULL, stomin B (4) NOT NULL, stomax B (4) NOT NULL, creditos N (10, 0) NOT NULL, colorf N (10, 0) NOT NULL DEFAULT RGB(216, 216, 216), colorl N (10, 0) NOT NULL DEFAULT RGB(51, 51, 51), contallas L NOT NULL, enviarweb L NOT NULL, envfotweb L NOT NULL, pvpcoma B (6) NOT NULL, pvpcomb B (6) NOT NULL, pvpcomc B (6) NOT NULL, pvpcomd B (6) NOT NULL, pvpcome B (6) NOT NULL, puntos N (7, 2) NOT NULL, pedpulsos L NOT NULL, idtipart C (15) NOT NULL, dtov N (5, 2) NOT NULL, dtoc N (5, 2) NOT NULL, actnumser L NOT NULL, motexeiva C (100) NOT NULL, poremps N (6, 2) NOT NULL, prestashop L NOT NULL, presenv L NOT NULL, prestags M NOT NULL, presmettit C (100) NOT NULL, presmetkey M NOT NULL, presmetdes C (200) NOT NULL, presurl C (100) NOT NULL, prescosenv B (6) NOT NULL, prescodart N (10, 0) NOT NULL)
 INDEX ON codart TAG codart COLLATE 'MACHINE'
 INDEX ON codpro+codart TAG codpro COLLATE 'MACHINE'
 INDEX ON familia1+codart TAG famsub COLLATE 'MACHINE'
 INDEX ON desart TAG desart COLLATE 'MACHINE'
 INDEX ON UPPER(codartdos) TAG codartdos COLLATE 'MACHINE'
 INDEX ON VAL(codart) TAG valcodart COLLATE 'MACHINE'
 INDEX ON idpuesto+codart TAG idpuesto COLLATE 'MACHINE'
 INDEX ON familia1+STR(orden, 5) TAG famord COLLATE 'MACHINE'
 INDEX ON familia1+desart TAG famdes COLLATE 'MACHINE'
 INDEX ON enviar TAG enviar COLLATE 'MACHINE'
 INDEX ON prestashop TAG prestashop COLLATE 'MACHINE'
 DBSETPROP('ARTICULOS.PORPVPA', 'Field', 'Comment', "porcentaje de PVP respecto COSTE")
 DBSETPROP('ARTICULOS.PVPVAR', 'Field', 'Comment', "PVP variable segun P.Coste")
 DBSETPROP('ARTICULOS.AVICHGPVP', 'Field', 'Comment', "Avisar si cambia el pvp")
 DBSETPROP('ARTICULOS.NTICKETS', 'Field', 'Comment', "Nº Tickets de coste para bonos")
ENDPROC
**
PROCEDURE MakeTable_BANCOS
 CREATE TABLE 'BANCOS.DBF' NAME 'BANCOS' (codban C (20) NOT NULL, nomban C (80) NOT NULL, dirban C (80) NOT NULL, codposban C (15) NOT NULL, pobban C (80) NOT NULL, proban C (80) NOT NULL, asenta C (80) NOT NULL, pais C (80) NOT NULL, tel1ban C (15) NOT NULL, tel2ban C (15) NOT NULL, tel3ban C (15) NOT NULL, email C (80) NOT NULL, obsban M NOT NULL, codcue C (10) NOT NULL DEFAULT "5720000000", entidad C (4) NOT NULL, oficina C (4) NOT NULL, cuenta C (23) NOT NULL, iban C (40) NOT NULL, swift C (15) NOT NULL)
 INDEX ON codban TAG codban COLLATE 'MACHINE'
 INDEX ON nomban TAG nomban COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_CARCLI
 CREATE TABLE 'CARCLI.DBF' NAME 'CARCLI' (ejefac N (4, 0) NOT NULL, serfac C (4) NOT NULL, numfac N (10, 0) NOT NULL, fecfac D NOT NULL, codcli C (15) NOT NULL, numrec N (12, 0) NOT NULL, fecven D NOT NULL, forpag C (10) NOT NULL, imprec B (4) NOT NULL, impcob B (4) NOT NULL, fecval D NOT NULL, idconcepto N (5, 0) NOT NULL, codban C (20) NOT NULL, cueban C (23) NOT NULL, codpro C (15) NOT NULL, liquidado L NOT NULL, estado C (1) NOT NULL DEFAULT "Pendiente", gasimp B (4) NOT NULL, gasvar B (4) NOT NULL, imprecibo B (4) NOT NULL, ejerem N (4, 0) NOT NULL, serrem C (4) NOT NULL, idrem N (10, 0) NOT NULL, acuenta L NOT NULL, iban C (40) NOT NULL)
 INDEX ON codcli TAG codcli COLLATE 'MACHINE'
 INDEX ON STR(ejefac, 4)+serfac+STR(numfac, 10)+STR(numrec, 12) TAG numfac COLLATE 'MACHINE'
 INDEX ON STR(ejerem, 4)+serrem+STR(idrem, 10)+STR(ejefac, 4)+serfac+STR(numfac, 10)+STR(numrec, 10) TAG idrem COLLATE 'MACHINE'
 INDEX ON fecfac TAG fecfac COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_CLIENTES
 CREATE TABLE 'CLIENTES.DBF' NAME 'CLIENTES' (codcli C (15) NOT NULL, nomcli C (50) NOT NULL, ape1cli C (40) NOT NULL, email C (40) NOT NULL, dnicli C (20) NOT NULL, dircli C (80) NOT NULL, codposcli C (15) NOT NULL, pobcli C (80) NOT NULL, procli C (80) NOT NULL, asenta C (80) NOT NULL, pais C (80) NOT NULL, tel1cli C (15) NOT NULL, tel2cli C (15) NOT NULL, foto C (254) NOT NULL, tipcli C (40) NOT NULL, obscli M NOT NULL, dtopp N (5, 2) NOT NULL, dto1 N (5, 2) NOT NULL, forpagcli C (10) NOT NULL, fijo1 N (3, 0) NOT NULL, fijo2 N (3, 0) NOT NULL, fijo3 N (3, 0) NOT NULL, numpag N (3, 0) NOT NULL, pripag N (3, 0) NOT NULL, entpag N (3, 0) NOT NULL, deuda B (6) NOT NULL, codemp C (15) NOT NULL, faxcli C (15) NOT NULL, puntos N (12, 2) NOT NULL, tarifa C (1) NOT NULL, fecnac D NOT NULL, enviar L NOT NULL, sexo C (1) NOT NULL, obslopdo M NOT NULL, tipcuecabp C (40) NOT NULL, tipcabp C (40) NOT NULL, estcabp C (40) NOT NULL, proutip M NOT NULL, sesionesp C (6) NOT NULL, frecuenp C (40) NOT NULL, fecinip C (10) NOT NULL, fecfinp C (10) NOT NULL, prouticp M NOT NULL, formulasp M NOT NULL, tecnicap C (80) NOT NULL, tieexpp C (80) NOT NULL, pesoe C (7) NOT NULL, tippiee C (40) NOT NULL, embarazoe C (2) NOT NULL, alergiase M NOT NULL, marcape C (2) NOT NULL, protesise C (80) NOT NULL, heridase M NOT NULL, operacione M NOT NULL, tiroidese C (2) NOT NULL, anticone C (80) NOT NULL, tensione C (80) NOT NULL, enfnonome M NOT NULL, proutie M NOT NULL, sesionese C (6) NOT NULL, frecuene C (40) NOT NULL, fecinie C (10) NOT NULL, fecfine C (10) NOT NULL, diabetese C (2) NOT NULL, obsoleto L NOT NULL, codalu C (15) NOT NULL, codcue C (10) NOT NULL, idtipcli C (15) NOT NULL, codcli2 C (40) NOT NULL, codproce C (15) NOT NULL, doclopd C (254) NOT NULL, percon C (100) NOT NULL, fecalta D NOT NULL DEFAULT DATE(), essocio L NOT NULL, fecaltsoc D NOT NULL, fecbajsoc D NOT NULL, codban C (20) NOT NULL, cueban C (23) NOT NULL, altura N (3, 0) NOT NULL, concor N (1, 0) NOT NULL DEFAULT 2, bonosneg L NOT NULL, codemppel C (15) NOT NULL, codempest C (15) NOT NULL, profesion C (100) NOT NULL, menprovis M NOT NULL, siniva L NOT NULL, conrec L NOT NULL, idcenalta C (15) NOT NULL, nomcen C (100) NOT NULL, numcalle C (30) NOT NULL, numpiso C (30) NOT NULL, enviarand L NOT NULL, iban C (40) NOT NULL, swift C (15) NOT NULL, idmansepa C (30) NOT NULL, fecmansepa D NOT NULL, enviarcro L NOT NULL, actpuntos L NOT NULL, opcpuntos N (1, 0) NOT NULL, codclienl C (15) NOT NULL, idioma C (30) NOT NULL, envticmail L NOT NULL)
 INDEX ON codcli TAG codcli COLLATE 'MACHINE'
 INDEX ON ape1cli TAG ape1cli COLLATE 'MACHINE'
 INDEX ON nomcli TAG nomcli COLLATE 'MACHINE'
 INDEX ON VAL(codcli) TAG numcodcli COLLATE 'MACHINE'
 INDEX ON codcli2 TAG codcli2 COLLATE 'MACHINE'
 INDEX ON UPPER(email) TAG email COLLATE 'MACHINE'
 INDEX ON enviar TAG enviar COLLATE 'MACHINE'
 INDEX ON DTOC(fecnac) TAG fecnac COLLATE 'MACHINE'
 INDEX ON DTOS(fecalta) TAG fecalta COLLATE 'MACHINE'
 INDEX ON enviarand TAG enviarand COLLATE 'MACHINE'
 INDEX ON enviarcro TAG enviarcro COLLATE 'MACHINE'
 INDEX ON codclienl TAG codclienl COLLATE 'MACHINE'
 DBSETPROP('CLIENTES.SEXO', 'Field', 'Comment', "(H)ombre, (M)ujer")
ENDPROC
**
PROCEDURE MakeTable_COBROS
 CREATE TABLE 'COBROS.DBF' NAME 'COBROS' (numcob N (14, 0) NOT NULL, ejefac N (4, 0) NOT NULL, serfac C (4) NOT NULL, numfac N (10, 0) NOT NULL, numrec N (12, 0) NOT NULL, feccob D NOT NULL, impcob B (4) NOT NULL, forpag C (10) NOT NULL, contab L NOT NULL, acuenta L NOT NULL, ejerem N (4, 0) NOT NULL, serrem C (4) NOT NULL, idrem N (10, 0) NOT NULL, codban C (20) NOT NULL, impdev B (4) NOT NULL)
 INDEX ON numcob TAG numcob COLLATE 'MACHINE'
 INDEX ON STR(ejefac, 4)+serfac+STR(numfac, 10)+STR(numrec, 12) TAG numrec COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_EMPLEADOS
 CREATE TABLE 'EMPLEADOS.DBF' NAME 'EMPLEADOS' (codemp C (15) NOT NULL, nomemp C (80) NOT NULL, ape1emp C (80) NOT NULL, ape2emp C (80) NOT NULL, dniemp C (20) NOT NULL, diremp C (80) NOT NULL, codposemp C (15) NOT NULL, pobemp C (80) NOT NULL, proemp C (80) NOT NULL, asenta C (80) NOT NULL, pais C (80) NOT NULL, tel1emp C (15) NOT NULL, tel2emp C (15) NOT NULL, tel3emp C (15) NOT NULL, foto C (254) NOT NULL, tipemp C (40) NOT NULL, obsemp M NOT NULL, comision N (5, 2) NOT NULL, obsoleto L NOT NULL, fecbaja D NOT NULL, lunes L NOT NULL, martes L NOT NULL, miercoles L NOT NULL, jueves L NOT NULL, viernes L NOT NULL, sabado L NOT NULL, domingo L NOT NULL, codemp2 C (20) NOT NULL, tipcom N (1, 0) NOT NULL DEFAULT 1, barprod C (15) NOT NULL, barserv C (15) NOT NULL, dia1a C (5) NOT NULL DEFAULT "00:00", dia1b C (5) NOT NULL DEFAULT "15:00", dia1c C (5) NOT NULL DEFAULT "15:00", dia1d C (5) NOT NULL DEFAULT "23:59", dia2a C (5) NOT NULL DEFAULT "00:00", dia2b C (5) NOT NULL DEFAULT "15:00", dia2c C (5) NOT NULL DEFAULT "15:00", dia2d C (5) NOT NULL DEFAULT "23:59", dia3a C (5) NOT NULL DEFAULT "00:00", dia3b C (5) NOT NULL DEFAULT "15:00", dia3c C (5) NOT NULL DEFAULT "15:00", dia3d C (5) NOT NULL DEFAULT "23:59", dia4a C (5) NOT NULL DEFAULT "00:00", dia4b C (5) NOT NULL DEFAULT "15:00", dia4c C (5) NOT NULL DEFAULT "15:00", dia4d C (5) NOT NULL DEFAULT "23:59", dia5a C (5) NOT NULL DEFAULT "00:00", dia5b C (5) NOT NULL DEFAULT "15:00", dia5c C (5) NOT NULL DEFAULT "15:00", dia5d C (5) NOT NULL DEFAULT "23:59", dia6a C (5) NOT NULL DEFAULT "00:00", dia6b C (5) NOT NULL DEFAULT "15:00", dia6c C (5) NOT NULL DEFAULT "15:00", dia6d C (5) NOT NULL DEFAULT "23:59", dia7a C (5) NOT NULL DEFAULT "00:00", dia7b C (5) NOT NULL DEFAULT "15:00", dia7c C (5) NOT NULL DEFAULT "15:00", dia7d C (5) NOT NULL DEFAULT "23:59", verplan L NOT NULL DEFAULT .T., ordplan N (5, 0) NOT NULL, colorpf N (10, 0) NOT NULL DEFAULT RGB(242, 249, 255), colorpl N (10, 0) NOT NULL DEFAULT RGB(62, 66, 101), enviar L NOT NULL, allcentros L NOT NULL, enviarweb L NOT NULL, envfotweb L NOT NULL, enviarcro L NOT NULL, titaddi C (100) NOT NULL, obsaddi M NOT NULL, facebook C (250) NOT NULL, twitter C (250) NOT NULL, instagram C (250) NOT NULL, ordaddi N (5, 0) NOT NULL, idcatemp C (15) NOT NULL)
 INDEX ON codemp TAG codemp COLLATE 'MACHINE'
 INDEX ON ape1emp TAG ape1emp COLLATE 'MACHINE'
 INDEX ON nomemp TAG nomemp COLLATE 'MACHINE'
 INDEX ON codemp2 TAG codemp2 COLLATE 'MACHINE'
 INDEX ON STR(ordplan, 5)+codemp TAG ordplan COLLATE 'MACHINE'
 INDEX ON enviarcro TAG enviarcro COLLATE 'MACHINE'
 INDEX ON idcatemp+codemp TAG idcatemp COLLATE 'MACHINE'
 DBSETPROP('EMPLEADOS.BARPROD', 'Field', 'Comment', "baremo para productos")
 DBSETPROP('EMPLEADOS.BARSERV', 'Field', 'Comment', "baremo para servicios")
ENDPROC
**
PROCEDURE MakeTable_FACCAB
 CREATE TABLE 'FACCAB.DBF' NAME 'FACCAB' (serfac C (4) NOT NULL, ejefac N (4, 0) NOT NULL, numfac N (10, 0) NOT NULL, fecfac D NOT NULL, hora C (5) NOT NULL, codcli C (15) NOT NULL, obsfac M NOT NULL, impbas1 B (6) NOT NULL, impbas2 B (6) NOT NULL, impbas3 B (6) NOT NULL, impbas4 B (6) NOT NULL, impiva1 B (6) NOT NULL, impiva2 B (6) NOT NULL, impiva3 B (6) NOT NULL, impiva4 B (6) NOT NULL, iva1 N (5, 2) NOT NULL, iva2 N (5, 2) NOT NULL, iva3 N (5, 2) NOT NULL, iva4 N (5, 2) NOT NULL, totimpbas B (6) NOT NULL, totimpdto B (6) NOT NULL, totimpiva B (6) NOT NULL, totfac B (6) NOT NULL, lineas N (5, 0) NOT NULL, impresa L NOT NULL, fijo1 N (3, 0) NOT NULL, fijo2 N (3, 0) NOT NULL, fijo3 N (3, 0) NOT NULL, numpag N (3, 0) NOT NULL, pripag N (3, 0) NOT NULL, entpag N (3, 0) NOT NULL, dtopp N (5, 2) NOT NULL, dto1 N (5, 2) NOT NULL, poliza C (20) NOT NULL, codban C (20) NOT NULL, cueban C (23) NOT NULL, dtocam B (6) NOT NULL, dtoaso B (6) NOT NULL, dtomav B (6) NOT NULL, dtovar B (6) NOT NULL, anulada L NOT NULL, puntos N (12, 2) NOT NULL, codemp C (15) NOT NULL, impcob1 B (6) NOT NULL, forpag1 C (10) NOT NULL, impcob2 B (6) NOT NULL, forpag2 C (10) NOT NULL, impcam B (6) NOT NULL, cierre N (10, 0) NOT NULL, foto1 C (254) NOT NULL, foto2 C (254) NOT NULL, enviar L NOT NULL, sexo C (1) NOT NULL, idconcepto N (5, 0) NOT NULL, codboncli1 C (30) NOT NULL, codboncli2 C (30) NOT NULL, impbono1 B (4) NOT NULL, impbono2 B (4) NOT NULL, mesa C (5) NOT NULL, comensales N (3, 0) NOT NULL, actrec L NOT NULL, rec1 N (5, 2) NOT NULL, rec2 N (5, 2) NOT NULL, rec3 N (5, 2) NOT NULL, rec4 N (5, 2) NOT NULL, imprec1 B (6) NOT NULL, imprec2 B (6) NOT NULL, imprec3 B (6) NOT NULL, imprec4 B (6) NOT NULL, totimprec B (6) NOT NULL, actirpfp L NOT NULL, irpfp N (5, 2) NOT NULL, impirpfp B (6) NOT NULL, numfacrel C (18) NOT NULL, ntickets N (6, 2) NOT NULL, codalu C (15) NOT NULL, ticeval C (60) NOT NULL, contab L NOT NULL, idfactura N (10, 0) NOT NULL, bloqueado L NOT NULL, fechorfin T NOT NULL, facimp L NOT NULL, numprerel C (18) NOT NULL, numalbrel C (18) NOT NULL, ntickets1 N (6, 2) NOT NULL, ntickets2 N (6, 2) NOT NULL, hash C (254) NOT NULL, hash1 M NOT NULL, cert M NOT NULL, nocert C (100) NOT NULL, folfis C (100) NOT NULL, fecfolfis C (100) NOT NULL, hashsat C (254) NOT NULL, hash1sat M NOT NULL, nocertsat C (100) NOT NULL, rutaqr C (254) NOT NULL, timbrepac M NOT NULL, horasaft C (8) NOT NULL, iban C (40) NOT NULL, siniva L NOT NULL, rfcsat C (100) NOT NULL, leysat C (200) NOT NULL)
 INDEX ON cierre TAG cierre COLLATE 'MACHINE'
 INDEX ON codboncli2 TAG codboncli2 COLLATE 'MACHINE'
 INDEX ON codboncli1 TAG codboncli1 COLLATE 'MACHINE'
 INDEX ON codcli+DTOS(fecfac) TAG ultven COLLATE 'MACHINE' DESCENDING
 INDEX ON STR(ejefac, 4)+serfac+STR(numfac, 10) TAG numfac COLLATE 'MACHINE'
 INDEX ON codcli+STR(ejefac, 4)+serfac+STR(numfac, 10) TAG cliente COLLATE 'MACHINE'
 INDEX ON STR(ejefac, 4)+serfac+STR(numfac, 10) TAG numfacdes COLLATE 'MACHINE' DESCENDING
 INDEX ON numfacrel TAG numfacrel COLLATE 'MACHINE'
 INDEX ON fecfac TAG fecfac COLLATE 'MACHINE'
 INDEX ON serfac TAG serfac COLLATE 'MACHINE'
 INDEX ON codcli TAG codcli COLLATE 'MACHINE'
 INDEX ON enviar TAG enviar COLLATE 'MACHINE'
 DBSETPROP('FACCAB.CODBONCLI1', 'Field', 'Comment', "Codigo del bono seleccionado para la forma de pago 1")
 DBSETPROP('FACCAB.CODBONCLI2', 'Field', 'Comment', "Codigo del bono seleccionado para la forma de pago 2")
 DBSETPROP('FACCAB.IMPBONO1', 'Field', 'Comment', "Importe restante del bono seleccionado para la forma de pago 1")
 DBSETPROP('FACCAB.IMPBONO2', 'Field', 'Comment', "Importe restante del bono seleccionado para la forma de pago 2")
 DBSETPROP('FACCAB.IDFACTURA', 'Field', 'Comment', "nº de factura web para conexion web con central")
ENDPROC
**
PROCEDURE MakeTable_FACLIN
 CREATE TABLE 'FACLIN.DBF' NAME 'FACLIN' (serfac C (4) NOT NULL, ejefac N (4, 0) NOT NULL, numfac N (10, 0) NOT NULL, linfac N (5, 0) NOT NULL, codart C (15) NOT NULL, desart C (100) NOT NULL, tipfam1 C (15) NOT NULL, preven B (6) NOT NULL, coste B (6) NOT NULL, cant B (6) NOT NULL, subtot B (6) NOT NULL, descuento N (5, 2) NOT NULL, taniva N (1, 0) NOT NULL, obser M NOT NULL, codemp C (15) NOT NULL, comision N (5, 2) NOT NULL, codboncli C (30) NOT NULL, codbon C (20) NOT NULL, estado C (1) NOT NULL DEFAULT "X", hora T NOT NULL DEFAULT DATETIME(), impreso L NOT NULL, plato N (1, 0) NOT NULL DEFAULT 1, poremps N (6, 2) NOT NULL DEFAULT 100, codemp2 C (15) NOT NULL, comision2 N (5, 2) NOT NULL, creditos N (10, 0) NOT NULL, codalu C (15) NOT NULL, idtalla C (15) NOT NULL, idcolor C (15) NOT NULL, pvpcom B (6) NOT NULL, pulsos N (5, 0) NOT NULL, energia N (10, 0) NOT NULL, numalb N (10, 0) NOT NULL, seralb C (4) NOT NULL, ejealb N (4, 0) NOT NULL, linalb N (5, 0) NOT NULL, numser C (30) NOT NULL)
 INDEX ON codboncli TAG codboncli COLLATE 'MACHINE'
 INDEX ON estado+TTOC(hora, 1) TAG esthora COLLATE 'MACHINE'
 INDEX ON STR(ejefac, 4)+serfac+STR(numfac, 10)+STR(linfac, 5) TAG linfac COLLATE 'MACHINE'
 INDEX ON codemp+STR(ejefac, 4)+serfac+STR(numfac, 10)+STR(linfac, 5) TAG codemp COLLATE 'MACHINE'
 INDEX ON codart TAG codart COLLATE 'MACHINE'
 INDEX ON codemp TAG codemp_a COLLATE 'MACHINE'
 INDEX ON codemp2 TAG codemp2 COLLATE 'MACHINE'
 INDEX ON codart+STR(ejefac, 4)+serfac+STR(numfac, 10)+STR(linfac, 5) TAG artfac COLLATE 'MACHINE' DESCENDING
 INDEX ON STR(ejefac, 4)+codart TAG ejeart COLLATE 'MACHINE'
 DBSETPROP('FACLIN.ESTADO', 'Field', 'Comment', "(P)endiente, (R)ealizado, (S)ervido,(X)Sin Estado")
 DBSETPROP('FACLIN.POREMPS', 'Field', 'Comment', "Porcentaje de Comision para Empleado 1")
ENDPROC
**
PROCEDURE MakeTable_FAMILIA1
 CREATE TABLE 'FAMILIA1.DBF' NAME 'FAMILIA1' (codfam1 C (10) NOT NULL, desfam1 C (40) NOT NULL, tipfam1 C (15) NOT NULL, enviar L NOT NULL, vender L NOT NULL, foto C (254) NOT NULL, obsoleto L NOT NULL, idpuesto C (15) NOT NULL, codcuev C (10) NOT NULL, codcuec C (10) NOT NULL, estvenmen L NOT NULL, colorf N (10, 0) NOT NULL DEFAULT RGB(216, 216, 216), colorl N (10, 0) NOT NULL DEFAULT RGB(51, 51, 51), orden N (5, 0) NOT NULL, enviarweb L NOT NULL, puntos N (7, 2) NOT NULL, prestashop L NOT NULL, presenv L NOT NULL, obsfam M NOT NULL, presmettit C (100) NOT NULL, presmetdes C (200) NOT NULL, presmetkey M NOT NULL, presurlami C (100) NOT NULL, prescatsup C (100) NOT NULL, presroot L NOT NULL, prescodfam N (10, 0) NOT NULL)
 INDEX ON codfam1 TAG codfam1 COLLATE 'MACHINE'
 INDEX ON idpuesto+codfam1 TAG idpuesto COLLATE 'MACHINE'
 INDEX ON orden TAG orden COLLATE 'MACHINE'
 INDEX ON desfam1 TAG desfam1 COLLATE 'MACHINE'
 INDEX ON enviar TAG enviar COLLATE 'MACHINE'
 INDEX ON prestashop TAG prestashop COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_FORPAG
 CREATE TABLE 'FORPAG.DBF' NAME 'FORPAG' (codfp C (10) NOT NULL, des C (60) NOT NULL, foto C (254) NOT NULL, vender L NOT NULL DEFAULT .T., codcuev C (10) NOT NULL, codcuec C (10) NOT NULL, enviar L NOT NULL, remesas L NOT NULL, serie C (4) NOT NULL, fpefac C (5) NOT NULL)
 INDEX ON codfp TAG codfp COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_PEDPROC
 CREATE TABLE 'PEDPROC.DBF' NAME 'PEDPROC' (serped C (4) NOT NULL, ejeped N (4, 0) NOT NULL, numped N (10, 0) NOT NULL, suped C (20) NOT NULL, fecped D NOT NULL, fecent D NOT NULL, codpro C (15) NOT NULL, obsped M NOT NULL, impbas1 B (6) NOT NULL, impbas2 B (6) NOT NULL, impbas3 B (6) NOT NULL, impbas4 B (6) NOT NULL, impiva1 B (6) NOT NULL, impiva2 B (6) NOT NULL, impiva3 B (6) NOT NULL, impiva4 B (6) NOT NULL, iva1 N (5, 2) NOT NULL, iva2 N (5, 2) NOT NULL, iva3 N (5, 2) NOT NULL, iva4 N (5, 2) NOT NULL, totimpbas B (6) NOT NULL, totimpdto B (6) NOT NULL, totimpiva B (6) NOT NULL, totped B (6) NOT NULL, lineas N (5, 0) NOT NULL, impresa L NOT NULL, forpag C (10) NOT NULL, fijo1 N (3, 0) NOT NULL, fijo2 N (3, 0) NOT NULL, fijo3 N (3, 0) NOT NULL, numpag N (3, 0) NOT NULL, pripag N (3, 0) NOT NULL, entpag N (3, 0) NOT NULL, dtopp N (5, 2) NOT NULL, dto1 N (5, 2) NOT NULL, final L NOT NULL, enviar L NOT NULL, idconcepto N (5, 0) NOT NULL, actrec L NOT NULL, rec1 N (5, 2) NOT NULL, rec2 N (5, 2) NOT NULL, rec3 N (5, 2) NOT NULL, rec4 N (5, 2) NOT NULL, imprec1 B (6) NOT NULL, imprec2 B (6) NOT NULL, imprec3 B (6) NOT NULL, imprec4 B (6) NOT NULL, totimprec B (6) NOT NULL, actirpfp L NOT NULL, irpfp N (5, 2) NOT NULL, impirpfp B (6) NOT NULL, codban C (20) NOT NULL, cueban C (23) NOT NULL, efactusol L NOT NULL, pedonline L NOT NULL)
 INDEX ON STR(ejeped, 4)+serped+STR(numped, 10) TAG numped COLLATE 'MACHINE'
 DBSETPROP('PEDPROC.EFACTUSOL', 'Field', 'Comment', "Enviado a Factusol (Central)")
ENDPROC
**
PROCEDURE MakeTable_PEDPROL
 CREATE TABLE 'PEDPROL.DBF' NAME 'PEDPROL' (serped C (4) NOT NULL, ejeped N (4, 0) NOT NULL, numped N (10, 0) NOT NULL, linped N (5, 0) NOT NULL, codart C (15) NOT NULL, desart C (100) NOT NULL, preven B (6) NOT NULL, canped B (6) NOT NULL, canpen B (6) NOT NULL, canser B (6) NOT NULL, subtot B (6) NOT NULL, descuento N (5, 2) NOT NULL, taniva N (1, 0) NOT NULL, obser M NOT NULL, idtalla C (15) NOT NULL, idcolor C (15) NOT NULL, nseries M NOT NULL)
 INDEX ON STR(ejeped, 4)+serped+STR(numped, 10)+STR(linped, 5) TAG linped COLLATE 'MACHINE'
 INDEX ON codart TAG codart COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_PROVEEDOR
 CREATE TABLE 'PROVEEDOR.DBF' NAME 'PROVEEDOR' (codpro C (15) NOT NULL, razon C (100) NOT NULL, razon2 C (100) NOT NULL, nifpro C (20) NOT NULL, dirpro C (80) NOT NULL, codpospro C (15) NOT NULL, pobpro C (80) NOT NULL, propro C (80) NOT NULL, asenta C (80) NOT NULL, pais C (80) NOT NULL, tel1pro C (15) NOT NULL, tel2pro C (15) NOT NULL, tel3pro C (15) NOT NULL, tippro C (40) NOT NULL, coddivpro C (5) NOT NULL, forpagpro C (10) NOT NULL, fijo1 N (3, 0) NOT NULL, fijo2 N (3, 0) NOT NULL, fijo3 N (3, 0) NOT NULL, pripag N (3, 0) NOT NULL, entpag N (3, 0) NOT NULL, numpag N (3, 0) NOT NULL, obspro M NOT NULL, dtopp N (5, 2) NOT NULL, dto1 N (5, 2) NOT NULL, webpro C (60) NOT NULL, enviar L NOT NULL, cueban C (23) NOT NULL, obsoleto L NOT NULL, codcue C (10) NOT NULL, mailpro C (100) NOT NULL, percon C (100) NOT NULL, iban C (40) NOT NULL, swift C (15) NOT NULL)
 INDEX ON razon TAG razon COLLATE 'MACHINE'
 INDEX ON codpro TAG codpro COLLATE 'MACHINE'
 INDEX ON razon2 TAG razon2 COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_REGISTROS
 CREATE TABLE 'REGISTROS.DBF' NAME 'REGISTROS' (tabla C (20) NOT NULL, serie C (4) NOT NULL, year N (4, 0) NOT NULL, numreg N (10, 0) NOT NULL, descrip C (40) NOT NULL, visible L NOT NULL)
ENDPROC
**
PROCEDURE MakeTable_CIEENTSAL
 CREATE TABLE 'CIEENTSAL.DBF' NAME 'CIEENTSAL' (numdoc N (10, 0) NOT NULL, desdoc C (100) NOT NULL, fecdoc D NOT NULL, hordoc C (5) NOT NULL, codemp C (15) NOT NULL, tipdoc C (1) NOT NULL, forpag C (10) NOT NULL, impdoc B (6) NOT NULL, numcie N (10, 0) NOT NULL, obsdoc M NOT NULL, codtipmov C (15) NOT NULL)
 INDEX ON numdoc TAG numdoc COLLATE 'MACHINE'
 INDEX ON numcie TAG numcie COLLATE 'MACHINE'
 INDEX ON DTOS(fecdoc)+tipdoc TAG fecdoc COLLATE 'MACHINE'
 INDEX ON tipdoc+DTOS(fecdoc) TAG cierre COLLATE 'MACHINE' DESCENDING
ENDPROC
**
PROCEDURE MakeTable_CIECAB
 CREATE TABLE 'CIECAB.DBF' NAME 'CIECAB' (numcie N (10, 0) NOT NULL, feccie D NOT NULL, horcie C (5) NOT NULL, codemp C (15) NOT NULL, impcie B (6) NOT NULL, cerrado L NOT NULL, obscie M NOT NULL)
 INDEX ON numcie TAG numcie COLLATE 'MACHINE'
 INDEX ON DTOS(feccie) TAG feccie COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_CIELIN
 CREATE TABLE 'CIELIN.DBF' NAME 'CIELIN' (numcie N (10, 0) NOT NULL, codfp C (10) NOT NULL, des C (60) NOT NULL, imprea B (6) NOT NULL, impteo B (6) NOT NULL, impdif B (6) NOT NULL)
 INDEX ON numcie TAG numcie COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_KITS
 CREATE TABLE 'KITS.DBF' NAME 'KITS' (codart1 C (15) NOT NULL, codart2 C (15) NOT NULL, desart2 C (100) NOT NULL, cant B (4) NOT NULL)
 INDEX ON codart2 TAG codart2 COLLATE 'MACHINE'
 INDEX ON codart1 TAG codart1 COLLATE 'MACHINE'
 INDEX ON codart1+codart2 TAG codart12 COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_TIENDAS
 CREATE TABLE 'TIENDAS.DBF' NAME 'TIENDAS' (idtienda C (10) NOT NULL, nomtie C (100) NOT NULL, dirtie C (80) NOT NULL, cptie C (15) NOT NULL, pobtie C (80) NOT NULL, protie C (80) NOT NULL, paistie C (80) NOT NULL, tel1tie C (15) NOT NULL, tel2tie C (15) NOT NULL, faxtie C (15) NOT NULL, mailtie C (50) NOT NULL, percontie C (100) NOT NULL, central L NOT NULL, serie C (2) NOT NULL, obstie M NOT NULL, tipcom N (1, 0) NOT NULL, enviar L NOT NULL, ruta C (50) NOT NULL, ciftie C (20) NOT NULL, cfactusol N (5, 0) NOT NULL, tarifa C (1) NOT NULL, tarifa2 C (1) NOT NULL, obsoleto L NOT NULL)
 INDEX ON idtienda TAG idtienda COLLATE 'MACHINE'
 INDEX ON nomtie TAG nomtie COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_FOTOS
 CREATE TABLE 'FOTOS.DBF' NAME 'FOTOS' (idfoto N (10, 0) NOT NULL, tabla C (15) NOT NULL, idtabla C (20) NOT NULL, ruta C (254) NOT NULL, desfoto C (200) NOT NULL, obsfoto M NOT NULL, facebook L NOT NULL, facebookdt T NOT NULL)
 INDEX ON idfoto TAG idfoto COLLATE 'MACHINE'
 INDEX ON tabla+idtabla TAG tabla COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_USUARIOS
 CREATE TABLE 'USUARIOS.DBF' NAME 'USUARIOS' (codusu C (15) NOT NULL, nomusu C (50) NOT NULL, apeusu C (100) NOT NULL, passusu C (15) NOT NULL, codgru C (15) NOT NULL, obsusu M NOT NULL, ididi C (2) NOT NULL, foto C (250) NOT NULL)
 INDEX ON codgru+codusu TAG codgru COLLATE 'MACHINE'
 INDEX ON codusu TAG codusu COLLATE 'MACHINE'
 INDEX ON apeusu TAG apeusu COLLATE 'MACHINE'
 INDEX ON nomusu TAG nomusu COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_ACCESOS
 CREATE TABLE 'ACCESOS.DBF' NAME 'ACCESOS' (codgru C (15) NOT NULL, codpan C (15) NOT NULL)
 INDEX ON codgru+codpan TAG grupan COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_GRUPOS
 CREATE TABLE 'GRUPOS.DBF' NAME 'GRUPOS' (codgru C (15) NOT NULL, desgru C (100) NOT NULL, ladmin L NOT NULL, obsusu M NOT NULL, busxdias L NOT NULL, ndiasbus N (3, 0) NOT NULL, nocosteart L NOT NULL, nobonoscli L NOT NULL)
 INDEX ON codgru TAG codgru COLLATE 'MACHINE'
 INDEX ON desgru TAG desgru COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_PANTALLAS
 CREATE TABLE 'PANTALLAS.DBF' NAME 'PANTALLAS' (codpan C (15) NOT NULL, despan C (100) NOT NULL, lopd L NOT NULL DEFAULT .F.)
 INDEX ON codpan TAG codpan COLLATE 'MACHINE'
 INDEX ON despan TAG despan COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_REPORTS
 CREATE TABLE 'REPORTS.DBF' NAME 'REPORTS' (nomrep C (60) NOT NULL, idgrupo C (20) NOT NULL, nomfrx C (20) NOT NULL, interno L NOT NULL, predet L NOT NULL, nomrepidi C (60) NOT NULL, orden C (254) NOT NULL, filtro C (254) NOT NULL)
 INDEX ON idgrupo TAG idgrupo COLLATE 'MACHINE'
 INDEX ON nomfrx TAG nomfrx COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_SERIES
 CREATE TABLE 'SERIES.DBF' NAME 'SERIES' (serie C (4) NOT NULL, desser C (60) NOT NULL, recargov L NOT NULL, recargoc L NOT NULL, irpfpv L NOT NULL, irpfpc L NOT NULL, facini N (10, 0) NOT NULL, mxcodbar C (254) NOT NULL, mxnumapr C (50) NOT NULL, mxfecapr D NOT NULL, mxdnumfac N (10, 0) NOT NULL, mxhnumfac N (10, 0) NOT NULL, mxavifec L NOT NULL, mxdiasant N (5, 0) NOT NULL, mxavinum L NOT NULL, mxnumant N (10, 0) NOT NULL, mxdiaavi D NOT NULL, mxfacavi D NOT NULL, efactura L NOT NULL)
 INDEX ON serie TAG serie COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_CONCEPTOS
 CREATE TABLE 'CONCEPTOS.DBF' NAME 'CONCEPTOS' (idconcepto N (5, 0) NOT NULL, desconcep C (100) NOT NULL)
 INDEX ON idconcepto TAG idconcepto COLLATE 'MACHINE'
 INDEX ON desconcep TAG desconcep COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_FACPROC
 CREATE TABLE 'FACPROC.DBF' NAME 'FACPROC' (serfacp C (4) NOT NULL, ejefacp N (4, 0) NOT NULL, numfacp N (10, 0) NOT NULL, fecfacp D NOT NULL, seralb C (4) NOT NULL, ejealb N (4, 0) NOT NULL, numalb N (10, 0) NOT NULL, sufacp C (20) NOT NULL, codpro C (15) NOT NULL, obsfac M NOT NULL, impbas1 B (6) NOT NULL, impbas2 B (6) NOT NULL, impbas3 B (6) NOT NULL, impbas4 B (6) NOT NULL, impiva1 B (6) NOT NULL, impiva2 B (6) NOT NULL, impiva3 B (6) NOT NULL, impiva4 B (6) NOT NULL, iva1 N (5, 2) NOT NULL, iva2 N (5, 2) NOT NULL, iva3 N (5, 2) NOT NULL, iva4 N (5, 2) NOT NULL, totimpbas B (6) NOT NULL, totimpdto B (6) NOT NULL, totimpiva B (6) NOT NULL, totfacp B (6) NOT NULL, lineas N (5, 0) NOT NULL, impresa L NOT NULL, forpag C (10) NOT NULL, fijo1 N (3, 0) NOT NULL, fijo2 N (3, 0) NOT NULL, fijo3 N (3, 0) NOT NULL, numpag N (3, 0) NOT NULL, pripag N (3, 0) NOT NULL, entpag N (3, 0) NOT NULL, dtopp N (5, 2) NOT NULL, dto1 N (5, 2) NOT NULL, enviar L NOT NULL, idconcepto N (5, 0) NOT NULL, actrec L NOT NULL, rec1 N (5, 2) NOT NULL, rec2 N (5, 2) NOT NULL, rec3 N (5, 2) NOT NULL, rec4 N (5, 2) NOT NULL, imprec1 B (6) NOT NULL, imprec2 B (6) NOT NULL, imprec3 B (6) NOT NULL, imprec4 B (6) NOT NULL, totimprec B (6) NOT NULL, actirpfp L NOT NULL, irpfp N (5, 2) NOT NULL, impirpfp B (6) NOT NULL, codban C (20) NOT NULL, cueban C (23) NOT NULL, contab L NOT NULL)
 INDEX ON STR(ejefacp, 4)+serfacp+STR(numfacp, 10) TAG numfacp COLLATE 'MACHINE'
 INDEX ON STR(ejealb, 4)+seralb+STR(numalb, 10) TAG numalb COLLATE 'MACHINE'
 INDEX ON fecfacp TAG fecfacp COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_FACPROL
 CREATE TABLE 'FACPROL.DBF' NAME 'FACPROL' (serfacp C (4) NOT NULL, ejefacp N (4, 0) NOT NULL, numfacp N (10, 0) NOT NULL, linfacp N (5, 0) NOT NULL, seralb C (4) NOT NULL, ejealb N (4, 0) NOT NULL, numalb N (10, 0) NOT NULL, linalb N (5, 0) NOT NULL, codart C (15) NOT NULL, desart C (100) NOT NULL, preven B (6) NOT NULL, canser B (6) NOT NULL, subtot B (6) NOT NULL, descuento N (5, 2) NOT NULL, taniva N (1, 0) NOT NULL, obser M NOT NULL, idtalla C (15) NOT NULL, idcolor C (15) NOT NULL, numser C (30) NOT NULL)
 INDEX ON STR(ejefacp, 4)+serfacp+STR(numfacp, 10)+STR(linfacp, 5) TAG linfacp COLLATE 'MACHINE'
 INDEX ON codart TAG codart COLLATE 'MACHINE'
 INDEX ON codart+STR(ejefacp, 4)+serfacp+STR(numfacp, 10)+STR(linfacp, 5) TAG artfac COLLATE 'MACHINE' DESCENDING
ENDPROC
**
PROCEDURE MakeTable_PLANIFICADOR
 CREATE TABLE 'PLANIFICADOR.DBF' NAME 'PLANIFICADOR' (fecha D NOT NULL, hora C (5) NOT NULL, cliente C (50) NOT NULL, observ M NOT NULL, codemp C (15) NOT NULL, idplan N (10, 0) NOT NULL, color N (10, 0) NOT NULL, facturado L NOT NULL, clientebd L NOT NULL, codart C (15) NOT NULL, codrec C (15) NOT NULL, telefono C (15) NOT NULL, idplanrel N (10, 0) NOT NULL, horafin C (5) NOT NULL)
 INDEX ON DTOS(fecha)+hora TAG fechahora COLLATE 'MACHINE'
 INDEX ON idplan TAG idplan COLLATE 'MACHINE'
 INDEX ON DTOS(fecha)+hora+codrec TAG fechorrec COLLATE 'MACHINE'
 INDEX ON DTOS(fecha)+hora+codemp+codrec TAG fechoremp COLLATE 'MACHINE'
 INDEX ON idplanrel TAG idplanrel COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_CODPOS
 CREATE TABLE 'CODPOS.DBF' NAME 'CODPOS' (codpos C (15) NOT NULL, poblacion C (60) NOT NULL, provincia C (60) NOT NULL, asenta C (80) NOT NULL)
 INDEX ON codpos TAG codpos COLLATE 'MACHINE'
 INDEX ON codpos+poblacion+provincia+asenta TAG cp COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_EMPFAM
 CREATE TABLE 'EMPFAM.DBF' NAME 'EMPFAM' (codemp C (15) NOT NULL, codfam1 C (10) NOT NULL, comision N (7, 4) NOT NULL)
 INDEX ON codemp+codfam1 TAG empfam COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_EMPART
 CREATE TABLE 'EMPART.DBF' NAME 'EMPART' (codemp C (15) NOT NULL, codart C (15) NOT NULL, comision N (7, 4) NOT NULL)
 INDEX ON codemp+codart TAG empart COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_BONOS
 CREATE TABLE 'BONOS.DBF' NAME 'BONOS' (codbon C (20) NOT NULL, desbon C (100) NOT NULL, diamesany C (1) NOT NULL DEFAULT "Años", caduca N (5, 0) NOT NULL DEFAULT 1, foto C (254) NOT NULL, obsoleto L NOT NULL, importe B (4) NOT NULL, dto N (5, 2) NOT NULL, obsbon M NOT NULL, servicios L NOT NULL, productos L NOT NULL, nocaduca L NOT NULL, ntickets N (6, 2) NOT NULL, tipo N (1, 0) NOT NULL DEFAULT 1, enviar L NOT NULL, pvpb B (4) NOT NULL, pvpc B (4) NOT NULL, pvpd B (4) NOT NULL, pvpe B (4) NOT NULL, config L NOT NULL, noautonum L NOT NULL)
 INDEX ON codbon TAG codbon COLLATE 'MACHINE'
 INDEX ON enviar TAG enviar COLLATE 'MACHINE'
 DBSETPROP('BONOS.DIAMESANY', 'Field', 'Comment', "Días / Meses / Años")
 DBSETPROP('BONOS.TIPO', 'Field', 'Comment', "1-Bono por Importe"+CHR(13)+"2-Bono por NºTickets")
ENDPROC
**
PROCEDURE MakeTable_BONOSFAM
 CREATE TABLE 'BONOSFAM.DBF' NAME 'BONOSFAM' (codbon C (20) NOT NULL, codfam1 C (10) NOT NULL)
 INDEX ON codbon+codfam1 TAG codbon COLLATE 'MACHINE'
 INDEX ON codfam1 TAG codfam1 COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_BONOSART
 CREATE TABLE 'BONOSART.DBF' NAME 'BONOSART' (codbon C (20) NOT NULL, codart C (15) NOT NULL)
 INDEX ON codbon+codart TAG codbon COLLATE 'MACHINE'
 INDEX ON codart TAG codart COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_BONOSCLI
 CREATE TABLE 'BONOSCLI.DBF' NAME 'BONOSCLI' (codboncli C (30) NOT NULL, codcli C (15) NOT NULL, fecha D NOT NULL, fecven D NOT NULL, importe B (4) NOT NULL, dto N (5, 2) NOT NULL, impgas B (4) NOT NULL, obsboncli M NOT NULL, codemp C (15) NOT NULL, nocaduca L NOT NULL, codbon C (20) NOT NULL, ntickets N (6, 2) NOT NULL, ticgas N (6, 2) NOT NULL, enviar L NOT NULL, finalizado L NOT NULL)
 INDEX ON codcli+codboncli TAG codcli COLLATE 'MACHINE'
 INDEX ON codboncli TAG codboncli COLLATE 'MACHINE'
 INDEX ON enviar TAG enviar COLLATE 'MACHINE'
 INDEX ON fecha TAG fecha COLLATE 'MACHINE' DESCENDING
 DBSETPROP('BONOSCLI.IMPORTE', 'Field', 'Comment', "Importe del bono")
 DBSETPROP('BONOSCLI.DTO', 'Field', 'Comment', "% Dto del bono")
 DBSETPROP('BONOSCLI.IMPGAS', 'Field', 'Comment', "Importe gastado del bono")
 DBSETPROP('BONOSCLI.CODEMP', 'Field', 'Comment', "Empleado que vendió el bono")
ENDPROC
**
PROCEDURE MakeTable_MESAS
 CREATE TABLE 'MESAS.DBF' NAME 'MESAS' (idmesa C (5) NOT NULL, nommesa C (80) NOT NULL, color N (10, 0) NOT NULL DEFAULT RGB(255, 255, 255), tarifa C (1) NOT NULL DEFAULT "A")
 INDEX ON idmesa TAG idmesa COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_LOPD
 CREATE TABLE 'LOPD.DBF' NAME 'LOPD' (fechahora T NOT NULL, codusu C (15) NOT NULL, codpan C (15) NOT NULL, descrip C (80) NOT NULL)
 INDEX ON fechahora TAG fechahora COLLATE 'MACHINE'
 INDEX ON codpan TAG codpan COLLATE 'MACHINE'
 INDEX ON codusu TAG codusu COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_CARPRO
 CREATE TABLE 'CARPRO.DBF' NAME 'CARPRO' (ejefacp N (4, 0) NOT NULL, serfacp C (4) NOT NULL, numfacp N (10, 0) NOT NULL, fecfacp D NOT NULL, codpro C (15) NOT NULL, numrec N (12, 0) NOT NULL, fecven D NOT NULL, forpag C (10) NOT NULL, imprec B (4) NOT NULL, imppag B (4) NOT NULL, fecval D NOT NULL, idconcepto N (5, 0) NOT NULL, codban C (20) NOT NULL, cueban C (23) NOT NULL, liquidado L NOT NULL, estado C (1) NOT NULL DEFAULT "Pendiente", gasimp B (4) NOT NULL, gasvar B (4) NOT NULL, imprecibo B (4) NOT NULL)
 INDEX ON codpro TAG codpro COLLATE 'MACHINE'
 INDEX ON STR(ejefacp, 4)+serfacp+STR(numfacp, 10)+STR(numrec, 12) TAG numfacp COLLATE 'MACHINE'
 INDEX ON fecfacp TAG fecfacp COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_PAGOS
 CREATE TABLE 'PAGOS.DBF' NAME 'PAGOS' (numpag N (14, 0) NOT NULL, ejefacp N (4, 0) NOT NULL, serfacp C (4) NOT NULL, numfacp N (10, 0) NOT NULL, numrec N (12, 0) NOT NULL, fecpag D NOT NULL, imppag B (4) NOT NULL, forpag C (10) NOT NULL, contab L NOT NULL, codban C (20) NOT NULL)
 INDEX ON numpag TAG numpag COLLATE 'MACHINE'
 INDEX ON STR(ejefacp, 4)+serfacp+STR(numfacp, 10)+STR(numrec, 12) TAG numrec COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_FESTIVOS
 CREATE TABLE 'FESTIVOS.DBF' NAME 'FESTIVOS' (fecha D NOT NULL, desfecha C (50) NOT NULL)
 INDEX ON DTOS(fecha) TAG fecha COLLATE 'MACHINE' DESCENDING
ENDPROC
**
PROCEDURE MakeTable_EMPFEST
 CREATE TABLE 'EMPFEST.DBF' NAME 'EMPFEST' (codemp C (15) NOT NULL, fecha D NOT NULL, desfec C (50) NOT NULL)
 INDEX ON codemp+DTOS(fecha) TAG codemp COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_PUESTOS
 CREATE TABLE 'PUESTOS.DBF' NAME 'PUESTOS' (idpuesto C (15) NOT NULL, nompuesto C (80) NOT NULL, impresora C (200) NOT NULL)
 INDEX ON idpuesto TAG idpuesto COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_FACLINTMP
 CREATE TABLE 'FACLINTMP.DBF' NAME 'FACLINTMP' (idticket N (12, 0) NOT NULL, linfac N (4, 0) NOT NULL, cant N (10, 3) NOT NULL, codart C (15) NOT NULL, desart C (100) NOT NULL, precio B (6) NOT NULL, foto C (254) NOT NULL, taniva N (1, 0) NOT NULL, codemp C (15) NOT NULL, descuento N (5, 2) NOT NULL, subtot B (6) NOT NULL, coste B (6) NOT NULL, comision N (5, 2) NOT NULL, codboncli C (30) NOT NULL, codbon C (20) NOT NULL, estado C (1) NOT NULL DEFAULT "X", impreso L NOT NULL, obser C (254) NOT NULL, hora T NOT NULL DEFAULT DATETIME(), plato N (1, 0) NOT NULL, poremps N (6, 2) NOT NULL DEFAULT 100, codemp2 C (15) NOT NULL, comision2 N (5, 2) NOT NULL, creditos N (10, 0) NOT NULL, codalu C (15) NOT NULL, idtalla C (15) NOT NULL, idcolor C (15) NOT NULL, pvpcom B (6) NOT NULL, pulsos N (5, 0) NOT NULL, energia N (10, 0) NOT NULL, bonconfig M NOT NULL, numser C (30) NOT NULL, idticand N (10, 0) NOT NULL, idlinand N (10, 0) NOT NULL)
 INDEX ON STR(idticket, 12)+STR(linfac, 4) TAG idticket COLLATE 'MACHINE'
 INDEX ON idticket TAG idticket1 COLLATE 'MACHINE'
 INDEX ON TTOC(hora, 1) TAG esthora COLLATE 'MACHINE'
 INDEX ON STR(idticket, 12)+IIF(estado="R", "1", IIF(estado="P", "2", "3")) TAG ticketest COLLATE 'MACHINE'
 INDEX ON STR(idticket, 12)+STR(plato, 1)+IIF(estado="R", "1", IIF(estado="P", "2", "3")) TAG produccion COLLATE 'MACHINE'
 DBSETPROP('FACLINTMP.POREMPS', 'Field', 'Comment', "Porcentaje comision del empleado 1")
ENDPROC
**
PROCEDURE MakeTable_FOTOSTMP
 CREATE TABLE 'FOTOSTMP.DBF' NAME 'FOTOSTMP' (idfoto N (10, 0) NOT NULL, ruta C (254) NOT NULL, idticket N (12, 0) NOT NULL, desfoto C (200) NOT NULL, obsfoto M NOT NULL, facebook L NOT NULL, facebookdt T NOT NULL)
 INDEX ON idticket TAG idticket COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_FACCABTMP
 CREATE TABLE 'FACCABTMP.DBF' NAME 'FACCABTMP' (idticket N (12, 0) NOT NULL, serfac C (4) NOT NULL, ejefac N (4, 0) NOT NULL, numfac N (10, 0) NOT NULL, fecfac D NOT NULL, hora C (5) NOT NULL, codcli C (15) NOT NULL, codemp C (15) NOT NULL, obsfac M NOT NULL, mesa C (5) NOT NULL, comensales N (3, 0) NOT NULL, puntos N (12, 2) NOT NULL, puntosfac N (12, 2) NOT NULL, dtovar N (8, 6) NOT NULL, cierre N (10, 0) NOT NULL, lineas N (5, 0) NOT NULL, totfac B (6) NOT NULL, cobrando L NOT NULL, plato N (1, 0) NOT NULL DEFAULT 1, codalu C (15) NOT NULL, ticeval C (60) NOT NULL, hash C (254) NOT NULL, hash1 M NOT NULL, acuenta B (6) NOT NULL, cert M NOT NULL, nocert C (100) NOT NULL, folfis C (100) NOT NULL, fecfolfis C (100) NOT NULL, hashsat C (254) NOT NULL, hash1sat M NOT NULL, nocertsat C (100) NOT NULL, rutaqr C (254) NOT NULL, horasaft C (8) NOT NULL, enviadoand L NOT NULL, siniva L NOT NULL, puntosavi L NOT NULL, puntosres L NOT NULL, rfcsat C (100) NOT NULL, leysat C (200) NOT NULL)
 INDEX ON idticket TAG idticket COLLATE 'MACHINE'
 INDEX ON mesa TAG mesa COLLATE 'MACHINE'
 INDEX ON STR(ejefac, 4)+serfac+STR(numfac, 10) TAG numfac COLLATE 'MACHINE'
 INDEX ON codcli+STR(ejefac, 4)+serfac+STR(numfac, 10) TAG cliente COLLATE 'MACHINE'
 INDEX ON enviadoand TAG enviadoand COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_IMPRESORAS
 CREATE TABLE 'IMPRESORAS.DBF' NAME 'IMPRESORAS' (idpc C (100) NOT NULL, idpuesto C (15) NOT NULL, impresora1 C (200) NOT NULL, impresora2 C (200) NOT NULL, impresora3 C (200) NOT NULL)
 INDEX ON idpc+idpuesto TAG idpc COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_BAREMOS
 CREATE TABLE 'BAREMOS.DBF' NAME 'BAREMOS' (codbar C (15) NOT NULL, desbar C (70) NOT NULL, tipo N (1, 0) NOT NULL DEFAULT 1, obsbar M NOT NULL)
 INDEX ON desbar TAG desbar COLLATE 'MACHINE'
 INDEX ON codbar TAG codbar COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_RANGOS
 CREATE TABLE 'RANGOS.DBF' NAME 'RANGOS' (codbar C (15) NOT NULL, desde B (6) NOT NULL, hasta B (6) NOT NULL, comision B (6) NOT NULL)
 INDEX ON codbar TAG codbar COLLATE 'MACHINE'
 INDEX ON codbar+STR(desde, 10, 2) TAG coddesde COLLATE 'MACHINE'
 DBSETPROP('RANGOS.COMISION', 'Field', 'Comment', "Puede ser un importe o un porcentaje")
ENDPROC
**
PROCEDURE MakeTable_MENUS
 CREATE TABLE 'MENUS.DBF' NAME 'MENUS' (idmenu C (15) NOT NULL, nommenu C (60) NOT NULL, pvp B (6) NOT NULL, fecmenu D NOT NULL, lineas N (5, 0) NOT NULL, obsoleto L NOT NULL)
 INDEX ON idmenu TAG idmenu COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_MENUDET
 CREATE TABLE 'MENUDET.DBF' NAME 'MENUDET' (idmenu C (15) NOT NULL, codart C (15) NOT NULL, desart C (100) NOT NULL, grupo C (10) NOT NULL, linea N (5, 0) NOT NULL)
 INDEX ON idmenu+grupo+STR(linea) TAG idmenu COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_CLILOPD
 CREATE TABLE 'CLILOPD.DBF' NAME 'CLILOPD' (codcli C (15) NOT NULL, dato1 C (100) NOT NULL, dato2 C (100) NOT NULL, dato3 C (100) NOT NULL, dato4 C (100) NOT NULL, dato5 C (100) NOT NULL, dato6 C (100) NOT NULL, dato7 C (100) NOT NULL, dato8 C (100) NOT NULL, dato9 C (100) NOT NULL, dato10 C (100) NOT NULL, dato11 C (100) NOT NULL, dato12 C (100) NOT NULL, dato13 C (100) NOT NULL, dato14 C (100) NOT NULL, dato15 C (100) NOT NULL, dato16 C (100) NOT NULL, dato17 C (100) NOT NULL, dato18 C (100) NOT NULL, dato19 C (100) NOT NULL, dato20 C (100) NOT NULL, dato21 C (100) NOT NULL, dato22 C (100) NOT NULL, dato23 C (100) NOT NULL, dato24 C (100) NOT NULL, dato25 C (100) NOT NULL, dato26 C (100) NOT NULL, dato27 C (100) NOT NULL, dato28 C (100) NOT NULL, dato29 C (100) NOT NULL, dato30 C (100) NOT NULL, dato31 C (100) NOT NULL, dato32 C (100) NOT NULL, dato33 C (100) NOT NULL, dato34 C (100) NOT NULL, dato35 C (100) NOT NULL, dato36 C (100) NOT NULL, dato37 C (100) NOT NULL, dato38 C (100) NOT NULL, dato39 C (100) NOT NULL, dato40 C (100) NOT NULL, dato41 C (100) NOT NULL, dato42 C (100) NOT NULL, dato43 C (100) NOT NULL, dato44 C (100) NOT NULL, dato45 C (100) NOT NULL, dato46 C (100) NOT NULL, dato47 C (100) NOT NULL, dato48 M NOT NULL, dato49 C (100) NOT NULL, dato50 C (100) NOT NULL, dato51 M NOT NULL, dato52 M NOT NULL, dato501 C (50) NOT NULL, dato502 C (50) NOT NULL, dato503 C (50) NOT NULL, dato504 C (100) NOT NULL, dato505 C (100) NOT NULL, dato506 M NOT NULL, dato507 C (50) NOT NULL, dato508 C (50) NOT NULL, dato509 C (50) NOT NULL, dato510 C (50) NOT NULL, dato511 C (50) NOT NULL, dato512 C (50) NOT NULL, dato513 C (50) NOT NULL, dato514 C (50) NOT NULL, dato515 C (50) NOT NULL, dato516 C (50) NOT NULL, dato517 M NOT NULL, dato518 M NOT NULL, dato519 M NOT NULL, dato520 C (50) NOT NULL, dato601 C (50) NOT NULL, dato602 C (5) NOT NULL, dato603 C (50) NOT NULL, dato604 C (100) NOT NULL, dato605 C (50) NOT NULL, dato606 C (5) NOT NULL, dato607 C (5) NOT NULL, dato608 C (5) NOT NULL, dato609 C (5) NOT NULL, dato610 C (5) NOT NULL, dato611 M NOT NULL, dato612 C (5) NOT NULL, dato613 C (5) NOT NULL, dato614 C (5) NOT NULL, dato615 C (5) NOT NULL, dato616 C (5) NOT NULL, dato617 C (100) NOT NULL, dato618 C (5) NOT NULL, dato619 C (5) NOT NULL, dato620 C (5) NOT NULL, dato621 C (5) NOT NULL, dato622 C (5) NOT NULL, dato623 C (5) NOT NULL, dato624 C (5) NOT NULL, dato625 C (5) NOT NULL, dato626 C (5) NOT NULL, dato627 M NOT NULL, dato701 C (50) NOT NULL, dato702 M NOT NULL, dato703 C (50) NOT NULL)
 INDEX ON codcli TAG codcli COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_TICKETPREC
 CREATE TABLE 'TICKETPREC.DBF' NAME 'TICKETPREC' (idticpre N (10, 0) NOT NULL, destic C (100) NOT NULL, foto C (250) NOT NULL, obstic M NOT NULL, obsoleto L NOT NULL, lineas N (5, 0) NOT NULL)
 INDEX ON idticpre TAG idticpre COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_TICKETPREL
 CREATE TABLE 'TICKETPREL.DBF' NAME 'TICKETPREL' (idticpre N (10, 0) NOT NULL, linea N (5, 0) NOT NULL, codart C (15) NOT NULL, desart C (100) NOT NULL, pvp B (6) NOT NULL)
 INDEX ON STR(idticpre, 10)+STR(linea, 5) TAG idticpre COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_AGENDA
 CREATE TABLE 'AGENDA.DBF' NAME 'AGENDA' (codage N (10, 0) NOT NULL, dia D NOT NULL, hora C (5) NOT NULL, cliente C (80) NOT NULL, codemp C (15) NOT NULL, obsage M NOT NULL, facturado L NOT NULL, clientebd L NOT NULL, agendaweb L NOT NULL, enviar L NOT NULL, idplan N (10, 0) NOT NULL, horfin C (5) NOT NULL, tel1cli C (20) NOT NULL, idusuweb N (10, 0) NOT NULL)
 INDEX ON DTOS(dia)+SUBSTR(hora, 1, 2)+SUBSTR(hora, 4, 2) TAG diahora COLLATE 'MACHINE'
 INDEX ON codage TAG codage COLLATE 'MACHINE'
 INDEX ON enviar TAG enviar COLLATE 'MACHINE'
 INDEX ON dia TAG dia COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_RECURSOS
 CREATE TABLE 'RECURSOS.DBF' NAME 'RECURSOS' (codrec C (15) NOT NULL, desrec C (80) NOT NULL, obsrec M NOT NULL, obsoleto L NOT NULL, foto C (254) NOT NULL, ordplan N (5, 0) NOT NULL, verplan L NOT NULL DEFAULT .T., enviar L NOT NULL, colorpf N (10, 0) NOT NULL DEFAULT RGB(242, 249, 255), colorpl N (10, 0) NOT NULL DEFAULT RGB(62, 66, 101))
 INDEX ON desrec TAG desrec COLLATE 'MACHINE'
 INDEX ON codrec TAG codrec COLLATE 'MACHINE'
 INDEX ON ordplan TAG ordplan COLLATE 'MACHINE'
 INDEX ON enviar TAG enviar COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_ALUMNOS
 CREATE TABLE 'ALUMNOS.DBF' NAME 'ALUMNOS' (codalu C (15) NOT NULL, nomalu C (80) NOT NULL, ape1alu C (80) NOT NULL, mail C (150) NOT NULL, dnialu C (20) NOT NULL, diralu C (80) NOT NULL, codposalu C (15) NOT NULL, pobalu C (80) NOT NULL, proalu C (80) NOT NULL, asenta C (80) NOT NULL, pais C (80) NOT NULL, tel1alu C (15) NOT NULL, tel2alu C (15) NOT NULL, tel3alu C (15) NOT NULL, foto C (254) NOT NULL, obsalu M NOT NULL, obsoleto L NOT NULL, fecbaja D NOT NULL, fecalta D NOT NULL, codalu2 C (20) NOT NULL, idgrualu C (15) NOT NULL)
 INDEX ON nomalu TAG nomalu COLLATE 'MACHINE'
 INDEX ON codalu TAG codalu COLLATE 'MACHINE'
 INDEX ON ape1alu TAG ape1alu COLLATE 'MACHINE'
 INDEX ON codalu2 TAG codalu2 COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_PROFESORES
 CREATE TABLE 'PROFESORES.DBF' NAME 'PROFESORES' (codprof C (15) NOT NULL, nomprof C (80) NOT NULL, ape1prof C (80) NOT NULL, mail C (150) NOT NULL, dniprof C (20) NOT NULL, dirprof C (80) NOT NULL, codposprof C (15) NOT NULL, pobprof C (80) NOT NULL, proprof C (80) NOT NULL, asenta C (80) NOT NULL, pais C (80) NOT NULL, tel1prof C (15) NOT NULL, tel2prof C (15) NOT NULL, tel3prof C (15) NOT NULL, foto C (254) NOT NULL, obsprof M NOT NULL, obsoleto L NOT NULL, fecbaja D NOT NULL, fecalta D NOT NULL)
 INDEX ON ape1prof TAG ape1prof COLLATE 'MACHINE'
 INDEX ON nomprof TAG nomprof COLLATE 'MACHINE'
 INDEX ON codprof TAG codprof COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_CURSOS
 CREATE TABLE 'CURSOS.DBF' NAME 'CURSOS' (codcur C (15) NOT NULL, descur C (200) NOT NULL, obscur M NOT NULL, obsoleto L NOT NULL)
 INDEX ON descur TAG descur COLLATE 'MACHINE'
 INDEX ON codcur TAG codcur COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_CUREJE
 CREATE TABLE 'CUREJE.DBF' NAME 'CUREJE' (codcur C (15) NOT NULL, idcurso N (10, 0) NOT NULL, descurso C (150) NOT NULL, obscurso M NOT NULL, fecini D NOT NULL, fecfin D NOT NULL, precio B (6) NOT NULL, obsoleto L NOT NULL, lunes L NOT NULL, martes L NOT NULL, miercoles L NOT NULL, jueves L NOT NULL, viernes L NOT NULL, sabado L NOT NULL, domingo L NOT NULL, dia1a C (5) NOT NULL, dia1b C (5) NOT NULL, dia1c C (5) NOT NULL, dia1d C (5) NOT NULL, dia2a C (5) NOT NULL, dia2b C (5) NOT NULL, dia2c C (5) NOT NULL, dia2d C (5) NOT NULL, dia3a C (5) NOT NULL, dia3b C (5) NOT NULL, dia3c C (5) NOT NULL, dia3d C (5) NOT NULL, dia4a C (5) NOT NULL, dia4b C (5) NOT NULL, dia4c C (5) NOT NULL, dia4d C (5) NOT NULL, dia5a C (5) NOT NULL, dia5b C (5) NOT NULL, dia5c C (5) NOT NULL, dia5d C (5) NOT NULL, dia6a C (5) NOT NULL, dia6b C (5) NOT NULL, dia6c C (5) NOT NULL, dia6d C (5) NOT NULL, dia7a C (5) NOT NULL, dia7b C (5) NOT NULL, dia7c C (5) NOT NULL, dia7d C (5) NOT NULL)
 INDEX ON idcurso TAG idcurso COLLATE 'MACHINE'
 INDEX ON codcur+DTOS(fecini) TAG codcur COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_CURALU
 CREATE TABLE 'CURALU.DBF' NAME 'CURALU' (idcurso N (10, 0) NOT NULL, codalu C (15) NOT NULL, cureval C (60) NOT NULL, obsalu M NOT NULL)
 INDEX ON codalu TAG codalu COLLATE 'MACHINE'
 INDEX ON STR(idcurso, 10)+codalu TAG curalu COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_CURPROF
 CREATE TABLE 'CURPROF.DBF' NAME 'CURPROF' (idcurso N (10, 0) NOT NULL, codprof C (15) NOT NULL)
 INDEX ON STR(idcurso, 10)+codprof TAG curprof COLLATE 'MACHINE'
 INDEX ON codprof TAG codprof COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_CURASI
 CREATE TABLE 'CURASI.DBF' NAME 'CURASI' (idcurso N (10, 0) NOT NULL, fecasi D NOT NULL, codalu C (15) NOT NULL, asistencia L NOT NULL)
 INDEX ON STR(idcurso, 10)+codalu+DTOS(fecasi) TAG idcurso COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_MOTSAL
 CREATE TABLE 'MOTSAL.DBF' NAME 'MOTSAL' (codmot N (10, 0) NOT NULL, desmot C (150) NOT NULL, obsmot M NOT NULL, foto C (254) NOT NULL, obsoleto L NOT NULL)
 INDEX ON desmot TAG desmot COLLATE 'MACHINE'
 INDEX ON codmot TAG codmot COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_PRESENCIA
 CREATE TABLE 'PRESENCIA.DBF' NAME 'PRESENCIA' (idpres N (12, 0) NOT NULL, fechor T NOT NULL, tippres N (1, 0) NOT NULL, codmot N (10, 0) NOT NULL, codemp C (15) NOT NULL, empalu C (1) NOT NULL)
 INDEX ON idpres TAG idpres COLLATE 'MACHINE'
 INDEX ON codemp+DTOS(fechor) TAG codemp COLLATE 'MACHINE'
 DBSETPROP('PRESENCIA.TIPPRES', 'Field', 'Comment', "1-Entrada,2-Salida")
 DBSETPROP('PRESENCIA.EMPALU', 'Field', 'Comment', "[E]mpleado,[A]lumno")
ENDPROC
**
PROCEDURE MakeTable_TIPCLI
 CREATE TABLE 'TIPCLI.DBF' NAME 'TIPCLI' (idtipcli C (15) NOT NULL, destipcli C (80) NOT NULL)
 INDEX ON destipcli TAG destipcli COLLATE 'MACHINE'
 INDEX ON idtipcli TAG idtipcli COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_GASCAB
 CREATE TABLE 'GASCAB.DBF' NAME 'GASCAB' (numgas N (10, 0) NOT NULL, fecgas D NOT NULL, hora C (5) NOT NULL, obsgas M NOT NULL, lineas N (5, 0) NOT NULL, codemp C (15) NOT NULL)
 INDEX ON codemp+STR(numgas, 10) TAG codemp COLLATE 'MACHINE'
 INDEX ON numgas TAG numgas COLLATE 'MACHINE'
 INDEX ON STR(numgas, 10) TAG numgasstr COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_GASLIN
 CREATE TABLE 'GASLIN.DBF' NAME 'GASLIN' (numgas N (10, 0) NOT NULL, lingas N (5, 0) NOT NULL, codart C (15) NOT NULL, desart C (100) NOT NULL, coste B (6) NOT NULL, cant B (6) NOT NULL, idtalla C (15) NOT NULL, idcolor C (15) NOT NULL)
 INDEX ON STR(numgas, 10)+STR(lingas, 5) TAG lingas COLLATE 'MACHINE'
 INDEX ON codart+STR(numgas, 10)+STR(lingas, 5) TAG artgas COLLATE 'MACHINE' DESCENDING
 INDEX ON STR(numgas, 10)+STR(lingas, 5) TAG lingasdes COLLATE 'MACHINE' DESCENDING
ENDPROC
**
PROCEDURE MakeTable_PROCEDENCIA
 CREATE TABLE 'PROCEDENCIA.DBF' NAME 'PROCEDENCIA' (codproce C (15) NOT NULL, desproce C (100) NOT NULL, obsproce M NOT NULL, obsoleto L NOT NULL)
 INDEX ON desproce TAG desproce COLLATE 'MACHINE'
 INDEX ON codproce TAG codproce COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_TIPMOV
 CREATE TABLE 'TIPMOV.DBF' NAME 'TIPMOV' (codtipmov C (15) NOT NULL, destipmov C (100) NOT NULL, obstipmov M NOT NULL, enviar L NOT NULL, tipdoc C (1) NOT NULL, foto C (254) NOT NULL, obsoleto L NOT NULL, colorf N (10, 0) NOT NULL, colorl N (10, 0) NOT NULL)
 INDEX ON destipmov TAG destipmov COLLATE 'MACHINE'
 INDEX ON codtipmov TAG codtipmov COLLATE 'MACHINE'
 INDEX ON tipdoc+codtipmov TAG tipmov COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_SMS
 CREATE TABLE 'SMS.DBF' NAME 'SMS' (fecha T NOT NULL, remitente C (20) NOT NULL, telefono C (20) NOT NULL, texto C (160) NOT NULL, estado C (10) NOT NULL, msgerror M NOT NULL, prefijo C (5) NOT NULL, codcli C (15) NOT NULL)
 INDEX ON fecha TAG fecha COLLATE 'MACHINE'
 INDEX ON codcli+DTOS(TTOD(fecha)) TAG codcli COLLATE 'MACHINE' DESCENDING
ENDPROC
**
PROCEDURE MakeTable_CBARRAS
 CREATE TABLE 'CBARRAS.DBF' NAME 'CBARRAS' (codart C (15) NOT NULL, codartdos C (20) NOT NULL)
 INDEX ON codart+codartdos TAG codart COLLATE 'MACHINE'
 INDEX ON codartdos TAG codartdos COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_GRUALU
 CREATE TABLE 'GRUALU.DBF' NAME 'GRUALU' (idgrualu C (15) NOT NULL, desgrualu C (80) NOT NULL)
 INDEX ON idgrualu TAG idgrualu COLLATE 'MACHINE'
 INDEX ON desgrualu TAG desgrualu COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_BONOSART1
 CREATE TABLE 'BONOSART1.DBF' NAME 'BONOSART1' (codbon C (20) NOT NULL, codart C (15) NOT NULL, cant B (6) NOT NULL, pvp B (6) NOT NULL, cantmax B (6) NOT NULL)
 INDEX ON codbon+codart TAG codbon COLLATE 'MACHINE'
 INDEX ON codart TAG codart COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_BONOSART2
 CREATE TABLE 'BONOSART2.DBF' NAME 'BONOSART2' (codboncli C (30) NOT NULL, codart C (15) NOT NULL, cant B (6) NOT NULL, cantgas B (6) NOT NULL, pvp B (6) NOT NULL, cantmax B (6) NOT NULL)
 INDEX ON codboncli+codart TAG codboncli COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_PLANART
 CREATE TABLE 'PLANART.DBF' NAME 'PLANART' (idplan N (10, 0) NOT NULL, codart C (15) NOT NULL, hora C (5) NOT NULL, enviar L NOT NULL DEFAULT .F., artcom L NOT NULL, artcomrel N (10, 0) NOT NULL)
 INDEX ON STR(idplan, 10)+hora TAG idplan COLLATE 'MACHINE'
 INDEX ON STR(idplan, 10)+codart+hora TAG idplanart COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_FACCABPER
 CREATE TABLE 'FACCABPER.DBF' NAME 'FACCABPER' (serfac C (4) NOT NULL, numfac N (10, 0) NOT NULL, codcli C (15) NOT NULL, obsfac M NOT NULL, impbas1 B (6) NOT NULL, impbas2 B (6) NOT NULL, impbas3 B (6) NOT NULL, impbas4 B (6) NOT NULL, impiva1 B (6) NOT NULL, impiva2 B (6) NOT NULL, impiva3 B (6) NOT NULL, impiva4 B (6) NOT NULL, iva1 N (5, 2) NOT NULL, iva2 N (5, 2) NOT NULL, iva3 N (5, 2) NOT NULL, iva4 N (5, 2) NOT NULL, totimpbas B (6) NOT NULL, totimpdto B (6) NOT NULL, totimpiva B (6) NOT NULL, totfac B (6) NOT NULL, lineas N (5, 0) NOT NULL, impresa L NOT NULL, forpag C (10) NOT NULL, fijo1 N (3, 0) NOT NULL, fijo2 N (3, 0) NOT NULL, fijo3 N (3, 0) NOT NULL, numpag N (3, 0) NOT NULL, pripag N (3, 0) NOT NULL, entpag N (3, 0) NOT NULL, dtopp N (5, 2) NOT NULL, dto1 N (5, 2) NOT NULL, idconcepto N (5, 0) NOT NULL, codban C (20) NOT NULL, cueban C (23) NOT NULL, dtocam B (6) NOT NULL, dtoaso B (6) NOT NULL, dtomav B (6) NOT NULL, dtovar B (6) NOT NULL, anulada L NOT NULL, codemp C (15) NOT NULL, comision N (6, 2) NOT NULL, obsfac2 M NOT NULL, actrec L NOT NULL, rec1 N (5, 2) NOT NULL, rec2 N (5, 2) NOT NULL, rec3 N (5, 2) NOT NULL, rec4 N (5, 2) NOT NULL, imprec1 B (6) NOT NULL, imprec2 B (6) NOT NULL, imprec3 B (6) NOT NULL, imprec4 B (6) NOT NULL, totimprec B (6) NOT NULL, actirpfp L NOT NULL, irpfp N (5, 2) NOT NULL, impirpfp B (6) NOT NULL, enero L NOT NULL, enero1 N (4, 0) NOT NULL, febrero L NOT NULL, febrero1 N (4, 0) NOT NULL, marzo L NOT NULL, marzo1 N (4, 0) NOT NULL, abril L NOT NULL, abril1 N (4, 0) NOT NULL, mayo L NOT NULL, mayo1 N (4, 0) NOT NULL, junio L NOT NULL, junio1 N (4, 0) NOT NULL, julio L NOT NULL, julio1 N (4, 0) NOT NULL, agosto L NOT NULL, agosto1 N (4, 0) NOT NULL, setiembre L NOT NULL, setiembre1 N (4, 0) NOT NULL, octubre L NOT NULL, octubre1 N (4, 0) NOT NULL, noviembre L NOT NULL, noviembre1 N (4, 0) NOT NULL, diciembre L NOT NULL, diciembre1 N (4, 0) NOT NULL, fecini D NOT NULL, fecfin D NOT NULL, codempalta C (15) NOT NULL, suped C (30) NOT NULL, iddir C (10) NOT NULL, iban C (40) NOT NULL, siniva L NOT NULL)
 INDEX ON codcli TAG codcli COLLATE 'MACHINE'
 INDEX ON numfac TAG numfac COLLATE 'MACHINE'
 INDEX ON codcli+STR(numfac, 10) TAG cliente COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_FACLINPER
 CREATE TABLE 'FACLINPER.DBF' NAME 'FACLINPER' (numfac N (10, 0) NOT NULL, linfac N (5, 0) NOT NULL, codart C (15) NOT NULL, desart C (60) NOT NULL, tipfam1 C (15) NOT NULL, codemp C (15) NOT NULL, preven B (6) NOT NULL, coste B (6) NOT NULL, cant B (6) NOT NULL, subtot B (6) NOT NULL, descuento N (5, 2) NOT NULL, taniva N (1, 0) NOT NULL, obser M NOT NULL, codbon C (20) NOT NULL, codboncli C (30) NOT NULL)
 INDEX ON codart TAG codart COLLATE 'MACHINE'
 INDEX ON STR(numfac, 10)+STR(linfac, 5) TAG linfac COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_REMESAS
 CREATE TABLE 'REMESAS.DBF' NAME 'REMESAS' (ejerem N (4, 0) NOT NULL, serrem C (4) NOT NULL, idrem N (10, 0) NOT NULL, fecrem D NOT NULL, imprem B (6) NOT NULL, numrec N (5, 0) NOT NULL, tipofec N (1, 0) NOT NULL, feccob D NOT NULL, cobrada L NOT NULL, codban C (20) NOT NULL, fichero N (1, 0) NOT NULL, empresa C (40) NOT NULL, cif C (9) NOT NULL, sufijo C (3) NOT NULL, feccargo D NOT NULL, codine C (9) NOT NULL, locord C (38) NOT NULL, codproord C (2) NOT NULL, contab L NOT NULL, idsepa C (30) NOT NULL)
 INDEX ON STR(ejerem, 4)+serrem+STR(idrem, 10) TAG idrem COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_CLIPESO
 CREATE TABLE 'CLIPESO.DBF' NAME 'CLIPESO' (codcli C (15) NOT NULL, fecha D NOT NULL, pesbas N (10, 2) NOT NULL, masgra N (10, 2) NOT NULL, excmas N (10, 2) NOT NULL, agua N (10, 2) NOT NULL, peside N (10, 2) NOT NULL, gracor N (10, 2) NOT NULL, masgraopt N (10, 2) NOT NULL, matnogra N (10, 2) NOT NULL, excgra N (10, 2) NOT NULL, tobillo N (10, 2) NOT NULL, muslo N (10, 2) NOT NULL, cintura N (10, 2) NOT NULL, pechoalt N (10, 2) NOT NULL, gemelos N (10, 2) NOT NULL, cadera N (10, 2) NOT NULL, abdomen N (10, 2) NOT NULL, rodilla N (10, 2) NOT NULL, barriga N (10, 2) NOT NULL, pechocon N (10, 2) NOT NULL, obspes M NOT NULL, imc N (10, 2) NOT NULL)
 INDEX ON codcli+DTOS(fecha) TAG codcli COLLATE 'MACHINE' DESCENDING
ENDPROC
**
PROCEDURE MakeTable_EDADPESO
 CREATE TABLE 'EDADPESO.DBF' NAME 'EDADPESO' (edad N (3, 0) NOT NULL, sexo C (1) NOT NULL, correc N (5, 2) NOT NULL)
 INDEX ON STR(edad, 3)+sexo TAG edad COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_ALTPESO
 CREATE TABLE 'ALTPESO.DBF' NAME 'ALTPESO' (altura N (3, 0) NOT NULL, peso N (5, 2) NOT NULL)
 INDEX ON altura TAG altura COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_CLITRA
 CREATE TABLE 'CLITRA.DBF' NAME 'CLITRA' (idclitra N (10, 0) NOT NULL, codcli C (15) NOT NULL, fecini D NOT NULL, fecfin D NOT NULL, sesact C (20) NOT NULL, sestot C (20) NOT NULL, destra C (100) NOT NULL, tecemp C (100) NOT NULL, aparatos C (100) NOT NULL, cosme C (100) NOT NULL, apodom C (100) NOT NULL, otros M NOT NULL, resultado M NOT NULL)
 INDEX ON codcli+DTOS(fecini) TAG codcli COLLATE 'MACHINE' DESCENDING
 INDEX ON idclitra TAG idclitra COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_TALLASGRU
 CREATE TABLE 'TALLASGRU.DBF' NAME 'TALLASGRU' (idgrupo C (15) NOT NULL, desgru C (100) NOT NULL, obsgru M NOT NULL, enviar L NOT NULL)
 INDEX ON idgrupo TAG idgrupo COLLATE 'MACHINE'
 INDEX ON desgru TAG desgru COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_TALLAS
 CREATE TABLE 'TALLAS.DBF' NAME 'TALLAS' (idtalla C (15) NOT NULL, idgrupo C (15) NOT NULL, destalla C (100) NOT NULL, enviar L NOT NULL)
 INDEX ON idgrupo+idtalla TAG idtalla COLLATE 'MACHINE'
 INDEX ON idtalla TAG talla COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_COLORES
 CREATE TABLE 'COLORES.DBF' NAME 'COLORES' (idcolor C (15) NOT NULL, descolor C (100) NOT NULL, color N (10, 0) NOT NULL, enviar L NOT NULL)
 INDEX ON idcolor TAG idcolor COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_TALLASART
 CREATE TABLE 'TALLASART.DBF' NAME 'TALLASART' (codart C (15) NOT NULL, idgrupo C (15) NOT NULL, idtalla C (15) NOT NULL, idcolor C (15) NOT NULL, color N (10, 0) NOT NULL, stock B (6) NOT NULL, pvp B (6) NOT NULL, codartdos C (20) NOT NULL, descolor C (100) NOT NULL)
 INDEX ON codart+idgrupo+idtalla+idcolor TAG codart COLLATE 'MACHINE'
 INDEX ON codart+idtalla+idcolor TAG arttalcol COLLATE 'MACHINE'
 INDEX ON codartdos TAG codartdos COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_GALERIAS
 CREATE TABLE 'GALERIAS.DBF' NAME 'GALERIAS' (idfoto N (10, 0) NOT NULL, ordfoto N (5, 0) NOT NULL, rutafoto C (250) NOT NULL, txtfoto C (250) NOT NULL, enviarweb L NOT NULL, obsfoto M NOT NULL, facebook L NOT NULL, facebookdt T NOT NULL, rutafoto2 C (250) NOT NULL)
 INDEX ON ordfoto TAG ordfoto COLLATE 'MACHINE'
 INDEX ON idfoto TAG idfoto COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_AGENDAART
 CREATE TABLE 'AGENDAART.DBF' NAME 'AGENDAART' (codage N (10, 0) NOT NULL, codart C (15) NOT NULL)
 INDEX ON codage TAG codage COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_PLAN2009
 CREATE TABLE 'PLAN2009.DBF' NAME 'PLAN2009' (idplan N (10, 0) NOT NULL, codemp C (15) NOT NULL, codcli C (15) NOT NULL, fecha D NOT NULL, horini C (5) NOT NULL, horfin C (5) NOT NULL, texto C (250) NOT NULL, codrec C (15) NOT NULL, nomcli C (80) NOT NULL, tel1cli C (20) NOT NULL, colfon N (15, 0) NOT NULL, collet N (15, 0) NOT NULL, facturado L NOT NULL, enviar L NOT NULL DEFAULT .T., idusuweb N (10, 0) NOT NULL, enviadoand L NOT NULL, macand C (30) NOT NULL, idand N (15, 0) NOT NULL, enviadocro L NOT NULL, idcro N (15, 0) NOT NULL, enviadoadd L NOT NULL, idplanrel N (10, 0) NOT NULL, codproce C (15) NOT NULL, horaman L NOT NULL)
 INDEX ON fecha TAG fecha COLLATE 'MACHINE'
 INDEX ON codcli TAG codcli COLLATE 'MACHINE'
 INDEX ON codemp TAG codemp COLLATE 'MACHINE'
 INDEX ON idplan TAG idplan COLLATE 'MACHINE'
 INDEX ON codrec TAG codrec COLLATE 'MACHINE'
 INDEX ON fecha TAG fechades COLLATE 'MACHINE' DESCENDING
 INDEX ON DTOS(fecha)+codemp TAG fecemp COLLATE 'MACHINE'
 INDEX ON DTOS(fecha)+codrec TAG fecrec COLLATE 'MACHINE'
 INDEX ON enviar TAG enviar COLLATE 'MACHINE'
 INDEX ON codcli+DTOS(fecha) TAG clifec COLLATE 'MACHINE' DESCENDING
 INDEX ON enviadoand TAG enviadoand COLLATE 'MACHINE'
 INDEX ON enviadocro TAG enviadocro COLLATE 'MACHINE'
 INDEX ON enviadoadd TAG enviadoadd COLLATE 'MACHINE'
 INDEX ON idplanrel TAG idplanrel COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_PLANSMS
 CREATE TABLE 'PLANSMS.DBF' NAME 'PLANSMS' (idsms C (10) NOT NULL, dessms C (150) NOT NULL, texto C (250) NOT NULL, tipsms N (2, 0) NOT NULL, enviar L NOT NULL, allcentros L NOT NULL)
 INDEX ON idsms TAG idsms COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_PLANINC
 CREATE TABLE 'PLANINC.DBF' NAME 'PLANINC' (idplaninc N (10, 0) NOT NULL, codusu C (15) NOT NULL, fechorinc T NOT NULL, tipinc C (20) NOT NULL, idplan N (10, 0) NOT NULL, codemp C (15) NOT NULL, codcli C (15) NOT NULL, fecha D NOT NULL, horini C (5) NOT NULL, horfin C (5) NOT NULL, texto C (250) NOT NULL, codrec C (15) NOT NULL, nomcli C (80) NOT NULL, tel1cli C (20) NOT NULL, planart M NOT NULL, codempx C (15) NOT NULL, codclix C (15) NOT NULL, fechax D NOT NULL, horinix C (5) NOT NULL, horfinx C (5) NOT NULL, textox C (250) NOT NULL, codrecx C (15) NOT NULL, nomclix C (80) NOT NULL, tel1clix C (20) NOT NULL, planartx M NOT NULL)
 INDEX ON fecha TAG fecha COLLATE 'MACHINE'
 INDEX ON codcli TAG codcli COLLATE 'MACHINE'
 INDEX ON codemp TAG codemp COLLATE 'MACHINE'
 INDEX ON idplan TAG idplan COLLATE 'MACHINE'
 INDEX ON codrec TAG codrec COLLATE 'MACHINE'
 INDEX ON fecha TAG fechades COLLATE 'MACHINE' DESCENDING
 INDEX ON idplaninc TAG idplaninc COLLATE 'MACHINE'
 INDEX ON codusu+DTOS(fecha) TAG codusu COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_EMAIL
 CREATE TABLE 'EMAIL.DBF' NAME 'EMAIL' (fecha T NOT NULL, mail C (250) NOT NULL, tema C (250) NOT NULL, texto M NOT NULL, adjuntos C (250) NOT NULL, estado C (10) NOT NULL, msgerror M NOT NULL, codcli C (15) NOT NULL)
 INDEX ON fecha TAG fecha COLLATE 'MACHINE'
 INDEX ON codcli+DTOS(TTOD(fecha)) TAG codcli COLLATE 'MACHINE' DESCENDING
ENDPROC
**
PROCEDURE MakeTable_TIPART
 CREATE TABLE 'TIPART.DBF' NAME 'TIPART' (idtipart C (15) NOT NULL, destipart C (150) NOT NULL)
 INDEX ON destipart TAG destipart COLLATE 'MACHINE'
 INDEX ON idtipart TAG idtipart COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_CLICAV
 CREATE TABLE 'CLICAV.DBF' NAME 'CLICAV' (idclicav N (10, 0) NOT NULL, codcli C (15) NOT NULL, fecha D NOT NULL, area C (50) NOT NULL, potencia C (50) NOT NULL, programa C (100) NOT NULL, altura C (50) NOT NULL, medida1 C (50) NOT NULL, medida2 C (50) NOT NULL)
 INDEX ON codcli+DTOS(fecha) TAG codcli COLLATE 'MACHINE' DESCENDING
 INDEX ON idclicav TAG idclicav COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_FAVORITOS
 CREATE TABLE 'FAVORITOS.DBF' NAME 'FAVORITOS' (idmenu N (10, 0) NOT NULL, favorito L NOT NULL)
 INDEX ON idmenu TAG idmenu COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_SMSAUTO
 CREATE TABLE 'SMSAUTO.DBF' NAME 'SMSAUTO' (idplan N (10, 0) NOT NULL, desplan C (100) NOT NULL, activado L NOT NULL, avifel L NOT NULL, avipla L NOT NULL, aviage L NOT NULL, avicli L NOT NULL, diasavi N (3, 0) NOT NULL, horavi N (2, 0) NOT NULL, txtfel C (10) NOT NULL, txtpla C (10) NOT NULL, txtage C (10) NOT NULL, txtcli C (10) NOT NULL, remitente C (11) NOT NULL, fecult D NOT NULL, horult C (2) NOT NULL, fecini D NOT NULL, fecfin D NOT NULL, anteriores L NOT NULL, ndiasant N (3, 0) NOT NULL, dcodcli C (15) NOT NULL, hcodcli C (15) NOT NULL, dcodpos C (15) NOT NULL, hcodpos C (15) NOT NULL, didtipcli C (15) NOT NULL, hidtipcli C (15) NOT NULL, hombre L NOT NULL, mujer L NOT NULL, nino L NOT NULL, anicli L NOT NULL, dfecani C (5) NOT NULL, hfecani C (5) NOT NULL, noobscli L NOT NULL, allcentros L NOT NULL, enviar L NOT NULL)
 INDEX ON idplan TAG idplan COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_SMSAUTOREG
 CREATE TABLE 'SMSAUTOREG.DBF' NAME 'SMSAUTOREG' (idplanreg N (10, 0) NOT NULL, idplan N (10, 0) NOT NULL, fecha D NOT NULL, hora C (5) NOT NULL, estado C (5) NOT NULL, msgerror C (250) NOT NULL, smsenvfel N (10, 0) NOT NULL, smserrfel N (10, 0) NOT NULL, smsenvpla N (10, 0) NOT NULL, smserrpla N (10, 0) NOT NULL, smsenvage N (10, 0) NOT NULL, smserrage N (10, 0) NOT NULL, smsenvtot N (10, 0) NOT NULL, smserrtot N (10, 0) NOT NULL, mostrar L NOT NULL, smsenvcli N (10, 0) NOT NULL, smserrcli N (10, 0) NOT NULL)
 INDEX ON idplanreg TAG idplanreg COLLATE 'MACHINE'
 INDEX ON STR(idplan, 10)+STR(idplanreg, 10) TAG idplan COLLATE 'MACHINE' DESCENDING
 INDEX ON mostrar TAG mostrar COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_PRELIN
 CREATE TABLE 'PRELIN.DBF' NAME 'PRELIN' (serpre C (4) NOT NULL, ejepre N (4, 0) NOT NULL, numpre N (10, 0) NOT NULL, linpre N (5, 0) NOT NULL, codart C (15) NOT NULL, desart C (100) NOT NULL, tipfam1 C (15) NOT NULL, precio B (6) NOT NULL, coste B (6) NOT NULL, cant B (6) NOT NULL, subtot B (6) NOT NULL, descuento N (5, 2) NOT NULL, taniva N (1, 0) NOT NULL, obser M NOT NULL, codemp C (15) NOT NULL, comision N (5, 2) NOT NULL, codboncli C (30) NOT NULL, codbon C (20) NOT NULL, estado C (1) NOT NULL, hora T NOT NULL, impreso L NOT NULL, plato N (1, 0) NOT NULL, poremps N (6, 2) NOT NULL, codemp2 C (15) NOT NULL, comision2 N (5, 2) NOT NULL, creditos N (10, 0) NOT NULL, codalu C (15) NOT NULL, idtalla C (15) NOT NULL, idcolor C (15) NOT NULL, pvpcom B (6) NOT NULL, pulsos N (5, 0) NOT NULL, energia N (10, 0) NOT NULL, foto C (150) NOT NULL)
 INDEX ON codboncli TAG codboncli COLLATE 'MACHINE'
 INDEX ON estado+TTOC(hora, 1) TAG esthora COLLATE 'MACHINE'
 INDEX ON codart TAG codart COLLATE 'MACHINE'
 INDEX ON codemp TAG codemp_a COLLATE 'MACHINE'
 INDEX ON codemp2 TAG codemp2 COLLATE 'MACHINE'
 INDEX ON codemp+STR(ejepre, 4)+serpre+STR(numpre, 10)+STR(linpre, 5) TAG codemp COLLATE 'MACHINE'
 INDEX ON codart+STR(ejepre, 4)+serpre+STR(numpre, 10)+STR(linpre, 5) TAG artfac COLLATE 'MACHINE' DESCENDING
 INDEX ON STR(ejepre, 4)+serpre+STR(numpre, 10)+STR(linpre, 5) TAG lineas COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_PRECAB
 CREATE TABLE 'PRECAB.DBF' NAME 'PRECAB' (serpre C (4) NOT NULL, ejepre N (4, 0) NOT NULL, numpre N (10, 0) NOT NULL, fecha D NOT NULL, hora C (5) NOT NULL, codcli C (15) NOT NULL, obser M NOT NULL, impbas1 B (6) NOT NULL, impbas2 B (6) NOT NULL, impbas3 B (6) NOT NULL, impbas4 B (6) NOT NULL, impiva1 B (6) NOT NULL, impiva2 B (6) NOT NULL, impiva3 B (6) NOT NULL, impiva4 B (6) NOT NULL, iva1 N (5, 2) NOT NULL, iva2 N (5, 2) NOT NULL, iva3 N (5, 2) NOT NULL, iva4 N (5, 2) NOT NULL, totimpbas B (6) NOT NULL, totimpdto B (6) NOT NULL, totimpiva B (6) NOT NULL, total B (6) NOT NULL, lineas N (5, 0) NOT NULL, impresa L NOT NULL, dtopp N (5, 2) NOT NULL, dto1 N (5, 2) NOT NULL, dtocam B (6) NOT NULL, dtoaso B (6) NOT NULL, dtomav B (6) NOT NULL, dtovar B (6) NOT NULL, anulada L NOT NULL, puntos N (12, 2) NOT NULL, codemp C (15) NOT NULL, foto1 C (254) NOT NULL, foto2 C (254) NOT NULL, enviar L NOT NULL, sexo C (1) NOT NULL, idconcepto N (5, 0) NOT NULL, codboncli1 C (30) NOT NULL, codboncli2 C (30) NOT NULL, impbono1 B (4) NOT NULL, impbono2 B (4) NOT NULL, mesa C (5) NOT NULL, comensales N (3, 0) NOT NULL, actrec L NOT NULL, rec1 N (5, 2) NOT NULL, rec2 N (5, 2) NOT NULL, rec3 N (5, 2) NOT NULL, rec4 N (5, 2) NOT NULL, imprec1 B (6) NOT NULL, imprec2 B (6) NOT NULL, imprec3 B (6) NOT NULL, imprec4 B (6) NOT NULL, totimprec B (6) NOT NULL, actirpfp L NOT NULL, irpfp N (5, 2) NOT NULL, impirpfp B (6) NOT NULL, ntickets N (6, 2) NOT NULL, codalu C (15) NOT NULL, ticeval C (60) NOT NULL, contab L NOT NULL, fechorfin T NOT NULL, facimp L NOT NULL, plato N (1, 0) NOT NULL, albaranado L NOT NULL, numalbrel C (18) NOT NULL, facturado L NOT NULL, numfacrel C (18) NOT NULL, estado N (1, 0) NOT NULL, impcob B (6) NOT NULL, siniva L NOT NULL)
 INDEX ON codboncli2 TAG codboncli2 COLLATE 'MACHINE'
 INDEX ON codboncli1 TAG codboncli1 COLLATE 'MACHINE'
 INDEX ON numfacrel TAG numfacrel COLLATE 'MACHINE'
 INDEX ON codcli TAG codcli COLLATE 'MACHINE'
 INDEX ON enviar TAG enviar COLLATE 'MACHINE'
 INDEX ON codcli+STR(ejepre, 4)+serpre+STR(numpre, 10) TAG cliente COLLATE 'MACHINE'
 INDEX ON STR(ejepre, 4)+serpre+STR(numpre, 10) TAG numpredes COLLATE 'MACHINE' DESCENDING
 INDEX ON serpre TAG serpre COLLATE 'MACHINE'
 INDEX ON codcli+DTOS(fecha) TAG ultven COLLATE 'MACHINE' DESCENDING
 INDEX ON fecha TAG fecha COLLATE 'MACHINE'
 INDEX ON STR(ejepre, 4)+serpre+STR(numpre, 10) TAG numdoc COLLATE 'MACHINE'
 INDEX ON numalbrel TAG numalbrel COLLATE 'MACHINE'
 DBSETPROP('PRECAB.ESTADO', 'Field', 'Comment', "1-Pendiente, 2-Aceptado, 3-Rechazado")
ENDPROC
**
PROCEDURE MakeTable_ACUENTA
 CREATE TABLE 'ACUENTA.DBF' NAME 'ACUENTA' (numcob N (14, 0) NOT NULL, tipdoc C (1) NOT NULL, ejercicio N (4, 0) NOT NULL, serie C (4) NOT NULL, numdoc N (10, 0) NOT NULL, fecha D NOT NULL, impcob B (4) NOT NULL, forpag C (10) NOT NULL, cieentsal N (10, 0) NOT NULL)
 INDEX ON numcob TAG idcob COLLATE 'MACHINE'
 INDEX ON tipdoc+STR(ejercicio, 4)+serie+STR(numdoc, 10)+STR(numcob, 14) TAG numdoc COLLATE 'MACHINE'
 DBSETPROP('ACUENTA.TIPDOC', 'Field', 'Comment', "'A'-Albaran, 'P'-Presupuesto")
ENDPROC
**
PROCEDURE MakeTable_ALBCAB
 CREATE TABLE 'ALBCAB.DBF' NAME 'ALBCAB' (seralb C (4) NOT NULL, ejealb N (4, 0) NOT NULL, numalb N (10, 0) NOT NULL, fecha D NOT NULL, hora C (5) NOT NULL, codcli C (15) NOT NULL, obser M NOT NULL, impbas1 B (6) NOT NULL, impbas2 B (6) NOT NULL, impbas3 B (6) NOT NULL, impbas4 B (6) NOT NULL, impiva1 B (6) NOT NULL, impiva2 B (6) NOT NULL, impiva3 B (6) NOT NULL, impiva4 B (6) NOT NULL, iva1 N (5, 2) NOT NULL, iva2 N (5, 2) NOT NULL, iva3 N (5, 2) NOT NULL, iva4 N (5, 2) NOT NULL, totimpbas B (6) NOT NULL, totimpdto B (6) NOT NULL, totimpiva B (6) NOT NULL, total B (6) NOT NULL, lineas N (5, 0) NOT NULL, impresa L NOT NULL, dtopp N (5, 2) NOT NULL, dto1 N (5, 2) NOT NULL, dtocam B (6) NOT NULL, dtoaso B (6) NOT NULL, dtomav B (6) NOT NULL, dtovar B (6) NOT NULL, anulada L NOT NULL, puntos N (12, 2) NOT NULL, codemp C (15) NOT NULL, foto1 C (254) NOT NULL, foto2 C (254) NOT NULL, enviar L NOT NULL, sexo C (1) NOT NULL, idconcepto N (5, 0) NOT NULL, codboncli1 C (30) NOT NULL, codboncli2 C (30) NOT NULL, impbono1 B (4) NOT NULL, impbono2 B (4) NOT NULL, mesa C (5) NOT NULL, comensales N (3, 0) NOT NULL, actrec L NOT NULL, rec1 N (5, 2) NOT NULL, rec2 N (5, 2) NOT NULL, rec3 N (5, 2) NOT NULL, rec4 N (5, 2) NOT NULL, imprec1 B (6) NOT NULL, imprec2 B (6) NOT NULL, imprec3 B (6) NOT NULL, imprec4 B (6) NOT NULL, totimprec B (6) NOT NULL, actirpfp L NOT NULL, irpfp N (5, 2) NOT NULL, impirpfp B (6) NOT NULL, numprerel C (18) NOT NULL, numfacrel C (18) NOT NULL, ntickets N (6, 2) NOT NULL, codalu C (15) NOT NULL, ticeval C (60) NOT NULL, contab L NOT NULL, fechorfin T NOT NULL, facimp L NOT NULL, plato N (1, 0) NOT NULL, facturado L NOT NULL, estado N (1, 0) NOT NULL, impcob B (6) NOT NULL, siniva L NOT NULL)
 INDEX ON codboncli2 TAG codboncli2 COLLATE 'MACHINE'
 INDEX ON codboncli1 TAG codboncli1 COLLATE 'MACHINE'
 INDEX ON numfacrel TAG numfacrel COLLATE 'MACHINE'
 INDEX ON codcli TAG codcli COLLATE 'MACHINE'
 INDEX ON enviar TAG enviar COLLATE 'MACHINE'
 INDEX ON codcli+DTOS(fecha) TAG ultven COLLATE 'MACHINE' DESCENDING
 INDEX ON fecha TAG fecha COLLATE 'MACHINE'
 INDEX ON codcli+STR(ejealb, 4)+seralb+STR(numalb, 10) TAG cliente COLLATE 'MACHINE'
 INDEX ON seralb TAG serpre COLLATE 'MACHINE'
 INDEX ON STR(ejealb, 4)+seralb+STR(numalb, 10) TAG numdoc COLLATE 'MACHINE'
 INDEX ON STR(ejealb, 4)+seralb+STR(numalb, 10) TAG numalbdes COLLATE 'MACHINE' DESCENDING
ENDPROC
**
PROCEDURE MakeTable_ALBLIN
 CREATE TABLE 'ALBLIN.DBF' NAME 'ALBLIN' (seralb C (4) NOT NULL, ejealb N (4, 0) NOT NULL, numalb N (10, 0) NOT NULL, linalb N (5, 0) NOT NULL, codart C (15) NOT NULL, desart C (100) NOT NULL, tipfam1 C (15) NOT NULL, precio B (6) NOT NULL, coste B (6) NOT NULL, cant B (6) NOT NULL, subtot B (6) NOT NULL, descuento N (5, 2) NOT NULL, taniva N (1, 0) NOT NULL, obser M NOT NULL, codemp C (15) NOT NULL, comision N (5, 2) NOT NULL, codboncli C (30) NOT NULL, codbon C (20) NOT NULL, estado C (1) NOT NULL, hora T NOT NULL, impreso L NOT NULL, plato N (1, 0) NOT NULL, poremps N (6, 2) NOT NULL, codemp2 C (15) NOT NULL, comision2 N (5, 2) NOT NULL, creditos N (10, 0) NOT NULL, codalu C (15) NOT NULL, idtalla C (15) NOT NULL, idcolor C (15) NOT NULL, pvpcom B (6) NOT NULL, pulsos N (5, 0) NOT NULL, energia N (10, 0) NOT NULL, foto C (150) NOT NULL, numser C (30) NOT NULL)
 INDEX ON codboncli TAG codboncli COLLATE 'MACHINE'
 INDEX ON estado+TTOC(hora, 1) TAG esthora COLLATE 'MACHINE'
 INDEX ON codart TAG codart COLLATE 'MACHINE'
 INDEX ON codemp TAG codemp_a COLLATE 'MACHINE'
 INDEX ON codemp2 TAG codemp2 COLLATE 'MACHINE'
 INDEX ON codemp+STR(ejealb, 4)+seralb+STR(numalb, 10)+STR(linalb, 5) TAG codemp COLLATE 'MACHINE'
 INDEX ON codart+STR(ejealb, 4)+seralb+STR(numalb, 10)+STR(linalb, 5) TAG artfac COLLATE 'MACHINE' DESCENDING
 INDEX ON STR(ejealb, 4)+seralb+STR(numalb, 10)+STR(linalb, 5) TAG lineas COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_CONSEN
 CREATE TABLE 'CONSEN.DBF' NAME 'CONSEN' (idconsen C (15) NOT NULL, desconsen C (100) NOT NULL, obsconsen M NOT NULL)
 INDEX ON idconsen TAG idconsen COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_FIRMAS
 CREATE TABLE 'FIRMAS.DBF' NAME 'FIRMAS' (idfirma N (10, 0) NOT NULL, codrel C (20) NOT NULL, tabrel C (20) NOT NULL, firma C (254) NOT NULL)
 INDEX ON idfirma TAG idfirma COLLATE 'MACHINE'
 INDEX ON tabrel+codrel TAG tabcod COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_CLICON
 CREATE TABLE 'CLICON.DBF' NAME 'CLICON' (idclicon N (10, 0) NOT NULL, codcli C (15) NOT NULL, idconsen C (15) NOT NULL, fecha D NOT NULL, firmado L NOT NULL, ruta C (254) NOT NULL)
 INDEX ON codcli+idconsen TAG clicon COLLATE 'MACHINE'
 INDEX ON idclicon TAG idclicon COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_NUMSER
 CREATE TABLE 'NUMSER.DBF' NAME 'NUMSER' (codart C (15) NOT NULL, numser C (30) NOT NULL, fecent D NOT NULL, fecsal D NOT NULL, docent C (23) NOT NULL, tipdocent C (1) NOT NULL, docsal C (23) NOT NULL, tipdocsal C (1) NOT NULL)
 INDEX ON numser TAG numser COLLATE 'MACHINE'
 INDEX ON codart+numser TAG codart COLLATE 'MACHINE'
 INDEX ON numser+tipdocent+docent TAG numserent COLLATE 'MACHINE'
 INDEX ON numser+tipdocsal+docsal TAG numsersal COLLATE 'MACHINE'
 INDEX ON tipdocsal+docsal TAG docsal COLLATE 'MACHINE'
 INDEX ON tipdocent+docent TAG docent COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_CLISESLAS
 CREATE TABLE 'CLISESLAS.DBF' NAME 'CLISESLAS' (idclises N (10, 0) NOT NULL, codcli C (15) NOT NULL, fecha D NOT NULL, precio B (6) NOT NULL, zona C (100) NOT NULL, tippie C (15) NOT NULL, grapig C (15) NOT NULL, grovel C (15) NOT NULL, energia N (10, 2) NOT NULL, numdis N (10, 0) NOT NULL, sistema C (15) NOT NULL, opera C (15) NOT NULL, obser M NOT NULL, energia2 N (10, 2) NOT NULL, sesion C (10) NOT NULL)
 INDEX ON idclises TAG idclises COLLATE 'MACHINE'
 INDEX ON codcli+DTOS(fecha)+STR(idclises, 10) TAG codcli COLLATE 'MACHINE' DESCENDING
ENDPROC
**
PROCEDURE MakeTable_RESUMENDIA
 CREATE TABLE 'RESUMENDIA.DBF' NAME 'RESUMENDIA' (diares D NOT NULL, ntic00 N (5, 0) NOT NULL, nticres N (5, 0) NOT NULL, totfac00 B (6) NOT NULL, totfacres B (6) NOT NULL, totdeuven B (6) NOT NULL, totser00 B (6) NOT NULL, totserres B (6) NOT NULL, nser00 N (5, 0) NOT NULL, nserres N (5, 0) NOT NULL, totpro00 B (6) NOT NULL, totprores B (6) NOT NULL, npro00 N (5, 0) NOT NULL, nprores N (5, 0) NOT NULL, nclih N (5, 0) NOT NULL, nclim N (5, 0) NOT NULL, nclin N (5, 0) NOT NULL, nclinue N (5, 0) NOT NULL, nclinueh N (5, 0) NOT NULL, nclinuem N (5, 0) NOT NULL, nclinuen N (5, 0) NOT NULL, totcli N (10, 0) NOT NULL, totentcaj B (6) NOT NULL, totsalcaj B (6) NOT NULL, totfaccom B (6) NOT NULL, totdeucom B (6) NOT NULL, nreservas N (5, 0) NOT NULL, nresfac N (5, 0) NOT NULL, restie N (10, 0) NOT NULL, restiefac N (10, 0) NOT NULL, enviar L NOT NULL)
 INDEX ON DTOS(diares) TAG diares COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_OFERTAS
 CREATE TABLE 'OFERTAS.DBF' NAME 'OFERTAS' (codofe C (15) NOT NULL, desofe C (100) NOT NULL, feciniofe D NOT NULL, fecfinofe D NOT NULL, obsoleto L NOT NULL, lunes L NOT NULL, martes L NOT NULL, miercoles L NOT NULL, jueves L NOT NULL, viernes L NOT NULL, sabado L NOT NULL, domingo L NOT NULL, obsofe M NOT NULL, productos L NOT NULL, dtoprod N (6, 2) NOT NULL, servicios L NOT NULL, dtoserv N (6, 2) NOT NULL, rutafoto C (250) NOT NULL, facebook L NOT NULL, facebookdt T NOT NULL, enviarweb L NOT NULL, orden N (10, 0) NOT NULL)
 INDEX ON feciniofe TAG feciniofe COLLATE 'MACHINE'
 INDEX ON desofe TAG desofe COLLATE 'MACHINE'
 INDEX ON codofe TAG codofe COLLATE 'MACHINE'
 INDEX ON facebook TAG facebook COLLATE 'MACHINE' DESCENDING
ENDPROC
**
PROCEDURE MakeTable_OFERTASART
 CREATE TABLE 'OFERTASART.DBF' NAME 'OFERTASART' (codofe C (15) NOT NULL, codart C (15) NOT NULL, dto N (6, 2) NOT NULL, pvp B (4) NOT NULL, pvpcom B (4) NOT NULL)
 INDEX ON codofe+codart TAG codofe COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_OFERTASFAM
 CREATE TABLE 'OFERTASFAM.DBF' NAME 'OFERTASFAM' (codofe C (15) NOT NULL, codfam1 C (10) NOT NULL, dto N (6, 2) NOT NULL)
 INDEX ON codofe+codfam1 TAG codofe COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_TURNOS
 CREATE TABLE 'TURNOS.DBF' NAME 'TURNOS' (diatur D NOT NULL, turno N (5, 0) NOT NULL)
 INDEX ON diatur TAG diatur COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_PLANTMP
 CREATE TABLE 'PLANTMP.DBF' NAME 'PLANTMP' (idplantmp N (10, 0) NOT NULL, codusu C (15) NOT NULL, fechortmp T NOT NULL, tiptmp C (20) NOT NULL, idplan N (10, 0) NOT NULL, codemp C (15) NOT NULL, codcli C (15) NOT NULL, fecha D NOT NULL, horini C (5) NOT NULL, horfin C (5) NOT NULL, texto C (250) NOT NULL, codrec C (15) NOT NULL, nomcli C (80) NOT NULL, tel1cli C (20) NOT NULL, planart M NOT NULL, colfon N (10, 0) NOT NULL, collet N (10, 0) NOT NULL, codempx C (15) NOT NULL, codclix C (15) NOT NULL, fechax D NOT NULL, horinix C (5) NOT NULL, horfinx C (5) NOT NULL, textox C (250) NOT NULL, codrecx C (15) NOT NULL, nomclix C (80) NOT NULL, tel1clix C (20) NOT NULL, planartx M NOT NULL, colfonx N (10, 0) NOT NULL, colletx N (10, 0) NOT NULL, estado C (1) NOT NULL)
 INDEX ON idplan TAG idplan COLLATE 'MACHINE'
 INDEX ON idplantmp TAG idplantmp COLLATE 'MACHINE'
 INDEX ON estado+STR(idplantmp, 10) TAG estado COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_CLIPEL
 CREATE TABLE 'CLIPEL.DBF' NAME 'CLIPEL' (idclipel N (10, 0) NOT NULL, codcli C (15) NOT NULL, fecha D NOT NULL, prouticp M NOT NULL, formulasp M NOT NULL, tecnicap C (80) NOT NULL, tieexpp C (80) NOT NULL)
 INDEX ON codcli+DTOS(fecha) TAG codcli COLLATE 'MACHINE' DESCENDING
 INDEX ON idclipel TAG idclipel COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_INVENTARIO
 CREATE TABLE 'INVENTARIO.DBF' NAME 'INVENTARIO' (fecinv D NOT NULL, codart C (15) NOT NULL, idtalla C (15) NOT NULL, idcolor C (15) NOT NULL, stoold B (4) NOT NULL, stonew B (4) NOT NULL, cosold B (4) NOT NULL, cosnew B (4) NOT NULL)
 INDEX ON codart+idtalla+idcolor TAG articulo COLLATE 'MACHINE'
 INDEX ON codart+idtalla+idcolor+DTOS(fecinv) TAG fecart COLLATE 'MACHINE'
 INDEX ON fecinv TAG fecinv COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_PROCLIEMP
 CREATE TABLE 'PROCLIEMP.DBF' NAME 'PROCLIEMP' (codproce C (15) NOT NULL, desproce C (80) NOT NULL, obsproce M NOT NULL, obsoleto L NOT NULL, descorta C (10) NOT NULL)
 INDEX ON codproce TAG codproce COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_REMREC
 CREATE TABLE 'REMREC.DBF' NAME 'REMREC' (ejerem N (4, 0) NOT NULL, serrem C (4) NOT NULL, idrem N (10, 0) NOT NULL, ejefac N (4, 0) NOT NULL, serfac C (4) NOT NULL, numfac N (10, 0) NOT NULL, numrec N (12, 0) NOT NULL, importe B (6) NOT NULL, estado C (15) NOT NULL)
 INDEX ON STR(ejefac, 4)+serfac+STR(numfac, 10)+STR(numrec, 12) TAG numrec COLLATE 'MACHINE'
 INDEX ON STR(ejerem, 4)+serrem+STR(idrem, 10) TAG numrem COLLATE 'MACHINE'
 INDEX ON STR(ejerem, 4)+serrem+STR(idrem, 10)+STR(ejefac, 4)+serfac+STR(numfac, 10)+STR(numrec, 12) TAG remrec COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_BLOG
 CREATE TABLE 'BLOG.DBF' NAME 'BLOG' (idblog N (10, 0) NOT NULL, fecblog D NOT NULL, titblog C (100) NOT NULL, obsblog M NOT NULL, obscorblog M NOT NULL, foto C (250) NOT NULL, fecini D NOT NULL, fecfin D NOT NULL, enviarweb L NOT NULL, facebook L NOT NULL, facebookdt T NOT NULL)
 INDEX ON fecblog TAG fecblog COLLATE 'MACHINE'
 INDEX ON idblog TAG idblog COLLATE 'MACHINE'
 INDEX ON titblog TAG titblog COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_CLIFAMILIA
 CREATE TABLE 'CLIFAMILIA.DBF' NAME 'CLIFAMILIA' (codcli C (15) NOT NULL, codfam C (15) NOT NULL, relacion N (1, 0) NOT NULL, nomfam C (100) NOT NULL, apefam C (100) NOT NULL, telfam C (30) NOT NULL, fecnac D NOT NULL, categoria C (100) NOT NULL, importe B (6) NOT NULL)
 INDEX ON codcli+codfam TAG codcli COLLATE 'MACHINE'
 INDEX ON codcli+STR(relacion, 1)+nomfam TAG clirel COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_CATEMP
 CREATE TABLE 'CATEMP.DBF' NAME 'CATEMP' (idcatemp C (15) NOT NULL, descatemp C (80) NOT NULL)
 INDEX ON idcatemp TAG idcatemp COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_OBSPLAN
 CREATE TABLE 'OBSPLAN.DBF' NAME 'OBSPLAN' (fecha D NOT NULL, obsplan M NOT NULL)
 INDEX ON fecha TAG fecha COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE DisplayStatus
 LPARAMETERS lcmessage
 WAIT WINDOW NOWAIT lcmessage
ENDPROC
**
