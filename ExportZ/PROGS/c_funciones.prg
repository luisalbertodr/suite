**
FUNCTION CompruebaUnicidad
 PARAMETER codtabla, codnuevo
 IF RECCOUNT()=1
    RETURN .T.
 ELSE
    reg = RECNO()
    GOTO TOP
    LOCATE FOR &codtabla=codnuevo .AND. RECNO()#reg
    IF FOUND() .AND. RECCOUNT()<>1
       GOTO reg
       _messagebox(traducir(pcidioma, "Registro existente, Introducción no válida."), 64, traducir(pcidioma, "Atención"))
       RETURN .F.
    ELSE
       GOTO reg
       RETURN .T.
    ENDIF
 ENDIF
ENDFUNC
**
FUNCTION c_Damenumero
 PARAMETER xdescrip, xtabla, xserie, xyear, xvisible, xtablaregistros
 LOCAL xnumero, tablaant, lnnumreg, lnrecno, lcorder
 xnumero = 1
 IF PCOUNT()=2
    xserie = ""
    xyear = 0
    xvisible = .T.
 ENDIF
 IF PCOUNT()=4
    xvisible = .T.
 ENDIF
 IF PCOUNT()=3
    xyear = 0
    xvisible = .T.
 ENDIF
 IF PCOUNT()<6
    xtablaregistros = ""
 ENDIF
 IF EMPTY(xtablaregistros)
    xtablaregistros = "C_REGISTROS"
 ENDIF
 xserie = LEFT(xserie, 2)
 tablaant = SELECT()
 lnnumreg = 0
 IF ALLTRIM(UPPER(xtabla))=="FACCAB"
    SELECT faccab
    IF  .NOT. EOF()
       lnrecno = RECNO()
    ELSE
       lnrecno = 0
    ENDIF
    lcorder = ORDER()
    SET ORDER TO numfac DESCENDING
    IF SEEK(STR(xyear, 4)+xserie)
       lnnumreg = faccab.numfac+1
    ELSE
       lnnumreg = 1
    ENDIF
 ENDIF
 SELE &xtablaregistros 
 GOTO TOP
 LOCATE FOR tabla=xtabla .AND. serie=xserie .AND. year=xyear
 IF FOUND()
    IF RLOCK(xtablaregistros)
       REPLACE numreg WITH IIF(lnnumreg=0, numreg+1, lnnumreg)
       UNLOCK IN &xtablaregistros
    ELSE
       xnumero = 0
       SELECT (tablaant)
       RETURN xnumero
    ENDIF
    xnumero = numreg
 ELSE
    SELE &xtablaregistros
    IF RLOCK("0", xtablaregistros)
       APPEND BLANK
       REPLACE descrip WITH xdescrip
       REPLACE tabla WITH xtabla
       REPLACE serie WITH xserie
       REPLACE year WITH xyear
       REPLACE numreg WITH IIF(lnnumreg=0, 1, lnnumreg)
       REPLACE visible WITH xvisible
       UNLOCK RECORD 0 IN &xtablaregistros
    ELSE
       xnumero = 0
       SELECT (tablaant)
       RETURN xnumero
    ENDIF
 ENDIF
 IF ALLTRIM(UPPER(xtabla))=="FACCAB"
    SELECT faccab
    IF lnrecno<>0
       GOTO lnrecno
    ENDIF
    SET ORDER TO &lcorder
 ENDIF
 SELECT (tablaant)
 RETURN xnumero
ENDFUNC
**
FUNCTION PIDEFECHA
 PARAMETER xdoc, xeje, xser
 IF PCOUNT()=1
    xeje = .F.
    xser = .F.
 ENDIF
 IF PCOUNT()<3
    xser = .F.
 ENDIF
 LOCAL fecret
 DO FORM pidefecha TO fecret WITH xdoc, xeje, xser
 RETURN (fecret)
ENDFUNC
**
FUNCTION DAMEVALOR
 PARAMETER xtabla, xcamporetorno, xbusca, xindice
 LOCAL dejamosabierta, valorretorno, oldtabla, xxtabla
 IF ATC("\", xtabla)<>0
    xxtabla = SUBSTR(xtabla, ATC("\", xtabla)+1, LEN(xtabla)-ATC("\", xtabla)+1)
 ELSE
    IF ATC("/", xtabla)<>0
       xxtabla = SUBSTR(xtabla, ATC("/", xtabla)+1, LEN(xtabla)-ATC("/", xtabla)+1)
    ELSE
       xxtabla = xtabla
    ENDIF
 ENDIF
 oldtabla = SELECT()
 dejamosabierta = .F.
 IF USED(xxtabla)
    dejamosabierta = .T.
 ELSE
    USE (xtabla) AGAIN IN 0
 ENDIF
 SELECT (xxtabla)
 SET ORDER TO &xindice
 IF SEEK(xbusca)
    valorretorno=&xcamporetorno	
 ELSE
    valorretorno = ""
 ENDIF
 IF  .NOT. dejamosabierta
    USE IN &xxtabla
 ENDIF
 SELECT (oldtabla)
 RETURN (valorretorno)
ENDFUNC
**
FUNCTION Traducir
 PARAMETER tcidioma, tctexto
 IF PCOUNT()<2
    RETURN ""
 ENDIF
 LOCAL lcalias, lcexact
 lcalias = ALIAS()
 lcexact = SET("Exact")
 SET EXACT ON
 tctexto = STRTRAN(tctexto, "\<", "")
 IF FILE("idiomas/traductor.dbf")
    IF  .NOT. USED("traductor")
       USE SHARED idiomas/traductor AGAIN IN 0
    ENDIF
    SELECT traductor
    SET ORDER TO IDITRA
    IF SEEK(tcidioma+tctexto)
       tctexto = IIF(EMPTY(ALLTRIM(traductor.traduccion)), tctexto, ALLTRIM(traductor.traduccion))
    ELSE
       INSERT INTO traductor (ididi, caption, traduccion) VALUES (tcidioma, tctexto, "")
    ENDIF
 ENDIF
 SET EXACT &lcexact
 IF  .NOT. EMPTY(lcalias)
    SELECT (lcalias)
 ENDIF
 RETURN (tctexto)
ENDFUNC
**
FUNCTION _messagebox
 PARAMETER tctexto, tnparametros, tctitulo
 IF PCOUNT()<3
    tctitulo = ""
 ENDIF
 IF PCOUNT()<2
    tctitulo = ""
    tnparametros = 64
 ENDIF
 lnretorno = MESSAGEBOX(tctexto, tnparametros, tctitulo)
 RETURN lnretorno
ENDFUNC
**
FUNCTION ValidarCuenta
 PARAMETER tccuenta
 LOCAL lcretorno
 lcretorno = tccuenta
 lccuenta = ALLTRIM(tccuenta)
 lnpospunto = AT(".", lccuenta)
 IF lnpospunto<>0
    lccuenta1 = SUBSTR(lccuenta, 1, lnpospunto-1)
    lccuenta2 = SUBSTR(lccuenta, lnpospunto+1)
    lnlong1 = LEN(lccuenta1)
    lnlong2 = LEN(lccuenta2)
    lcretorno = lccuenta1+REPLICATE("0", IIF((cfgauxiliar2-lnlong1-lnlong2)>0, cfgauxiliar2-lnlong1-lnlong2, 0))+lccuenta2
 ENDIF
 IF LEN(ALLTRIM(lcretorno))<>cfgauxiliar2
    WAIT WINDOW NOWAIT "Longitud de cuenta incorrecta"
    RETURN (SUBSTR(lcretorno, 1, cfgauxiliar2))
 ENDIF
 RETURN (lcretorno)
ENDFUNC
**
FUNCTION DameCuenta
 PARAMETER tccfgcuenta, tcfincuenta
 LOCAL lcretorno
 lcretorno = ""
 lccuenta1 = ALLTRIM(tccfgcuenta)
 lccuenta2 = ALLTRIM(tcfincuenta)
 IF LEN(lccuenta2)=cfgauxiliar2
    RETURN (lccuenta2)
 ENDIF
 lnlong1 = LEN(lccuenta1)
 lnlong2 = LEN(lccuenta2)
 lcretorno = lccuenta1+REPLICATE("0", IIF((cfgauxiliar2-lnlong1-lnlong2)>0, cfgauxiliar2-lnlong1-lnlong2, 0))+lccuenta2
 RETURN (lcretorno)
ENDFUNC
**
PROCEDURE C_Actualizar
 PARAMETER tcdirdbf, tcdirtmp, tcprgcreadbc, tcdirfrx, tcdirtmpfrx, tcnombreexe
 LOCAL llactualizar, lnnuevaversion, ladatosversion, lnhandler
 DIMENSION ladatosversion(1)
 LOCAL lahaydatos, lncont, lnnumfic
 DIMENSION lahaydatos(1)
 llactualizar = .F.
 AGETFILEVERSION(arrayname, tcnombreexe)
 lnnuevaversion = arrayname(4)
 lnhandler = 0
 IF FILE("versionc.bmp")
    lnhandler = FOPEN("versionc.bmp", 2)
    lnantiguaversion = FGETS(lnhandler)
    IF lnnuevaversion>lnantiguaversion
       llactualizar = .T.
    ENDIF
 ELSE
    llactualizar = .T.
 ENDIF
 IF llactualizar
    lcdirdefault = ADDBS(SYS(5)+SYS(2003))
    c_creatablasexternas(ADDBS(ALLTRIM(tcdirdbf))+"..\", tcdirtmp)
    c_creafrx(tcdirfrx, tcdirtmpfrx)
    llhaycarpeta = .F.
    lnnumfic = ADIR(lahaydatos, tcdirdbf+"*.*", "D")
    FOR lncont = 1 TO lnnumfic
       IF UPPER(SUBSTR(ALLTRIM(lahaydatos(lncont, 1)), 1, 6))="CONTA2"
          lcdircontadbf = tcdirdbf+ALLTRIM(lahaydatos(lncont, 1))+"/"
          c_creadbc(lcdircontadbf, tcdirtmp, tcprgcreadbc)
          llhaycarpeta = .T.
       ENDIF
    ENDFOR
    IF  .NOT. llhaycarpeta
       lcdircontadbf = tcdirdbf+"CONTA"+ALLTRIM(STR(cfgyear))+"/"
       c_creadbc(lcdircontadbf, tcdirtmp, tcprgcreadbc)
    ENDIF
    IF lnhandler<>0
       FSEEK(lnhandler, 0, 0)
       FPUTS(lnhandler, lnnuevaversion)
       FCLOSE(lnhandler)
    ELSE
       SET DEFAULT TO &lcdirdefault 
       STRTOFILE(lnnuevaversion, "versionc.bmp")
    ENDIF
 ENDIF
ENDPROC
**
PROCEDURE C_CreaTablasExternas
 PARAMETER tcdirtablas, tcdirtemp
 LOCAL llexisteempresa, llexistefondos, lcoldsafety, lcdirtemp
 llexisteempresa = .F.
 llexistefondos = .F.
 lcoldsafety = SET("safety")
 SET SAFETY OFF
 IF  .NOT. DIRECTORY(tcdirtemp)
    MD (tcdirtemp)
 ENDIF
 lcdirtemp = ADDBS(ALLTRIM(tcdirtemp))+"*.*"
 IF FILE(tcdirtablas+"C_CONTA.DBF")
    llexisteempresa = .T.
    COPY FILE ( tcdirtablas + "C_CONTA.*" ) TO &lcdirtemp
 ENDIF
 c_maketable_conta(tcdirtablas)
 IF llexisteempresa
    IF  .NOT. USED("C_CONTA")
       USE C_CONTA IN 0
    ENDIF
    SELECT c_conta
    APPEND FROM ADDBS(ALLTRIM(tcdirtemp))+"C_CONTA.DBF"
    USE IN c_conta
 ENDIF
 CLOSE DATABASES ALL
 DELETE FILE &lcdirtemp
 SET SAFETY &lcoldsafety
ENDPROC
**
PROCEDURE C_CreaDBC
 PARAMETER tcdirdatos, tcdirtemp, tcprgdbc
 LOCAL ladatos, lnnumtablas, lncont, lctabla, lcdirdatos, lcdirtemp, lcolddefault, lcoldsafety, lahaydatos
 DIMENSION ladatos(1)
 DIMENSION lahaydatos(1)
 lcdirdatos = ADDBS(ALLTRIM(tcdirdatos))+"c_*.*"
 lcdirtemp = ADDBS(ALLTRIM(tcdirtemp))+"c_*.*"
 lcoldsafety = SET("safety")
 SET SAFETY OFF
 IF  .NOT. DIRECTORY(tcdirdatos)
    MD (tcdirdatos)
 ENDIF
 IF  .NOT. DIRECTORY(tcdirtemp)
    MD (tcdirtemp)
 ENDIF
 IF ADIR(lahaydatos, lcdirdatos)<>0
    COPY FILE &lcdirdatos TO &lcdirtemp
 ENDIF
 lcolddefault = SET("Default")
 SET DEFAULT TO &tcdirdatos
 DO &tcprgdbc
 SET DEFAULT TO &lcolddefault
 lnnumtablas = AUSED(ladatos)
 FOR lncont = 1 TO lnnumtablas
    SELECT (ladatos(lncont, 1))
    IF FILE(ADDBS(ALLTRIM(tcdirtemp))+ladatos(lncont, 1)+".DBF")
       APPEND FROM ADDBS(ALLTRIM(tcdirtemp))+ladatos(lncont, 1)
    ENDIF
 ENDFOR
 CLOSE DATABASES ALL
 DELETE FILE &lcdirtemp
 SET SAFETY &lcoldsafety
ENDPROC
**
PROCEDURE C_CreaFRX
 PARAMETER tcdirfrx, tcdirtempfrx
 LOCAL lnnumfrxtpv, lafrxtpv, lncont, lcficheroorigen, lcficherodestino, lcoldsafety
 DIMENSION lafrxtpv(1)
 lcoldsafety = SET("safety")
 SET SAFETY OFF
 IF  .NOT. DIRECTORY(tcdirfrx)
    MD (tcdirfrx)
 ENDIF
 lnnumfrxtpv = ADIR(lafrxtpv, ADDBS(ALLTRIM(tcdirtempfrx))+"c_*.*")
 FOR lncont = 1 TO lnnumfrxtpv
    lcficheroorigen = ADDBS(ALLTRIM(tcdirtempfrx))+lafrxtpv(lncont, 1)
    lcficherodestino = ADDBS(ALLTRIM(tcdirfrx))+lafrxtpv(lncont, 1)
    COPY FILE &lcficheroorigen  TO &lcficherodestino 
 ENDFOR
 SET SAFETY &lcoldsafety
ENDPROC
**
PROCEDURE c_MakeTable_Conta
 PARAMETER tcdir
 CREATE TABLE tcdir+'C_CONTA.DBF' (idemp C (8) NOT NULL, nomemp C (80) NOT NULL, ejeemp N (4) NOT NULL, config M NOT NULL)
 SET COLLATE TO 'MACHINE'
 INDEX ON idemp+STR(ejeemp) TAG idemp
ENDPROC
**
FUNCTION ValidarAsientosDiario
 PARAMETER lnejercicio, lcserie
 IF  .NOT. c_abrir_tabla("c_diario", "tmpAsiento", 1, "numasi", "")
    RETURN .F.
 ENDIF
 SELECT tmpasiento
 SELECT DISTINCT ejeasi, serasi, numasi FROM tmpAsiento WHERE ejeasi=lnejercicio AND lcserie=serasi INTO CURSOR tmpAsientos1
 SELECT tmpasientos1
 llreturn = .T.
 lctexto = ""
 SCAN
    lnnumasiento = 0
    SELECT tmpasiento
    IF SEEK(STR(tmpasientos1.ejeasi, 4)+tmpasientos1.serasi+STR(tmpasientos1.numasi, 10))
       llprimero = .T.
       ldfecha = CTOD("")
       lndiferencia = 0
       lctitulo = "- Asiento: "+STR(tmpasientos1.ejeasi, 4)+"/"+ALLTRIM(tmpasientos1.serasi)+"/"+ALLTRIM(STR(tmpasientos1.numasi, 10))
       SCAN REST WHILE STR(tmpasientos1.ejeasi, 4)+tmpasientos1.serasi+STR(tmpasientos1.numasi, 10)=STR(tmpasiento.ejeasi, 4)+tmpasiento.serasi+STR(tmpasiento.numasi, 10)
          IF EMPTY(tmpasiento.codcue)
             lctexto = lctexto+traducir(pcidioma, "El apunte no tiene cuenta contable")+lctitulo+CHR(13)
             llreturn = .F.
          ENDIF
          IF EMPTY(tmpasiento.diario)
             lctexto = lctexto+traducir(pcidioma, "El apunte no tiene diario")+lctitulo+CHR(13)
             llreturn = .F.
          ENDIF
          IF EMPTY(tmpasiento.fecasi)
             lctexto = lctexto+traducir(pcidioma, "El apunte no tiene fecha")+lctitulo+CHR(13)
             llreturn = .F.
          ENDIF
          IF llprimero
             llprimero = .F.
             ldfecha = tmpasiento.fecasi
          ENDIF
          IF ldfecha<>tmpasiento.fecasi
             lctexto = lctexto+traducir(pcidioma, "Un apunte tiene una fecha incorrecta")+lctitulo+CHR(13)
             llreturn = .F.
          ENDIF
          lndiferencia = lndiferencia+tmpasiento.impdeb-tmpasiento.imphab
       ENDSCAN
       IF ROUND(lndiferencia, 3)<>0.000 
          lctexto = lctexto+traducir(pcidioma, "El asiento está descuadrado")+lctitulo+CHR(13)
          llreturn = .F.
       ENDIF
    ENDIF
 ENDSCAN
 USE IN tmpasientos1
 USE IN tmpasiento
 IF  .NOT. llreturn
    MESSAGEBOX(traducir(pcidioma, "Tiene Asientos Erroneos"), 48, "Atención")
    STRTOFILE(lctexto, "Asientos Erroneos.txt", 0)
    MODIFY FILE "Asientos Erroneos.txt"
 ENDIF
 RETURN (llreturn)
ENDFUNC
**
FUNCTION GenerarBalance
 PARAMETER tcbalance, tnejercicio, tcserie, tdfecini, tdfecfin
 lcbalance = tcbalance
 lnejercicio = tnejercicio
 lcserie = tcserie
 ldfecini = tdfecini
 ldfecfin = tdfecfin
 IF  .NOT. c_abrir_maestros("c_balances1", "c_balances1", 1, "idbal", "")
    RETURN .F.
 ENDIF
 IF  .NOT. c_abrir_maestros("c_balances2", "c_balances2", 1, "idbal", "")
    RETURN .F.
 ENDIF
 IF USED("consulta")
    USE IN consulta
 ENDIF
 SELECT *, 0000000000000.00  AS importe, 0000000000000.00  AS importe1 FROM c_balances1 WHERE idbal=lcbalance ORDER BY idbal, idgru INTO CURSOR TmpConsulta
 USE SHARED DBF("tmpConsulta") AGAIN ALIAS consulta IN 0
 USE IN tmpconsulta
 SELECT consulta
 INDEX ON idgru TAG idgru
 SET ORDER TO idgru
 FOR lncontcomparativa = 1 TO 2
    IF lncontcomparativa=2
       lctabladiario = "c_diario1"
       lccampoimporte = "importe1"
       lnejercicio = tnejercicio-1
       ldfecini = GOMONTH(tdfecini, -12)
       ldfecfin = GOMONTH(tdfecfin, -12)
       IF  .NOT. USED("c_diario1")
          LOOP
       ENDIF
    ELSE
       lctabladiario = "c_diario"
       lccampoimporte = "importe"
    ENDIF
    lnsaldo551 = 0
    SELECT &lctabladiario
    SET ORDER TO numasi
    IF SEEK(STR(lnejercicio, 4)+lcserie)
       SCAN REST WHILE &lctabladiario..ejeasi = lnejercicio AND &lctabladiario..serasi = lcserie 
          IF !BETWEEN( &lctabladiario..fecasi, ldfecini, ldfecfin )
             LOOP
          ENDIF
          IF INLIST( &lctabladiario..numasi, 99999998, 99999999 )
             LOOP
          ENDIF
          SELECT c_balances2
          lnsaldo551ok = .F.
          FOR lncont = 4 TO 1 STEP -1
             IF SEEK( lcbalance + SUBSTR( ALLTRIM( &lctabladiario..codcue ), 1, lncont ) )
                SCAN REST WHILE  SUBSTR( ALLTRIM( &lctabladiario..codcue ), 1, lncont ) = ALLTRIM( c_balances2.codcue ) AND lcbalance = c_balances2.idbal
                   SELECT consulta
                   IF SEEK(c_balances2.idgru)
                      lcoperacion = c_balances2.operacion
                      IF lcoperacion=":"
                         IF  .NOT. lnsaldo551ok
                            lnsaldo551 = lnsaldo551 + ( &lctabladiario..impdeb - &lctabladiario..imphab )
                            lnsaldo551ok = .T.
                         ENDIF
                      ELSE
                         IF INLIST(c_balances2.tipo, "A", "D")
                            DO CASE
                               CASE lcoperacion="*"
                                  REPLACE &lccampoimporte WITH &lccampoimporte + &lctabladiario..impdeb
                               CASE lcoperacion="/"
                                  REPLACE &lccampoimporte WITH &lccampoimporte + &lctabladiario..imphab
                               OTHERWISE
                                  REPLACE &lccampoimporte WITH &lccampoimporte &lcoperacion ( &lctabladiario..impdeb - &lctabladiario..imphab )
                            ENDCASE
                         ELSE
                            DO CASE
                               CASE lcoperacion="*"
                                  REPLACE &lccampoimporte WITH &lccampoimporte + &lctabladiario..impdeb
                               CASE lcoperacion="/"
                                  REPLACE &lccampoimporte WITH &lccampoimporte + &lctabladiario..imphab
                               OTHERWISE
                                  REPLACE &lccampoimporte WITH &lccampoimporte &lcoperacion ( &lctabladiario..imphab - &lctabladiario..impdeb )
                            ENDCASE
                         ENDIF
                      ENDIF
                   ENDIF
                ENDSCAN
             ENDIF
          ENDFOR
       ENDSCAN
    ENDIF
    IF lnsaldo551<>0 .AND. tcbalance="S"
       IF lnsaldo551>0
          SELECT consulta
          IF SEEK("12400")
             REPLACE &lccampoimporte WITH &lccampoimporte + lnsaldo551 
          ENDIF
          SELECT consulta
          IF SEEK("12000")
             REPLACE &lccampoimporte WITH &lccampoimporte + lnsaldo551 
          ENDIF
          SELECT consulta
          IF SEEK("13000")
             REPLACE &lccampoimporte WITH &lccampoimporte + lnsaldo551 
          ENDIF
       ELSE
          SELECT consulta
          IF SEEK("23230")
             REPLACE &lccampoimporte WITH &lccampoimporte + ( lnsaldo551 * -1 )
          ENDIF
          SELECT consulta
          IF SEEK("23200")
             REPLACE &lccampoimporte WITH &lccampoimporte + ( lnsaldo551 * -1 )
          ENDIF
          SELECT consulta
          IF SEEK("23000")
             REPLACE &lccampoimporte WITH &lccampoimporte + ( lnsaldo551 * -1 )
          ENDIF
          SELECT consulta
          IF SEEK("24000")
             REPLACE &lccampoimporte WITH &lccampoimporte + ( lnsaldo551 * -1 )
          ENDIF
       ENDIF
    ENDIF
 ENDFOR
 IF tnejercicio<2008 .AND. tcbalance="P"
    lnimportecalculado = 0
    SELECT consulta
    IF SEEK("21110")
       SCAN REST WHILE consulta.idgru<"21200"
          lnimportecalculado = lnimportecalculado+consulta.importe
       ENDSCAN
    ENDIF
    IF SEEK("11001")
       SCAN REST WHILE consulta.idgru<"11600"
          lnimportecalculado = lnimportecalculado-consulta.importe
       ENDSCAN
    ENDIF
    IF lnimportecalculado<0
       SELECT consulta
       IF SEEK("21200")
          REPLACE importe WITH lnimportecalculado*-1
       ENDIF
    ELSE
       SELECT consulta
       IF SEEK("11600")
          REPLACE importe WITH lnimportecalculado
       ENDIF
    ENDIF
    lnimportecalculado = 0
    SELECT consulta
    IF SEEK("21310")
       SCAN REST WHILE consulta.idgru<"21500"
          lnimportecalculado = lnimportecalculado+consulta.importe
       ENDSCAN
    ENDIF
    IF SEEK("11700")
       SCAN REST WHILE consulta.idgru<"11A00"
          lnimportecalculado = lnimportecalculado-consulta.importe
       ENDSCAN
    ENDIF
    IF lnimportecalculado<0
       SELECT consulta
       IF SEEK("21500")
          REPLACE importe WITH lnimportecalculado*-1
       ENDIF
    ELSE
       SELECT consulta
       IF SEEK("11A00")
          REPLACE importe WITH lnimportecalculado
       ENDIF
    ENDIF
    lnimportecalculado = 0
    SELECT consulta
    IF SEEK("11600")
       lnimportecalculado = lnimportecalculado+consulta.importe
    ENDIF
    IF SEEK("11A00")
       lnimportecalculado = lnimportecalculado+consulta.importe
    ENDIF
    IF SEEK("21200")
       lnimportecalculado = lnimportecalculado-consulta.importe
    ENDIF
    IF SEEK("21500")
       lnimportecalculado = lnimportecalculado-consulta.importe
    ENDIF
    IF lnimportecalculado<0
       SELECT consulta
       IF SEEK("21600")
          REPLACE importe WITH lnimportecalculado*-1
       ENDIF
    ELSE
       SELECT consulta
       IF SEEK("11B00")
          REPLACE importe WITH lnimportecalculado
       ENDIF
    ENDIF
    lnimportecalculado = 0
    SELECT consulta
    IF SEEK("21700")
       SCAN REST WHILE consulta.idgru<"21C00"
          lnimportecalculado = lnimportecalculado+consulta.importe
       ENDSCAN
    ENDIF
    IF SEEK("11C00")
       SCAN REST WHILE consulta.idgru<"11H00"
          lnimportecalculado = lnimportecalculado-consulta.importe
       ENDSCAN
    ENDIF
    IF lnimportecalculado<0
       SELECT consulta
       IF SEEK("21C00")
          REPLACE importe WITH lnimportecalculado*-1
       ENDIF
    ELSE
       SELECT consulta
       IF SEEK("11H00")
          REPLACE importe WITH lnimportecalculado
       ENDIF
    ENDIF
    lnimportecalculado = 0
    SELECT consulta
    IF SEEK("11B00")
       lnimportecalculado = lnimportecalculado+consulta.importe
    ENDIF
    IF SEEK("11H00")
       lnimportecalculado = lnimportecalculado+consulta.importe
    ENDIF
    IF SEEK("21600")
       lnimportecalculado = lnimportecalculado-consulta.importe
    ENDIF
    IF SEEK("21C00")
       lnimportecalculado = lnimportecalculado-consulta.importe
    ENDIF
    IF lnimportecalculado<0
       SELECT consulta
       IF SEEK("21D00")
          REPLACE importe WITH lnimportecalculado*-1
       ENDIF
    ELSE
       SELECT consulta
       IF SEEK("11I00")
          REPLACE importe WITH lnimportecalculado
       ENDIF
    ENDIF
    lnimportecalculado = 0
    SELECT consulta
    IF SEEK("11I00")
       IF consulta.importe=0
          IF SEEK("21D00")
             lnimportecalculado = lnimportecalculado+consulta.importe
          ENDIF
          IF SEEK("11J00")
             lnimportecalculado = lnimportecalculado+consulta.importe
          ENDIF
          IF SEEK("11K00")
             lnimportecalculado = lnimportecalculado+consulta.importe
          ENDIF
          IF SEEK("21E00")
             REPLACE importe WITH lnimportecalculado
          ENDIF
       ELSE
          lnimportecalculado = lnimportecalculado+consulta.importe
          IF SEEK("11J00")
             lnimportecalculado = lnimportecalculado-consulta.importe
          ENDIF
          IF SEEK("11K00")
             lnimportecalculado = lnimportecalculado-consulta.importe
          ENDIF
          IF SEEK("11L00")
             REPLACE importe WITH lnimportecalculado
          ENDIF
       ENDIF
    ENDIF
 ENDIF
 SELECT consulta
 GOTO TOP
ENDFUNC
**
PROCEDURE IMPRBALU
 PARAMETER cuantos, m.mes
 PRIVATE unabase, unindex, pgprovact, miterm
 m.ejer1 = m.p_ejer
 m.ejer2 = 0
 WAIT WINDOW NOWAIT "SE ESTA CONFECCIONANDO EL BALANCE "
 CREATE CURSOR auxlst6 (esbal L, esactivo L, negrita L, codigo C (4), descrip C (35), num1 N (12, 2), porcen1 N (6, 2), nivel N (1), truco N (1))
 CREATE CURSOR totbal (operacion C (1), descrip C (35), clave N (6), identif C (4), importe1 N (12, 2), entrada1 C (1), truco N (1), nivel N (1))
 INDEX ON clave TAG clave ADDITIVE
 DO cargatot WITH "NOR"
 llenatot("BAL", m.mes)
 m.pgprovact = 0
 calprgan(mes, @pgprovact)
 SELECT ("TOTBAL")
 SEEK "216000" 
 IF FOUND()
    REPLACE totbal.importe1 WITH totbal.importe1+m.pgprovact
 ELSE
    ?? CHR(7)
    WAIT WINDOW TIMEOUT 1 "NO SE HA PODIDO ACTUALIZAR LA CUENTA DE P.G."
 ENDIF
 sumarbal()
 SELECT ("TOTBAL")
 SEEK 199000 
 m.totact1 = importe1
 SEEK 299000 
 m.totpas1 = importe1
 GOTO TOP
 DO WHILE  .NOT. EOF()
    IF totbal.importe1==0 .AND. m.cuantos=="UNO"
       SKIP
       LOOP
    ENDIF
    IF totbal.clave==199000 .OR. totbal.clave==299000
       SKIP
       LOOP
    ENDIF
    SELECT ("AUXLST6")
    APPEND BLANK
    REPLACE auxlst6.esbal WITH .T.
    IF totbal.clave<200000
       REPLACE auxlst6.esactivo WITH .T., auxlst6.truco WITH 1
    ELSE
       REPLACE auxlst6.esactivo WITH .F., auxlst6.truco WITH 2
    ENDIF
    IF totbal.nivel==1
       REPLACE auxlst6.negrita WITH .T.
    ENDIF
    REPLACE auxlst6.codigo WITH totbal.identif, auxlst6.descrip WITH totbal.descrip
    IF totbal.operacion=="R" .AND. totbal.importe1>0
       REPLACE auxlst6.num1 WITH totbal.importe1*-1
    ELSE
       REPLACE auxlst6.num1 WITH totbal.importe1
    ENDIF
    IF totbal.nivel==1 .OR. totbal.nivel==2
       IF totbal.clave<200000
          REPLACE auxlst6.porcen1 WITH totbal.importe1*100/m.totact1
       ELSE
          REPLACE auxlst6.porcen1 WITH totbal.importe1*100/m.totpas1
       ENDIF
    ENDIF
    SELECT ("TOTBAL")
    SKIP
 ENDDO
 SELECT ("TOTBAL")
 RETURN
ENDPROC
**
PROCEDURE CargaTot
 PARAMETER tipobalance
 DO CASE
    CASE tipobalance="NOR"
       SELECT 0
       USE BALNORM
       SET ORDER TO CLAVE
       GOTO TOP
       DO WHILE  .NOT. EOF()
          SELECT ("TOTBAL")
          APPEND BLANK
          REPLACE totbal.operacion WITH balnorm.operacion, totbal.descrip WITH balnorm.descrip, totbal.clave WITH balnorm.clave, totbal.identif WITH balnorm.identif, totbal.importe1 WITH 0
          SELECT ("BALNORM")
          SKIP
       ENDDO
       SELECT ("BALNORM")
       USE
    CASE tipobalance="PGN"
       SELECT 0
       USE PRGANORM
       SET ORDER TO CLAVE
       GOTO TOP
       DO WHILE  .NOT. EOF()
          SELECT ("TOTPER")
          APPEND BLANK
          REPLACE totper.operacion WITH prganorm.operacion, totper.descrip WITH prganorm.descrip, totper.clave WITH prganorm.clave, totper.identif WITH prganorm.identif, totper.importe1 WITH 0
          SELECT ("PRGANORM")
          SKIP
       ENDDO
       SELECT ("PRGANORM")
       USE
 ENDCASE
 RETURN
ENDPROC
**
FUNCTION LlenaTot
 PARAMETER tipo, mes
 PRIVATE saldo1, saldo2, miterm
 SELECT ("CUENTAS")
 GOTO TOP
 DO WHILE  .NOT. EOF()
    IF tipo=="BAL" .AND. cuentas.clavenorm>299999
       SKIP
       LOOP
    ENDIF
    IF tipo=="PGN" .AND. cuentas.clavenorm<300000
       SKIP
       LOOP
    ENDIF
    IF  .NOT. EMPTY(cuentas.clavenorm)
       saldo1 = calsaldo(1, mes)
       DO CASE
          CASE EMPTY(cuentas.clavenormh)
             SELECT ("TOTBAL")
             SEEK cuentas.clavenorm 
             IF FOUND()
                IF cuentas.signo<>"*"
                   IF tipo=="BAL" .AND. cuentas.clavenorm<299999
                      IF cuentas.clavenorm>199999
                         IF saldo1>0
                            saldo1 = saldo1*-1
                         ELSE
                            saldo1 = ABS(saldo1)
                         ENDIF
                      ENDIF
                   ENDIF
                ENDIF
                DO CASE
                   CASE cuentas.operacn=="S"
                      REPLACE totbal.importe1 WITH totbal.importe1+saldo1
                   CASE cuentas.operacn=="R"
                      REPLACE totbal.importe1 WITH totbal.importe1-saldo1
                   OTHERWISE
                      REPLACE totbal.importe1 WITH totbal.importe1+saldo1
                ENDCASE
             ENDIF
          CASE  .NOT. EMPTY(cuentas.clavenormh) .AND. saldo1<0
             SELECT ("TOTBAL")
             SEEK cuentas.clavenormh 
             IF FOUND()
                IF cuentas.signo<>"*"
                   saldo1 = ABS(saldo1)
                ENDIF
                IF cuentas.operacn=="S"
                   REPLACE totbal.importe1 WITH totbal.importe1+saldo1
                ELSE
                   REPLACE totbal.importe1 WITH totbal.importe1-saldo1
                ENDIF
             ENDIF
          CASE  .NOT. EMPTY(cuentas.clavenormh) .AND. saldo1>0
             SELECT ("TOTBAL")
             SEEK cuentas.clavenorm 
             IF FOUND()
                IF cuentas.signo<>"*"
                   saldo1 = ABS(saldo1)
                ENDIF
                IF cuentas.operacn=="S"
                   REPLACE totbal.importe1 WITH totbal.importe1+saldo1
                ELSE
                   REPLACE totbal.importe1 WITH totbal.importe1-saldo1
                ENDIF
             ENDIF
       ENDCASE
    ENDIF
    SELECT ("CUENTAS")
    SKIP
 ENDDO
 RETURN .T.
ENDFUNC
**
FUNCTION CALPRGAN
 LPARAMETERS mes, elsaldo
 calprga2(2, "60", "79", 1, mes, .T., @elsaldo)
 RETURN .T.
ENDFUNC
**
FUNCTION CALPRGA2
 LPARAMETERS mnivel, mdecuenta, macuenta, mdemes, mames, mdirini, elsaldo
 PRIVATE tdebeact, thaberact, tsdebeact, tshaberact, sadebeact, sahaberact, ssdebeact, sshaberact
 STORE 0 TO tdebeact, thaberact, tsdebeact, tshaberact
 SELECT ("CUENTAS")
 GOTO TOP
 DO WHILE  .NOT. EOF()
    IF LEN(TRIM(cuentas.numcta))<>mnivel
       SKIP
       LOOP
    ENDIF
    STORE 0 TO sadebeact, sahaberact, ssdebeact, sshaberact
    IF VAL(cuentas.numcta)>=VAL(mdecuenta) .AND. VAL(cuentas.numcta)<=VAL(macuenta)
       IF mdirini==.T.
          sumarlos(@sadebeact, cuentas.d_ini_act)
          sumarlos(@sahaberact, cuentas.h_ini_act)
       ENDIF
       IF 1>=mdemes .AND. 1<=mames
          sumarlos(@sadebeact, cuentas.d_01_act)
          sumarlos(@sahaberact, cuentas.h_01_act)
       ENDIF
       IF 2>=mdemes .AND. 2<=mames
          sumarlos(@sadebeact, cuentas.d_02_act)
          sumarlos(@sahaberact, cuentas.h_02_act)
       ENDIF
       IF 3>=mdemes .AND. 3<=mames
          sumarlos(@sadebeact, cuentas.d_03_act)
          sumarlos(@sahaberact, cuentas.h_03_act)
       ENDIF
       IF 4>=mdemes .AND. 4<=mames
          sumarlos(@sadebeact, cuentas.d_04_act)
          sumarlos(@sahaberact, cuentas.h_04_act)
       ENDIF
       IF 5>=mdemes .AND. 5<=mames
          sumarlos(@sadebeact, cuentas.d_05_act)
          sumarlos(@sahaberact, cuentas.h_05_act)
       ENDIF
       IF 6>=mdemes .AND. 6<=mames
          sumarlos(@sadebeact, cuentas.d_06_act)
          sumarlos(@sahaberact, cuentas.h_06_act)
       ENDIF
       IF 7>=mdemes .AND. 7<=mames
          sumarlos(@sadebeact, cuentas.d_07_act)
          sumarlos(@sahaberact, cuentas.h_07_act)
       ENDIF
       IF 8>=mdemes .AND. 8<=mames
          sumarlos(@sadebeact, cuentas.d_08_act)
          sumarlos(@sahaberact, cuentas.h_08_act)
       ENDIF
       IF 9>=mdemes .AND. 9<=mames
          sumarlos(@sadebeact, cuentas.d_09_act)
          sumarlos(@sahaberact, cuentas.h_09_act)
       ENDIF
       IF 10>=mdemes .AND. 10<=mames
          sumarlos(@sadebeact, cuentas.d_10_act)
          sumarlos(@sahaberact, cuentas.h_10_act)
       ENDIF
       IF 11>=mdemes .AND. 11<=mames
          sumarlos(@sadebeact, cuentas.d_11_act)
          sumarlos(@sahaberact, cuentas.h_11_act)
       ENDIF
       IF 12>=mdemes .AND. 12<=mames
          sumarlos(@sadebeact, cuentas.d_12_act)
          sumarlos(@sahaberact, cuentas.h_12_act)
       ENDIF
    ENDIF
    IF  .NOT. EMPTY(m.sadebeact) .OR.  .NOT. EMPTY(m.sahaberact)
       IF  .NOT. EMPTY(m.sadebeact)
          sumarlos(@tdebeact, m.sadebeact)
       ENDIF
       IF  .NOT. EMPTY(m.sahaberact)
          sumarlos(@thaberact, m.sahaberact)
       ENDIF
       IF (m.sadebeact-m.sahaberact)>0
          sumarlos(@tsdebeact, (m.sadebeact-m.sahaberact))
       ELSE
          sumarlos(@tshaberact, ABS(m.sadebeact-m.sahaberact))
       ENDIF
    ENDIF
    SKIP
 ENDDO
 elsaldo = m.tshaberact-m.tsdebeact
 RETURN .T.
ENDFUNC
**
PROCEDURE SUMARLOS
 PARAMETER acumulado, suma
 m.acumulado = m.acumulado+m.suma
 RETURN
ENDPROC
**
PROCEDURE SUMARBAL
 PRIVATE tactiv1, tpasiv1
 PRIVATE ctaact, ctapas, it, ctasup, nivel, ctasupb, reg
 PRIVATE elimporte1, eltipoope
 STORE 0 TO tactiv1, tpasiv1, ctaact, ctapas, ctasup, nivel, ctasupb
 m.eltipoope = ""
 SELECT ("TOTBAL")
 GOTO BOTTOM
 DO WHILE .T.
    IF clave=199000 .OR. clave=299000
       SKIP -1
       IF BOF()
          EXIT
       ENDIF
       LOOP
    ENDIF
    m.nivel = miranivel(clave)
    REPLACE totbal.nivel WITH m.nivel
    IF importe1<>0
       DO CASE
          CASE m.nivel==1
          CASE m.nivel==2
             m.ctasupb = INT(clave/10000)*10000
             DO sdatosb WITH m.ctasupb
          CASE m.nivel==3
             m.ctasupb = INT(clave/1000)*1000
             DO sdatosb WITH m.ctasupb
          CASE m.nivel==4
             m.ctasupb = INT(clave/10)*10
             DO sdatosb WITH m.ctasupb
       ENDCASE
    ENDIF
    SKIP -1
    IF BOF()
       EXIT
    ENDIF
 ENDDO
 SEEK 199000 
 m.ctaact = RECNO()
 REPLACE importe1 WITH 0
 SEEK 299000 
 m.ctapas = RECNO()
 REPLACE importe1 WITH 0
 GOTO BOTTOM
 DO WHILE  .NOT. BOF()
    m.nivel = miranivel(clave)
    DO CASE
       CASE m.nivel==1 .AND. clave<200000
          m.elimporte1 = importe1
          m.eltipoope = operacion
          m.reg = RECNO()
          GOTO m.ctaact
          IF m.eltipoope="R"
             REPLACE importe1 WITH importe1-m.elimporte1
          ELSE
             REPLACE importe1 WITH importe1+m.elimporte1
          ENDIF
          GOTO m.reg
       CASE m.nivel==1 .AND. clave>200000
          m.elimporte1 = importe1
          m.eltipoope = operacion
          m.reg = RECNO()
          GOTO m.ctapas
          IF m.eltipoope="R"
             REPLACE importe1 WITH importe1-m.elimporte1
          ELSE
             REPLACE importe1 WITH importe1+m.elimporte1
          ENDIF
          GOTO m.reg
    ENDCASE
    SKIP -1
 ENDDO
 RETURN
ENDPROC
**
PROCEDURE SDATOSB
 PARAMETER ctasup
 PRIVATE reg, elimporte1, eltipoope
 m.reg = RECNO()
 m.elimporte1 = importe1
 m.eltipoope = operacion
 SEEK m.ctasup 
 IF m.elimporte1<>0
    IF totbal.entrada1="E"
       REPLACE totbal.importe1 WITH 0, totbal.entrada1 WITH "S"
    ENDIF
    IF m.eltipoope="R"
       REPLACE totbal.importe1 WITH totbal.importe1-m.elimporte1
    ELSE
       REPLACE totbal.importe1 WITH totbal.importe1+m.elimporte1
    ENDIF
 ENDIF
 GOTO m.reg
 RETURN
ENDPROC
**
FUNCTION MiraNivel
 PARAMETER mdato
 PRIVATE ok
 DO CASE
    CASE MOD(mdato, 10000)=0
       m.ok = 1
    CASE MOD(mdato, 1000)=0
       m.ok = 2
    CASE MOD(mdato, 10)<>0
       m.ok = 4
    OTHERWISE
       m.ok = 3
 ENDCASE
 RETURN m.ok
ENDFUNC
**
PROCEDURE SUMARBAL
 PRIVATE tactiv1, tpasiv1
 PRIVATE ctaact, ctapas, it, ctasup, nivel, ctasupb, reg
 PRIVATE elimporte1, eltipoope
 STORE 0 TO tactiv1, tpasiv1, ctaact, ctapas, ctasup, nivel, ctasupb
 m.eltipoope = ""
 SELECT ("TOTBAL")
 GOTO BOTTOM
 DO WHILE .T.
    IF clave=199000 .OR. clave=299000
       SKIP -1
       IF BOF()
          EXIT
       ENDIF
       LOOP
    ENDIF
    m.nivel = miranivel(clave)
    REPLACE totbal.nivel WITH m.nivel
    IF importe1<>0
       DO CASE
          CASE m.nivel==1
          CASE m.nivel==2
             m.ctasupb = INT(clave/10000)*10000
             DO sdatosb WITH m.ctasupb
          CASE m.nivel==3
             m.ctasupb = INT(clave/1000)*1000
             DO sdatosb WITH m.ctasupb
          CASE m.nivel==4
             m.ctasupb = INT(clave/10)*10
             DO sdatosb WITH m.ctasupb
       ENDCASE
    ENDIF
    SKIP -1
    IF BOF()
       EXIT
    ENDIF
 ENDDO
 SEEK 199000 
 m.ctaact = RECNO()
 REPLACE importe1 WITH 0
 SEEK 299000 
 m.ctapas = RECNO()
 REPLACE importe1 WITH 0
 GOTO BOTTOM
 DO WHILE  .NOT. BOF()
    m.nivel = miranivel(clave)
    DO CASE
       CASE m.nivel==1 .AND. clave<200000
          m.elimporte1 = importe1
          m.eltipoope = operacion
          m.reg = RECNO()
          GOTO m.ctaact
          IF m.eltipoope="R"
             REPLACE importe1 WITH importe1-m.elimporte1
          ELSE
             REPLACE importe1 WITH importe1+m.elimporte1
          ENDIF
          GOTO m.reg
       CASE m.nivel==1 .AND. clave>200000
          m.elimporte1 = importe1
          m.eltipoope = operacion
          m.reg = RECNO()
          GOTO m.ctapas
          IF m.eltipoope="R"
             REPLACE importe1 WITH importe1-m.elimporte1
          ELSE
             REPLACE importe1 WITH importe1+m.elimporte1
          ENDIF
          GOTO m.reg
    ENDCASE
    SKIP -1
 ENDDO
 RETURN
ENDPROC
**
FUNCTION c_abrir_tabla
 PARAMETER tctabla, tcalias, tcbuffermode, tcorder, tcfilter, tnejercicio, tlsilencio
 IF PCOUNT()<2
    tcalias = tctabla
    tcbuffermode = 1
    tcorder = ""
    tcfilter = ""
    tnejercicio = cfgyear
    tlsilencio = .F.
 ENDIF
 IF PCOUNT()<6
    tnejercicio = cfgyear
    tlsilencio = .F.
 ENDIF
 IF PCOUNT()<7
    tlsilencio = .F.
 ENDIF
 LOCAL lccarpeta
 IF TYPE("plDesarrollo")="L" .AND. pldesarrollo
    lcrutatabla = ADDBS(SYS(5)+"/Fuentes/Conta")+"dbf/Conta"+ALLTRIM(STR(tnejercicio))+"/"+tctabla+".dbf"
 ELSE
    lcrutatabla = ADDBS(SYS(5)+SYS(2003))+"dbf/Conta"+ALLTRIM(STR(tnejercicio))+"/"+tctabla+".dbf"
 ENDIF
 IF  .NOT. FILE(lcrutatabla)
    IF  .NOT. tlsilencio
       _messagebox(traducir(pcidioma, "El Ejercicio Contable no se ha creado")+CHR(13)+CHR(13)+traducir(pcidioma, " [Tabla no creada]")+" "+lcrutatabla, 48, "Atención")
    ENDIF
    RETURN .F.
 ENDIF
 IF  .NOT. USED(tcalias)
    USE SHARED (lcrutatabla) AGAIN ALIAS (tcalias) IN 0
 ENDIF
 SELECT (tcalias)
 IF tcbuffermode<>1
    IF  .NOT. CURSORSETPROP("Buffering", tcbuffermode, tcalias)
       _messagebox(traducir(pcidioma, "Error al modificar 'Buffering'")+CHR(13)+lcrutatabla, 48, "Atención")
       USE IN (lcrutatabla)
       RETURN .F.
    ENDIF
 ENDIF
 IF  .NOT. EMPTY(tcorder)
    SET ORDER TO &tcorder 
 ENDIF
 IF  .NOT. EMPTY(tcfilter)
    SET FILTER TO &tcfilter
 ENDIF
 RETURN .T.
ENDFUNC
**
FUNCTION c_cerrar_tabla
 PARAMETER tcalias
 IF USED(tcalias)
    USE IN (tcalias)
 ENDIF
 RETURN .T.
ENDFUNC
**
FUNCTION c_abrir_maestros
 PARAMETER tctabla, tcalias, tcbuffermode, tcorder, tcfilter, tnejercicio
 IF PCOUNT()<2
    tcalias = tctabla
    tcbuffermode = 1
    tcorder = ""
    tcfilter = ""
    tnejercicio = cfgyear
 ENDIF
 IF PCOUNT()<6
    tnejercicio = cfgyear
 ENDIF
 LOCAL lccarpeta
 IF tnejercicio<2008
    IF TYPE("plDesarrollo")="L" .AND. pldesarrollo
       lcrutatabla = ADDBS(SYS(5)+"/Fuentes/Conta")+"maestro/PGC_1990/"+tctabla+".dbf"
    ELSE
       lcrutatabla = ADDBS(SYS(5)+SYS(2003))+"maestro/PGC_1990/"+tctabla+".dbf"
    ENDIF
 ELSE
    IF TYPE("plDesarrollo")="L" .AND. pldesarrollo
       lcrutatabla = ADDBS(SYS(5)+"/Fuentes/Conta")+"maestro/PGC_2007/"+tctabla+".dbf"
    ELSE
       lcrutatabla = ADDBS(SYS(5)+SYS(2003))+"maestro/PGC_2007/"+tctabla+".dbf"
    ENDIF
 ENDIF
 IF  .NOT. FILE(lcrutatabla)
    _messagebox(traducir(pcidioma, "La tabla no existe")+CHR(13)+lcrutatabla, 48, "Atención")
    RETURN .F.
 ENDIF
 IF  .NOT. USED(tcalias)
    USE SHARED (lcrutatabla) AGAIN ALIAS (tcalias) IN 0
 ENDIF
 SELECT (tcalias)
 IF tcbuffermode<>1
    IF  .NOT. CURSORSETPROP("Buffering", tcbuffermode, tcalias)
       _messagebox(traducir(pcidioma, "Error al modificar 'Buffering'")+CHR(13)+lcrutatabla, 48, "Atención")
       USE IN (lcrutatabla)
       RETURN .F.
    ENDIF
 ENDIF
 IF  .NOT. EMPTY(tcorder)
    SET ORDER TO &tcorder 
 ENDIF
 IF  .NOT. EMPTY(tcfilter)
    SET FILTER TO &tcfilter 
 ENDIF
 RETURN .T.
ENDFUNC
**
FUNCTION c_Crear_Nuevas_Cuentas
 PARAMETER tnejercicio
 IF  .NOT. c_abrir_tabla("c_cuentas", "c_cuentas", 1, "CODCUE", "", tnejercicio)
    RETURN .F.
 ENDIF
 IF  .NOT. c_abrir_maestros("c_maestro", "c_maestro", 1, "CODCUE", "", tnejercicio)
    RETURN .F.
 ENDIF
 SELECT c_maestro
 SCAN
    SELECT c_cuentas
    IF SEEK(c_maestro.codcue)
       SELECT c_maestro
       SCATTER MEMO MEMVAR
       SELECT c_cuentas
       GATHER MEMO MEMVAR
    ELSE
       SELECT c_maestro
       SCATTER MEMO MEMVAR
       SELECT c_cuentas
       APPEND BLANK
       GATHER MEMO MEMVAR
    ENDIF
 ENDSCAN
 SELECT c_cuentas
 SCAN
    IF LEN(ALLTRIM(c_cuentas.codcue))<=4
       SELECT c_maestro
       IF  .NOT. SEEK(c_cuentas.codcue)
          SELECT c_cuentas
          DELETE IN c_cuentas
       ENDIF
    ENDIF
 ENDSCAN
 SELECT * FROM c_cuentas ORDER BY codcue INTO CURSOR tmpCuentas
 locuenta = CREATEOBJECT("oCuenta")
 SELECT tmpcuentas
 SCAN
    locuenta.ccuenta = tmpcuentas.codcue
    locuenta.comprobar()
    IF locuenta.nivelauxiliar<>0
       locuenta.crearcuenta()
    ENDIF
 ENDSCAN
 USE IN tmpcuentas
 c_cerrar_tabla("c_maestro")
 c_cerrar_tabla("c_cuentas")
ENDFUNC
**
FUNCTION BalanceSituacion_Detallado
 PARAMETER tnyear, tcseriex, tdfechaini, tdfechafin
 tcbalance = "P"
 tnejercicio = tnyear
 tcserie = tcseriex
 tdfecini = tdfechaini
 tdfecfin = tdfechafin
 IF  .NOT. c_abrir_maestros("c_balances1", "c_balances1", 1, "idbal", "")
    RETURN .F.
 ENDIF
 IF  .NOT. c_abrir_maestros("c_balances2", "c_balances2", 1, "idgru", "")
    RETURN .F.
 ENDIF
 IF  .NOT. c_abrir_tabla("c_cuentas", "c_cuentas", 1, "CODCUE", "", tnejercicio)
    RETURN .F.
 ENDIF
 IF  .NOT. c_abrir_tabla("c_diario", "c_diario", 1, "cuereg", "", tnejercicio)
    RETURN .F.
 ENDIF
 IF USED("consulta")
    USE IN consulta
 ENDIF
 generarbalance(tcbalance, tnejercicio, tcserie, tdfecini, tdfecfin)
 lnresultadopyg = 0
 IF lnejercicio<2008
    SELECT consulta
    IF SEEK("11L00")
       IF consulta.importe=0
          IF SEEK("21E00")
             lnresultadopyg = consulta.importe*-1
          ENDIF
       ELSE
          lnresultadopyg = consulta.importe
       ENDIF
    ENDIF
 ELSE
    SELECT consulta
    IF SEEK("70000")
       lnresultadopyg = consulta.importe
    ENDIF
 ENDIF
 lcbalance = "S"
 lnejercicio = tnejercicio
 lcserie = tcserie
 ldfecini = tdfecini
 ldfecfin = tdfecfin
 SELECT c_balances2
 SET ORDER TO idgru
 SELECT c_balances1
 SET ORDER TO idbal
 CREATE CURSOR Consulta (idgru C (5), titulo C (200), nivel C (1), codcuegru C (4), tipo C (1), operacion C (1), codcue C (10), descue C (100), impdeb N (12, 2), imphab N (12, 2), saldo N (12, 2))
 SELECT DISTINCT c_diario.codcue FROM c_diario LEFT JOIN c_cuentas ON (c_cuentas.codcue=c_diario.codcue) WHERE c_diario.serasi=tcserie AND c_diario.ejeasi=tnejercicio AND BETWEEN(c_diario.fecasi, tdfecini, tdfecfin) AND ISNULL(c_cuentas.codcue) ORDER BY c_diario.codcue INTO CURSOR tmpAsientosSinCuenta
 SELECT tmpasientossincuenta
 GOTO TOP
 IF  .NOT. EOF()
    MESSAGEBOX("Existen apuntes sin cuenta creada en Mantenimiento de Cuentas. Debe crearlas."+CHR(13)+"Compruebe las cuentas en el EXCEL 'Apuntes_sin_Cuentas.xls'.", 48, "Atención")
    COPY TO 'Apuntes_sin_Cuentas.xls' TYPE XLS
 ENDIF
 USE IN tmpasientossincuenta
 SELECT .F. AS balance, c_cuentas.codcue, c_cuentas.descue, SUM(c_diario.impdeb) AS totimpdeb, SUM(c_diario.imphab) AS totimphab FROM c_cuentas INNER JOIN c_diario ON (c_cuentas.codcue=c_diario.codcue) WHERE c_diario.serasi=tcserie AND c_diario.ejeasi=tnejercicio AND BETWEEN(c_diario.fecasi, tdfecini, tdfecfin) GROUP BY 1, c_cuentas.codcue, c_cuentas.descue ORDER BY 1, c_cuentas.codcue, c_cuentas.descue INTO CURSOR tmpSaldos READWRITE
 SELECT tmpsaldos
 INDEX ON codcue TAG codcue
 SET ORDER TO codcue
 APPEND BLANK
 REPLACE balance WITH .F.
 REPLACE codcue WITH "1290000000"
 REPLACE descue WITH "Perdidas y Ganancias"
 REPLACE totimphab WITH lnresultadopyg
 SELECT c_balances1
 IF SEEK("S")
    SCAN REST WHILE idbal="S"
       SELECT c_balances2
       IF SEEK("S"+c_balances1.idgru)
          SCAN REST WHILE c_balances2.idbal="S" .AND. c_balances2.idgru=c_balances1.idgru
             SELECT tmpsaldos
             IF SEEK(ALLTRIM(c_balances2.codcue))
                SCAN REST WHILE ALLTRIM(c_balances2.codcue)==SUBSTR(ALLTRIM(tmpsaldos.codcue), 1, LEN(ALLTRIM(c_balances2.codcue)))
                   SELECT consulta
                   APPEND BLANK
                   REPLACE idgru WITH c_balances1.idgru
                   REPLACE titulo WITH c_balances1.titulo
                   REPLACE nivel WITH c_balances1.nivel
                   REPLACE codcuegru WITH c_balances2.codcue
                   REPLACE tipo WITH c_balances2.tipo
                   REPLACE operacion WITH c_balances2.operacion
                   REPLACE codcue WITH tmpsaldos.codcue
                   REPLACE descue WITH tmpsaldos.descue
                   REPLACE impdeb WITH tmpsaldos.totimpdeb
                   REPLACE imphab WITH tmpsaldos.totimphab
                   lcoperacion = c_balances2.operacion
                   IF INLIST(c_balances2.tipo, "A", "D")
                      DO CASE
                         CASE lcoperacion="*"
                            REPLACE saldo WITH tmpsaldos.totimpdeb
                         CASE lcoperacion="/"
                            REPLACE saldo WITH tmpsaldos.totimphab
                         CASE lcoperacion=":"
                            IF tmpsaldos.totimpdeb>tmpsaldos.totimphab
                               REPLACE saldo WITH tmpsaldos.totimpdeb-tmpsaldos.totimphab
                            ENDIF
                         OTHERWISE
                            REPLACE saldo WITH &lcoperacion ( tmpsaldos.totimpdeb - tmpsaldos.totimphab )
                      ENDCASE
                   ELSE
                      DO CASE
                         CASE lcoperacion="*"
                            REPLACE saldo WITH tmpsaldos.totimpdeb
                         CASE lcoperacion="/"
                            REPLACE saldo WITH tmpsaldos.totimphab
                         CASE lcoperacion=":"
                            IF tmpsaldos.totimphab>tmpsaldos.totimpdeb
                               REPLACE saldo WITH tmpsaldos.totimphab-tmpsaldos.totimpdeb
                            ENDIF
                         OTHERWISE
                            REPLACE saldo WITH &lcoperacion ( tmpsaldos.totimphab - tmpsaldos.totimpdeb )
                      ENDCASE
                   ENDIF
                   SELECT tmpsaldos
                   REPLACE balance WITH .T.
                ENDSCAN
             ELSE
                SELECT consulta
                APPEND BLANK
                REPLACE idgru WITH c_balances1.idgru
                REPLACE titulo WITH c_balances1.titulo
                REPLACE nivel WITH c_balances1.nivel
                REPLACE codcuegru WITH c_balances2.codcue
                REPLACE tipo WITH c_balances2.tipo
                REPLACE operacion WITH c_balances2.operacion
             ENDIF
          ENDSCAN
       ELSE
          SELECT consulta
          APPEND BLANK
          REPLACE idgru WITH c_balances1.idgru
          REPLACE titulo WITH c_balances1.titulo
          REPLACE nivel WITH c_balances1.nivel
       ENDIF
    ENDSCAN
 ENDIF
 SELECT * FROM tmpsaldos WHERE  NOT balance ORDER BY codcue INTO CURSOR tmpSinBalance READWRITE
 SELECT tmpsinbalance
 INDEX ON codcue TAG codcue
 SET ORDER TO codcue
 SELECT c_balances1
 IF SEEK("P")
    SCAN REST WHILE idbal="P"
       SELECT c_balances2
       IF SEEK("P"+c_balances1.idgru)
          SCAN REST WHILE c_balances2.idbal="P" .AND. c_balances2.idgru=c_balances1.idgru
             SELECT tmpsinbalance
             IF SEEK(ALLTRIM(c_balances2.codcue))
                SCAN REST WHILE ALLTRIM(c_balances2.codcue)==SUBSTR(ALLTRIM(tmpsinbalance.codcue), 1, LEN(ALLTRIM(c_balances2.codcue)))
                   SELECT tmpsinbalance
                   REPLACE balance WITH .T.
                ENDSCAN
             ENDIF
          ENDSCAN
       ENDIF
    ENDSCAN
 ENDIF
 SELECT * FROM tmpSinBalance WHERE  NOT balance ORDER BY codcue INTO CURSOR SinBalance READWRITE
 SELECT sinbalance
 GOTO TOP
 IF  .NOT. EOF()
    MESSAGEBOX("Existen cuentas que no se tienen en cuenta en el Balance."+CHR(13)+"Compruebe las cuentas en el EXCEL 'Cuentas_Sin_Balance.xls'.", 48, "Atención")
    COPY TO 'Cuentas_Sin_Balance.xls' TYPE XLS
 ENDIF
 USE IN tmpsinbalance
 USE IN sinbalance
 SELECT consulta
ENDFUNC
**
