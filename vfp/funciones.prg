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
       _messagebox(traducir(pcidioma, "Registro existente, Introducci�n no v�lida."), 64, traducir(pcidioma, "Atenci�n"))
       RETURN .F.
    ELSE
       GOTO reg
       RETURN .T.
    ENDIF
 ENDIF
ENDFUNC
**
FUNCTION Damenumero
 PARAMETER xdescrip, xtabla, xserie, xyear, xvisible
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
 tablaant = SELECT()
 lnnumreg = 0
 IF ALLTRIM(UPPER(xtabla))=="FACCAB"
    lnnumeroinicio = damevalor("dbf/series", "facini", xserie, "serie")
    IF  .NOT. cfgnumerofacturaseguro
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
    IF lnnumeroinicio<>0 .AND. lnnumreg<lnnumeroinicio
       lnnumreg = lnnumeroinicio
    ENDIF
 ENDIF
 SELECT registros
 GOTO TOP
 LOCATE FOR tabla=xtabla .AND. serie=xserie .AND. year=xyear
 IF FOUND()
    IF RLOCK("REGISTROS")
       DO CASE
          CASE ALLTRIM(UPPER(xtabla))=="CLIENTES"
             IF registros.numreg<cfgprimercliente
                REPLACE numreg WITH cfgprimercliente
             ELSE
                REPLACE numreg WITH numreg+1
             ENDIF
          CASE ALLTRIM(UPPER(xtabla))=="BONOS"
             IF cfgcodbonautomatico .AND. registros.numreg<cfgprimerbono
                REPLACE numreg WITH cfgprimerbono
             ELSE
                REPLACE numreg WITH numreg+1
             ENDIF
          OTHERWISE
             IF cfgnumerofacturaseguro .AND. lnnumreg<>0
                REPLACE numreg WITH IIF(lnnumreg<=numreg, numreg+1, lnnumreg)
             ELSE
                REPLACE numreg WITH IIF(lnnumreg=0, numreg+1, lnnumreg)
             ENDIF
       ENDCASE
       UNLOCK IN registros
    ELSE
       xnumero = 0
       SELECT (tablaant)
       IF ALLTRIM(UPPER(xtabla))=="CLIENTES"
          RETURN ("0")
       ELSE
          RETURN xnumero
       ENDIF
    ENDIF
    xnumero = numreg
 ELSE
    SELECT registros
    IF RLOCK("0", "REGISTROS")
       APPEND BLANK
       REPLACE descrip WITH xdescrip
       REPLACE tabla WITH xtabla
       REPLACE serie WITH xserie
       REPLACE year WITH xyear
       DO CASE
          CASE ALLTRIM(UPPER(xtabla))=="CLIENTES"
             REPLACE numreg WITH IIF(cfgprimercliente=0, 1, cfgprimercliente)
          CASE ALLTRIM(UPPER(xtabla))=="BONOS"
             REPLACE numreg WITH IIF(cfgprimerbono=0, 1, cfgprimerbono)
          OTHERWISE
             REPLACE numreg WITH IIF(lnnumreg=0, 1, lnnumreg)
       ENDCASE
       REPLACE visible WITH xvisible
       UNLOCK IN registros RECORD 0
    ELSE
       xnumero = 0
       SELECT (tablaant)
       IF ALLTRIM(UPPER(xtabla))=="CLIENTES"
          RETURN ("0")
       ELSE
          RETURN xnumero
       ENDIF
    ENDIF
    xnumero = numreg
 ENDIF
 IF ALLTRIM(UPPER(xtabla))=="CLIENTES"
    IF cfgformatocliente<>0
       IF LEN(ALLTRIM(STR(xnumero)))<cfgformatocliente
          xnumero = PADL(ALLTRIM(STR(xnumero)), cfgformatocliente, "0")
       ELSE
          xnumero = ALLTRIM(STR(xnumero))
       ENDIF
    ELSE
       xnumero = ALLTRIM(STR(xnumero))
    ENDIF
 ENDIF
 IF  .NOT. cfgnumerofacturaseguro
    IF ALLTRIM(UPPER(xtabla))=="FACCAB"
       SELECT faccab
       IF lnrecno<>0
          GOTO lnrecno
       ENDIF
       SET ORDER TO &lcorder
    ENDIF
 ENDIF
 SELECT (tablaant)
 RETURN xnumero
ENDFUNC
**
FUNCTION PIDEFECHA
 PARAMETER xdoc, xeje, xser, xfec
 IF PCOUNT()=1
    xeje = .F.
    xser = .F.
    xfec = .T.
 ENDIF
 IF PCOUNT()<3
    xser = .F.
    xfec = .T.
 ENDIF
 IF PCOUNT()<4
    xfec = .T.
 ENDIF
 LOCAL fecret
 DO FORM pidefecha TO fecret WITH xdoc, xeje, xser, xfec
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
 IF  .NOT. EMPTY(xbusca) .AND. SEEK(xbusca)
    valorretorno=&xcamporetorno	
 ELSE
    DO CASE
       CASE TYPE(xcamporetorno)="C"
          valorretorno = ""
       CASE TYPE(xcamporetorno)="L"
          valorretorno = .F.
       CASE TYPE(xcamporetorno)="D"
          valorretorno = CTOD("")
       CASE TYPE(xcamporetorno)="M"
          valorretorno = ""
       CASE TYPE(xcamporetorno)="N"
          valorretorno = 0
       CASE TYPE(xcamporetorno)="T"
          valorretorno = CTOT("")
       CASE TYPE(xcamporetorno)="Y"
          valorretorno = 0
       CASE TYPE(xcamporetorno)="U"
          valorretorno = .F.
    ENDCASE
 ENDIF
 IF  .NOT. dejamosabierta
    USE IN &xxtabla
 ENDIF
 SELECT (oldtabla)
 RETURN (valorretorno)
ENDFUNC
**
FUNCTION registrar
 PARAMETER tcclave, tcpass, tlregistroprevio
 IF PCOUNT()<3
    tlregistroprevio = .F.
 ENDIF
 lcpaisregistro = "0"
 IF AT("x", tcclave)<>0
    lcpaisregistro = SUBSTR(tcclave, AT("x", tcclave)+1)
    tcclave = LEFT(tcclave, AT("x", tcclave)-1)
 ENDIF
 LOCAL registrar, llversionpago12meses, llversionrenting
 registrar = .F.
 llversionpago12meses = .F.
 llversionrenting = .F.
 IF tcpass=="lanicare"
    registrar = .T.
 ELSE
    IF tlregistroprevio
       IF ROUND(VAL(DTOS(DATE()))/VAL(SUBSTR(tcclave, 1, 4)), 0)+20+VAL(lcpaisregistro)=VAL(tcpass)
          registrar = .T.
       ENDIF
    ELSE
       IF ROUND(VAL(DTOS(DATE()))/VAL(SUBSTR(tcclave, 1, 4)), 0)+VAL(lcpaisregistro)=VAL(tcpass)
          registrar = .T.
       ELSE
          IF ROUND(VAL(DTOS(DATE()))/VAL(SUBSTR(tcclave, 1, 4)), 0)+20+VAL(lcpaisregistro)=VAL(tcpass)
             registrar = .T.
             llversionpago12meses = .T.
          ELSE
             IF ROUND(VAL(DTOS(DATE()))/VAL(SUBSTR(tcclave, 1, 4)), 0)+30+VAL(lcpaisregistro)=VAL(tcpass)
                registrar = .T.
                llversionrenting = .T.
             ENDIF
          ENDIF
       ENDIF
    ENDIF
 ENDIF
 IF registrar
    LOCAL gnerrfile
    gnerrfile = FOPEN(SYS(5)+'\'+pcficheroregistro, 12)
    IF gnerrfile<0
       WAIT WINDOW NOWAIT 'Imposible abrir o crear archivo de salida'
       DO cerrar
       RETURN (.F.)
    ELSE
       = FSEEK(gnerrfile, 0, 2)
       IF llversionpago12meses .AND.  .NOT. tlregistroprevio
          = FPUTS(gnerrfile, "FRP"+DTOS(DATE()))
       ELSE
          IF llversionrenting
             = FPUTS(gnerrfile, "RRP"+DTOS(DATE()))
          ELSE
             = FPUTS(gnerrfile, "No Modificar este Fichero.")
          ENDIF
       ENDIF
       = FCLOSE(gnerrfile)
       RETURN (.T.)
    ENDIF
 ELSE
    RETURN (.F.)
 ENDIF
ENDFUNC
**
FUNCTION RegistrarActualizacion
 PARAMETER tcclave, tcpass
 lcpaisregistro = "0"
 IF AT("x", tcclave)<>0
    lcpaisregistro = SUBSTR(tcclave, AT("x", tcclave)+1)
    tcclave = LEFT(tcclave, AT("x", tcclave)-1)
 ENDIF
 LOCAL registrar
 registrar = .F.
 IF tcpass=="lanicare"
    registrar = .T.
 ELSE
    IF plversiondemo
       IF ROUND(VAL(DTOS(DATE()))/VAL(SUBSTR(tcclave, 1, 4)), 0)+10+VAL(lcpaisregistro)=VAL(tcpass)
          registrar = .T.
       ENDIF
    ELSE
       IF ROUND(VAL(DTOS(DATE()))/VAL(SUBSTR(tcclave, 1, 4)), 0)+1+VAL(lcpaisregistro)=VAL(tcpass)
          registrar = .T.
       ENDIF
    ENDIF
 ENDIF
 IF registrar
    RETURN (.T.)
 ELSE
    RETURN (.F.)
 ENDIF
ENDFUNC
**
FUNCTION DesactivarRenting
 IF plrenting
    LOCAL gnerrfile
    gnerrfile = FOPEN(SYS(5)+'\'+pcficheroregistro, 12)
    IF gnerrfile<0
       _messagebox(traducir(pcidioma, "Imposible desactivar Renting."), 64, traducir(pcidioma, "Atenci�n"))
       RETURN (.F.)
    ELSE
       = FPUTS(gnerrfile, "No Modificar este Fichero.")
       = FCLOSE(gnerrfile)
       RETURN (.T.)
    ENDIF
 ELSE
    RETURN (.F.)
 ENDIF
ENDFUNC
**
FUNCTION ActivarRenting
 LOCAL gnerrfile
 gnerrfile = FOPEN(SYS(5)+'\'+pcficheroregistro, 12)
 IF gnerrfile<0
    RETURN (.F.)
 ELSE
    DO WHILE  .NOT. FEOF(gnerrfile)
       palabra = FGETS(gnerrfile)
    ENDDO
    IF palabra=="No Modificar este Fichero."
       = FCLOSE(gnerrfile)
       STRTOFILE("RRP"+DTOS(DATE()), SYS(5)+'\'+pcficheroregistro, 0)
       plrenting = .T.
       RETURN (.T.)
    ENDIF
 ENDIF
ENDFUNC
**
FUNCTION DameClave
 PARAMETER nveces
 LOCAL lcclave
 SET DATE TO dmy
 SET CENTURY ON
 SET SECONDS ON
 fecha = ALLTRIM(DTOS(DATE()))
 hora = ALLTRIM(STRTRAN(TIME(), ":", ""))
 lcclave = RIGHT(ALLTRIM(STR(ROUND(VAL(fecha)*VAL(hora), 0), 15)), 7)
 RETURN (lcclave)
ENDFUNC
**
FUNCTION DameClaveActualizacion
 LOCAL lcclave
 SET DATE TO dmy
 SET CENTURY ON
 SET SECONDS ON
 fecha = ALLTRIM(DTOS(DATE()))
 hora = ALLTRIM(STRTRAN(TIME(), ":", ""))
 lcclave = RIGHT(ALLTRIM(STR(ROUND(VAL(fecha)*VAL(hora), 0), 15)), 7)
 RETURN (lcclave)
ENDFUNC
**
FUNCTION DameClaveDepurador
 LOCAL lcclave
 SET DATE TO dmy
 SET CENTURY ON
 SET SECONDS ON
 fecha = ALLTRIM(DTOS(DATE()))
 hora = ALLTRIM(STRTRAN(TIME(), ":", ""))
 lcclave = RIGHT(ALLTRIM(STR(ROUND(VAL(fecha)*VAL(hora), 0), 15)), 7)
 RETURN (lcclave)
ENDFUNC
**
FUNCTION AccesoDepurador
 PARAMETER tcclave, tcpass
 LOCAL registrar
 registrar = .F.
 IF tcpass=="dspc"
    registrar = .T.
 ELSE
    IF ROUND(VAL(DTOS(DATE()))/VAL(SUBSTR(tcclave, 1, 4)), 0)+15=VAL(tcpass)
       registrar = .T.
    ENDIF
 ENDIF
 IF registrar
    RETURN (.T.)
 ELSE
    RETURN (.F.)
 ENDIF
ENDFUNC
**
FUNCTION RutaFrx
 PARAMETER informe
 RETURN (SYS(5)+SYS(2003)+"\frx\"+informe)
ENDFUNC
**
FUNCTION NumtoLet
 PARAMETER gt
 IF gt=0
    RETURN 'CERO'
 ENDIF
 IF gt<0
    c = 'MENOS '
    gt = gt*-1
 ELSE
    c = ''
 ENDIF
 f = ''
 f = STR(gt, 12, 2)
 f = SUBSTR(f, 1, LEN(f))
 n = 1
 DO WHILE n<>LEN(f)
    IF SUBSTR(f, n, 1)='.'
       EXIT
    ENDIF
    n = n+1
 ENDDO
 de = SUBSTR(f, n+1, 2)
 ft = LTRIM(SUBSTR(f, 1, 9))
 decimales = LTRIM(SUBSTR(f, 11, 12))
 ceros = '000000000'
 IF LEN(ft)<>9
    f = SUBSTR(ceros, 1, 9-LEN(ft))+ft
 ENDIF
 STORE 1 TO l, x
 DO WHILE .T.
    IF x=1 .OR. x=4 .OR. x=7
       DO CASE
          CASE VAL(SUBSTR(f, x, 3))=0
             l = l+1
          CASE VAL(SUBSTR(f, x, 3))=100
             c = c+'CIEN '
             l = l+1
          CASE VAL(SUBSTR(f, x, 3))>100
             IF l=2 .OR. l=3
                IF VAL(SUBSTR(f, x, 1))=1
                   c = c+'CIENTO '
                ENDIF
                IF VAL(SUBSTR(f, x, 1))=2
                   c = c+'DOSCIENTOS '
                ENDIF
                IF VAL(SUBSTR(f, x, 1))=3
                   c = c+'TRESCIENTOS '
                ENDIF
                IF VAL(SUBSTR(f, x, 1))=4
                   c = c+'CUATROCIENTOS '
                ENDIF
                IF VAL(SUBSTR(f, x, 1))=5
                   c = c+'QUINIENTOS '
                ENDIF
                IF VAL(SUBSTR(f, x, 1))=6
                   c = c+'SEISCIENTOS '
                ENDIF
                IF VAL(SUBSTR(f, x, 1))=7
                   c = c+'SETECIENTOS '
                ENDIF
                IF VAL(SUBSTR(f, x, 1))=8
                   c = c+'OCHOCIENTOS '
                ENDIF
                IF VAL(SUBSTR(f, x, 1))=9
                   c = c+'NOVECIENTOS '
                ENDIF
             ENDIF
             IF l=1
                IF VAL(SUBSTR(f, x, 1))=1
                   c = c+'CIENTO '
                ENDIF
                IF VAL(SUBSTR(f, x, 1))=2
                   c = c+'DOSCIENTOS '
                ENDIF
                IF VAL(SUBSTR(f, x, 1))=3
                   c = c+'TRESCIENTOS '
                ENDIF
                IF VAL(SUBSTR(f, x, 1))=4
                   c = c+'CUATROCIENTOS '
                ENDIF
                IF VAL(SUBSTR(f, x, 1))=5
                   c = c+'QUINIENTOS '
                ENDIF
                IF VAL(SUBSTR(f, x, 1))=6
                   c = c+'SEISCIENTOS '
                ENDIF
                IF VAL(SUBSTR(f, x, 1))=7
                   c = c+'SETECIENTOS '
                ENDIF
                IF VAL(SUBSTR(f, x, 1))=8
                   c = c+'OCHOCIENTOS '
                ENDIF
                IF VAL(SUBSTR(f, x, 1))=9
                   c = c+'NOVECIENTOS '
                ENDIF
             ENDIF
             x = x+1
             LOOP
          CASE VAL(SUBSTR(f, x, 3))=1
             IF l=1
                c = c+'UN '
             ENDIF
             IF l=3
                c = c+'UN '
             ENDIF
             l = l+1
          CASE VAL(SUBSTR(f, x, 3))<100
             x = x+1
             LOOP
       ENDCASE
       DO unoeur
       LOOP
    ENDIF
    IF x=2 .OR. x=5 .OR. x=8
       DO CASE
          CASE VAL(SUBSTR(f, x, 2))=20
             c = c+'VEINTE '
             l = l+1
             DO unoeur
             LOOP
          CASE VAL(SUBSTR(f, x, 1))>1 .AND. VAL(SUBSTR(f, x, 2))<>20
             IF VAL(SUBSTR(f, x, 1))=2
                c = c+'VEINTI'
             ENDIF
             IF VAL(SUBSTR(f, x, 1))=3
                c = c+'TREINTA '
                IF VAL(SUBSTR(f, x+1, 1))<>0
                   c = c+'Y '
                ENDIF
             ENDIF
             IF VAL(SUBSTR(f, x, 1))=4
                c = c+'CUARENTA '
                IF VAL(SUBSTR(f, x+1, 1))<>0
                   c = c+'Y '
                ENDIF
             ENDIF
             IF VAL(SUBSTR(f, x, 1))=5
                c = c+'CINCUENTA '
                IF VAL(SUBSTR(f, x+1, 1))<>0
                   c = c+'Y '
                ENDIF
             ENDIF
             IF VAL(SUBSTR(f, x, 1))=6
                c = c+'SESENTA '
                IF VAL(SUBSTR(f, x+1, 1))<>0
                   c = c+'Y '
                ENDIF
             ENDIF
             IF VAL(SUBSTR(f, x, 1))=7
                c = c+'SETENTA '
                IF VAL(SUBSTR(f, x+1, 1))<>0
                   c = c+'Y '
                ENDIF
             ENDIF
             IF VAL(SUBSTR(f, x, 1))=8
                c = c+'OCHENTA '
                IF VAL(SUBSTR(f, x+1, 1))<>0
                   c = c+'Y '
                ENDIF
             ENDIF
             IF VAL(SUBSTR(f, x, 1))=9
                c = c+'NOVENTA '
                IF VAL(SUBSTR(f, x+1, 1))<>0
                   c = c+'Y '
                ENDIF
             ENDIF
             x = x+1
             LOOP
          CASE VAL(SUBSTR(f, x, 1))=1
             IF VAL(SUBSTR(f, x, 2))=10
                c = c+'DIEZ '
             ENDIF
             IF VAL(SUBSTR(f, x, 2))=11
                c = c+'ONCE '
             ENDIF
             IF VAL(SUBSTR(f, x, 2))=12
                c = c+'DOCE '
             ENDIF
             IF VAL(SUBSTR(f, x, 2))=13
                c = c+'TRECE '
             ENDIF
             IF VAL(SUBSTR(f, x, 2))=14
                c = c+'CATORCE '
             ENDIF
             IF VAL(SUBSTR(f, x, 2))=15
                c = c+'QUINCE '
             ENDIF
             IF VAL(SUBSTR(f, x, 2))=16
                c = c+'DIECISEIS '
             ENDIF
             IF VAL(SUBSTR(f, x, 2))=17
                c = c+'DIECISIETE '
             ENDIF
             IF VAL(SUBSTR(f, x, 2))=18
                c = c+'DIECIOCHO '
             ENDIF
             IF VAL(SUBSTR(f, x, 2))=19
                c = c+'DIECINUEVE '
             ENDIF
             l = l+1
             DO unoeur
             LOOP
          OTHERWISE
             x = x+1
             LOOP
       ENDCASE
    ENDIF
    IF x=3 .OR. x=6 .OR. x=9
       DO CASE
          CASE VAL(SUBSTR(f, x, 1))<>1 .AND. VAL(SUBSTR(f, x, 1))<>0
             IF VAL(SUBSTR(f, x, 1))=2
                c = c+'DOS '
             ENDIF
             IF VAL(SUBSTR(f, x, 1))=3
                c = c+'TRES '
             ENDIF
             IF VAL(SUBSTR(f, x, 1))=4
                c = c+'CUATRO '
             ENDIF
             IF VAL(SUBSTR(f, x, 1))=5
                c = c+'CINCO '
             ENDIF
             IF VAL(SUBSTR(f, x, 1))=6
                c = c+'SEIS '
             ENDIF
             IF VAL(SUBSTR(f, x, 1))=7
                c = c+'SIETE '
             ENDIF
             IF VAL(SUBSTR(f, x, 1))=8
                c = c+'OCHO '
             ENDIF
             IF VAL(SUBSTR(f, x, 1))=9
                c = c+'NUEVE '
             ENDIF
          CASE VAL(SUBSTR(f, x, 1))=1
             IF l=1
                c = c+'UN '
             ENDIF
             IF l=2 .OR. l=3
                c = c+'UN '
             ENDIF
       ENDCASE
       l = l+1
       DO unoeur
       LOOP
    ENDIF
    IF x>9
       EXIT
    ENDIF
 ENDDO
 IF VAL(decimales)<>0
    f = ''
    f = decimales
    f = SUBSTR(f, 1, LEN(f))
    c = c+" COMA "
    ceros = '00'
    IF LEN(f)<>2
       f = SUBSTR(ceros, 1, 2-LEN(f))+f
    ENDIF
    STORE 1 TO l, x
    DO WHILE .T.
       IF x=1
          DO CASE
             CASE VAL(SUBSTR(f, x, 2))=20
                c = c+'VEINTE '
                l = l+1
                DO unoeur
                LOOP
             CASE VAL(SUBSTR(f, x, 1))>1 .AND. VAL(SUBSTR(f, x, 2))<>20
                IF VAL(SUBSTR(f, x, 1))=2
                   c = c+'VEINTI'
                ENDIF
                IF VAL(SUBSTR(f, x, 1))=3
                   c = c+'TREINTA '
                   IF VAL(SUBSTR(f, x+1, 1))<>0
                      c = c+'Y '
                   ENDIF
                ENDIF
                IF VAL(SUBSTR(f, x, 1))=4
                   c = c+'CUARENTA '
                   IF VAL(SUBSTR(f, x+1, 1))<>0
                      c = c+'Y '
                   ENDIF
                ENDIF
                IF VAL(SUBSTR(f, x, 1))=5
                   c = c+'CINCUENTA '
                   IF VAL(SUBSTR(f, x+1, 1))<>0
                      c = c+'Y '
                   ENDIF
                ENDIF
                IF VAL(SUBSTR(f, x, 1))=6
                   c = c+'SESENTA '
                   IF VAL(SUBSTR(f, x+1, 1))<>0
                      c = c+'Y '
                   ENDIF
                ENDIF
                IF VAL(SUBSTR(f, x, 1))=7
                   c = c+'SETENTA '
                   IF VAL(SUBSTR(f, x+1, 1))<>0
                      c = c+'Y '
                   ENDIF
                ENDIF
                IF VAL(SUBSTR(f, x, 1))=8
                   c = c+'OCHENTA '
                   IF VAL(SUBSTR(f, x+1, 1))<>0
                      c = c+'Y '
                   ENDIF
                ENDIF
                IF VAL(SUBSTR(f, x, 1))=9
                   c = c+'NOVENTA '
                   IF VAL(SUBSTR(f, x+1, 1))<>0
                      c = c+'Y '
                   ENDIF
                ENDIF
                x = x+1
                LOOP
             CASE VAL(SUBSTR(f, x, 1))=0
                c = c+'CERO '
                x = x+1
                LOOP
             CASE VAL(SUBSTR(f, x, 1))=1
                IF VAL(SUBSTR(f, x, 2))=10
                   c = c+'DIEZ '
                ENDIF
                IF VAL(SUBSTR(f, x, 2))=11
                   c = c+'ONCE '
                ENDIF
                IF VAL(SUBSTR(f, x, 2))=12
                   c = c+'DOCE '
                ENDIF
                IF VAL(SUBSTR(f, x, 2))=13
                   c = c+'TRECE '
                ENDIF
                IF VAL(SUBSTR(f, x, 2))=14
                   c = c+'CATORCE '
                ENDIF
                IF VAL(SUBSTR(f, x, 2))=15
                   c = c+'QUINCE '
                ENDIF
                IF VAL(SUBSTR(f, x, 2))=16
                   c = c+'DIECISEIS '
                ENDIF
                IF VAL(SUBSTR(f, x, 2))=17
                   c = c+'DIECISIETE '
                ENDIF
                IF VAL(SUBSTR(f, x, 2))=18
                   c = c+'DIECIOCHO '
                ENDIF
                IF VAL(SUBSTR(f, x, 2))=19
                   c = c+'DIECINUEVE '
                ENDIF
                l = l+1
                DO unoeur
                LOOP
             OTHERWISE
                x = x+1
                LOOP
          ENDCASE
       ENDIF
       IF x=2
          DO CASE
             CASE VAL(SUBSTR(f, x, 1))<>1 .AND. VAL(SUBSTR(f, x, 1))<>0
                IF VAL(SUBSTR(f, x, 1))=2
                   c = c+'DOS '
                ENDIF
                IF VAL(SUBSTR(f, x, 1))=3
                   c = c+'TRES '
                ENDIF
                IF VAL(SUBSTR(f, x, 1))=4
                   c = c+'CUATRO '
                ENDIF
                IF VAL(SUBSTR(f, x, 1))=5
                   c = c+'CINCO '
                ENDIF
                IF VAL(SUBSTR(f, x, 1))=6
                   c = c+'SEIS '
                ENDIF
                IF VAL(SUBSTR(f, x, 1))=7
                   c = c+'SIETE '
                ENDIF
                IF VAL(SUBSTR(f, x, 1))=8
                   c = c+'OCHO '
                ENDIF
                IF VAL(SUBSTR(f, x, 1))=9
                   c = c+'NUEVE '
                ENDIF
             CASE VAL(SUBSTR(f, x, 1))=1
                IF l=1
                   c = c+'UN '
                ENDIF
                IF l=2 .OR. l=3
                   c = c+'UN '
                ENDIF
          ENDCASE
          IF x>=2
             EXIT
          ENDIF
          x = x+1
          LOOP
       ENDIF
       IF x>=2
          EXIT
       ENDIF
    ENDDO
 ENDIF
 gt = SPACE(70)
 gt = c
 RETURN gt
ENDFUNC
**
PROCEDURE unoEUR
 IF l=1
    l = l+1
 ELSE
    IF l=2
       IF VAL(SUBSTR(f, 1, 3))=1
          c = c+'MILLON '
       ENDIF
       IF VAL(SUBSTR(f, 1, 3))>0 .AND. VAL(SUBSTR(f, 1, 3))<>1
          c = c+'MILLONES '
       ENDIF
       x = 4
    ELSE
       IF l=3
          IF VAL(SUBSTR(f, 4, 3))>0
             c = c+'MIL '
          ENDIF
          x = 7
       ELSE
          x = 10
          RETURN
       ENDIF
    ENDIF
 ENDIF
ENDPROC
**
PROCEDURE vaciardbf
 PARAMETER xruta
 LOCAL i, numtablas, porcen, estado
 DIMENSION tablas(1)
 CLOSE DATABASES ALL
 SET EXCLUSIVE ON
 numtablas = ADIR(tablas, xruta+"*.dbf")
 FOR i = 1 TO numtablas
    tablax = xruta+tablas(i, 1)
    USE &tablax. EXCL
    ZAP
    WAIT WINDOW NOWAIT "LIMPIANDO... "+tablax
 ENDFOR
 _messagebox(traducir(pcidioma, "El Proceso ha finalizado con Exito."), 64, traducir(pcidioma, "Atencion"))
 CLOSE TABLE ALL
 SET EXCLUSIVE OFF
ENDPROC
**
FUNCTION RetrocedeNumero
 PARAMETER xtabla, xserie, xyear, xnumeroretroceso
 LOCAL xnumero, tablaant
 xnumero = 1
 IF PCOUNT()<>4
    xnumero = 0
    RETURN xnumero
 ENDIF
 tablaant = SELECT()
 SELECT registros
 GOTO TOP
 LOCATE FOR tabla=xtabla .AND. serie=xserie .AND. year=xyear
 IF FOUND()
    IF RLOCK("REGISTROS")
       IF numreg=xnumeroretroceso
          REPLACE numreg WITH numreg-1
          UNLOCK IN registros
       ENDIF
    ELSE
       xnumero = 0
       SELECT (tablaant)
       RETURN xnumero
    ENDIF
    xnumero = numreg
 ELSE
    xnumero = 0
    SELECT (tablaant)
    RETURN xnumero
 ENDIF
 SELECT (tablaant)
 RETURN xnumero
ENDFUNC
**
PROCEDURE ImprimeTexto
 PARAMETER tctexto
 IF  .NOT. cfgabrircajon2
    abrircajonportamonedas(tctexto)
 ELSE
    lhandle = FOPEN(cfgpuertoimpresoratickets, 2)
    IF lhandle=-1
       WAIT WINDOW NOWAIT "Error abriendo puerto"
       RETURN
    ENDIF
    res=ANSITOOEM(&tctexto)
    FPUTS(lhandle, res)
    lresu = FFLUSH(lhandle)
    IF  .NOT. lresu
       WAIT WINDOW "Error escribiendo en puerto"
    ENDIF
    = FCLOSE(lhandle)
 ENDIF
 RETURN
ENDPROC
**
PROCEDURE AbrirCajonPortamonedas
 PARAMETER tctexto
 LOCAL lcoldselect, lcoldreprocess, lcalias, llnoimpresoras
 lcoldselect = SELECT()
 llnoimpresoras = .F.
 TRY
    IF  .NOT. USED("impresoras")
       llnoimpresoras = .T.
       USE SHARED dbf/impresoras AGAIN IN 0
    ENDIF
    cambiarimpresora("999999999999999")
    lcdevice = SET("Device")
    lcconsole = SET("Console")
    IF EMPTY(impresoras.impresora3)
       _messagebox(traducir(pcidioma, "Pulse 'ACEPTAR' y Seleccione la impresora que abre el caj�n portamonedas"), 64, traducir(pcidioma, "Seleccionar Impresora"))
       lcprinter = GETPRINTER()
       SELECT impresoras
       REPLACE impresoras.impresora3 WITH lcprinter
    ENDIF
    IF EMPTY(impresoras.impresora3)
       _messagebox(traducir(pcidioma, "Debe seleccionar la impresora que abre el caj�n portamonedas"), 48, traducir(pcidioma, "Atenci�n"))
    ELSE
       SET DEVICE TO PRINTER
       SET PRINTER TO NAME (ALLTRIM(impresoras.impresora3))
       ??? &tctexto
       SET DEVICE TO &lcdevice
       SET PRINTER TO DEFAULT
       SET CONSOLE &lcconsole
    ENDIF
 CATCH TO oerr
    _messagebox(traducir(pcidioma, "Error al abrir caj�n")+" "+ALLTRIM(oerr.message), 48, traducir(pcidioma, "Atenci�n"))
 ENDTRY
 IF llnoimpresoras
    USE IN impresoras
 ENDIF
 IF  .NOT. EMPTY(lcoldselect)
    SELECT (lcoldselect)
 ENDIF
ENDPROC
**
PROCEDURE ABRIRCAJON_SERIAL
 PARAMETER tctexto
 TRY
    LOCAL lotestcom
    lotestcom = CREATEOBJECT("MSCOMMLib.MSComm")
    lotestcom.commport = 2
    lotestcom.settings = "14400,N,8,1"
    lotestcom.portopen = .T.
    lotestcom.OUTPUT = &tctexto
    lotestcom.portopen = .F.
 CATCH TO oerr
    _messagebox(traducir(pcidioma, "Error al abrir caj�n ")+" "+ALLTRIM(oerr.message), 48, traducir(pcidioma, "Atenci�n"))
 ENDTRY
ENDPROC
**
PROCEDURE ESCRIBIR_SERIE
 PARAMETER tctexto1, tctexto2
 TRY
    IF TYPE("LOTESTCOM")<>"O"
       PUBLIC lotestcom
       lotestcom = CREATEOBJECT("Visor")
    ENDIF
    lotestcom.visor.commport = cfgpuertovisor
    lotestcom.visor.settings = cfgsettingsvisor
    lotestcom.visor.portopen = .T.
    lotestcom.visor.output = CHR(13)
    lotestcom.visor.output = SPACE(cfgdigitosxlinea*2)
    lctexto1 = tctexto1
    lctexto1 = PADR(lctexto1, cfgdigitosxlinea, " ")
    lctexto2 = tctexto2
    lctexto2 = PADR(lctexto2, cfgdigitosxlinea, " ")
    lotestcom.visor.output = lctexto1+lctexto2
    lotestcom.visor.portopen = .F.
    DOEVENTS
 CATCH TO oerr
    _messagebox(traducir(pcidioma, "Error al escribir en el Visor")+" "+ALLTRIM(oerr.message), 48, traducir(pcidioma, "Atenci�n"))
 ENDTRY
ENDPROC
**
FUNCTION SuiteLoadUnlockFromFunciones
 PARAMETER tcStyleRoot
 LOCAL llOk
 * v2: TYPE() no detecta FUNCTION embebida; usar plSuiteSyncEnabled (set en Suite_SyncInit).
 IF TYPE("plSuiteSyncEnabled")="L" AND plSuiteSyncEnabled
    RETURN .T.
 ENDIF
 IF TYPE("SuiteLoadColaSyncRuntime")#"U"
    llOk = SuiteLoadColaSyncRuntime(tcStyleRoot)
    IF llOk
       RETURN .T.
    ENDIF
 ENDIF
 IF TYPE("pcidioma")#"C"
    PUBLIC pcidioma, pcpais, pcversionpais
    pcidioma = "CA"
    pcpais = "ESP"
    pcversionpais = "ESP"
 ENDIF
 DO SuiteBootstrapLog WITH "[BOOT-07] falta PROGS\suite_cola_sync.prg en "+tcStyleRoot
 RETURN .F.
ENDFUNC
**
FUNCTION SuiteGetHttpLocal
 LOCAL lo, lcSavErr, llFail, lcRoot, lcPrg
 lo = .NULL.
 IF TYPE("SuiteCreateHttp")#"U"
    RETURN SuiteCreateHttp()
 ENDIF
 llFail = .F.
 lcSavErr = ON("ERROR")
 ON ERROR llFail = .T.
 lcRoot = IIF(TYPE("pcSuiteStyleRoot")="C" .AND. .NOT. EMPTY(pcSuiteStyleRoot), ADDBS(pcSuiteStyleRoot), ADDBS(SYS(5)+SYS(2003)))
 lcPrg = lcRoot+"PROGS\suite_full_unlock.prg"
 IF  .NOT. FILE(lcPrg)
    lcPrg = lcRoot+"suite_full_unlock.prg"
 ENDIF
 IF TYPE("SuiteEnsureSyncGlobals")="U"
    IF FILE(lcPrg)
       SET PROCEDURE TO (lcPrg) ADDITIVE
    ENDIF
 ENDIF
 IF TYPE("SuiteEnsureSyncGlobals")#"U"
    DO SuiteEnsureSyncGlobals
 ENDIF
 lo = CREATEOBJECT("httpasp_local")
 ON ERROR &lcSavErr
 IF llFail OR VARTYPE(lo)#"O"
    lo = .NULL.
 ENDIF
 RETURN lo
ENDFUNC
**
FUNCTION Actualizar
 PARAMETER tcdirdbf, tcdirtmp, tcprgcreadbc, tcdirfrx, tcdirtmpfrx, tcnombreexe, llregistroactualizacion, llnuevainstalacionmex, lnantiguaversion
 LOCAL llactualizar, lnnuevaversion, ladatosversion, lnhandler
 LOCAL lcNuevaVer, lcAntiguaVer, lcExeVer
 DIMENSION ladatosversion(7)
 lnantiguaversion = ""
 llactualizar = .F.
 llregistroactualizacion = .T.
 IF TYPE("plSuiteSyncEnabled")="U"
    = SuiteLoadUnlockFromFunciones(IIF(TYPE("pcSuiteStyleRoot")="C" .AND. .NOT. EMPTY(pcSuiteStyleRoot), ADDBS(pcSuiteStyleRoot), ADDBS(SYS(5)+SYS(2003))))
 ENDIF
 * Style Suite: sin comprobar/instalar actualizacion Dunasoft al arrancar
 IF TYPE("plSuiteFullUnlock")="L" AND plSuiteFullUnlock
    RETURN .T.
 ENDIF
 IF TYPE("plSuiteSyncEnabled")="L" AND plSuiteSyncEnabled
    RETURN .T.
 ENDIF
 IF FILE(ADDBS(SYS(5)+SYS(2003))+"SuiteSync.cfg")
    RETURN .T.
 ENDIF
 IF FILE(ADDBS(SYS(5)+SYS(2003))+"suite_cola_sync.prg")
    RETURN .T.
 ENDIF
 IF FILE(ADDBS(SYS(5)+SYS(2003))+"PROGS\suite_cola_sync.prg")
    RETURN .T.
 ENDIF
 lcExeVer = FULLPATH(tcnombreexe)
 IF EMPTY(lcExeVer) OR .NOT. FILE(lcExeVer)
    lcExeVer = FULLPATH("duna.exe")
 ENDIF
 IF EMPTY(lcExeVer) OR .NOT. FILE(lcExeVer)
    lcExeVer = FULLPATH("mscomctl.exe")
 ENDIF
 IF EMPTY(lcExeVer) OR .NOT. FILE(lcExeVer)
    llregistroactualizacion = .T.
    RETURN .T.
 ENDIF
 lcNuevaVer = ""
 IF .NOT. EMPTY(lcExeVer) AND AGETFILEVERSION(ladatosversion, lcExeVer)
    lcNuevaVer = ALLTRIM(ladatosversion(4))
    IF EMPTY(lcNuevaVer)
       lcNuevaVer = ALLTRIM(ladatosversion(3))
    ENDIF
 ENDIF
 lnnuevaversion = lcNuevaVer
 lnhandler = 0
 pcnversionaplicacion = lcNuevaVer
 IF FILE(pcficheroversion)
    lnhandler = FOPEN(pcficheroversion, 2)
    IF lnhandler >= 0
       lcAntiguaVer = ALLTRIM(CHRTRAN(FGETS(lnhandler), CHR(13)+CHR(10), ""))
       lnantiguaversion = lcAntiguaVer
       IF .NOT. EMPTY(lcNuevaVer) AND lcNuevaVer > lcAntiguaVer
          llactualizar = .T.
       ELSE
          = FCLOSE(lnhandler)
          lnhandler = 0
       ENDIF
    ENDIF
 ELSE
    llnuevainstalacionmex = .T.
    llactualizar = .T.
 ENDIF
 IF llactualizar
    IF FILE(SYS(5)+'\'+pcficheroregistro)
       DO config
       IF pcversionpais=="MEX"
          llregistroactualizacion = .T.
       ELSE
          DO FORM RegistroActualizacion TO llregistroactualizacion WITH .T.
       ENDIF
       IF  .NOT. llregistroactualizacion
          RETURN .F.
       ENDIF
    ENDIF
 ENDIF
 DO actualizacion_pre WITH lnantiguaversion
 IF llactualizar
    creatablasexternas(ADDBS(ALLTRIM(tcdirdbf))+"..\", tcdirtmp)
    creadbc(tcdirdbf, tcdirtmp, tcprgcreadbc)
    creafrx(tcdirfrx, tcdirtmpfrx)
    IF lnhandler<>0
       FSEEK(lnhandler, 0, 0)
       FPUTS(lnhandler, lnnuevaversion)
       FCLOSE(lnhandler)
    ELSE
       STRTOFILE(lnnuevaversion, "..\"+pcficheroversion)
    ENDIF
    DO actualizacion_post WITH lnantiguaversion
 ENDIF
 llregistroactualizacion = .T.
ENDFUNC
**
PROCEDURE CreaTablasExternas
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
 IF FILE(tcdirtablas+"EMPRESA.DBF")
    llexisteempresa = .T.
    COPY FILE empresa.* TO &lcdirtemp
 ENDIF
 IF FILE(tcdirtablas+"FONDOS.DBF")
    llexistefondos = .T.
    COPY FILE fondos.* TO &lcdirtemp
    DELETE FILE FONDOS.*
 ENDIF
 maketable_empresa(tcdirtablas)
 IF llexisteempresa
    IF  .NOT. USED("EMPRESA")
       USE EMPRESA IN 0
    ENDIF
    SELECT empresa
    APPEND FROM ADDBS(ALLTRIM(tcdirtemp))+"EMPRESA.DBF"
    USE IN empresa
 ENDIF
 IF llexistefondos
    IF  .NOT. USED("EMPRESA")
       USE EMPRESA IN 0
    ENDIF
    SELECT empresa
    IF  .NOT. USED("FONDOS")
       USE (ADDBS(ALLTRIM(tcdirtemp))+"FONDOS.DBF") IN 0
    ENDIF
    SELECT fondos
    GOTO TOP
    SELECT empresa
    GOTO TOP
    REPLACE fondo WITH fondos.ruta
    USE IN empresa
    USE IN fondos
 ENDIF
 CLOSE DATABASES ALL
 DELETE FILE &lcdirtemp
 SET SAFETY &lcoldsafety
ENDPROC
**
PROCEDURE CreaDBC
 PARAMETER tcdirdatos, tcdirtemp, tcprgdbc
 LOCAL ladatos, lnnumtablas, lncont, lctabla, lcdirdatos, lcdirtemp, lcolddefault, lcoldsafety, lahaydatos
 DIMENSION ladatos(1)
 DIMENSION lahaydatos(1)
 lcdirdatos = ADDBS(ALLTRIM(tcdirdatos))+"*.*"
 lcdirtemp = ADDBS(ALLTRIM(tcdirtemp))+"*.*"
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
PROCEDURE CreaFRX
 PARAMETER tcdirfrx, tcdirtempfrx
 LOCAL lnnumfrxtpv, lafrxtpv, lncont, lcficheroorigen, lcficherodestino, lcoldsafety
 DIMENSION lafrxtpv(1)
 lcoldsafety = SET("safety")
 SET SAFETY OFF
 IF  .NOT. DIRECTORY(tcdirfrx)
    MD (tcdirfrx)
 ENDIF
 lnnumfrxtpv = ADIR(lafrxtpv, ADDBS(ALLTRIM(tcdirtempfrx))+"*.*")
 FOR lncont = 1 TO lnnumfrxtpv
    lcficheroorigen = ADDBS(ALLTRIM(tcdirtempfrx))+lafrxtpv(lncont, 1)
    lcficherodestino = ADDBS(ALLTRIM(tcdirfrx))+lafrxtpv(lncont, 1)
    COPY FILE &lcficheroorigen  TO &lcficherodestino 
 ENDFOR
 SET SAFETY &lcoldsafety
ENDPROC
**
PROCEDURE MakeTable_EMPRESA
 PARAMETER tcdir
 CREATE TABLE tcdir+'EMPRESA.DBF' (codemp C (8) NOT NULL, razemp C (80) NOT NULL, domemp C (80) NOT NULL, codpos C (15) NOT NULL, pobemp C (80) NOT NULL, proemp C (80) NOT NULL, pais C (80) NOT NULL, nifemp C (20) NOT NULL, telefono C (12) NOT NULL, fax C (12) NOT NULL, webemp C (254) NOT NULL, imaemp C (254) NOT NULL, config M NOT NULL, fondo C (254) NOT NULL, ftpcentral N (6) NOT NULL)
 SET COLLATE TO 'MACHINE'
 INDEX ON codemp TAG codemp
ENDPROC
**
PROCEDURE MakeTable_FIRMAS
 PARAMETER tcdir
ENDPROC
**
FUNCTION REALIZARCOPIASEGURIDAD
 PARAMETER tlcopiadirecta
 IF cfgvercopia
    IF (DATE()>=cfgultimacopia+cfgdiascopia) .OR. tlcopiadirecta
       IF _messagebox(traducir(pcidioma, "�Desea realizar la copia de seguridad ahora? ")+CHR(13)+traducir(pcidioma, "Si acepta el programa se cerrara y se ejecutara la aplicacion de Utilidades."), 036, traducir(pcidioma, "Atenci�n"))=6
          llcopiaseg = .T.
          IF  .NOT. USED("EMPRESA")
             USE SHARED EMPRESA IN 0
          ENDIF
          SELECT empresa
          GOTO TOP
          cfgultimacopia = DATE()
          SAVE TO MEMO config ALL LIKE CFG*
          CLOSE TABLE ALL
          SET DEFAULT TO ../UTILIDADES/
          RUN /N "../UTILIDADES/UTILIDADES.EXE"
          RETURN (.T.)
       ENDIF
    ENDIF
 ENDIF
 RETURN (.F.)
ENDFUNC
**
PROCEDURE TPV_Peluqueria
 PARAMETER tcparametro, tcparametro1, tcparametro2
 DO CASE
    CASE UPPER(tcparametro)=="FACTURAS"
       IF pcversionpais=="MEX"
          DO FORM newescritorio_stylemex
       ELSE
          DO FORM NEWESCRITORIO
       ENDIF
    CASE UPPER(tcparametro)=="FACTURAS_CLIENTES"
       DO FORM NEW_TICKET_TACTIL WITH .T., tcparametro2, "CONSULTA", "", ""
    OTHERWISE
 ENDCASE
ENDPROC
**
PROCEDURE CalculaKits
 PARAMETER tccodart1, tnstock, tnrecurrencia
 LOCAL lcalias, lnrecnoarticulos
 IF PCOUNT()<3
    tnrecurrencia = 0
 ENDIF
 IF tnrecurrencia>10
    _messagebox(traducir(pcidioma, "Se ha superado el m�ximo de Kits anidados. Revise el Kit."), 48, traducir(pcidioma, "Atenci�n"))
    RETURN
 ENDIF
 lcalias = SELECT()
 SELECT articulos
 lnrecnoarticulos = IIF(EOF(), 0, RECNO())
 SELECT kits
 SET ORDER TO codart1
 IF SEEK(tccodart1)
    tnrecurrencia = tnrecurrencia+1
    SCAN REST WHILE tccodart1=kits.codart1
       SELECT articulos
       SET ORDER TO codart
       IF SEEK(kits.codart2)
          IF articulos.matpri=1
             REPLACE stock WITH stock+(tnstock*kits.cant)
             REPLACE enviar WITH .T.
             IF tnstock<0
                IF plavisorupturastock
                   IF (articulos.stock+ABS(tnstock*kits.cant)>articulos.stomin) .AND. (articulos.stock<=articulos.stomin)
                      lctextomail = traducir(pcidioma, "Centro:")+" "+ALLTRIM(cfgusuariofranquicia)+CHR(13)+CHR(10)
                      lctextomail = lctextomail+traducir(pcidioma, "Art�culo:")+" "+ALLTRIM(articulos.codart)+" - "+ALLTRIM(articulos.desart)+CHR(13)+CHR(10)
                      lctextomail = lctextomail+traducir(pcidioma, "Stock M�nimo:")+" "+ALLTRIM(STR(articulos.stomin))+CHR(13)+CHR(10)
                      lctextomail = lctextomail+traducir(pcidioma, "Stock Actual:")+" "+ALLTRIM(STR(articulos.stock))+CHR(13)+CHR(10)
                      lctextomail = lctextomail+traducir(pcidioma, "Stock M�ximo:")+" "+ALLTRIM(STR(articulos.stomax))+CHR(13)+CHR(10)+CHR(13)+CHR(10)
                      lctextomail = lctextomail+IIF(pcversionpais="MEX", traducir(pcidioma, "Email Autom�tico de Style for Mex"), traducir(pcidioma, "Email Autom�tico de Style DunaSoft"))
                      enviarmail(pcmailavisorupturastock, traducir(pcidioma, "Ruptura de Stock")+" ["+ALLTRIM(cfgusuariofranquicia)+"]", lctextomail)
                   ENDIF
                ENDIF
             ENDIF
          ENDIF
       ENDIF
       SELECT kits
       lnrecno = RECNO()
       calculakits(kits.codart2, (tnstock*kits.cant), @tnrecurrencia)
       SELECT kits
       GOTO lnrecno
    ENDSCAN
 ENDIF
 IF lnrecnoarticulos<>0
    SELECT articulos
    GOTO lnrecnoarticulos
 ENDIF
 SELECT (lcalias)
ENDPROC
**
FUNCTION CapturarImagenWebCam
 PARAMETER tctabla, tccampo, tcarchivo
 LOCAL lnimagehandle, lnreply, llretorno, lcpathdefault
 lcpathdefault = SET('DEFAULT')+SYS(2003)
 TRY
    llretorno = .F.
    IF EMPTY(tcarchivo)
       tcarchivo = ADDBS(SYS(5)+SYS(2003))+ADDBS(ALLTRIM(cfgpathfotos))+"foto_"+ALLTRIM(STR(damenumero("FOTOS", "FOTOS", "", 0, .F.)))+".bmp"
    ENDIF
    DECLARE INTEGER TWAIN_SelectImageSource IN Eztw32.DLL INTEGER
    DECLARE INTEGER TWAIN_GetSourceList IN Eztw32.dll
    DECLARE INTEGER TWAIN_GetNextSourceName IN Eztw32.dll STRING @
    DECLARE INTEGER TWAIN_OpenSource IN Eztw32.DLL STRING
    DECLARE INTEGER TWAIN_AcquireNative IN Eztw32.DLL INTEGER, INTEGER
    DECLARE INTEGER TWAIN_WriteNativeToFilename IN Eztw32.DLL INTEGER, STRING
    DECLARE INTEGER TWAIN_FreeNative IN Eztw32.DLL INTEGER
    DECLARE INTEGER TWAIN_SetMultiTransfer IN Eztw32.dll INTEGER
    DECLARE LONG TWAIN_SelectImageSource IN eztw32.dll LONG
    DECLARE LONG TWAIN_CloseSource IN eztw32.dll
    IF twain_selectimagesource(0)<>0
       lnimagehandle = twain_acquirenative(0, 0)
       IF lnimagehandle<>0
          lnreply = twain_writenativetofilename(lnimagehandle, tcarchivo)
          twain_freenative(lnimagehandle)
          IF lnreply=0
             SELECT (tctabla)
             REPLACE &tccampo WITH tcarchivo
             llretorno = .T.
          ELSE
             _messagebox(traducir(pcidioma, "No se pudo guardar la imagen"), 64, traducir(pcidioma, "Atenci�n"))
          ENDIF
          twain_closesource()
       ENDIF
    ENDIF
 CATCH TO oerr
    _messagebox(traducir(pcidioma, "No se pudo guardar la imagen. Asegurese que la WEBCAM est� conectada e instalada en su PC.")+CHR(13)+traducir(pcidioma, "[Error: ")+ALLTRIM(STR(oerr.errorno))+"-"+ALLTRIM(oerr.message)+"] (Lin:"+ALLTRIM(STR(oerr.lineno))+")", 64, traducir(pcidioma, "Atenci�n"))
 ENDTRY
 SET DEFAULT TO (lcpathdefault)
 RETURN (llretorno)
ENDFUNC
**
FUNCTION Cambia_Codigo_Cliente
 PARAMETER tccodigoanterior, tccodigonuevo, tlsustituir
 LOCAL llclientesabierta, llcambiado, llfaccababierta, llcarcliabierta, llbonoscliabierta, llplanificadorabierta, lllopdabierta, llagendaabierta, llclicavabierta, llcliconabierta, llcliseslasabierta, llalbcababierta, llclifamiliaabierta, llclipelabierta, llemailabierta, llplanincabierta, llprecababierta, llsmsabierta
 llcambiado = .T.
 llclientesabierta = .F.
 llfaccababierta = .F.
 llfaccabperabierta = .F.
 llcarcliabierta = .F.
 llbonoscliabierta = .F.
 llplanificadorabierta = .F.
 lllopdabierta = .F.
 llagendaabierta = .F.
 llpesoabierta = .F.
 lltratamientosabierta = .F.
 llclicavabierta = .F.
 llcliconabierta = .F.
 llcliseslasabierta = .F.
 llalbcababierta = .F.
 llclifamiliaabierta = .F.
 llclipelabierta = .F.
 llemailabierta = .F.
 llplanincabierta = .F.
 llprecababierta = .F.
 llsmsabierta = .F.
 IF  .NOT. USED("Clientes")
    USE SHARED dbf/clientes AGAIN ALIAS clientes IN 0
 ELSE
    llclientesabierta = .T.
 ENDIF
 lltraspasarventas = .F.
 SELECT clientes
 SET ORDER TO codcli
 IF SEEK(tccodigonuevo)
    IF tlsustituir
       lltraspasarventas = .T.
    ELSE
       IF  .NOT. llclientesabierta
          USE IN clientes
       ENDIF
       _messagebox(traducir(pcidioma, "El nuevo c�digo ya existe"), 48, traducir(pcidioma, "Atenci�n"))
       RETURN .F.
    ENDIF
 ENDIF
 IF  .NOT. USED("faccab")
    USE SHARED dbf/faccab AGAIN ALIAS faccab IN 0
 ELSE
    llfaccababierta = .T.
 ENDIF
 IF  .NOT. USED("faccabper")
    USE SHARED dbf/faccabper AGAIN ALIAS faccabper IN 0
 ELSE
    llfaccabperabierta = .T.
 ENDIF
 IF  .NOT. USED("carcli")
    USE SHARED dbf/carcli AGAIN ALIAS carcli IN 0
 ELSE
    llcarcliabierta = .T.
 ENDIF
 IF  .NOT. USED("bonoscli")
    USE SHARED dbf/bonoscli AGAIN ALIAS bonoscli IN 0
 ELSE
    llbonoscliabierta = .T.
 ENDIF
 IF  .NOT. USED("plan2009")
    USE SHARED dbf/plan2009 AGAIN ALIAS plan2009 IN 0
 ELSE
    llplanificadorabierta = .T.
 ENDIF
 IF  .NOT. USED("clilopd")
    USE SHARED dbf/clilopd AGAIN ALIAS clilopd IN 0
 ELSE
    lllopdabierta = .T.
 ENDIF
 IF  .NOT. USED("clipeso")
    USE SHARED dbf/clipeso AGAIN ALIAS clipeso IN 0
 ELSE
    llpesoabierta = .T.
 ENDIF
 IF  .NOT. USED("clitra")
    USE SHARED dbf/clitra AGAIN ALIAS clitra IN 0
 ELSE
    lltratamientosabierta = .T.
 ENDIF
 IF  .NOT. USED("Agenda")
    USE SHARED dbf/Agenda AGAIN ALIAS agenda IN 0
 ELSE
    llagendaabierta = .T.
 ENDIF
 IF  .NOT. USED("clicav")
    USE SHARED dbf/clicav AGAIN ALIAS clicav IN 0
 ELSE
    llclicavabierta = .T.
 ENDIF
 IF  .NOT. USED("clicon")
    USE SHARED dbf/clicon AGAIN ALIAS clicon IN 0
 ELSE
    llcliconabierta = .T.
 ENDIF
 IF  .NOT. USED("cliseslas")
    USE SHARED dbf/cliseslas AGAIN ALIAS cliseslas IN 0
 ELSE
    llcliseslasabierta = .T.
 ENDIF
 IF  .NOT. USED("albcab")
    USE SHARED dbf/albcab AGAIN ALIAS albcab IN 0
 ELSE
    llalbcababierta = .T.
 ENDIF
 IF  .NOT. USED("clifamilia")
    USE SHARED dbf/clifamilia AGAIN ALIAS clifamilia IN 0
 ELSE
    llclifamiliaabierta = .T.
 ENDIF
 IF  .NOT. USED("clipel")
    USE SHARED dbf/clipel AGAIN ALIAS clipel IN 0
 ELSE
    llclipelabierta = .T.
 ENDIF
 IF  .NOT. USED("email")
    USE SHARED dbf/email AGAIN ALIAS email IN 0
 ELSE
    llemailabierta = .T.
 ENDIF
 IF  .NOT. USED("planinc")
    USE SHARED dbf/planinc AGAIN ALIAS planinc IN 0
 ELSE
    llplanincabierta = .T.
 ENDIF
 IF  .NOT. USED("precab")
    USE SHARED dbf/precab AGAIN ALIAS precab IN 0
 ELSE
    llprecababierta = .T.
 ENDIF
 IF  .NOT. USED("sms")
    USE SHARED dbf/sms AGAIN ALIAS sms IN 0
 ELSE
    llsmsabierta = .T.
 ENDIF
 BEGIN TRANSACTION
 SELECT clientes
 SET ORDER TO codcli
 IF SEEK(tccodigoanterior)
    IF lltraspasarventas
       IF RLOCK("0", "clientes")
          DELETE IN clientes
          UNLOCK IN clientes
       ELSE
          llcambiado = .F.
       ENDIF
    ELSE
       IF RLOCK("clientes")
          REPLACE codcli WITH tccodigonuevo
          UNLOCK IN clientes
       ELSE
          llcambiado = .F.
       ENDIF
    ENDIF
 ELSE
    llcambiado = .F.
 ENDIF
 IF llcambiado
    SELECT ejefac, serfac, numfac FROM faccab WHERE codcli=tccodigoanterior INTO CURSOR tmpFaccab
    SELECT faccab
    SET ORDER TO numfac
    SELECT tmpfaccab
    SCAN
       SELECT faccab
       IF SEEK(STR(tmpfaccab.ejefac, 4)+tmpfaccab.serfac+STR(tmpfaccab.numfac, 10))
          IF RLOCK("faccab")
             REPLACE codcli WITH tccodigonuevo
             REPLACE enviar WITH .T.
             UNLOCK IN faccab
          ELSE
             llcambiado = .F.
             EXIT
          ENDIF
       ELSE
          llcambiado = .F.
          EXIT
       ENDIF
    ENDSCAN
    USE IN tmpfaccab
 ENDIF
 IF llcambiado
    SELECT numfac FROM faccabper WHERE codcli=tccodigoanterior INTO CURSOR tmpFaccabper
    SELECT faccabper
    SET ORDER TO numfac
    SELECT tmpfaccabper
    SCAN
       SELECT faccabper
       IF SEEK(tmpfaccabper.numfac)
          IF RLOCK("faccabper")
             REPLACE codcli WITH tccodigonuevo
             UNLOCK IN faccabper
          ELSE
             llcambiado = .F.
             EXIT
          ENDIF
       ELSE
          llcambiado = .F.
          EXIT
       ENDIF
    ENDSCAN
    USE IN tmpfaccabper
 ENDIF
 IF llcambiado
    SELECT carcli
    SCAN
       IF codcli=tccodigoanterior
          IF RLOCK("carcli")
             REPLACE codcli WITH tccodigonuevo
             UNLOCK IN carcli
          ELSE
             llcambiado = .F.
             EXIT
          ENDIF
       ENDIF
    ENDSCAN
 ENDIF
 IF llcambiado
    SELECT bonoscli
    SCAN
       IF codcli=tccodigoanterior
          IF RLOCK("bonoscli")
             REPLACE codcli WITH tccodigonuevo
             REPLACE enviar WITH .T.
             UNLOCK IN bonoscli
          ELSE
             llcambiado = .F.
             EXIT
          ENDIF
       ENDIF
    ENDSCAN
 ENDIF
 IF llcambiado
    SELECT plan2009
    SCAN
       IF  .NOT. EMPTY(codcli) .AND. codcli=tccodigoanterior
          IF RLOCK("plan2009")
             REPLACE codcli WITH tccodigonuevo
             UNLOCK IN plan2009
          ELSE
             llcambiado = .F.
             EXIT
          ENDIF
       ENDIF
    ENDSCAN
 ENDIF
 IF llcambiado
    SELECT agenda
    SCAN
       IF clientebd .AND. ALLTRIM(cliente)=ALLTRIM(tccodigoanterior)
          IF RLOCK("Agenda")
             REPLACE cliente WITH tccodigonuevo
             UNLOCK IN agenda
          ELSE
             llcambiado = .F.
             EXIT
          ENDIF
       ENDIF
    ENDSCAN
 ENDIF
 IF llcambiado
    SELECT clilopd
    SCAN
       IF codcli=tccodigoanterior
          IF RLOCK("clilopd")
             REPLACE codcli WITH tccodigonuevo
             UNLOCK IN clilopd
          ELSE
             llcambiado = .F.
             EXIT
          ENDIF
       ENDIF
    ENDSCAN
 ENDIF
 IF llcambiado
    SELECT clipeso
    SCAN
       IF codcli=tccodigoanterior
          IF RLOCK("clipeso")
             REPLACE codcli WITH tccodigonuevo
             UNLOCK IN clipeso
          ELSE
             llcambiado = .F.
             EXIT
          ENDIF
       ENDIF
    ENDSCAN
 ENDIF
 IF llcambiado
    SELECT clitra
    SCAN
       IF codcli=tccodigoanterior
          IF RLOCK("clitra")
             REPLACE codcli WITH tccodigonuevo
             UNLOCK IN clitra
          ELSE
             llcambiado = .F.
             EXIT
          ENDIF
       ENDIF
    ENDSCAN
 ENDIF
 IF llcambiado
    SELECT clicav
    SCAN
       IF codcli=tccodigoanterior
          IF RLOCK("clicav")
             REPLACE codcli WITH tccodigonuevo
             UNLOCK IN clicav
          ELSE
             llcambiado = .F.
             EXIT
          ENDIF
       ENDIF
    ENDSCAN
 ENDIF
 IF llcambiado
    SELECT clicon
    SCAN
       IF codcli=tccodigoanterior
          IF RLOCK("clicon")
             REPLACE codcli WITH tccodigonuevo
             UNLOCK IN clicon
          ELSE
             llcambiado = .F.
             EXIT
          ENDIF
       ENDIF
    ENDSCAN
 ENDIF
 IF llcambiado
    SELECT cliseslas
    SCAN
       IF codcli=tccodigoanterior
          IF RLOCK("cliseslas")
             REPLACE codcli WITH tccodigonuevo
             UNLOCK IN cliseslas
          ELSE
             llcambiado = .F.
             EXIT
          ENDIF
       ENDIF
    ENDSCAN
 ENDIF
 IF llcambiado
    SELECT albcab
    SCAN
       IF codcli=tccodigoanterior
          IF RLOCK("albcab")
             REPLACE codcli WITH tccodigonuevo
             UNLOCK IN albcab
          ELSE
             llcambiado = .F.
             EXIT
          ENDIF
       ENDIF
    ENDSCAN
 ENDIF
 IF llcambiado
    SELECT clifamilia
    SCAN
       IF codcli=tccodigoanterior
          IF RLOCK("clifamilia")
             REPLACE codcli WITH tccodigonuevo
             UNLOCK IN clifamilia
          ELSE
             llcambiado = .F.
             EXIT
          ENDIF
       ENDIF
    ENDSCAN
 ENDIF
 IF llcambiado
    SELECT clipel
    SCAN
       IF codcli=tccodigoanterior
          IF RLOCK("clipel")
             REPLACE codcli WITH tccodigonuevo
             UNLOCK IN clipel
          ELSE
             llcambiado = .F.
             EXIT
          ENDIF
       ENDIF
    ENDSCAN
 ENDIF
 IF llcambiado
    SELECT email
    SCAN
       IF codcli=tccodigoanterior
          IF RLOCK("email")
             REPLACE codcli WITH tccodigonuevo
             UNLOCK IN email
          ELSE
             llcambiado = .F.
             EXIT
          ENDIF
       ENDIF
    ENDSCAN
 ENDIF
 IF llcambiado
    SELECT planinc
    SCAN
       IF codcli=tccodigoanterior
          IF RLOCK("planinc")
             REPLACE codcli WITH tccodigonuevo
             UNLOCK IN planinc
          ELSE
             llcambiado = .F.
             EXIT
          ENDIF
       ENDIF
    ENDSCAN
 ENDIF
 IF llcambiado
    SELECT precab
    SCAN
       IF codcli=tccodigoanterior
          IF RLOCK("precab")
             REPLACE codcli WITH tccodigonuevo
             UNLOCK IN precab
          ELSE
             llcambiado = .F.
             EXIT
          ENDIF
       ENDIF
    ENDSCAN
 ENDIF
 IF llcambiado
    SELECT sms
    SCAN
       IF codcli=tccodigoanterior
          IF RLOCK("sms")
             REPLACE codcli WITH tccodigonuevo
             UNLOCK IN sms
          ELSE
             llcambiado = .F.
             EXIT
          ENDIF
       ENDIF
    ENDSCAN
 ENDIF
 IF llcambiado
    END TRANSACTION
 ELSE
    ROLLBACK
 ENDIF
 IF  .NOT. llclientesabierta
    USE IN clientes
 ENDIF
 IF  .NOT. llfaccababierta
    USE IN faccab
 ENDIF
 IF  .NOT. llfaccabperabierta
    USE IN faccabper
 ENDIF
 IF  .NOT. llcarcliabierta
    USE IN carcli
 ENDIF
 IF  .NOT. llbonoscliabierta
    USE IN bonoscli
 ENDIF
 IF  .NOT. llplanificadorabierta
    USE IN plan2009
 ENDIF
 IF  .NOT. llagendaabierta
    USE IN agenda
 ENDIF
 IF  .NOT. lllopdabierta
    USE IN clilopd
 ENDIF
 IF  .NOT. llpesoabierta
    USE IN clipeso
 ENDIF
 IF  .NOT. lltratamientosabierta
    USE IN clitra
 ENDIF
 IF  .NOT. llclicavabierta
    USE IN clicav
 ENDIF
 IF  .NOT. llcliconabierta
    USE IN clicon
 ENDIF
 IF  .NOT. llcliseslasabierta
    USE IN cliseslas
 ENDIF
 IF  .NOT. llalbcababierta
    USE IN albcab
 ENDIF
 IF  .NOT. llclifamiliaabierta
    USE IN clifamilia
 ENDIF
 IF  .NOT. llclipelabierta
    USE IN clipel
 ENDIF
 IF  .NOT. llemailabierta
    USE IN email
 ENDIF
 IF  .NOT. llplanincabierta
    USE IN planinc
 ENDIF
 IF  .NOT. llprecababierta
    USE IN precab
 ENDIF
 IF  .NOT. llsmsabierta
    USE IN sms
 ENDIF
 TRY
    = SuiteAfterEntitySave("clientes", tccodigonuevo, "UPD")
 CATCH
 ENDTRY
 RETURN (llcambiado)
ENDFUNC
**
FUNCTION Cambia_Codigo_Proveedor
 PARAMETER tccodigoanterior, tccodigonuevo
 LOCAL llcambiado, llproveedorabierta, llalbprocabierta, llarticulosabierta, llpedprocabierta, llfacprocabierta
 llcambiado = .T.
 llproveedorabierta = .F.
 llalbprocabierta = .F.
 llarticulosabierta = .F.
 llpedprocabierta = .F.
 llfacprocabierta = .F.
 llcarproabierta = .F.
 IF  .NOT. USED("Proveedor")
    USE SHARED dbf/Proveedor AGAIN ALIAS proveedor IN 0
 ELSE
    llproveedorabierta = .T.
 ENDIF
 SELECT proveedor
 SET ORDER TO codpro
 IF SEEK(tccodigonuevo)
    IF  .NOT. llproveedorabierta
       USE IN proveedor
    ENDIF
    _messagebox(traducir(pcidioma, "El nuevo c�digo ya existe"), 48, traducir(pcidioma, "Atenci�n"))
    RETURN .F.
 ENDIF
 IF  .NOT. USED("albproc")
    USE SHARED dbf/albproc AGAIN ALIAS albproc IN 0
 ELSE
    llalbprocabierta = .T.
 ENDIF
 IF  .NOT. USED("articulos")
    USE SHARED dbf/articulos AGAIN ALIAS articulos IN 0
 ELSE
    llarticulosabierta = .T.
 ENDIF
 IF  .NOT. USED("pedproc")
    USE SHARED dbf/pedproc AGAIN ALIAS pedproc IN 0
 ELSE
    llpedprocabierta = .T.
 ENDIF
 IF  .NOT. USED("facproc")
    USE SHARED dbf/facproc AGAIN ALIAS facproc IN 0
 ELSE
    llfacprocabierta = .T.
 ENDIF
 IF  .NOT. USED("carpro")
    USE SHARED dbf/carpro AGAIN ALIAS carpro IN 0
 ELSE
    llcarproabierta = .T.
 ENDIF
 BEGIN TRANSACTION
 SELECT proveedor
 SET ORDER TO codpro
 IF SEEK(tccodigoanterior)
    IF RLOCK("Proveedor")
       REPLACE codpro WITH tccodigonuevo
       UNLOCK IN proveedor
    ELSE
       llcambiado = .F.
    ENDIF
 ELSE
    llcambiado = .F.
 ENDIF
 IF llcambiado
    SELECT ejealb, seralb, numalb FROM albproc WHERE codpro=tccodigoanterior INTO CURSOR tmpAlbproc
    SELECT albproc
    SET ORDER TO numalb
    SELECT tmpalbproc
    SCAN
       SELECT albproc
       IF SEEK(STR(tmpalbproc.ejealb, 4)+tmpalbproc.seralb+STR(tmpalbproc.numalb, 10))
          IF RLOCK("albproc")
             REPLACE codpro WITH tccodigonuevo
             UNLOCK IN albproc
          ELSE
             llcambiado = .F.
             EXIT
          ENDIF
       ELSE
          llcambiado = .F.
          EXIT
       ENDIF
    ENDSCAN
    USE IN tmpalbproc
 ENDIF
 IF llcambiado
    SELECT codart FROM articulos WHERE codpro=tccodigoanterior INTO CURSOR tmpArticulos
    SELECT articulos
    SET ORDER TO codart
    SELECT tmparticulos
    SCAN
       SELECT articulos
       IF SEEK(tmparticulos.codart)
          IF RLOCK("articulos")
             REPLACE codpro WITH tccodigonuevo
             UNLOCK IN articulos
          ELSE
             llcambiado = .F.
             EXIT
          ENDIF
       ELSE
          llcambiado = .F.
          EXIT
       ENDIF
    ENDSCAN
    USE IN tmparticulos
 ENDIF
 IF llcambiado
    SELECT ejeped, serped, numped FROM pedproc WHERE codpro=tccodigoanterior INTO CURSOR tmppedproc
    SELECT pedproc
    SET ORDER TO numped
    SELECT tmppedproc
    SCAN
       SELECT pedproc
       IF SEEK(STR(tmppedproc.ejeped, 4)+tmppedproc.serped+STR(tmppedproc.numped, 10))
          IF RLOCK("pedproc")
             REPLACE codpro WITH tccodigonuevo
             UNLOCK IN pedproc
          ELSE
             llcambiado = .F.
             EXIT
          ENDIF
       ELSE
          llcambiado = .F.
          EXIT
       ENDIF
    ENDSCAN
    USE IN tmppedproc
 ENDIF
 IF llcambiado
    SELECT facproc
    SCAN
       IF codpro=tccodigoanterior
          IF RLOCK("facproc")
             REPLACE codpro WITH tccodigonuevo
             UNLOCK IN facproc
          ELSE
             llcambiado = .F.
             EXIT
          ENDIF
       ENDIF
    ENDSCAN
 ENDIF
 IF llcambiado
    SELECT carpro
    SCAN
       IF codpro=tccodigoanterior
          IF RLOCK("carpro")
             REPLACE codpro WITH tccodigonuevo
             UNLOCK IN carpro
          ELSE
             llcambiado = .F.
             EXIT
          ENDIF
       ENDIF
    ENDSCAN
 ENDIF
 IF llcambiado
    END TRANSACTION
 ELSE
    ROLLBACK
 ENDIF
 IF  .NOT. llproveedorabierta
    USE IN proveedor
 ENDIF
 IF  .NOT. llalbprocabierta
    USE IN albproc
 ENDIF
 IF  .NOT. llarticulosabierta
    USE IN articulos
 ENDIF
 IF  .NOT. llpedprocabierta
    USE IN pedproc
 ENDIF
 IF  .NOT. llfacprocabierta
    USE IN facproc
 ENDIF
 IF  .NOT. llcarproabierta
    USE IN carpro
 ENDIF
 RETURN (llcambiado)
ENDFUNC
**
FUNCTION Cambia_Codigo_Articulo
 PARAMETER tccodigoanterior, tccodigonuevo
 LOCAL llcambiado, llarticulosabierta, llalbprolabierta, llfaclinabierta, llpedprolabierta, llkitsabierta, llbonosartabierta, llempartabierta, llfacprolabierta, llmenudetabierta, llticketprelabierta, llgaslinabierta, llnumserabierta
 llcambiado = .T.
 llarticulosabierta = .F.
 llalbprolabierta = .F.
 llfaclinabierta = .F.
 llfaclinperabierta = .F.
 llpedprolabierta = .F.
 llkitsabierta = .F.
 llbonosartabierta = .F.
 llbonosart1abierta = .F.
 llbonosart2abierta = .F.
 llempartabierta = .F.
 llfacprolabierta = .F.
 llplanificadorabierta = .F.
 llmenudetabierta = .F.
 llticketprelabierta = .F.
 llgaslinabierta = .F.
 llplanartabierta = .F.
 llcbarrasabierta = .F.
 lltallasartabierta = .F.
 llofertasartabierta = .F.
 llnumserabierta = .F.
 IF  .NOT. USED("Articulos")
    USE SHARED dbf/Articulos AGAIN ALIAS articulos IN 0
 ELSE
    llarticulosabierta = .T.
 ENDIF
 SELECT articulos
 SET ORDER TO codart
 IF SEEK(tccodigonuevo)
    IF  .NOT. llarticulosabierta
       USE IN articulos
    ENDIF
    _messagebox(traducir(pcidioma, "El nuevo c�digo ya existe"), 48, traducir(pcidioma, "Atenci�n"))
    RETURN .F.
 ENDIF
 IF  .NOT. USED("cbarras")
    USE SHARED dbf/cbarras AGAIN ALIAS cbarras IN 0
 ELSE
    llcbarrasabierta = .T.
 ENDIF
 IF  .NOT. USED("Albprol")
    USE SHARED dbf/Albprol AGAIN ALIAS albprol IN 0
 ELSE
    llalbprolabierta = .T.
 ENDIF
 IF  .NOT. USED("faclin")
    USE SHARED dbf/faclin AGAIN ALIAS faclin IN 0
 ELSE
    llfaclinabierta = .T.
 ENDIF
 IF  .NOT. USED("faclinper")
    USE SHARED dbf/faclinper AGAIN ALIAS faclinper IN 0
 ELSE
    llfaclinperabierta = .T.
 ENDIF
 IF  .NOT. USED("pedprol")
    USE SHARED dbf/pedprol AGAIN ALIAS pedprol IN 0
 ELSE
    llpedprolabierta = .T.
 ENDIF
 IF  .NOT. USED("Kits")
    USE SHARED dbf/Kits AGAIN ALIAS kits IN 0
 ELSE
    llkitsabierta = .T.
 ENDIF
 IF  .NOT. USED("bonosart")
    USE SHARED dbf/bonosart AGAIN ALIAS bonosart IN 0
 ELSE
    llbonosartabierta = .T.
 ENDIF
 IF  .NOT. USED("bonosart1")
    USE SHARED dbf/bonosart1 AGAIN ALIAS bonosart1 IN 0
 ELSE
    llbonosart1abierta = .T.
 ENDIF
 IF  .NOT. USED("bonosart2")
    USE SHARED dbf/bonosart2 AGAIN ALIAS bonosart2 IN 0
 ELSE
    llbonosart2abierta = .T.
 ENDIF
 IF  .NOT. USED("empart")
    USE SHARED dbf/empart AGAIN ALIAS empart IN 0
 ELSE
    llempartabierta = .T.
 ENDIF
 IF  .NOT. USED("facprol")
    USE SHARED dbf/facprol AGAIN ALIAS facprol IN 0
 ELSE
    llfacprolabierta = .T.
 ENDIF
 IF  .NOT. USED("menudet")
    USE SHARED dbf/menudet AGAIN ALIAS menudet IN 0
 ELSE
    llmenudetabierta = .T.
 ENDIF
 IF  .NOT. USED("gaslin")
    USE SHARED dbf/gaslin AGAIN ALIAS gaslin IN 0
 ELSE
    llgaslinabierta = .T.
 ENDIF
 IF  .NOT. USED("ticketprel")
    USE SHARED dbf/ticketprel AGAIN ALIAS ticketprel IN 0
 ELSE
    llticketprelabierta = .T.
 ENDIF
 IF  .NOT. USED("planart")
    USE SHARED dbf/planart AGAIN ALIAS planart IN 0
 ELSE
    llplanartabierta = .T.
 ENDIF
 IF  .NOT. USED("tallasart")
    USE SHARED dbf/tallasart AGAIN ALIAS tallasart IN 0
 ELSE
    lltallasartabierta = .T.
 ENDIF
 IF  .NOT. USED("ofertasart")
    USE SHARED dbf/ofertasart AGAIN ALIAS ofertasart IN 0
 ELSE
    llofertasartabierta = .T.
 ENDIF
 IF  .NOT. USED("numser")
    USE SHARED dbf/numser AGAIN ALIAS numser IN 0
 ELSE
    llnumserabierta = .T.
 ENDIF
 BEGIN TRANSACTION
 SELECT articulos
 SET ORDER TO codart
 IF SEEK(tccodigoanterior)
    IF RLOCK("Articulos")
       REPLACE codart WITH tccodigonuevo
    ELSE
       llcambiado = .F.
    ENDIF
 ELSE
    llcambiado = .F.
 ENDIF
 IF llcambiado
    SELECT ejealb, seralb, numalb, linalb FROM albprol WHERE codart=tccodigoanterior INTO CURSOR tmpAlbprol
    SELECT albprol
    SET ORDER TO linalb
    SELECT tmpalbprol
    SCAN
       SELECT albprol
       IF SEEK(STR(tmpalbprol.ejealb, 4)+tmpalbprol.seralb+STR(tmpalbprol.numalb, 10)+STR(tmpalbprol.linalb, 5))
          IF RLOCK("albprol")
             REPLACE codart WITH tccodigonuevo
             UNLOCK IN albprol
          ELSE
             llcambiado = .F.
             EXIT
          ENDIF
       ELSE
          llcambiado = .F.
          EXIT
       ENDIF
    ENDSCAN
    USE IN tmpalbprol
 ENDIF
 IF llcambiado
    SELECT codart, idgrupo, idtalla, idcolor FROM tallasart WHERE codart=tccodigoanterior INTO CURSOR tmptallasart
    SELECT tallasart
    SET ORDER TO codart
    SELECT tmptallasart
    SCAN
       SELECT tallasart
       IF SEEK(tmptallasart.codart+tmptallasart.idgrupo+tmptallasart.idtalla+tmptallasart.idcolor)
          IF RLOCK("tallasart")
             REPLACE codart WITH tccodigonuevo
          ELSE
             llcambiado = .F.
             EXIT
          ENDIF
       ELSE
          llcambiado = .F.
          EXIT
       ENDIF
    ENDSCAN
    USE IN tmptallasart
 ENDIF
 IF llcambiado
    SELECT codart, codartdos FROM cbarras WHERE codart=tccodigoanterior INTO CURSOR tmpcbarras
    SELECT cbarras
    SET ORDER TO codart
    SELECT tmpcbarras
    SCAN
       SELECT cbarras
       IF SEEK(tmpcbarras.codart+tmpcbarras.codartdos)
          IF RLOCK("cbarras")
             REPLACE codart WITH tccodigonuevo
          ELSE
             llcambiado = .F.
             EXIT
          ENDIF
       ELSE
          llcambiado = .F.
          EXIT
       ENDIF
    ENDSCAN
    USE IN tmpcbarras
 ENDIF
 IF llcambiado
    SELECT ejefac, serfac, numfac, linfac FROM faclin WHERE codart=tccodigoanterior INTO CURSOR tmpfaclin
    SELECT faclin
    SET ORDER TO linfac
    SELECT tmpfaclin
    SCAN
       SELECT faclin
       IF SEEK(STR(tmpfaclin.ejefac, 4)+tmpfaclin.serfac+STR(tmpfaclin.numfac, 10)+STR(tmpfaclin.linfac, 5))
          IF RLOCK("faclin")
             REPLACE codart WITH tccodigonuevo
             UNLOCK IN faclin
          ELSE
             llcambiado = .F.
             EXIT
          ENDIF
       ELSE
          llcambiado = .F.
          EXIT
       ENDIF
    ENDSCAN
    USE IN tmpfaclin
 ENDIF
 IF llcambiado
    SELECT numfac, linfac FROM faclinper WHERE codart=tccodigoanterior INTO CURSOR tmpfaclinper
    SELECT faclinper
    SET ORDER TO linfac
    SELECT tmpfaclinper
    SCAN
       SELECT faclinper
       IF SEEK(STR(tmpfaclinper.numfac, 10)+STR(tmpfaclinper.linfac, 5))
          IF RLOCK("faclinper")
             REPLACE codart WITH tccodigonuevo
             UNLOCK IN faclinper
          ELSE
             llcambiado = .F.
             EXIT
          ENDIF
       ELSE
          llcambiado = .F.
          EXIT
       ENDIF
    ENDSCAN
    USE IN tmpfaclinper
 ENDIF
 IF llcambiado
    SELECT ejeped, serped, numped, linped FROM pedprol WHERE codart=tccodigoanterior INTO CURSOR tmppedprol
    SELECT pedprol
    SET ORDER TO linped
    SELECT tmppedprol
    SCAN
       SELECT pedprol
       IF SEEK(STR(tmppedprol.ejeped, 4)+tmppedprol.serped+STR(tmppedprol.numped, 10)+STR(tmppedprol.linped, 5))
          IF RLOCK("pedprol")
             REPLACE codart WITH tccodigonuevo
             UNLOCK IN pedprol
          ELSE
             llcambiado = .F.
             EXIT
          ENDIF
       ELSE
          llcambiado = .F.
          EXIT
       ENDIF
    ENDSCAN
    USE IN tmppedprol
 ENDIF
 IF llcambiado
    SELECT codart1, codart2 FROM kits WHERE codart1=tccodigoanterior OR codart2=tccodigoanterior INTO CURSOR tmpKits
    SELECT kits
    SET ORDER TO codart12
    SELECT tmpkits
    SCAN
       SELECT kits
       IF SEEK(tmpkits.codart1+tmpkits.codart2)
          IF RLOCK("kits")
             IF codart1=tccodigoanterior
                REPLACE codart1 WITH tccodigonuevo
                UNLOCK IN kits
             ENDIF
             IF codart2=tccodigoanterior
                REPLACE codart2 WITH tccodigonuevo
             ENDIF
          ELSE
             llcambiado = .F.
             EXIT
          ENDIF
       ELSE
          llcambiado = .F.
          EXIT
       ENDIF
    ENDSCAN
    USE IN tmpkits
 ENDIF
 IF llcambiado
    SELECT bonosart
    SCAN
       IF codart=tccodigoanterior
          IF RLOCK("bonosart")
             REPLACE codart WITH tccodigonuevo
             UNLOCK IN bonosart
          ELSE
             llcambiado = .F.
             EXIT
          ENDIF
       ENDIF
    ENDSCAN
 ENDIF
 IF llcambiado
    SELECT bonosart1
    SCAN
       IF codart=tccodigoanterior
          IF RLOCK("bonosart1")
             REPLACE codart WITH tccodigonuevo
             UNLOCK IN bonosart1
          ELSE
             llcambiado = .F.
             EXIT
          ENDIF
       ENDIF
    ENDSCAN
 ENDIF
 IF llcambiado
    SELECT bonosart2
    SCAN
       IF codart=tccodigoanterior
          IF RLOCK("bonosart2")
             REPLACE codart WITH tccodigonuevo
             UNLOCK IN bonosart2
          ELSE
             llcambiado = .F.
             EXIT
          ENDIF
       ENDIF
    ENDSCAN
 ENDIF
 IF llcambiado
    SELECT empart
    SCAN
       IF codart=tccodigoanterior
          IF RLOCK("empart")
             REPLACE codart WITH tccodigonuevo
             UNLOCK IN empart
          ELSE
             llcambiado = .F.
             EXIT
          ENDIF
       ENDIF
    ENDSCAN
 ENDIF
 IF llcambiado
    SELECT facprol
    SCAN
       IF codart=tccodigoanterior
          IF RLOCK("facprol")
             REPLACE codart WITH tccodigonuevo
             UNLOCK IN facprol
          ELSE
             llcambiado = .F.
             EXIT
          ENDIF
       ENDIF
    ENDSCAN
 ENDIF
 IF llcambiado
    SELECT gaslin
    SCAN
       IF codart=tccodigoanterior
          IF RLOCK("gaslin")
             REPLACE codart WITH tccodigonuevo
             UNLOCK IN gaslin
          ELSE
             llcambiado = .F.
             EXIT
          ENDIF
       ENDIF
    ENDSCAN
 ENDIF
 IF llcambiado
    SELECT ticketprel
    SCAN
       IF codart=tccodigoanterior
          IF RLOCK("ticketprel")
             REPLACE codart WITH tccodigonuevo
             UNLOCK IN ticketprel
          ELSE
             llcambiado = .F.
             EXIT
          ENDIF
       ENDIF
    ENDSCAN
 ENDIF
 IF llcambiado
    SELECT menudet
    SCAN
       IF codart=tccodigoanterior
          IF RLOCK("MenuDet")
             REPLACE codart WITH tccodigonuevo
             UNLOCK IN menudet
          ELSE
             llcambiado = .F.
             EXIT
          ENDIF
       ENDIF
    ENDSCAN
 ENDIF
 IF llcambiado
    SELECT planart
    SCAN
       IF codart=tccodigoanterior
          IF RLOCK("planart")
             REPLACE codart WITH tccodigonuevo
             UNLOCK IN planart
          ELSE
             llcambiado = .F.
             EXIT
          ENDIF
       ENDIF
    ENDSCAN
 ENDIF
 IF llcambiado
    SELECT ofertasart
    SCAN
       IF codart=tccodigoanterior
          IF RLOCK("ofertasart")
             REPLACE codart WITH tccodigonuevo
             UNLOCK IN ofertasart
          ELSE
             llcambiado = .F.
             EXIT
          ENDIF
       ENDIF
    ENDSCAN
 ENDIF
 IF llcambiado
    SELECT numser
    SCAN
       IF codart=tccodigoanterior
          IF RLOCK("numser")
             REPLACE codart WITH tccodigonuevo
             UNLOCK IN numser
          ELSE
             llcambiado = .F.
             EXIT
          ENDIF
       ENDIF
    ENDSCAN
 ENDIF
 IF llcambiado
    END TRANSACTION
 ELSE
    ROLLBACK
 ENDIF
 IF  .NOT. llcbarrasabierta
    USE IN cbarras
 ENDIF
 IF  .NOT. llarticulosabierta
    USE IN articulos
 ENDIF
 IF  .NOT. llalbprolabierta
    USE IN albprol
 ENDIF
 IF  .NOT. llfaclinabierta
    USE IN faclin
 ENDIF
 IF  .NOT. llfaclinperabierta
    USE IN faclinper
 ENDIF
 IF  .NOT. llpedprolabierta
    USE IN pedprol
 ENDIF
 IF  .NOT. llkitsabierta
    USE IN kits
 ENDIF
 IF  .NOT. llbonosartabierta
    USE IN bonosart
 ENDIF
 IF  .NOT. llbonosart1abierta
    USE IN bonosart1
 ENDIF
 IF  .NOT. llbonosart2abierta
    USE IN bonosart2
 ENDIF
 IF  .NOT. llempartabierta
    USE IN empart
 ENDIF
 IF  .NOT. llfacprolabierta
    USE IN facprol
 ENDIF
 IF  .NOT. llmenudetabierta
    USE IN menudet
 ENDIF
 IF  .NOT. llticketprelabierta
    USE IN ticketprel
 ENDIF
 IF  .NOT. llgaslinabierta
    USE IN gaslin
 ENDIF
 IF  .NOT. llplanartabierta
    USE IN planart
 ENDIF
 IF  .NOT. lltallasartabierta
    USE IN tallasart
 ENDIF
 IF  .NOT. llofertasartabierta
    USE IN ofertasart
 ENDIF
 IF  .NOT. llnumserabierta
    USE IN numser
 ENDIF
 TRY
    = SuiteAfterEntitySave("articulos", tccodigonuevo, "UPD")
 CATCH
 ENDTRY
 RETURN (llcambiado)
ENDFUNC
**
FUNCTION ShellExec
 LPARAMETERS lclink, lcaction, lcparms, lcdirectorio
 IF PCOUNT()<4
    lcdirectorio = SYS(2023)
 ENDIF
 lcaction = IIF(EMPTY(lcaction), "Open", lcaction)
 lcparms = IIF(EMPTY(lcparms), "", lcparms)
 DECLARE INTEGER ShellExecute IN SHELL32.dll INTEGER, STRING, STRING, STRING, STRING, INTEGER
 DECLARE INTEGER FindWindow IN WIN32API STRING, STRING
 RETURN shellexecute(findwindow(0, _SCREEN.caption), lcaction, lclink, lcparms, lcdirectorio, 1)
ENDFUNC
**
FUNCTION SetPrintto
 PARAMETER tcnombrereport, tctipoimpresora, tcnombreimpresora
 IF PCOUNT()<3
    tcnombreimpresora = ""
 ENDIF
 IF APRINTERS(alcprinters)=0
    _messagebox(traducir(pcidioma, "No hay ninguna impresora instalada.")+CHR(13)+CHR(13)+traducir(pcidioma, "Por favor instale las impresoras en el Panel de Control")+CHR(13)+traducir(pcidioma, "de Windows y vuelva a intentar la operaci�n."), 48, traducir(pcidioma, "Impresoras"))
    RETURN (.F.)
 ENDIF
 LOCAL lcoldselect, lcoldreprocess, lcalias, llnoimpresoras
 lcoldselect = SELECT()
 llnoimpresoras = .F.
 IF  .NOT. USED("impresoras")
    llnoimpresoras = .T.
    USE SHARED dbf/impresoras AGAIN IN 0
 ENDIF
 tcnombrereport = ALLTRIM(tcnombrereport)
 SET PRINTER TO NAME ""
 IF EMPTY(tcnombreimpresora)
    cambiarimpresora("999999999999999")
    DO CASE
       CASE tctipoimpresora="T"
          tcnombreimpresora = ALLTRIM(impresoras.impresora1)
       CASE tctipoimpresora="L"
          tcnombreimpresora = ALLTRIM(impresoras.impresora2)
    ENDCASE
 ENDIF
 LOCAL laimpr, lnnumimp, llimpresoraok
 DIMENSION laimpr(1)
 llimpresoraok = .F.
 IF  .NOT. EMPTY(tcnombreimpresora)
    lnnumimp = APRINTERS(laimpr)
    FOR i = 1 TO lnnumimp
       IF UPPER(laimpr(i, 1))=UPPER(tcnombreimpresora)
          llimpresoraok = .T.
          EXIT
       ENDIF
    ENDFOR
    IF  .NOT. llimpresoraok
       tcnombreimpresora = ""
    ENDIF
 ENDIF
 IF EMPTY(tcnombreimpresora)
    tcnombreimpresora = GETPRINTER()
 ENDIF
 IF  .NOT. EMPTY(tcnombreimpresora)
    SET PRINTER TO NAME ALLTRIM(tcnombreimpresora)
    lcoldreprocess = SET("REPROCESS")
    SET REPROCESS TO -1
    SELECT 0
    IF AT(".frx", tcnombrereport)<>0
       USE SHARED (tcnombrereport)
    ELSE
       USE SHARED (tcnombrereport+".frx")
    ENDIF
    LOCK()
    REPLACE tag WITH ""
    REPLACE tag2 WITH ""
    USE
    SET REPROCESS TO (lcoldreprocess)
 ENDIF
 IF llnoimpresoras
    USE IN impresoras
 ENDIF
 SELECT (lcoldselect)
 RETURN ( .NOT. EMPTY(tcnombreimpresora))
ENDFUNC
**
FUNCTION Importar_Codigos_Postales
 LOCAL llcambiado, llarticulosabierta, llalbprolabierta, llfaclinabierta, llpedprolabierta, llkitsabierta
 llcambiado = .T.
 llcodposabierta = .F.
 TRY
    IF  .NOT. USED("CODPOS")
       USE SHARED dbf/codpos AGAIN ALIAS codpos IN 0
    ELSE
       llcodposabierta = .T.
    ENDIF
    IF USED("CODPOSIMPX")
       USE IN codposimpx
    ENDIF
    USE SHARED cpostales/codpos AGAIN ALIAS codposimpx IN 0
 CATCH TO oerr
    llcambiado = .F.
    _messagebox(traducir(pcidioma, "Error al importar c�digos postales.")+CHR(13)+oerr.message, 48, traducir(pcidioma, "Atenci�n"))
 ENDTRY
 IF llcambiado
    SELECT * FROM codposimpX WHERE idpais=pcpais INTO CURSOR codposimp
    TRY
       BEGIN TRANSACTION
       SELECT codpos
       SET ORDER TO cp
       SELECT codposimp
       SCAN
          SELECT codpos
          IF  .NOT. SEEK(codposimp.codpos+codposimp.poblacion+codposimp.provincia+codposimp.asenta)
             INSERT INTO codpos (codpos, poblacion, provincia, asenta) VALUES (codposimp.codpos, codposimp.poblacion, codposimp.provincia, codposimp.asenta)
          ENDIF
       ENDSCAN
       END TRANSACTION
    CATCH TO oerr
       llcambiado = .F.
       ROLLBACK
       _messagebox(traducir(pcidioma, "Error al importar c�digos postales.")+CHR(13)+oerr.message, 48, traducir(pcidioma, "Atenci�n"))
    ENDTRY
 ENDIF
 IF  .NOT. llcodposabierta .AND. USED("codpos")
    USE IN codpos
 ENDIF
 IF USED("codposimpx")
    USE IN codposimpx
 ENDIF
 IF USED("codposimp")
    USE IN codposimp
 ENDIF
 RETURN (llcambiado)
ENDFUNC
**
FUNCTION Importar_edadpeso
 LOCAL llcambiado, llarticulosabierta, llalbprolabierta, llfaclinabierta, llpedprolabierta, llkitsabierta
 llcambiado = .T.
 llcodposabierta = .F.
 TRY
    IF  .NOT. USED("EDADPESO")
       USE SHARED dbf/EDADPESO AGAIN ALIAS edadpeso IN 0
    ELSE
       llcodposabierta = .T.
    ENDIF
    IF USED("EDADPESOIMP")
       USE IN edadpesoimp
    ENDIF
    USE SHARED cpostales/EDADPESO AGAIN ALIAS edadpesoimp IN 0
 CATCH TO oerr
    llcambiado = .F.
    _messagebox(traducir(pcidioma, "Error al importar parametros 1.")+CHR(13)+oerr.message, 48, traducir(pcidioma, "Atenci�n"))
 ENDTRY
 IF llcambiado
    TRY
       BEGIN TRANSACTION
       SELECT edadpeso
       SET ORDER TO edad
       SELECT edadpesoimp
       SCAN
          SELECT edadpeso
          IF  .NOT. SEEK(STR(edadpesoimp.edad, 3)+edadpesoimp.sexo)
             INSERT INTO EDADPESO (edad, sexo, correc) VALUES (edadpesoimp.edad, edadpesoimp.sexo, edadpesoimp.correc)
          ENDIF
       ENDSCAN
       END TRANSACTION
    CATCH TO oerr
       llcambiado = .F.
       ROLLBACK
       _messagebox(traducir(pcidioma, "Error al importar parametros 1.")+CHR(13)+oerr.message, 48, traducir(pcidioma, "Atenci�n"))
    ENDTRY
 ENDIF
 IF  .NOT. llcodposabierta .AND. USED("EDADPESO")
    USE IN edadpeso
 ENDIF
 IF USED("EDADPESOIMP")
    USE IN edadpesoimp
 ENDIF
 RETURN (llcambiado)
ENDFUNC
**
FUNCTION Importar_altpeso
 llcambiado = .T.
 llcodposabierta = .F.
 TRY
    IF  .NOT. USED("ALTPESO")
       USE SHARED dbf/ALTPESO AGAIN ALIAS altpeso IN 0
    ELSE
       llcodposabierta = .T.
    ENDIF
    IF USED("ALTPESOIMP")
       USE IN altpesoimp
    ENDIF
    USE SHARED cpostales/ALTPESO AGAIN ALIAS altpesoimp IN 0
 CATCH TO oerr
    llcambiado = .F.
    _messagebox(traducir(pcidioma, "Error al importar parametros 2.")+CHR(13)+oerr.message, 48, traducir(pcidioma, "Atenci�n"))
 ENDTRY
 IF llcambiado
    TRY
       BEGIN TRANSACTION
       SELECT altpeso
       SET ORDER TO altura
       SELECT altpesoimp
       SCAN
          SELECT altpeso
          IF  .NOT. SEEK(altpesoimp.altura)
             INSERT INTO ALTPESO (altura, peso) VALUES (altpesoimp.altura, altpesoimp.peso)
          ENDIF
       ENDSCAN
       END TRANSACTION
    CATCH TO oerr
       llcambiado = .F.
       ROLLBACK
       _messagebox(traducir(pcidioma, "Error al importar parametros 2.")+CHR(13)+oerr.message, 48, traducir(pcidioma, "Atenci�n"))
    ENDTRY
 ENDIF
 IF  .NOT. llcodposabierta .AND. USED("ALTPESO")
    USE IN altpeso
 ENDIF
 IF USED("ALTPESOIMP")
    USE IN altpesoimp
 ENDIF
 RETURN (llcambiado)
ENDFUNC
**
FUNCTION CalculaComision
 PARAMETER tccodemp, tccodart, tlsinmensajes, tcmensajeerror
 IF PCOUNT()<3
    tlsinmensajes = .F.
    tcmensajeerror = ""
 ENDIF
 LOCAL lcalias, lnrecnofamilia, llabiertaempart, llabiertaempfam, llabiertafamilia1, llabiertaempleados, llabiertaarticulos, lcordenempfam, lnrecnoempfam, lcordenempart, lnrecnoempart, lcordenfamilia1, lnrecnofamilia1, lcordenempleados, lnrecnoempleados, lcordenarticulos, lnrecnoarticulos, lncomision
 IF EMPTY(tccodemp) .OR. EMPTY(tccodart)
    IF tlsinmensajes
       tcmensajeerror = traducir(pcidioma, "No se ha indicado el Empleado o el Art�culo")
    ELSE
       _messagebox(traducir(pcidioma, "No se ha indicado el Empleado o el Art�culo"), 48, traducir(pcidioma, "Atenci�n"))
    ENDIF
    RETURN 0
 ENDIF
 tccodemp = PADR(tccodemp, 15, " ")
 tccodart = PADR(tccodart, 15, " ")
 lncomision = 0
 llabiertaempfam = .F.
 lcordenempfam = ""
 lnrecnoempfam = 0
 llabiertaempart = .F.
 lcordenempart = ""
 lnrecnoempart = 0
 llabiertafamilia1 = .F.
 lcordenfamilia1 = ""
 lnrecnofamilia1 = 0
 llabiertaempleados = .F.
 lcordenempleados = ""
 lnrecnoempleados = 0
 llabiertaarticulos = .F.
 lcordenarticulos = ""
 lnrecnoarticulos = 0
 lcalias = SELECT()
 IF  .NOT. USED("empart")
    USE SHARED dbf/empart AGAIN ALIAS empart IN 0
 ELSE
    SELECT empart
    llabiertaempart = .T.
    lcordenempart = ORDER()
    IF  .NOT. EOF()
       lnrecnoempart = RECNO()
    ENDIF
 ENDIF
 IF  .NOT. USED("empfam")
    USE SHARED dbf/empfam AGAIN ALIAS empfam IN 0
 ELSE
    SELECT empfam
    llabiertaempfam = .T.
    lcordenempfam = ORDER()
    IF  .NOT. EOF()
       lnrecnoempfam = RECNO()
    ENDIF
 ENDIF
 IF  .NOT. USED("familia1")
    USE SHARED dbf/familia1 AGAIN ALIAS familia1 IN 0
 ELSE
    SELECT familia1
    llabiertafamilia1 = .T.
    lcordenfamilia1 = ORDER()
    IF  .NOT. EOF()
       lnrecnofamilia1 = RECNO()
    ENDIF
 ENDIF
 IF  .NOT. USED("Empleados")
    USE SHARED dbf/Empleados AGAIN ALIAS empleados IN 0
 ELSE
    SELECT empleados
    llabiertaempleados = .T.
    lcordenempleados = ORDER()
    IF  .NOT. EOF()
       lnrecnoempleados = RECNO()
    ENDIF
 ENDIF
 IF  .NOT. USED("Articulos")
    USE SHARED dbf/Articulos AGAIN ALIAS articulos IN 0
 ELSE
    SELECT articulos
    llabiertaarticulos = .T.
    lcordenarticulos = ORDER()
    IF  .NOT. EOF()
       lnrecnoarticulos = RECNO()
    ENDIF
 ENDIF
 SELECT empart
 SET ORDER TO EmpArt
 IF SEEK(tccodemp+tccodart)
    lncomision = empart.comision
 ELSE
    SELECT articulos
    SET ORDER TO codart
    IF SEEK(tccodart)
       SELECT empfam
       SET ORDER TO empfam
       IF  .NOT. EMPTY(articulos.familia1) .AND. SEEK(tccodemp+articulos.familia1)
          lncomision = empfam.comision
       ELSE
          SELECT empleados
          SET ORDER TO codemp
          IF SEEK(tccodemp)
             lncomision = empleados.comision
          ENDIF
       ENDIF
    ENDIF
 ENDIF
 IF USED("Empleados")
    IF  .NOT. llabiertaempleados
       USE IN empleados
    ELSE
       SELECT empleados
       SET ORDER TO &lcordenempleados
       IF lnrecnoempleados<>0
          GOTO lnrecnoempleados
       ENDIF
    ENDIF
 ENDIF
 IF USED("EmpArt")
    IF  .NOT. llabiertaempart
       USE IN empart
    ELSE
       SELECT empart
       SET ORDER TO &lcordenempart
       IF lnrecnoempart<>0
          GOTO lnrecnoempart
       ENDIF
    ENDIF
 ENDIF
 IF USED("EmpFam")
    IF  .NOT. llabiertaempfam
       USE IN empfam
    ELSE
       SELECT empfam
       SET ORDER TO &lcordenempfam
       IF lnrecnoempfam<>0
          GOTO lnrecnoempfam
       ENDIF
    ENDIF
 ENDIF
 IF USED("Familia1")
    IF  .NOT. llabiertafamilia1
       USE IN familia1
    ELSE
       SELECT familia1
       SET ORDER TO &lcordenfamilia1
       IF lnrecnofamilia1<>0
          GOTO lnrecnofamilia1
       ENDIF
    ENDIF
 ENDIF
 IF USED("Articulos")
    IF  .NOT. llabiertaarticulos
       USE IN articulos
    ELSE
       SELECT articulos
       SET ORDER TO &lcordenarticulos
       IF lnrecnoarticulos<>0
          GOTO lnrecnoarticulos
       ENDIF
    ENDIF
 ENDIF
 SELECT (lcalias)
 RETURN (ROUND(lncomision, 2))
ENDFUNC
**
FUNCTION CalcularPVP
 PARAMETER tcarticulo, tncoste, tlnoavisar
 IF PCOUNT()<3
    tlnoavisar = .F.
 ENDIF
 LOCAL lctabla, lcorden, lnrecno, llarticulosenuso, lnpvpa, lnpvpb, lnpvpc, lnpvpd, lnpvpe, llactualizarpvps
 lnpvpa = 0
 lnpvpb = 0
 lnpvpc = 0
 lnpvpd = 0
 lnpvpe = 0
 lctabla = ALIAS()
 lcorden = ORDER()
 llarticulosenuso = .F.
 llactualizarpvps = .T.
 IF  .NOT. EOF()
    lnrecno = RECNO()
 ELSE
    lnrecno = 0
 ENDIF
 IF  .NOT. USED("articulos")
    USE SHARED dbf/articulos AGAIN IN 0
 ELSE
    llarticulosenuso = .T.
 ENDIF
 SELECT articulos
 SET ORDER TO codart
 IF SEEK(tcarticulo)
    IF articulos.pvpvar
       tniva = "CFGIVA"+ALLTRIM(STR(articulos.ivaart))
       DO CASE
          CASE cfgivainccom .AND.  .NOT. cfgivainc
             tncoste = ROUND(( tncoste / ( &tniva + 100 ) ) * 100, cfgredpvp )		
          CASE  .NOT. cfgivainccom .AND. cfgivainc
             tncoste = ROUND( tncoste + ( tncoste * ( &tniva / 100 ) ), cfgredpvp )		
       ENDCASE
       IF  .NOT. cfgmargencalpep
          lnpvpa = ROUND(tncoste+(tncoste*articulos.porpvpa/100), cfgredpvp)
          lnpvpb = ROUND(tncoste+(tncoste*articulos.porpvpb/100), cfgredpvp)
          lnpvpc = ROUND(tncoste+(tncoste*articulos.porpvpc/100), cfgredpvp)
          lnpvpd = ROUND(tncoste+(tncoste*articulos.porpvpd/100), cfgredpvp)
          lnpvpe = ROUND(tncoste+(tncoste*articulos.porpvpe/100), cfgredpvp)
       ELSE
          lnpvpa = ROUND(100*tncoste/(100-articulos.porpvpa), cfgredpvp)
          lnpvpb = ROUND(100*tncoste/(100-articulos.porpvpb), cfgredpvp)
          lnpvpc = ROUND(100*tncoste/(100-articulos.porpvpc), cfgredpvp)
          lnpvpd = ROUND(100*tncoste/(100-articulos.porpvpd), cfgredpvp)
          lnpvpe = ROUND(100*tncoste/(100-articulos.porpvpe), cfgredpvp)
       ENDIF
       IF lnpvpa<>articulos.pvpa .OR. lnpvpb<>articulos.pvpb .OR. lnpvpc<>articulos.pvpc .OR. lnpvpd<>articulos.pvpd .OR. lnpvpe<>articulos.pvpe
          IF articulos.avichgpvp .AND.  .NOT. tlnoavisar
             llactualizarpvps = _messagebox(traducir(pcidioma, "El precio de venta del art�culo '")+ALLTRIM(articulos.desart)+traducir(pcidioma, "' ha cambiado.")+CHR(13)+traducir(pcidioma, "PVPA actual:")+" "+ALLTRIM(STR(articulos.pvpa, 10, cfgredpvp))+"    "+traducir(pcidioma, "PVPA Nuevo:")+" "+ALLTRIM(STR(lnpvpa, 10, cfgredpvp))+CHR(13)+traducir(pcidioma, "PVPB actual:")+" "+ALLTRIM(STR(articulos.pvpb, 10, cfgredpvp))+"    "+traducir(pcidioma, "PVPB Nuevo:")+" "+ALLTRIM(STR(lnpvpb, 10, cfgredpvp))+CHR(13)+traducir(pcidioma, "PVPC actual:")+" "+ALLTRIM(STR(articulos.pvpc, 10, cfgredpvp))+"    "+traducir(pcidioma, "PVPC Nuevo:")+" "+ALLTRIM(STR(lnpvpc, 10, cfgredpvp))+CHR(13)+traducir(pcidioma, "PVPD actual:")+" "+ALLTRIM(STR(articulos.pvpd, 10, cfgredpvp))+"    "+traducir(pcidioma, "PVPD Nuevo:")+" "+ALLTRIM(STR(lnpvpd, 10, cfgredpvp))+CHR(13)+traducir(pcidioma, "PVPE actual:")+" "+ALLTRIM(STR(articulos.pvpe, 10, cfgredpvp))+"    "+traducir(pcidioma, "PVPE Nuevo:")+" "+ALLTRIM(STR(lnpvpe, 10, cfgredpvp))+CHR(13)+CHR(13)+traducir(pcidioma, "�Desea actualizar los nuevos precios de venta?"), 068, traducir(pcidioma, "Atenci�n"))=6
          ENDIF
          IF llactualizarpvps
             SELECT articulos
             REPLACE pvpa WITH lnpvpa, pvpb WITH lnpvpb, pvpc WITH lnpvpc, pvpd WITH lnpvpd, pvpe WITH lnpvpe
          ENDIF
       ENDIF
    ENDIF
 ENDIF
 IF  .NOT. llarticulosenuso
    USE IN articulos
 ENDIF
 IF  .NOT. EMPTY(lctabla)
    SELECT (lctabla)
    SET ORDER TO (lcorden)
    IF lnrecno<>0
       GOTO lnrecno
    ENDIF
 ENDIF
 RETURN .T.
ENDFUNC
**
PROCEDURE ImprimirEtiquetas
 PARAMETER tctipo
 CREATE CURSOR tmpConsulta (codart C (15), codartdos C (20), desart C (100), codpro C (15), coste B (4), familia1 C (10), ivaart N (1), matpri N (1), pvpa B (4), pvpb B (4), pvpc B (4), pvpd B (4), pvpe B (4), stock B (4), cant B (4), pvpaold B (4), pvpbold B (4), pvpcold B (4), pvpdold B (4), pvpeold B (4), numser C (30))
 SELECT articulos
 SET ORDER TO codart
 DO CASE
    CASE tctipo="ALBARAN"
       SELECT albproc
       IF  .NOT. EOF()
          SELECT albprol
          SET ORDER TO linalb
          IF SEEK(STR(albproc.ejealb, 4)+albproc.seralb+STR(albproc.numalb, 10))
             SCAN REST WHILE STR(albprol.ejealb, 4)+albprol.seralb+STR(albprol.numalb, 10)=STR(albproc.ejealb, 4)+albproc.seralb+STR(albproc.numalb, 10)
                SELECT articulos
                IF SEEK(albprol.codart)
                   INSERT INTO tmpConsulta (codart, codartdos, desart, codpro, coste, familia1, ivaart, matpri, pvpa, pvpb, pvpc, pvpd, pvpe, stock, cant, pvpaold, pvpbold, pvpcold, pvpdold, pvpeold, numser) VALUES (articulos.codart, articulos.codartdos, albprol.desart, albproc.codpro, articulos.coste, articulos.familia1, articulos.ivaart, articulos.matpri, articulos.pvpa, articulos.pvpb, articulos.pvpc, articulos.pvpd, articulos.pvpe, articulos.stock, IIF(albprol.canser>0, ROUND(albprol.canser, 0), 000), OLDVAL("pvpa", "articulos"), OLDVAL("pvpb", "articulos"), OLDVAL("pvpc", "articulos"), OLDVAL("pvpd", "articulos"), OLDVAL("pvpe", "articulos"), albprol.numser)
                ENDIF
             ENDSCAN
          ENDIF
       ENDIF
    CASE tctipo="FACTURA"
       SELECT facprol
       SELECT articulos
       SELECT facproc
       IF  .NOT. EOF()
          SELECT facprol
          SET ORDER TO linfacp
          IF SEEK(STR(facproc.ejefacp, 4)+facproc.serfacp+STR(facproc.numfacp, 10))
             SCAN REST WHILE STR(facprol.ejefacp, 4)+facprol.serfacp+STR(facprol.numfacp, 10)=STR(facproc.ejefacp, 4)+facproc.serfacp+STR(facproc.numfacp, 10)
                SELECT articulos
                IF SEEK(facprol.codart)
                   INSERT INTO tmpConsulta (codart, codartdos, desart, codpro, coste, familia1, ivaart, matpri, pvpa, pvpb, pvpc, pvpd, pvpe, stock, cant, pvpaold, pvpbold, pvpcold, pvpdold, pvpeold, numser) VALUES (articulos.codart, articulos.codartdos, facprol.desart, facproc.codpro, articulos.coste, articulos.familia1, articulos.ivaart, articulos.matpri, articulos.pvpa, articulos.pvpb, articulos.pvpc, articulos.pvpd, articulos.pvpe, articulos.stock, IIF(facprol.canser>0, ROUND(facprol.canser, 0), 000), OLDVAL("pvpa", "articulos"), OLDVAL("pvpb", "articulos"), OLDVAL("pvpc", "articulos"), OLDVAL("pvpd", "articulos"), OLDVAL("pvpe", "articulos"), facprol.numser)
                ENDIF
             ENDSCAN
          ENDIF
       ENDIF
 ENDCASE
 SELECT tmpconsulta
 DO FORM impeticom WITH .T.
 USE IN tmpconsulta
ENDPROC
**
PROCEDURE InsertarLOPD
 PARAMETER tcusuario, tcpantalla, tcdescripcion
 LOCAL lctabla, lcorden, lnrecno, lllopdabierta
 lctabla = ALIAS()
 lcorden = ORDER()
 lllopdabierta = .F.
 IF  .NOT. EOF()
    lnrecno = RECNO()
 ELSE
    lnrecno = 0
 ENDIF
 IF  .NOT. USED("lopd")
    USE SHARED DBF/lopd AGAIN IN 0
 ELSE
    lllopdabierta = .T.
 ENDIF
 INSERT INTO lopd (fechahora, codusu, codpan, descrip) VALUES (DATETIME(), tcusuario, tcpantalla, tcdescripcion)
 IF  .NOT. lllopdabierta
    USE IN lopd
 ENDIF
 IF  .NOT. EMPTY(lctabla)
    SELECT (lctabla)
    SET ORDER TO (lcorden)
    IF lnrecno<>0
       GOTO lnrecno
    ENDIF
 ENDIF
ENDPROC
**
FUNCTION Codificar
 PARAMETER string_x
 entrega_x = ""
 IF  .NOT. EMPTY(string_x)
    DIMENSION crip(LEN(string_x))
    FOR i = 1 TO LEN(string_x)
       crip(i) = ASC(SUBSTR(string_x, i, 1))
    ENDFOR
    FOR i = 1 TO LEN(string_x)
       crip(i) = crip(i)+2
    ENDFOR
    j = LEN(string_x)
    FOR i = 1 TO LEN(string_x)
       entrega_x = entrega_x+CHR(crip(j))
       j = j-1
    ENDFOR
 ENDIF
 RETURN entrega_x
ENDFUNC
**
FUNCTION Descodificar
 PARAMETER string_x
 entrega_x = ""
 IF  .NOT. EMPTY(string_x)
    DIMENSION crip(LEN(string_x))
    string_x = ALLTRIM(string_x)
    FOR i = 1 TO LEN(string_x)
       crip(i) = ASC(SUBSTR(string_x, i, 1))
    ENDFOR
    FOR i = 1 TO LEN(string_x)
       crip(i) = crip(i)-2
    ENDFOR
    j = LEN(string_x)
    FOR i = 1 TO LEN(string_x)
       entrega_x = entrega_x+CHR(crip(j))
       j = j-1
    ENDFOR
 ENDIF
 RETURN entrega_x
ENDFUNC
**
FUNCTION Importar_Datos
 PARAMETER tcdirdatos
 LOCAL ladatos, lnnumtablas, i, lcoldsafety
 DIMENSION ladatos(1)
 CLOSE DATABASES ALL
 IF  .NOT. FILE(ADDBS(tcdirdatos)+"WEDB.DBC")
    _messagebox(traducir(pcidioma, "No Existe ninguna Base de Datos en la Carpeta Seleccionada"), 48, traducir(pcidioma, "Atenci�n"))
    RETURN .F.
 ENDIF
 lcoldsafety = SET("safety")
 SET SAFETY OFF
 llerror = .F.
 BEGIN TRANSACTION
 TRY
    lnnumtablas = ADIR(ladatos, "dbf/*.dbf")
    FOR i = 1 TO lnnumtablas
       IF FILE("dbf/"+ladatos(i, 1))
          USE EXCLUSIVE ("dbf/"+ladatos(i, 1))
          DELETE ALL
          IF FILE(ADDBS(tcdirdatos)+ladatos(i, 1))
             APPEND FROM (ADDBS(tcdirdatos)+ladatos(i, 1))
          ENDIF
          USE IN (ladatos(i, 1))
       ENDIF
    ENDFOR
 CATCH TO oerr
    llerror = .T.
 ENDTRY
 IF llerror
    ROLLBACK
 ELSE
    END TRANSACTION
 ENDIF
 CLOSE DATABASES ALL
 IF  .NOT. llerror
    TRY
       FOR i = 1 TO lnnumtablas
          IF FILE("dbf/"+ladatos(i, 1))
             USE EXCLUSIVE ("dbf/"+ladatos(i, 1))
             PACK
             REINDEX
             USE IN (ladatos(i, 1))
          ENDIF
       ENDFOR
    CATCH TO oerr
       llerror = .T.
    ENDTRY
 ENDIF
 IF llerror
    _messagebox(traducir(pcidioma, "Error al importar datos [Error: ")+ALLTRIM(oerr.message)+"]", 48, traducir(pcidioma, "Atenci�n"))
 ELSE
    _messagebox(traducir(pcidioma, "La importaci�n se ha realizado con �xito"), 64, traducir(pcidioma, "Atenci�n"))
 ENDIF
 CLOSE DATABASES ALL
 SET SAFETY &lcoldsafety
ENDFUNC
**
FUNCTION CrearVencimientosCompras
 PARAMETER xejefac, xserfac, xnumfac, xfecfac, cliente, importe, xforpag, numven, numdias, num1dia, diafijo1, diafijo2, diafijo3, xpoliza, xcodban, xcueban, xcodpro
 IF numven=0
    numven = 1
 ENDIF
 SELECT carpro
 SET ORDER TO NUMFACP
 IF SEEK(STR(xejefac, 4)+xserfac+STR(xnumfac, 10))
    IF _messagebox(traducir(pcidioma, "Los recibos ya habian sido creados. �Desea volverlos a generar?"), 068, traducir(pcidioma, "Atencion"))=6
       SCAN REST WHILE carpro.ejefacp=xejefac .AND. carpro.serfacp=xserfac .AND. carpro.numfacp=xnumfac
          DELETE IN carpro
       ENDSCAN
    ELSE
       RETURN .F.
    ENDIF
 ENDIF
 SELECT pagos
 SET ORDER TO NUMREC
 IF SEEK(STR(xejefac, 4)+xserfac+STR(xnumfac, 10))
    SCAN REST FOR pagos.ejefacp=xejefac .AND. pagos.serfacp=xserfac .AND. pagos.numfacp=xnumfac
       DELETE IN pagos
    ENDSCAN
 ENDIF
 LOCAL i, fechault, impult, impacumulado, diafijo, diasmenos
 impacumulado = 0
 IF INLIST(num1dia, 30, 31)
    fechault = GOMONTH(xfecfac, 1)
 ELSE
    fechault = xfecfac+num1dia
 ENDIF
 impult = ROUND(importe/numven, cfgredond)
 diafijo = 0
 IF diafijo1<>0 .OR. diafijo2<>0 .OR. diafijo3<>0
    DO CASE
       CASE DAY(fechault)>0 .AND. DAY(fechault)<=diafijo1
          diafijo = diafijo1
       CASE DAY(fechault)>diafijo1 .AND. DAY(fechault)<=diafijo2
          diafijo = diafijo2
       CASE DAY(fechault)>diafijo2 .AND. DAY(fechault)<=diafijo3
          diafijo = diafijo3
       OTHERWISE
          IF diafijo1<>0
             diafijo = diafijo1
             IF INLIST(num1dia, 30, 31)
                fechault = GOMONTH(fechault, 1)
             ELSE
                fechault = fechault+num1dia
             ENDIF
          ELSE
             IF diafijo2<>0
                diafijo = diafijo2
                IF INLIST(num1dia, 30, 31)
                   fechault = GOMONTH(fechault, 1)
                ELSE
                   fechault = fechault+num1dia
                ENDIF
             ELSE
                diafijo = diafijo3
                IF INLIST(num1dia, 30, 31)
                   fechault = GOMONTH(fechault, 1)
                ELSE
                   fechault = fechault+num1dia
                ENDIF
             ENDIF
          ENDIF
    ENDCASE
 ENDIF
 FOR i = 1 TO numven
    IF i=numven
       impult = importe-impacumulado
    ENDIF
    SELECT carpro
    APPEND BLANK
    REPLACE ejefacp WITH xejefac
    REPLACE serfacp WITH xserfac
    REPLACE numfacp WITH xnumfac
    REPLACE fecfacp WITH xfecfac
    REPLACE forpag WITH xforpag
    REPLACE codpro WITH cliente
    REPLACE numrec WITH VAL(STR(numfacp, 10)+PADL(i, 2, "0"))
    IF diafijo<>0
       diasmenos = 0
       DO WHILE EMPTY(fecven)
          REPLACE fecven WITH CTOD(PADL(diafijo-diasmenos, 2, "0")+SUBSTR(DTOC(fechault), 3, 8))
          diasmenos = diasmenos+1
       ENDDO
    ELSE
       REPLACE fecven WITH fechault
    ENDIF
    REPLACE fecval WITH fecven+numdias-1
    REPLACE imprec WITH impult
    REPLACE imprecibo WITH impult
    REPLACE imppag WITH 0
    REPLACE codban WITH xcodban
    REPLACE cueban WITH xcueban
    REPLACE idconcepto WITH xpoliza
    impacumulado = impacumulado+impult
    IF INLIST(numdias, 30, 31)
       fechault = GOMONTH(fechault, 1)
    ELSE
       fechault = fechault+numdias
    ENDIF
 ENDFOR
ENDFUNC
**
FUNCTION ActualizarPVP
 PARAMETER tcarticulo, tnpvp
 IF  .NOT. cfgactualizarpvp
    RETURN .F.
 ENDIF
 LOCAL lctabla, lcorden, lnrecno, llarticulosenuso, lnpvpa
 lnpvpa = 0
 lctabla = ALIAS()
 lcorden = ORDER()
 llarticulosenuso = .F.
 IF  .NOT. EOF()
    lnrecno = RECNO()
 ELSE
    lnrecno = 0
 ENDIF
 IF  .NOT. USED("articulos")
    USE SHARED articulos AGAIN IN 0
 ELSE
    llarticulosenuso = .T.
 ENDIF
 SELECT articulos
 SET ORDER TO codart
 IF SEEK(tcarticulo)
    IF articulos.pvpa<>tnpvp
       IF _messagebox(traducir(pcidioma, "Ha modificado el precio de venta del art�culo '")+ALLTRIM(articulos.desart)+CHR(13)+traducir(pcidioma, "�Desea actualizar el Precio de Venta A en la ficha del art�culo?"), 068, traducir(pcidioma, "Atenci�n"))=6
          SELECT articulos
          REPLACE pvpa WITH tnpvp
       ENDIF
    ENDIF
 ENDIF
 IF  .NOT. llarticulosenuso
    USE IN articulos
 ENDIF
 IF  .NOT. EMPTY(lctabla)
    SELECT (lctabla)
    SET ORDER TO (lcorden)
    IF lnrecno<>0
       GOTO lnrecno
    ENDIF
 ENDIF
 RETURN .T.
ENDFUNC
**
FUNCTION Barcode128
 LPARAMETERS tcstring
 LOCAL lcstart, lcstop, lcret, lccheck, lnlong, lni, lnchecksum, lnasc
 lcstart = CHR((0136))
 lcstop = CHR((0138))
 lnchecksum = ASC(lcstart)-32
 lcret = tcstring
 lnlong = LEN(lcret)
 FOR lni = 1 TO lnlong
    lnasc = ASC(SUBSTR(lcret, lni, 1))-32
    IF  .NOT. BETWEEN(lnasc, 0, 99)
       lcret = STUFF(lcret, lni, 1, CHR(32))
       lnasc = ASC(SUBSTR(lcret, lni, 1))-32
    ENDIF
    lnchecksum = lnchecksum+(lnasc*lni)
 ENDFOR
 lccheck = CHR(MOD(lnchecksum, 103)+32)
 lcret = lcstart+lcret+lccheck+lcstop
 lcret = STRTRAN(lcret, CHR(32), CHR(232))
 lcret = STRTRAN(lcret, CHR(127), CHR(192))
 lcret = STRTRAN(lcret, CHR(128), CHR(193))
 RETURN lcret
ENDFUNC
**
FUNCTION Barcode39
 LPARAMETERS tcstring
 LOCAL lcret
 lcret = '*'+tcstring+'*'
 RETURN lcret
ENDFUNC
**
FUNCTION Ean13
 LPARAMETERS tcstring, tlcheckd
 LOCAL lclat, lcmed, lcret, lcjuego, lcini, lcresto, lccod, lni, lnchecksum, lnaux, lajuego(10), lnpri
 lcret = ALLTRIM(tcstring)
 IF LEN(lcret)<>12
    RETURN ''
 ENDIF
 lnchecksum = 0
 FOR lni = 1 TO 12
    IF MOD(lni, 2)=0
       lnchecksum = lnchecksum+VAL(SUBSTR(lcret, lni, 1))*3
    ELSE
       lnchecksum = lnchecksum+VAL(SUBSTR(lcret, lni, 1))*1
    ENDIF
 ENDFOR
 lnaux = MOD(lnchecksum, 10)
 lcret = lcret+ALLTRIM(STR(IIF(lnaux=0, 0, 10-lnaux)))
 IF tlcheckd
    RETURN lcret
 ENDIF
 lnpri = VAL(LEFT(lcret, 1))
 lajuego(1) = 'AAAAAACCCCCC'
 lajuego(2) = 'AABABBCCCCCC'
 lajuego(3) = 'AABBABCCCCCC'
 lajuego(4) = 'AABBBACCCCCC'
 lajuego(5) = 'ABAABBCCCCCC'
 lajuego(6) = 'ABBAABCCCCCC'
 lajuego(7) = 'ABBBAACCCCCC'
 lajuego(8) = 'ABABABCCCCCC'
 lajuego(9) = 'ABABBACCCCCC'
 lajuego(10) = 'ABBABACCCCCC'
 lcini = CHR(lnpri+35)
 lclat = CHR(33)
 lcmed = CHR(45)
 lcresto = SUBSTR(lcret, 2, 12)
 FOR lni = 1 TO 12
    lcjuego = SUBSTR(lajuego(lnpri+1), lni, 1)
    DO CASE
       CASE lcjuego='A'
          lcresto = STUFF(lcresto, lni, 1, CHR(VAL(SUBSTR(lcresto, lni, 1))+48))
       CASE lcjuego='B'
          lcresto = STUFF(lcresto, lni, 1, CHR(VAL(SUBSTR(lcresto, lni, 1))+65))
       CASE lcjuego='C'
          lcresto = STUFF(lcresto, lni, 1, CHR(VAL(SUBSTR(lcresto, lni, 1))+97))
    ENDCASE
 ENDFOR
 lccod = lcini+lclat+SUBSTR(lcresto, 1, 6)+lcmed+SUBSTR(lcresto, 7, 6)+lclat
 RETURN lccod
ENDFUNC
**
FUNCTION Ean8
 LPARAMETERS tcstring, tlcheckd
 LOCAL lclat, lcmed, lcret, lcini, lccod, lni, lnchecksum, lnaux
 lcret = ALLTRIM(tcstring)
 IF LEN(lcret)<>7
    RETURN ''
 ENDIF
 lnchecksum = 0
 FOR lni = 1 TO 7
    IF MOD(lni, 2)=0
       lnchecksum = lnchecksum+VAL(SUBSTR(lcret, lni, 1))*3
    ELSE
       lnchecksum = lnchecksum+VAL(SUBSTR(lcret, lni, 1))*1
    ENDIF
 ENDFOR
 lnaux = MOD(lnchecksum, 10)
 lcret = lcret+ALLTRIM(STR(IIF(lnaux=0, 0, 10-lnaux)))
 IF tlcheckd
    RETURN lcret
 ENDIF
 lclat = CHR(33)
 lcmed = CHR(45)
 FOR lni = 1 TO 8
    IF lni<=4
       lcret = STUFF(lcret, lni, 1, CHR(VAL(SUBSTR(lcret, lni, 1))+48))
    ELSE
       lcret = STUFF(lcret, lni, 1, CHR(VAL(SUBSTR(lcret, lni, 1))+97))
    ENDIF
 ENDFOR
 lccod = lclat+SUBSTR(lcret, 1, 4)+lcmed+SUBSTR(lcret, 5, 4)+lclat
 RETURN lccod
ENDFUNC
**
PROCEDURE CambiarImpresora
 PARAMETER tcidpuesto
 LOCAL lcalias, llnoimpresoras, lcidpc
 lcalias = ALIAS()
 llnoimpresoras = .F.
 IF  .NOT. USED("impresoras")
    llnoimpresoras = .T.
    USE SHARED dbf/impresoras AGAIN IN 0
 ENDIF
 SELECT impresoras
 SET ORDER TO idpc
 lcidpc = ID()
 IF TYPE("lcIdPC")<>"C"
    lcidpc = ALLTRIM(STR(lcidpc))
 ENDIF
 IF TYPE("plStyleDunaSoftOnline")="U" .OR.  .NOT. plstyledunasoftonline
    IF AT("#", lcidpc)<>0
       lcidpc = ALLTRIM(SUBSTR(lcidpc, 1, AT("#", lcidpc)-1))
    ENDIF
 ENDIF
 IF  .NOT. SEEK(PADR(lcidpc, 100, " ")+tcidpuesto)
    APPEND BLANK
    REPLACE idpc WITH lcidpc
    REPLACE idpuesto WITH tcidpuesto
    REPLACE impresora1 WITH ""
    REPLACE impresora2 WITH ""
    REPLACE impresora3 WITH ""
 ENDIF
 IF llnoimpresoras
    USE IN impresoras
 ENDIF
 IF  .NOT. EMPTY(lcalias)
    SELECT (lcalias)
 ENDIF
ENDPROC
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
 IF  .NOT. FILE(SYS(5)+SYS(2003)+"/idiomas/traductor.dbf")
    RETURN (tctexto)
 ENDIF
 IF  .NOT. USED("traductor")
    USE SHARED idiomas/traductor AGAIN IN 0
 ENDIF
 IF  .NOT. USED("idiomas")
    USE SHARED idiomas/idiomas AGAIN IN 0
 ENDIF
 SELECT traductor
 SET ORDER TO IDITRA
 IF SEEK(tcidioma+tctexto)
    tctexto = IIF(EMPTY(ALLTRIM(traductor.traduccion)), tctexto, ALLTRIM(traductor.traduccion))
 ELSE
    SELECT idiomas
    SCAN
       SELECT traductor
       IF  .NOT. SEEK(idiomas.ididi+tctexto)
          INSERT INTO traductor (ididi, caption, traduccion) VALUES (idiomas.ididi, tctexto, "")
       ENDIF
    ENDSCAN
 ENDIF
 SET EXACT &lcexact
 IF  .NOT. EMPTY(lcalias)
    SELECT (lcalias)
 ENDIF
 RETURN (tctexto)
ENDFUNC
**
FUNCTION _messagebox
 PARAMETER tctexto, tnparametros, tctitulo, tlavisoimportante
 IF PCOUNT()<4
    tlavisoimportante = .F.
 ENDIF
 IF PCOUNT()<3
    tctitulo = ""
 ENDIF
 IF PCOUNT()<2
    tctitulo = ""
    tnparametros = 64
 ENDIF
 DO FORM msg TO lnretorno WITH .T., tctexto, tnparametros, tctitulo, tlavisoimportante
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
    WAIT WINDOW NOWAIT traducir(pcidioma, "Longitud de cuenta incorrecta")
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
 FOR lnc = LEN(lccuenta1)-1 TO 1 STEP -1
    IF SUBSTR(lccuenta1, lnc, 1)<>"0"
       EXIT
    ENDIF
 ENDFOR
 lccuenta1 = SUBSTR(lccuenta1, 1, lnc)
 lccuenta2 = RIGHT(ALLTRIM(tcfincuenta), cfgauxiliar2-LEN(lccuenta1))
 lnlong1 = LEN(lccuenta1)
 lnlong2 = LEN(lccuenta2)
 lcretorno = lccuenta1+REPLICATE("0", IIF((cfgauxiliar2-lnlong1-lnlong2)>0, cfgauxiliar2-lnlong1-lnlong2, 0))+lccuenta2
 RETURN (lcretorno)
ENDFUNC
**
PROCEDURE Exportar_Excel
 PARAMETER ctabla, ctitulo, cdesde, chasta, cempresa, cproteg
 IF VARTYPE(cproteg)="U"
    cproteg = .F.
 ENDIF
 IF TYPE("cDesde")="L" .OR. TYPE("cHasta")="L"
    periodo = ""
 ELSE
    IF  .NOT. EMPTY(cdesde) .AND.  .NOT. EMPTY(chasta)
       IF TYPE("cDesde")="D" .OR. TYPE("cHasta")="D"
          periodo = "Desde: "+ALLTRIM(DTOC(cdesde))+" Hasta: "+ALLTRIM(DTOC(chasta))
       ELSE
          periodo = "Desde: "+ALLTRIM(cdesde)+" Hasta: "+ALLTRIM(chasta)
       ENDIF
    ELSE
       periodo = ""
    ENDIF
 ENDIF
 SELECT (ctabla)
 areatabla = SELECT()
 COUNT FOR  .NOT. DELETED() TO lineas
 CREATE CURSOR LargoCol (id_col C (10), anchocol N (8), tipocmp C (1))
 SELECT (areatabla)
 cstring = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
 STORE "" TO clago, cch, ncampo
 FOR xcta = 1 TO FCOUNT()
    ncampo = ncampo+FIELD(xcta)+","
    clago = FSIZE(FIELD(xcta))
    ctipo = TYPE(FIELD(xcta))
    IF clago<=10
       clago = 13
    ENDIF
    cch = SUBSTR(cstring, xcta, 1)
    gch = cch+ALLTRIM(STR(xcta))
    INSERT INTO LargoCol (anchocol, id_col, tipocmp) VALUES (clago, gch, ctipo)
    SELECT (areatabla)
 ENDFOR
 SELECT (areatabla)
 ncampo = SUBSTR(ncampo, 1, LEN(ncampo)-1)
 SELECT largocol
 xenca = LEFT(ALLTRIM(id_col), 1)+"5"
 xhay = LEFT(ALLTRIM(id_col), 1)+ALLTRIM(STR(lineas+7))
 IF xcta>26
    =MESSAGEBOX("La tabla... &cTabla tiene...(" + ALLTRIM(STR(xcta)) + ") " +  "campos, de los cuales solo... (26) pueden ser " + CHR(13)+ "exportados a MS Excel.",48,titulo)
    CLOSE DATABASES
    RETURN
 ENDIF
 WAIT WINDOW NOWAIT "Abriendo MS Excel..."
 SELECT (areatabla)
 txtfilename = "c:\Exprt_Excel_1.xls"
 EXPORT FIELDS &ncampo TO ALLTRIM((txtfilename)) TYPE XLS
 oexcel = CREATEOBJECT("Excel.Application")
 WITH oexcel
    .displayalerts = .F.
    .workbooks.open(txtfilename)
    .activewindow.displayzeros = "FALSE"
    choja = RIGHT(txtfilename, 13)
    .sheets("&cHoja").SELECT
    .sheets("&cHoja").NAME = "MM-Empresarial"
    .range("A1:A4").select
    .selection.entirerow.insert
    SELECT largocol
    SCAN ALL
       _col = ALLTRIM(id_col)
       _cls = LEFT(_col, 1)
       _ach = anchocol
       .COLUMNS("&_Cls:&_Cls").COLUMNWIDTH = _ach
       IF ALLTRIM(tipocmp)="D"
          .RANGE("&_Cls:&_Cls").horizontalalignment = -4152
       ENDIF
       IF ALLTRIM(tipocmp)="N"
          .RANGE("&_Cls:&_Cls").horizontalalignment = -4152
          _fin = "&_Cls"+ALLTRIM(STR(lineas+50))
          .RANGE("A1:&_Fin").SELECT
          .selection.numberformat = "#,##0.00"
       ENDIF
       _clu = LEFT(ALLTRIM(id_col), 1)
       _dsda5 = "&_Clu"+"5"
       .RANGE("&_DsdA5:&_DsdA5").SELECT
       .RANGE("&_DsdA5:&_DsdA5").VALUE = UPPER(.RANGE("&_DsdA5:&_DsdA5").VALUE)
    ENDSCAN
    .range("A1:A1").select
    .range("A1:A1").value = UPPER(ALLTRIM(lpempresa))
    .range("A2:A2").select
    .range("A2:A2").value = ctitulo
    .range("A3:A3").select
    .range("A3:A3").value = periodo
    .RANGE("A1:&xHay").SELECT
    .selection.autoformat(1, .T., .T., .T., .T., .T., .T.)
    .RANGE("A5:&xEnca").SELECT
    WITH .selection.interior
       .colorindex = 36
       .pattern = 1
    ENDWITH
    .RANGE("A6:&xHay").SELECT
    WITH .selection.font
       .name = "Arial"
       .size = 9
    ENDWITH
    .range("A1:A1").select
    WITH .selection.font
       .name = "Arial"
       .size = 12
    ENDWITH
    .selection.entirecolumn.insert
    IF xcta>3
       .columns("A:A").columnwidth = 8
    ELSE
       .columns("A:A").columnwidth = 3
    ENDIF
    IF cproteg
       .activesheet.protect("MaMh,.t.,.t.")
    ENDIF
    .visible = .T.
 ENDWITH
 WAIT CLEAR
 RETURN
ENDPROC
**
PROCEDURE RecalcularComisiones
 IF  .NOT. USED("faclin")
    USE SHARED dbf/faclin AGAIN ALIAS faclin IN 0
 ENDIF
 SELECT faclin
 SCAN
    lncomision = 0
    lncomision = calculacomision(faclin.codemp, faclin.codart)
    SELECT faclin
    REPLACE comision WITH lncomision
 ENDSCAN
 USE IN faclin
ENDPROC
**
PROCEDURE reindexar
 SET EXCLUSIVE ON
 numtablas = ADIR(tablas, SYS(5)+SYS(2003)+"\dbf\*.dbf")
 FOR i = 1 TO numtablas
    tablax = SYS(5)+SYS(2003)+"\dbf\"+tablas(i, 1)
    WAIT WINDOW NOWAIT "Indexando "+tablax
    USE &tablax.
    PACK
    REINDEX
 ENDFOR
ENDPROC
**
FUNCTION LanzarContabilidad
 PARAMETER tcopcion
 IF TYPE("plDesarrollo")="L" .AND. pldesarrollo
    DO CONTA.PRG WITH tcopcion
 ELSE
    DO CONTA.EXE WITH tcopcion
 ENDIF
 RETURN .T.
ENDFUNC
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
       _messagebox(traducir(pcidioma, "El Ejercicio Contable no se ha creado")+CHR(13)+CHR(13)+traducir(pcidioma, " [Tabla no creada]")+" "+lcrutatabla, 48, "Atenci�n")
    ENDIF
    RETURN .F.
 ENDIF
 IF  .NOT. USED(tcalias)
    USE SHARED (lcrutatabla) AGAIN ALIAS (tcalias) IN 0
 ENDIF
 SELECT (tcalias)
 IF tcbuffermode<>1
    IF  .NOT. CURSORSETPROP("Buffering", tcbuffermode, tcalias)
       _messagebox(traducir(pcidioma, "Error al modificar 'Buffering'")+CHR(13)+lcrutatabla, 48, "Atenci�n")
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
    _messagebox(traducir(pcidioma, "La tabla no existe")+CHR(13)+lcrutatabla, 48, "Atenci�n")
    RETURN .F.
 ENDIF
 IF  .NOT. USED(tcalias)
    USE SHARED (lcrutatabla) AGAIN ALIAS (tcalias) IN 0
 ENDIF
 SELECT (tcalias)
 IF tcbuffermode<>1
    IF  .NOT. CURSORSETPROP("Buffering", tcbuffermode, tcalias)
       _messagebox(traducir(pcidioma, "Error al modificar 'Buffering'")+CHR(13)+lcrutatabla, 48, "Atenci�n")
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
PROCEDURE LanzarPresentacion
 DO FORM presentacion WITH .T.
 SET CONSOLE OFF
 SET ECHO OFF
ENDPROC
**
FUNCTION GenerarPDF
 LPARAMETERS cnamereport AS STRING, cnamefilepdf AS STRING, ctipoimpresora AS STRING, cnamedirtarget AS STRING
 LOCAL laimpr, lnnumimp, llimpresoraok
 DIMENSION laimpr(1)
 llimpresoraok = .F.
 llpdfcreator = .F.
 lnnumimp = APRINTERS(laimpr)
 FOR i = 1 TO lnnumimp
    IF UPPER(laimpr(i, 1))="PDFCREATOR"
       llimpresoraok = .T.
       EXIT
    ENDIF
 ENDFOR
 IF  .NOT. llimpresoraok
    IF setprintto(cnamereport, ctipoimpresora)
       DO print2pdf WITH cnamefilepdf, cnamereport
    ENDIF
 ELSE
    llpdfcreator = .T.
    LOCAL opdf AS OBJECT
    opdf = CREATEOBJECT("PDFCreator.clsPDFCreator")
    opdf.cstart
    opdf.cvisible = .T.
    opdf.cclearcache
    opdf.cprinterstop = .F.
    opdf.coption("AutosaveDirectory") = cnamedirtarget
    opdf.coption("AutosaveFilename") = JUSTFNAME(cnamefilepdf)
    opdf.coption("UseAutosave") = 1
    opdf.coption("UseAutosaveDirectory") = 1
    opdf.coption("AutosaveFormat") = 0
    setprintto(cnamereport, "L", "PDFCreator")
    REPORT FORM (cnamereport) TO PRINTER NOCONSOLE
    opdf = .NULL.
 ENDIF
 RETURN (llpdfcreator)
ENDFUNC
**
FUNCTION CalcularStockTallasyColores
 PARAMETER tccodart, tctalla, tccolor, tnstock
 IF  .NOT. cfgmodulotallasycolores
    RETURN .T.
 ENDIF
 IF cfgstock<>1
    RETURN .T.
 ENDIF
 IF EMPTY(tctalla) .OR. EMPTY(tccolor) .OR. EMPTY(tccodart) .OR. EMPTY(tnstock)
    RETURN .T.
 ENDIF
 LOCAL lcalias, lnrecnoarticulos
 lcalias = SELECT()
 SELECT articulos
 lnrecnoarticulos = IIF(EOF(), 0, RECNO())
 SET ORDER TO codart
 IF SEEK(tccodart)
    IF articulos.matpri=1 .AND. articulos.contallas
       SELECT tallasart
       SET ORDER TO ARTTALCOL
       IF SEEK(tccodart+tctalla+tccolor)
          REPLACE stock WITH stock+tnstock
       ELSE
          _messagebox(traducir(pcidioma, "No existe la talla y color para el art�culo '")+ALLTRIM(tccodart)+"'", 48, "Atenci�n")
       ENDIF
    ENDIF
 ENDIF
 IF lnrecnoarticulos<>0
    SELECT articulos
    GOTO lnrecnoarticulos
 ENDIF
 SELECT (lcalias)
ENDFUNC
**
FUNCTION ValidarTallasyColoresDocumentos
 PARAMETER tccodart, tctalla, tccolor
 IF  .NOT. cfgmodulotallasycolores
    RETURN .T.
 ENDIF
 LOCAL lcalias
 lcalias = SELECT()
 SELECT articulos
 SET ORDER TO codart
 IF SEEK(tccodart)
    IF articulos.contallas
       IF EMPTY(tctalla) .OR. EMPTY(tccolor)
          _messagebox(traducir(pcidioma, "Debe inidicar la talla y el color"), 64, traducir(pcidioma, "Atenci�n"))
          SELECT (lcalias)
          RETURN .F.
       ENDIF
       SELECT tallasart
       SET ORDER TO ARTTALCOL
       IF  .NOT. SEEK(tccodart+tctalla+tccolor)
          _messagebox(traducir(pcidioma, "No existe esta talla/color para el Art�culo seleccionado"), 64, traducir(pcidioma, "Atenci�n"))
          SELECT (lcalias)
          RETURN .F.
       ENDIF
    ENDIF
 ELSE
    _messagebox(traducir(pcidioma, "El art�culo no existe"), 64, traducir(pcidioma, "Atenci�n"))
    SELECT (lcalias)
    RETURN .F.
 ENDIF
 SELECT (lcalias)
 RETURN .T.
ENDFUNC
**
FUNCTION DameHoraInicioFinPlanificador
 PARAMETER tciniciofin
 IF tciniciofin="INICIO"
    lchora = "23:00"
    IF lchora>cfgdia1a
       lchora = cfgdia1a
    ENDIF
    IF lchora>cfgdia2a
       lchora = cfgdia2a
    ENDIF
    IF lchora>cfgdia3a
       lchora = cfgdia3a
    ENDIF
    IF lchora>cfgdia4a
       lchora = cfgdia4a
    ENDIF
    IF lchora>cfgdia5a
       lchora = cfgdia5a
    ENDIF
    IF lchora>cfgdia6a
       lchora = cfgdia6a
    ENDIF
    IF lchora>cfgdia7a
       lchora = cfgdia7a
    ENDIF
 ELSE
    lchora = "01:00"
    IF lchora<cfgdia1d
       lchora = cfgdia1d
    ENDIF
    IF lchora<cfgdia2d
       lchora = cfgdia2d
    ENDIF
    IF lchora<cfgdia3d
       lchora = cfgdia3d
    ENDIF
    IF lchora<cfgdia4d
       lchora = cfgdia4d
    ENDIF
    IF lchora<cfgdia5d
       lchora = cfgdia5d
    ENDIF
    IF lchora<cfgdia6d
       lchora = cfgdia6d
    ENDIF
    IF lchora<cfgdia7d
       lchora = cfgdia7d
    ENDIF
 ENDIF
 RETURN lchora
ENDFUNC
**
FUNCTION HoraFestivaCentro
 PARAMETER tcdiasemana, tchora
 llfestiva = .F.
 lccampoa = "CFGDIA"+ALLTRIM(STR(IIF(DOW(tcdiasemana)=1, 7, DOW(tcdiasemana)-1)))+"a"
 lccampob = "CFGDIA"+ALLTRIM(STR(IIF(DOW(tcdiasemana)=1, 7, DOW(tcdiasemana)-1)))+"b"
 lccampoc = "CFGDIA"+ALLTRIM(STR(IIF(DOW(tcdiasemana)=1, 7, DOW(tcdiasemana)-1)))+"c"
 lccampod = "CFGDIA"+ALLTRIM(STR(IIF(DOW(tcdiasemana)=1, 7, DOW(tcdiasemana)-1)))+"d"
 lthora = CTOT(DTOC(tcdiasemana)+" "+tchora)+1
 IF ! ( BETWEEN( lthora, CTOT( DTOC( tcdiasemana ) + " " + ALLTRIM( &lccampoa ) ), CTOT( DTOC( tcdiasemana ) + " " + ALLTRIM( &lccampob ) ) )  OR BETWEEN( lthora, CTOT( DTOC( tcdiasemana ) + " " + ALLTRIM( &lccampoc ) ), CTOT( DTOC( tcdiasemana ) + " " + ALLTRIM( &lccampod ) ) ) )
    llfestiva = .T.
 ENDIF
 RETURN llfestiva
ENDFUNC
**
FUNCTION DiaFestivoCentro
 PARAMETER tcdiasemana
 llfestiva = .F.
 SELECT festivos
 SET ORDER TO FECHA
 IF SEEK(DTOS(tcdiasemana))
    llfestiva = .T.
 ENDIF
 IF  .NOT. llfestiva
    DO CASE
       CASE DOW(tcdiasemana)=1 .AND. cfgdomingo
          llfestiva = .T.
       CASE DOW(tcdiasemana)=2 .AND. cfglunes
          llfestiva = .T.
       CASE DOW(tcdiasemana)=3 .AND. cfgmartes
          llfestiva = .T.
       CASE DOW(tcdiasemana)=4 .AND. cfgmiercoles
          llfestiva = .T.
       CASE DOW(tcdiasemana)=5 .AND. cfgjueves
          llfestiva = .T.
       CASE DOW(tcdiasemana)=6 .AND. cfgviernes
          llfestiva = .T.
       CASE DOW(tcdiasemana)=7 .AND. cfgsabado
          llfestiva = .T.
    ENDCASE
 ENDIF
 RETURN llfestiva
ENDFUNC
**
FUNCTION ValidarNota_Empleados
 PARAMETER tnidplan, tdfecha, tccodemp, tccodrec, tchorini, tchorfin, llsinmensaje, lcmensajedevuelto
 lnhorainicial = damehorainiciofinplanificador("INICIO")
 lnhorafinal = damehorainiciofinplanificador("FIN")
 lnparticionhora = cfgparticionplanificador
 IF VAL(cfgparticionplanificador)=0
    cfgparticionplanificador = "15"
 ENDIF
 IF diafestivocentro(tdfecha)
    IF  .NOT. llsinmensaje
       _messagebox(traducir(pcidioma, "D�a Festivo del Centro"), 48, traducir(pcidioma, "Atenci�n"))
    ELSE
       lcmensajedevuelto = traducir(pcidioma, "D�a Festivo del Centro")
    ENDIF
    RETURN .F.
 ENDIF
 lncolumna = 1
 lncontador = 1
 SELECT empleados
 SET ORDER TO codemp
 IF  .NOT. EMPTY(tccodemp) .AND. SEEK(tccodemp)
    lthorainicio = CTOT(DTOC(tdfecha)+" "+tchorini)
    lthorafin = CTOT(DTOC(tdfecha)+" "+tchorfin)-(VAL(cfgparticionplanificador)*60)
    lncontador = 1
    SELECT empfest
    SET ORDER TO codemp
    IF SEEK(empleados.codemp+DTOS(tdfecha))
       IF  .NOT. llsinmensaje
          _messagebox(traducir(pcidioma, "D�a Festivo del Empleado")+" ["+ALLTRIM(empleados.codemp)+"-"+ALLTRIM(empleados.nomemp)+"]", 48, traducir(pcidioma, "Atenci�n"))
       ELSE
          lcmensajedevuelto = traducir(pcidioma, "D�a Festivo del Empleado")
       ENDIF
       RETURN .F.
    ENDIF
    DO WHILE lthorainicio<=lthorafin
       lchora = PADL(ALLTRIM(STR(HOUR(lthorainicio))), 2, "0")+":"+PADL(ALLTRIM(STR(MINUTE(lthorainicio))), 2, "0")
       IF horafestivacentro(tdfecha, lchora)
          IF  .NOT. llsinmensaje
             _messagebox(traducir(pcidioma, "Hora no disponible del Centro"), 48, traducir(pcidioma, "Atenci�n"))
          ELSE
             lcmensajedevuelto = traducir(pcidioma, "Hora no disponible del Centro")
          ENDIF
          RETURN .F.
       ENDIF
       DO CASE
          CASE DOW(tdfecha)=1 .AND. empleados.domingo
             IF  .NOT. llsinmensaje
                _messagebox(traducir(pcidioma, "D�a Festivo del Empleado")+" ["+ALLTRIM(empleados.codemp)+"-"+ALLTRIM(empleados.nomemp)+"]", 48, traducir(pcidioma, "Atenci�n"))
             ELSE
                lcmensajedevuelto = traducir(pcidioma, "D�a Festivo del Empleado")+" ["+ALLTRIM(empleados.codemp)+"-"+ALLTRIM(empleados.nomemp)+"]"
             ENDIF
             RETURN .F.
          CASE DOW(tdfecha)=2 .AND. empleados.lunes
             IF  .NOT. llsinmensaje
                _messagebox(traducir(pcidioma, "D�a Festivo del Empleado")+" ["+ALLTRIM(empleados.codemp)+"-"+ALLTRIM(empleados.nomemp)+"]", 48, traducir(pcidioma, "Atenci�n"))
             ELSE
                lcmensajedevuelto = traducir(pcidioma, "D�a Festivo del Empleado")+" ["+ALLTRIM(empleados.codemp)+"-"+ALLTRIM(empleados.nomemp)+"]"
             ENDIF
             RETURN .F.
          CASE DOW(tdfecha)=3 .AND. empleados.martes
             IF  .NOT. llsinmensaje
                _messagebox(traducir(pcidioma, "D�a Festivo del Empleado")+" ["+ALLTRIM(empleados.codemp)+"-"+ALLTRIM(empleados.nomemp)+"]", 48, traducir(pcidioma, "Atenci�n"))
             ELSE
                lcmensajedevuelto = traducir(pcidioma, "D�a Festivo del Empleado")+" ["+ALLTRIM(empleados.codemp)+"-"+ALLTRIM(empleados.nomemp)+"]"
             ENDIF
             RETURN .F.
          CASE DOW(tdfecha)=4 .AND. empleados.miercoles
             IF  .NOT. llsinmensaje
                _messagebox(traducir(pcidioma, "D�a Festivo del Empleado")+" ["+ALLTRIM(empleados.codemp)+"-"+ALLTRIM(empleados.nomemp)+"]", 48, traducir(pcidioma, "Atenci�n"))
             ELSE
                lcmensajedevuelto = traducir(pcidioma, "D�a Festivo del Empleado")+" ["+ALLTRIM(empleados.codemp)+"-"+ALLTRIM(empleados.nomemp)+"]"
             ENDIF
             RETURN .F.
          CASE DOW(tdfecha)=5 .AND. empleados.jueves
             IF  .NOT. llsinmensaje
                _messagebox(traducir(pcidioma, "D�a Festivo del Empleado")+" ["+ALLTRIM(empleados.codemp)+"-"+ALLTRIM(empleados.nomemp)+"]", 48, traducir(pcidioma, "Atenci�n"))
             ELSE
                lcmensajedevuelto = traducir(pcidioma, "D�a Festivo del Empleado")+" ["+ALLTRIM(empleados.codemp)+"-"+ALLTRIM(empleados.nomemp)+"]"
             ENDIF
             RETURN .F.
          CASE DOW(tdfecha)=6 .AND. empleados.viernes
             IF  .NOT. llsinmensaje
                _messagebox(traducir(pcidioma, "D�a Festivo del Empleado")+" ["+ALLTRIM(empleados.codemp)+"-"+ALLTRIM(empleados.nomemp)+"]", 48, traducir(pcidioma, "Atenci�n"))
             ELSE
                lcmensajedevuelto = traducir(pcidioma, "D�a Festivo del Empleado")+" ["+ALLTRIM(empleados.codemp)+"-"+ALLTRIM(empleados.nomemp)+"]"
             ENDIF
             RETURN .F.
          CASE DOW(tdfecha)=7 .AND. empleados.sabado
             IF  .NOT. llsinmensaje
                _messagebox(traducir(pcidioma, "D�a Festivo del Empleado")+" ["+ALLTRIM(empleados.codemp)+"-"+ALLTRIM(empleados.nomemp)+"]", 48, traducir(pcidioma, "Atenci�n"))
             ELSE
                lcmensajedevuelto = traducir(pcidioma, "D�a Festivo del Empleado")+" ["+ALLTRIM(empleados.codemp)+"-"+ALLTRIM(empleados.nomemp)+"]"
             ENDIF
             RETURN .F.
       ENDCASE
       SELECT empleados
       lccampoa = "empleados.dia"+ALLTRIM(STR(IIF(DOW(tdfecha)=1, 7, DOW(tdfecha)-1)))+"a"
       lccampob = "empleados.dia"+ALLTRIM(STR(IIF(DOW(tdfecha)=1, 7, DOW(tdfecha)-1)))+"b"
       lccampoc = "empleados.dia"+ALLTRIM(STR(IIF(DOW(tdfecha)=1, 7, DOW(tdfecha)-1)))+"c"
       lccampod = "empleados.dia"+ALLTRIM(STR(IIF(DOW(tdfecha)=1, 7, DOW(tdfecha)-1)))+"d"
       lthora = lthorainicio
       IF ! ( BETWEEN( lthora + 1, CTOT( DTOC( tdfecha ) + " " + ALLTRIM( &lccampoa ) ), CTOT( DTOC( tdfecha ) + " " + ALLTRIM( &lccampob ) ) )  OR BETWEEN( lthora + 1, CTOT( DTOC( tdfecha ) + " " + ALLTRIM( &lccampoc ) ), CTOT( DTOC( tdfecha ) + " " + ALLTRIM( &lccampod ) ) ) )
          IF  .NOT. llsinmensaje
             _messagebox(traducir(pcidioma, "Hora no disponible del Empleado")+" ["+ALLTRIM(empleados.codemp)+"-"+ALLTRIM(empleados.nomemp)+"]", 48, traducir(pcidioma, "Atenci�n"))
          ELSE
             lcmensajedevuelto = traducir(pcidioma, "Hora no disponible del Empleado")+" ["+ALLTRIM(empleados.codemp)+"-"+ALLTRIM(empleados.nomemp)+"]"
          ENDIF
          RETURN .F.
       ENDIF
       lthorainicio = lthorainicio+(VAL(cfgparticionplanificador)*60)
       lncontador = lncontador+1
    ENDDO
    lncolumna = lncolumna+1
 ENDIF
 lchorini = CTOT("01/01/2001 "+ALLTRIM(tchorini))
 lchorfin = CTOT("01/01/2001 "+ALLTRIM(tchorfin))
 SELECT plan2009
 IF  .NOT. EOF()
    lnoldrecno = RECNO()
 ELSE
    lnoldrecno = 0
 ENDIF
 SET ORDER TO fecha
 IF SEEK(tdfecha)
    SCAN REST WHILE tdfecha=plan2009.fecha
       IF tnidplan=plan2009.idplan
          LOOP
       ENDIF
       lchorinivalidar = CTOT("01/01/2001 "+ALLTRIM(plan2009.horini))+1
       lchorfinvalidar = CTOT("01/01/2001 "+ALLTRIM(plan2009.horfin))-1
       IF  .NOT. cfgplansolaparempleados
          IF  .NOT. EMPTY(tccodemp) .AND. tccodemp=plan2009.codemp
             IF EMPTY(tccodrec) .AND. EMPTY(plan2009.codrec)
                IF BETWEEN(lchorinivalidar, lchorini, lchorfin) .OR. BETWEEN(lchorfinvalidar, lchorini, lchorfin) .OR. BETWEEN(lchorini, lchorinivalidar, lchorfinvalidar)
                   IF  .NOT. llsinmensaje
                      _messagebox(traducir(pcidioma, "El Empleado ya est� asignado a un Servicio")+" ["+ALLTRIM(empleados.codemp)+"-"+ALLTRIM(empleados.nomemp)+"]", 48, traducir(pcidioma, "Atenci�n"))
                   ELSE
                      lcmensajedevuelto = traducir(pcidioma, "El Empleado ya est� asignado a un Servicio")+" ["+ALLTRIM(empleados.codemp)+"-"+ALLTRIM(empleados.nomemp)+"]"
                   ENDIF
                   SELECT plan2009
                   IF lnoldrecno>0
                      GOTO lnoldrecno
                   ENDIF
                   RETURN .F.
                ENDIF
             ENDIF
          ENDIF
       ENDIF
       IF  .NOT. cfgplansolaparempleadosr
          IF  .NOT. EMPTY(tccodemp) .AND. tccodemp=plan2009.codemp
             IF  .NOT. EMPTY(tccodrec) .AND.  .NOT. EMPTY(plan2009.codrec)
                IF BETWEEN(lchorinivalidar, lchorini, lchorfin) .OR. BETWEEN(lchorfinvalidar, lchorini, lchorfin) .OR. BETWEEN(lchorini, lchorinivalidar, lchorfinvalidar)
                   IF  .NOT. llsinmensaje
                      _messagebox(traducir(pcidioma, "El Empleado ya est� asignado a un Servicio")+" ["+ALLTRIM(empleados.codemp)+"-"+ALLTRIM(empleados.nomemp)+"]", 48, traducir(pcidioma, "Atenci�n"))
                   ELSE
                      lcmensajedevuelto = traducir(pcidioma, "El Empleado ya est� asignado a un Servicio")+" ["+ALLTRIM(empleados.codemp)+"-"+ALLTRIM(empleados.nomemp)+"]"
                   ENDIF
                   SELECT plan2009
                   IF lnoldrecno>0
                      GOTO lnoldrecno
                   ENDIF
                   RETURN .F.
                ENDIF
             ENDIF
          ENDIF
       ENDIF
       IF  .NOT. cfgplansolaparrecursosr
          IF  .NOT. EMPTY(tccodrec) .AND. tccodrec=plan2009.codrec
             IF BETWEEN(lchorinivalidar, lchorini, lchorfin) .OR. BETWEEN(lchorfinvalidar, lchorini, lchorfin) .OR. BETWEEN(lchorini, lchorinivalidar, lchorfinvalidar)
                IF  .NOT. llsinmensaje
                   _messagebox(traducir(pcidioma, "El Recurso ya est� asignado"), 48, traducir(pcidioma, "Atenci�n"))
                ELSE
                   lcmensajedevuelto = traducir(pcidioma, "El Recurso ya est� asignado")
                ENDIF
                SELECT plan2009
                IF lnoldrecno>0
                   GOTO lnoldrecno
                ENDIF
                RETURN .F.
             ENDIF
          ENDIF
       ENDIF
    ENDSCAN
 ENDIF
 SELECT plan2009
 IF lnoldrecno>0
    GOTO lnoldrecno
 ENDIF
 RETURN .T.
ENDFUNC
**
FUNCTION FormatearTelefono
 PARAMETER tctelefono
 LOCAL lcresultado
 lcresultado = ""
 LOCAL m.lccadena AS STRING, n AS INTEGER
 m.lccadena = ALLTRIM(tctelefono)
 lcresultado = ""
 FOR n = 1 TO LEN(m.lccadena)
    IF SUBSTR(m.lccadena, n, 1)$"0123456789"
       lcresultado = lcresultado+SUBSTR(m.lccadena, n, 1)
    ENDIF
 ENDFOR
 RETURN (lcresultado)
ENDFUNC
**
PROCEDURE Stop_ServicioComunicaciones
 TRY
    IF TYPE("Suite_SyncStopTimer")#"U"
       DO Suite_SyncStopTimer
    ENDIF
 CATCH
 ENDTRY
ENDPROC
**
PROCEDURE Start_ServicioComunicaciones
 LOCAL lcRoot
 TRY
    lcRoot = IIF(TYPE("pcSuiteStyleRoot")="C" .AND. .NOT. EMPTY(pcSuiteStyleRoot), ADDBS(pcSuiteStyleRoot), ADDBS(SYS(5)+SYS(2003)))
    IF TYPE("plSuiteSyncEnabled")="U"
       = SuiteLoadUnlockFromFunciones(lcRoot)
    ENDIF
 CATCH TO oerr
 ENDTRY
ENDPROC
**
FUNCTION Reservas_Incidencia
 PARAMETER tctipinc, tnidplan, pccodemp, pccodcli, pdfecha, pchorini, pchorfin, pctexto, pccodrec, pcnomcli, pctel1cli, pclineasreserva, pccodempnew, pccodclinew, pdfechanew, pchorininew, pchorfinnew, pctextonew, pccodrecnew, pcnomclinew, pctel1clinew, pclineasreservanew
 lcalias = ALIAS()
 llplanincabierto = .F.
 IF  .NOT. USED("planinc")
    USE SHARED dbf/planinc AGAIN ALIAS planinc IN 0
 ELSE
    llplanincabierto = .T.
 ENDIF
 DO CASE
    CASE UPPER(ALLTRIM(tctipinc))=="MODIFICAR"
       SELECT planinc
       APPEND BLANK
       REPLACE idplaninc WITH damenumero("PLANIFICADOR INCIDENCIAS", "PLANINC", "", 0, .F.)
       REPLACE codusu WITH pcusuario
       REPLACE fechorinc WITH DATETIME()
       REPLACE tipinc WITH UPPER(ALLTRIM(tctipinc))
       REPLACE idplan WITH tnidplan
       REPLACE codempx WITH pccodempnew
       REPLACE codclix WITH pccodclinew
       REPLACE fechax WITH pdfechanew
       REPLACE horinix WITH pchorininew
       REPLACE horfinx WITH pchorfinnew
       REPLACE textox WITH pctextonew
       REPLACE codrecx WITH pccodrecnew
       REPLACE nomclix WITH pcnomclinew
       REPLACE tel1clix WITH pctel1clinew
       REPLACE planartx WITH pclineasreservanew
       REPLACE codemp WITH pccodemp
       REPLACE codcli WITH pccodcli
       REPLACE fecha WITH pdfecha
       REPLACE horini WITH pchorini
       REPLACE horfin WITH pchorfin
       REPLACE texto WITH pctexto
       REPLACE codrec WITH pccodrec
       REPLACE nomcli WITH pcnomcli
       REPLACE tel1cli WITH pctel1cli
       REPLACE planart WITH pclineasreserva
    CASE UPPER(ALLTRIM(tctipinc))=="BORRAR"
       SELECT planinc
       APPEND BLANK
       REPLACE idplaninc WITH damenumero("PLANIFICADOR INCIDENCIAS", "PLANINC", "", 0, .F.)
       REPLACE codusu WITH pcusuario
       REPLACE fechorinc WITH DATETIME()
       REPLACE tipinc WITH UPPER(ALLTRIM(tctipinc))
       REPLACE idplan WITH tnidplan
       REPLACE codemp WITH pccodemp
       REPLACE codcli WITH pccodcli
       REPLACE fecha WITH pdfecha
       REPLACE horini WITH pchorini
       REPLACE horfin WITH pchorfin
       REPLACE texto WITH pctexto
       REPLACE codrec WITH pccodrec
       REPLACE nomcli WITH pcnomcli
       REPLACE tel1cli WITH pctel1cli
       REPLACE planart WITH pclineasreserva
    CASE UPPER(ALLTRIM(tctipinc))=="CREAR"
       SELECT planinc
       APPEND BLANK
       REPLACE idplaninc WITH damenumero("PLANIFICADOR INCIDENCIAS", "PLANINC", "", 0, .F.)
       REPLACE codusu WITH pcusuario
       REPLACE fechorinc WITH DATETIME()
       REPLACE tipinc WITH UPPER(ALLTRIM(tctipinc))
       REPLACE idplan WITH tnidplan
       REPLACE codemp WITH pccodempnew
       REPLACE codcli WITH pccodclinew
       REPLACE fecha WITH pdfechanew
       REPLACE horini WITH pchorininew
       REPLACE horfin WITH pchorfinnew
       REPLACE texto WITH pctextonew
       REPLACE codrec WITH pccodrecnew
       REPLACE nomcli WITH pcnomclinew
       REPLACE tel1cli WITH pctel1clinew
       REPLACE planart WITH pclineasreservanew
 ENDCASE
 IF  .NOT. llplanincabierto
    USE IN planinc
 ENDIF
 IF  .NOT. EMPTY(lcalias)
    SELECT (lcalias)
 ENDIF
 TRY
    LOCAL llUseV2
    llUseV2 = (TYPE("SuiteEnqueuePlan2009")#"U")
    IF llUseV2 .AND. TYPE("SuiteColaIsV2Active")#"U"
       llUseV2 = SuiteColaIsV2Active()
    ENDIF
    IF llUseV2
       LOCAL lcAcc, lcsCodemp, lcsCodcli, ldsFecha, lcsHorini, lcsHorfin, lcsTexto
       LOCAL lcsCodrec, lcsNomcli, lcsTel1cli
       lcAcc = "UPD"
       DO CASE
          CASE UPPER(ALLTRIM(tctipinc))=="BORRAR"
             lcAcc = "DEL"
             lcsCodemp = pccodemp
             lcsCodcli = pccodcli
             ldsFecha = pdfecha
             lcsHorini = pchorini
             lcsHorfin = pchorfin
             lcsTexto = pctexto
             lcsCodrec = pccodrec
             lcsNomcli = pcnomcli
             lcsTel1cli = pctel1cli
          CASE UPPER(ALLTRIM(tctipinc))=="CREAR"
             lcAcc = "INS"
             lcsCodemp = pccodempnew
             lcsCodcli = pccodclinew
             ldsFecha = pdfechanew
             lcsHorini = pchorininew
             lcsHorfin = pchorfinnew
             lcsTexto = pctextonew
             lcsCodrec = pccodrecnew
             lcsNomcli = pcnomclinew
             lcsTel1cli = pctel1clinew
          OTHERWISE
             lcAcc = "UPD"
             lcsCodemp = pccodempnew
             lcsCodcli = pccodclinew
             ldsFecha = pdfechanew
             lcsHorini = pchorininew
             lcsHorfin = pchorfinnew
             lcsTexto = pctextonew
             lcsCodrec = pccodrecnew
             lcsNomcli = pcnomclinew
             lcsTel1cli = pctel1clinew
       ENDCASE
       = SuiteEnqueuePlan2009(tnidplan, lcAcc, lcsCodemp, lcsCodcli, ldsFecha, lcsHorini, lcsHorfin, ;
             lcsTexto, lcsCodrec, lcsNomcli, lcsTel1cli)
       IF TYPE("Suite_SyncLog")#"U"
          DO Suite_SyncLog WITH "[ENQ-OK] plan2009 id="+ALLTRIM(STR(tnidplan))+" acc="+lcAcc
       ENDIF
    ELSE
       IF TYPE("Suite_SyncLog")#"U"
          DO Suite_SyncLog WITH "[ENQ-SKIP] v2 inactivo id="+ALLTRIM(STR(tnidplan))+" tipo="+ALLTRIM(tctipinc)
       ENDIF
       * Fallback legacy HTTP (solo si v2 no activo y suite_full_unlock presente).
       IF TYPE("SuiteSyncEnsureLoaded")#"U"
          = SuiteSyncEnsureLoaded()
       ENDIF
       IF TYPE("Suite_SyncInit")#"U"
          LOCAL lccfg
          lccfg = ADDBS(SYS(5)+SYS(2003))+"SuiteSync.cfg"
          IF TYPE("SuiteStyleRoot")#"U"
             lccfg = SuiteStyleRoot()+"SuiteSync.cfg"
          ENDIF
          IF TYPE("plSuiteSyncEnabled")#"L" OR .NOT. plSuiteSyncEnabled
             IF FILE(lccfg)
                DO Suite_SyncInit
             ENDIF
          ENDIF
       ENDIF
       IF TYPE("plSuiteSyncEnabled")="L" AND plSuiteSyncEnabled
          DO CASE
             CASE UPPER(ALLTRIM(tctipinc))=="BORRAR"
                DO Suite_SyncPushDelete WITH tnidplan, pccodemp, pccodcli, pdfecha, pchorini, pchorfin, pctexto, pccodrec, pcnomcli, pctel1cli, .F., pclineasreserva, 0, 0
             CASE UPPER(ALLTRIM(tctipinc))=="MODIFICAR"
                DO Suite_SyncAfterIncidencia WITH tctipinc, tnidplan
             CASE UPPER(ALLTRIM(tctipinc))=="CREAR"
                DO Suite_SyncAfterIncidencia WITH tctipinc, tnidplan
          ENDCASE
       ENDIF
    ENDIF
 CATCH TO oEnqErr
    IF TYPE("Suite_SyncLog")#"U"
       DO Suite_SyncLog WITH "[ENQ-ERR] id="+ALLTRIM(STR(tnidplan))+" "+IIF(TYPE("oEnqErr")="O", oEnqErr.message, "?")
    ENDIF
 ENDTRY
 RETURN .T.
ENDFUNC
**
FUNCTION Reservas_Temporales
 PARAMETER tctipinc, tnidplan, pccodemp, pccodcli, pdfecha, pchorini, pchorfin, pctexto, pccodrec, pcnomcli, pctel1cli, tncolfon, tncollet, pclineasreserva, pccodempnew, pccodclinew, pdfechanew, pchorininew, pchorfinnew, pctextonew, pccodrecnew, pcnomclinew, pctel1clinew, tncolfonnew, tncolletnew, pclineasreservanew, plmostrarmsg
 IF PCOUNT()<27
    plmostrarmsg = .T.
 ENDIF
 llinserciontemporal = .F.
 lcalias = ALIAS()
 llplantmpabierto = .F.
 IF  .NOT. USED("plantmp")
    USE SHARED dbf/plantmp AGAIN ALIAS plantmp IN 0
 ELSE
    llplantmpabierto = .T.
 ENDIF
 DO CASE
    CASE UPPER(ALLTRIM(tctipinc))=="CREAR"
       IF RLOCK("0", "plantmp")
          SELECT plantmp
          APPEND BLANK
          REPLACE idplantmp WITH damenumero("RESERVAS TEMPORALES", "PLANTMP", "", 0, .F.)
          REPLACE codusu WITH pcusuario
          REPLACE fechortmp WITH DATETIME()
          REPLACE tiptmp WITH UPPER(ALLTRIM(tctipinc))
          REPLACE idplan WITH 0
          REPLACE codempx WITH pccodempnew
          REPLACE codclix WITH pccodclinew
          REPLACE fechax WITH pdfechanew
          REPLACE horinix WITH pchorininew
          REPLACE horfinx WITH pchorfinnew
          REPLACE textox WITH pctextonew
          REPLACE codrecx WITH pccodrecnew
          REPLACE nomclix WITH pcnomclinew
          REPLACE tel1clix WITH pctel1clinew
          REPLACE colfonx WITH tncolfonnew
          REPLACE colletx WITH tncolletnew
          REPLACE planartx WITH pclineasreservanew
          llinserciontemporal = .T.
          IF plmostrarmsg
             _messagebox(traducir(pcidioma, "Reserva pendiente de confirmaci�n"), 48, traducir(pcidioma, "Reservas Temporales"))
          ENDIF
          UNLOCK IN plantmp
       ELSE
          _messagebox(traducir(pcidioma, "Tabla bloqueada. Vuelva a intentarlo en breves momentos."), 48, "Atenci�n")
       ENDIF
    CASE UPPER(ALLTRIM(tctipinc))=="MODIFICAR"
       llcambio = .F.
       IF  .NOT. (ALLTRIM(pccodempnew)==ALLTRIM(pccodemp))
          llcambio = .T.
       ENDIF
       IF  .NOT. (ALLTRIM(pccodclinew)==ALLTRIM(pccodcli))
          llcambio = .T.
       ENDIF
       IF pdfechanew<>pdfecha
          llcambio = .T.
       ENDIF
       IF  .NOT. (ALLTRIM(pchorininew)==ALLTRIM(pchorini))
          llcambio = .T.
       ENDIF
       IF  .NOT. (ALLTRIM(pchorfinnew)==ALLTRIM(pchorfin))
          llcambio = .T.
       ENDIF
       IF  .NOT. (ALLTRIM(pctextonew)==ALLTRIM(pctexto))
          llcambio = .T.
       ENDIF
       IF  .NOT. (ALLTRIM(pccodrecnew)==ALLTRIM(pccodrec))
          llcambio = .T.
       ENDIF
       IF  .NOT. (ALLTRIM(pcnomclinew)==ALLTRIM(pcnomcli))
          llcambio = .T.
       ENDIF
       IF  .NOT. (ALLTRIM(pctel1clinew)==ALLTRIM(pctel1cli))
          llcambio = .T.
       ENDIF
       IF tncolfonnew<>tncolfon
          llcambio = .T.
       ENDIF
       IF tncolletnew<>tncollet
          llcambio = .T.
       ENDIF
       IF  .NOT. (ALLTRIM(pclineasreservanew)==ALLTRIM(pclineasreserva))
          llcambio = .T.
       ENDIF
       IF llcambio
          IF RLOCK("0", "plantmp")
             SELECT plantmp
             APPEND BLANK
             REPLACE idplantmp WITH damenumero("RESERVAS TEMPORALES", "PLANTMP", "", 0, .F.)
             REPLACE codusu WITH pcusuario
             REPLACE fechortmp WITH DATETIME()
             REPLACE tiptmp WITH UPPER(ALLTRIM(tctipinc))
             REPLACE idplan WITH tnidplan
             REPLACE codempx WITH pccodempnew
             REPLACE codclix WITH pccodclinew
             REPLACE fechax WITH pdfechanew
             REPLACE horinix WITH pchorininew
             REPLACE horfinx WITH pchorfinnew
             REPLACE textox WITH pctextonew
             REPLACE codrecx WITH pccodrecnew
             REPLACE nomclix WITH pcnomclinew
             REPLACE tel1clix WITH pctel1clinew
             REPLACE planartx WITH pclineasreservanew
             REPLACE colfonx WITH tncolfonnew
             REPLACE colletx WITH tncolletnew
             REPLACE codemp WITH pccodemp
             REPLACE codcli WITH pccodcli
             REPLACE fecha WITH pdfecha
             REPLACE horini WITH pchorini
             REPLACE horfin WITH pchorfin
             REPLACE texto WITH pctexto
             REPLACE codrec WITH pccodrec
             REPLACE nomcli WITH pcnomcli
             REPLACE tel1cli WITH pctel1cli
             REPLACE planart WITH pclineasreserva
             REPLACE colfon WITH tncolfon
             REPLACE collet WITH tncollet
             llinserciontemporal = .T.
             IF plmostrarmsg
                _messagebox(traducir(pcidioma, "Reserva pendiente de confirmaci�n"), 48, traducir(pcidioma, "Reservas Temporales"))
             ENDIF
             UNLOCK IN plantmp
          ELSE
             plmostrarmsg = .F.
             _messagebox(traducir(pcidioma, "Tabla bloqueada. Vuelva a intentarlo en breves momentos."), 48, "Atenci�n")
          ENDIF
       ENDIF
    CASE UPPER(ALLTRIM(tctipinc))=="BORRAR"
       IF RLOCK("0", "plantmp")
          SELECT plantmp
          APPEND BLANK
          REPLACE idplantmp WITH damenumero("RESERVAS TEMPORALES", "PLANTMP", "", 0, .F.)
          REPLACE codusu WITH pcusuario
          REPLACE fechortmp WITH DATETIME()
          REPLACE tiptmp WITH UPPER(ALLTRIM(tctipinc))
          REPLACE idplan WITH tnidplan
          REPLACE codemp WITH pccodemp
          REPLACE codcli WITH pccodcli
          REPLACE fecha WITH pdfecha
          REPLACE horini WITH pchorini
          REPLACE horfin WITH pchorfin
          REPLACE texto WITH pctexto
          REPLACE codrec WITH pccodrec
          REPLACE nomcli WITH pcnomcli
          REPLACE tel1cli WITH pctel1cli
          REPLACE planart WITH pclineasreserva
          REPLACE colfon WITH tncolfon
          REPLACE collet WITH tncollet
          llinserciontemporal = .T.
          IF plmostrarmsg
             _messagebox(traducir(pcidioma, "Reserva pendiente de confirmaci�n"), 48, traducir(pcidioma, "Reservas Temporales"))
          ENDIF
          UNLOCK IN plantmp
       ELSE
          plmostrarmsg = .F.
          _messagebox(traducir(pcidioma, "Tabla bloqueada. Vuelva a intentarlo en breves momentos."), 48, "Atenci�n")
       ENDIF
 ENDCASE
 IF  .NOT. llplantmpabierto
    USE IN plantmp
 ENDIF
 IF  .NOT. EMPTY(lcalias)
    SELECT (lcalias)
 ENDIF
 RETURN (llinserciontemporal)
ENDFUNC
**
FUNCTION BuscarAniversarios
 LOCAL lcalias, lcroot, lcclientes, llnueva, lctag
 lcalias = ALIAS()
 llclientesabierto = .F.
 lcroot = IIF(TYPE("pcSuiteStyleRoot")="C" .AND. .NOT. EMPTY(pcSuiteStyleRoot), ADDBS(pcSuiteStyleRoot), ADDBS(SYS(5)+SYS(2003)))
 IF TYPE("SuiteStyleRoot")#"U" .AND. (EMPTY(lcroot) .OR. .NOT. FILE(lcroot+"dbf\clientes.dbf"))
    lcroot = SuiteStyleRoot()
 ENDIF
 IF UPPER(RIGHT(lcroot, 4))=="DBF\"
    lcroot = ADDBS(JUSTPATH(lcroot))
 ENDIF
 lcclientes = lcroot+"dbf\clientes"
 IF  .NOT. USED("clientes")
    llnueva = .F.
    IF SuiteIsDatabaseOpen()
       USE clientes IN 0 SHARED AGAIN ALIAS clientes
       llnueva = .T.
    ENDIF
    IF  .NOT. llnueva .AND. FILE(lcclientes+".dbf")
       USE SHARED (lcclientes) AGAIN ALIAS clientes IN 0
       llnueva = .T.
    ENDIF
    IF  .NOT. llnueva .AND. FILE(lcroot+"dbf\CLIENTES.DBF")
       USE SHARED (lcroot+"dbf\CLIENTES") AGAIN ALIAS clientes IN 0
       llnueva = .T.
    ENDIF
    IF  .NOT. llnueva
       RETURN .F.
    ENDIF
 ELSE
    llclientesabierto = .T.
 ENDIF
 SELECT clientes
 SET ORDER TO fecnac
 lcfechabusqueda = LEFT(DTOC(DATE()+cfgavisaraniversariosdias), 5)
 llencontrado = .F.
 IF SEEK(lcfechabusqueda)
    llencontrado = .T.
 ENDIF
 IF  .NOT. llclientesabierto
    USE IN clientes
 ENDIF
 IF  .NOT. EMPTY(lcalias)
    SELECT (lcalias)
 ENDIF
 IF llencontrado
    DO FORM AvisoAniversario WITH .T., lcfechabusqueda
 ENDIF
 RETURN .T.
ENDFUNC
**
FUNCTION GenerarPDF_Nuevo
 LPARAMETERS cnamereport AS STRING, cnamefilepdf AS STRING, ctipoimpresora AS STRING, cnamedirtarget AS STRING
 LOCAL lntype, lccodepage
 lccodepage = "CP1252"
 lntype = 1
 IF lntype=1
    LOCAL lolistener AS "PdfListener" OF "PR_Pdfx.vcx"
    lolistener = NEWOBJECT('PdfListener', 'PR_PDFx.vcx')
    lolistener.ccodepage = lccodepage
 ELSE
    LOCAL lolistener AS "PDFasImageListener" OF "PR_Pdfx.vcx"
    lolistener = NEWOBJECT('PDFasImageListener', 'PR_PDFx.vcx')
 ENDIF
 lolistener.ctargetfilename = ALLTRIM(cnamefilepdf)
 lolistener.quietmode = .T.
 lolistener.lcanprint = .T.
 lolistener.lcanedit = .T.
 lolistener.lcancopy = .T.
 lolistener.lcanaddnotes = .T.
 lolistener.lencryptdocument = .F.
 lolistener.cmasterpassword = ""
 lolistener.cuserpassword = ""
 lolistener.lopenviewer = .F.
 lnpdfnpagemode = 0
 lolistener.npagemode = lnpdfnpagemode
 DEFINE WINDOW window_html FROM 04, 05 TO 27, 75
 ACTIVATE WINDOW NOSHOW window_html
 REPORT FORM (cnamereport) OBJECT lolistener
 lolistener = .NULL.
 RELEASE WINDOW window_html
 RETURN .T.
ENDFUNC
**
PROCEDURE ConfigurarPais
 PARAMETER tcpais
 DO CASE
    CASE tcpais="ESP"
    CASE tcpais="POR"
       cfgiva1 = 23
       cfgiva2 = 13
       cfgiva3 = 6
       cfgiva4 = 0
    CASE tcpais="MEX"
       cfgiva1 = 16
       cfgiva2 = 11
       cfgiva3 = 0
       cfgiva4 = 0
       cfgredond = 2
       cfgredpvp = 2
       cfgmostrarmonedaalternativa = .T.
       cfgsimbolomonedaalternativa = "$US"
       cfgmonedaalternativaredond = 2
       cfgmonedaalternativaredpvp = 2
       cfgconversionmonedaalternativa = 0.071 
    CASE tcpais="ARG"
       cfgiva1 = 21
       cfgiva2 = 10.50 
       cfgiva3 = 0
       cfgiva4 = 0
    CASE tcpais="FRA"
       cfgiva1 = 19.60 
       cfgiva2 = 5.50 
       cfgiva3 = 2.10 
       cfgiva4 = 0
    CASE tcpais="ENG"
       cfgiva1 = 17.5 
       cfgiva2 = 5
       cfgiva3 = 0
       cfgiva4 = 0
    CASE tcpais="ITA"
       cfgiva1 = 21
       cfgiva2 = 10
       cfgiva3 = 4
       cfgiva4 = 0
    CASE tcpais="OTR"
    OTHERWISE
 ENDCASE
ENDPROC
**
PROCEDURE Favoritos
 PARAMETER tcidmenu, tcadd_del
 lcalias = ALIAS()
 llfavoritosabierto = .F.
 IF  .NOT. USED("favoritos")
    USE SHARED dbf/favoritos AGAIN ALIAS favoritos IN 0
 ELSE
    llfavoritosabierto = .T.
 ENDIF
 SELECT favoritos
 SET ORDER TO idmenu
 llencontrado = .F.
 IF SEEK(tcidmenu)
    DO CASE
       CASE tcadd_del="ADD"
          REPLACE favorito WITH .T.
       CASE tcadd_del="DEL"
          REPLACE favorito WITH .F.
    ENDCASE
 ELSE
    IF tcadd_del="ADD"
       APPEND BLANK
       REPLACE idmenu WITH tcidmenu
       REPLACE favorito WITH .T.
    ENDIF
 ENDIF
 IF  .NOT. llfavoritosabierto
    USE IN favoritos
 ENDIF
 IF  .NOT. EMPTY(lcalias)
    SELECT (lcalias)
 ENDIF
ENDPROC
**
FUNCTION DamePagoaCuenta
 PARAMETER tcticket
 lnacuenta = 0
 lcalias = ALIAS()
 llcarcliabierto = .F.
 IF  .NOT. USED("carcli")
    USE SHARED dbf/carcli AGAIN ALIAS carcli IN 0
 ELSE
    llcarcliabierto = .T.
 ENDIF
 IF  .NOT. EMPTY(tcticket)
    SELECT carcli
    SET ORDER TO NUMFAC
    IF SEEK(tcticket)
       SCAN REST WHILE tcticket=STR(carcli.ejefac, 4)+carcli.serfac+STR(carcli.numfac, 10)
          IF carcli.acuenta
             lnacuenta = lnacuenta+carcli.impcob
          ENDIF
       ENDSCAN
    ENDIF
 ENDIF
 IF  .NOT. llcarcliabierto
    USE IN carcli
 ENDIF
 IF  .NOT. EMPTY(lcalias)
    SELECT (lcalias)
 ENDIF
 RETURN (lnacuenta)
ENDFUNC
**
FUNCTION BuildBMP
 LPARAMETERS toform, tcfile, tnx1, tnx2, tny1, tny2
 LOCAL nx1, nx2, ny1, ny2, nwidth, nheight, npixels, i, j, cbmp, ccolarray, cpad
 nx1 = tvl(tnx1, 0)
 nx2 = tvl(tnx2, toform.width-1)
 ny1 = tvl(tny1, 0)
 ny2 = tvl(tny2, toform.height-1)
 nwidth = nx2-nx1+1
 cpad = REPLICATE(CHR(0), MOD(nwidth, 4))
 nheight = ny2-ny1+1
 npixels = nwidth*nheight
 IF npixels<1
    RETURN .F.
 ENDIF
 cbmp = 'BM'+numtodword(54+nwidth*nheight*3)+numtoword(0)+numtoword(0)+numtodword(54)
 cbmp = cbmp+getbmpinfoheader(nwidth, nheight)
 ccolarray = ''
 FOR j = ny2 TO ny1 STEP -1
    FOR i = nx1 TO nx2
       ccolarray = ccolarray+getbinarycolor(toform.point(i, j))
    ENDFOR
    ccolarray = ccolarray+cpad
 ENDFOR
 cbmp = cbmp+ccolarray
 STRTOFILE(cbmp, tcfile)
ENDFUNC
**
FUNCTION GetBMPInfoHeader
 LPARAMETERS tnwidth, tnheight
 LOCAL cheader, czero
 czero = numtodword(0)
 cheader = numtodword(40)+numtodword(tnwidth)+numtodword(tnheight)
 cheader = cheader+numtoword(1)+numtoword(24)+czero+czero
 cheader = cheader+numtodword(3780)+numtodword(3780)+czero+czero
 RETURN cheader
ENDFUNC
**
FUNCTION GetBinaryColor
 LPARAMETERS tncolor
 RETURN SUBSTR(BINTOC(MAX(tncolor, 0)-dwordoffset), 2)
ENDFUNC
**
FUNCTION NumToDWord
 LPARAMETERS tnval
 LOCAL cbin
 cbin = BINTOC(tnval-dwordoffset)
 RETURN SUBSTR(cbin, 4, 1)+SUBSTR(cbin, 3, 1)+SUBSTR(cbin, 2, 1)+SUBSTR(cbin, 1, 1)
ENDFUNC
**
FUNCTION NumToWord
 LPARAMETERS tnval
 LOCAL cbin
 cbin = BINTOC(tnval-wordoffset, 2)
 RETURN SUBSTR(cbin, 2, 1)+SUBSTR(cbin, 1, 1)
ENDFUNC
**
FUNCTION TVL
 LPARAMETERS tuparamvalue, tuinitvalue
 RETURN IIF(VARTYPE(tuparamvalue)=VARTYPE(tuinitvalue), tuparamvalue, tuinitvalue)
ENDFUNC
**
PROCEDURE bmpajpg
 SET PROCEDURE TO gdiplus ADDITIVE
 DO decl
 PRIVATE gdiplus
 gdiplus = CREATEOBJECT("gdiplusinit")
 LOCAL hwindow, hdc, bmp, nwidth, nheight
 hwindow = getfocus()
 hdc = getwindowdc(hwindow)
 STORE 0 TO nwidth, nheight
 = getwinrect(hwindow, @nwidth, @nheight)
 bmp = CREATEOBJECT("gdibitmap", m.nwidth, m.nheight)
 WITH bmp
    .graphics.getdc
    = bitblt(.graphics.hdc, 0, 0, .imgwidth, .imgheight, m.hdc, 0, 0, 13369376)
    .graphics.releasedc
    .savetofile("d:\temp\vfp.tif")
 ENDWITH
 = releasedc(m.hwindow, m.hdc)
ENDPROC
**
PROCEDURE GetWinRect
 LPARAMETERS hwindow, nwidth, nheight
 LOCAL lprect, nleft, ntop, nright, nbottom
 lprect = REPLICATE(CHR(0), 16)
 = getwindowrect(hwindow, @lprect)
 nright = buf2dword(SUBSTR(lprect, 9, 4))
 nbottom = buf2dword(SUBSTR(lprect, 13, 4))
 nleft = buf2dword(SUBSTR(lprect, 1, 4))
 IF nleft>nright
    nleft = nleft-4294967295 
 ENDIF
 ntop = buf2dword(SUBSTR(lprect, 5, 4))
 IF ntop>nbottom
    ntop = ntop-4294967295 
 ENDIF
 nwidth = nright-nleft
 nheight = nbottom-ntop
 RETURN
ENDPROC
**
PROCEDURE decl
 DECLARE INTEGER GetFocus IN user32
 DECLARE INTEGER GetWindowDC IN user32 INTEGER
 DECLARE INTEGER ReleaseDC IN user32 INTEGER, INTEGER
 DECLARE INTEGER GetWindowRect IN user32 INTEGER, STRING @
 DECLARE INTEGER BitBlt IN gdi32 INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER
ENDPROC
**
FUNCTION GestionNumeroSerie
 PARAMETER tcarticulo, tcnumser, tncant, tctipdoc, tcnumdoc, tdfecha, tcnumdocalb
 IF PCOUNT()<7
    tcnumdocalb = ""
 ENDIF
 llresultado = .T.
 lcalias = ALIAS()
 IF  .NOT. INLIST(tncant, 1, -1)
    llresultado = .F.
    _messagebox(traducir(pcidioma, "La cantidad debe ser 1 o -1"), 48, traducir(pcidioma, "Atenci�n"))
    RETURN (llresultado)
 ENDIF
 IF EMPTY(tcarticulo)
    llresultado = .F.
    _messagebox(traducir(pcidioma, "Debe indicar el C�digo de Art�culo"), 48, traducir(pcidioma, "Atenci�n"))
    RETURN (llresultado)
 ENDIF
 IF EMPTY(tcnumser)
    llresultado = .F.
    _messagebox(traducir(pcidioma, "Debe indicar el N� de Serie"), 48, traducir(pcidioma, "Atenci�n"))
    RETURN (llresultado)
 ENDIF
 IF tctipdoc=="F" .AND. VAL(LEFT(tcnumdocalb, 4))<>0
    tcnumdoc = tcnumdocalb
    tctipdoc = "A"
 ENDIF
 llnumserabierto = .F.
 llnumserorden = ""
 llnumserrecno = 0
 IF  .NOT. USED("Numser")
    USE SHARED dbf/Numser AGAIN ALIAS numser IN 0
 ELSE
    llnumserabierto = .T.
    SELECT numser
    llnumserorden = ORDER()
    llnumserrecno = RECNO()
 ENDIF
 SELECT numser
 SET ORDER TO numser
 SET EXACT ON
 IF tncant=1
    SELECT numser
    SET ORDER TO numserent
    IF  .NOT. SEEK(tcnumser+tctipdoc+tcnumdoc)
       SET ORDER TO numser
       IF SEEK(tcnumser)
          SCAN REST WHILE tcnumser=numser.numser
             IF  .NOT. (ALLTRIM(numser.codart)==ALLTRIM(tcarticulo))
                llresultado = .F.
                SET EXACT OFF
                _messagebox(traducir(pcidioma, "El N�mero de Serie ya existe para otro art�culo"), 48, traducir(pcidioma, "Atenci�n"))
                EXIT
             ENDIF
             IF EMPTY(numser.docsal)
                llresultado = .F.
                SET EXACT OFF
                _messagebox(traducir(pcidioma, "El N�mero de Serie ya existe"), 48, traducir(pcidioma, "Atenci�n"))
                EXIT
             ENDIF
          ENDSCAN
          IF llresultado
             SELECT numser
             APPEND BLANK
             REPLACE codart WITH tcarticulo
             REPLACE numser WITH tcnumser
             REPLACE fecent WITH tdfecha
             REPLACE tipdocent WITH tctipdoc
             REPLACE docent WITH tcnumdoc
          ENDIF
       ELSE
          SELECT numser
          APPEND BLANK
          REPLACE codart WITH tcarticulo
          REPLACE numser WITH tcnumser
          REPLACE fecent WITH tdfecha
          REPLACE tipdocent WITH tctipdoc
          REPLACE docent WITH tcnumdoc
       ENDIF
    ENDIF
 ELSE
    SELECT numser
    SET ORDER TO numsersal
    IF  .NOT. SEEK(tcnumser+tctipdoc+tcnumdoc)
       SET ORDER TO numser
       IF SEEK(tcnumser)
          llok = .F.
          SCAN REST WHILE tcnumser=numser.numser
             IF  .NOT. (ALLTRIM(numser.codart)==ALLTRIM(tcarticulo))
                llresultado = .F.
                SET EXACT OFF
                _messagebox(traducir(pcidioma, "El N�mero de Serie ya existe para otro art�culo"), 48, traducir(pcidioma, "Atenci�n"))
                EXIT
             ENDIF
             IF EMPTY(numser.docsal)
                llok = .T.
                SELECT numser
                REPLACE fecsal WITH tdfecha
                REPLACE tipdocsal WITH tctipdoc
                REPLACE docsal WITH tcnumdoc
                EXIT
             ENDIF
          ENDSCAN
          IF  .NOT. llok
             llresultado = .F.
             SET EXACT OFF
             _messagebox(traducir(pcidioma, "El N�mero de Serie no est� en Stock"), 48, traducir(pcidioma, "Atenci�n"))
          ENDIF
       ELSE
          llresultado = .F.
          SET EXACT OFF
          _messagebox(traducir(pcidioma, "El N�mero de Serie no est� en Stock"), 48, traducir(pcidioma, "Atenci�n"))
       ENDIF
    ENDIF
 ENDIF
 SET EXACT OFF
 IF  .NOT. llnumserabierto
    USE IN numser
 ELSE
    SELECT numser
    SET ORDER TO &llnumserorden
    GOTO llnumserrecno
 ENDIF
 IF  .NOT. EMPTY(lcalias)
    SELECT (lcalias)
 ENDIF
 RETURN (llresultado)
ENDFUNC
**
FUNCTION EliminarNumeroSerie
 PARAMETER tcentsal, tcnumser, tctipdoc, tcnumdoc, tcnumdocalb
 IF PCOUNT()<5
    tcnumdocalb = ""
 ENDIF
 llresultado = .T.
 lcalias = ALIAS()
 IF tctipdoc=="F" .AND. VAL(LEFT(tcnumdocalb, 4))<>0
    tcnumdoc = tcnumdocalb
    tctipdoc = "A"
 ENDIF
 llnumserabierto = .F.
 llnumserorden = ""
 llnumserrecno = 0
 IF  .NOT. USED("Numser")
    USE SHARED dbf/Numser AGAIN ALIAS numser IN 0
 ELSE
    llnumserabierto = .T.
    SELECT numser
    llnumserorden = ORDER()
    llnumserrecno = RECNO()
 ENDIF
 SELECT numser
 SET ORDER TO numser
 SET EXACT ON
 IF tcentsal="E"
    SELECT numser
    SET ORDER TO numserent
    IF SEEK(tcnumser+tctipdoc+tcnumdoc)
       IF EMPTY(numser.tipdocsal)
          SELECT numser
          DELETE IN numser
       ELSE
          llresultado = .F.
          SET EXACT OFF
          _messagebox(traducir(pcidioma, "El N�mero de Serie ya ha salido. Imposible eliminar."), 48, traducir(pcidioma, "Atenci�n"))
       ENDIF
    ENDIF
 ELSE
    SELECT numser
    SET ORDER TO numsersal
    IF SEEK(tcnumser+tctipdoc+tcnumdoc)
       IF EMPTY(numser.tipdocent)
          SELECT numser
          DELETE IN numser
       ELSE
          SELECT numser
          REPLACE tipdocsal WITH ""
          REPLACE docsal WITH ""
          REPLACE fecsal WITH CTOD("//")
       ENDIF
    ENDIF
 ENDIF
 SET EXACT OFF
 IF  .NOT. llnumserabierto
    USE IN numser
 ELSE
    SELECT numser
    SET ORDER TO &llnumserorden
    GOTO llnumserrecno
 ENDIF
 IF  .NOT. EMPTY(lcalias)
    SELECT (lcalias)
 ENDIF
 RETURN (llresultado)
ENDFUNC
**
PROCEDURE EnviarMail
 PARAMETER tcdestino, tctema, tctexto, tccodcli
 IF PCOUNT()<4
    tccodcli = ""
 ENDIF
 DO CASE
    CASE cfgtipoenviomail=1
       lomail = CREATEOBJECT("enviar_jmail")
       lcmensaje = lomail.enviaremail(tcdestino, tctema, tctexto, "", tccodcli)
       RELEASE lomail
    CASE cfgtipoenviomail=2
       lomail = CREATEOBJECT("enviadoc")
       lcmensaje = lomail.enviadoc(tcdestino, tctema, tctexto, "", tccodcli)
       RELEASE lomail
 ENDCASE
ENDPROC
**
FUNCTION VERSIONONLINEOK
 RETURN 1
ENDFUNC
**
FUNCTION __VERSIONONLINEOK_DUNASOFT_DISABLED
 llretorno = 0
 llerror = .F.
 DO CASE
    CASE plrenting
       IF plversiondemo
          llretorno = 1
          RETURN (llretorno)
       ENDIF
       IF (EMPTY(cfgclienteweb) .OR. EMPTY(cfgpasswordweb))
          _SCREEN.visible = .F.
          DO FORM PedirUsuarioDspc WITH .T.
          READ EVENTS
          _SCREEN.visible = .T.
       ENDIF
       IF EMPTY(cfgclienteweb) .OR. EMPTY(cfgpasswordweb)
          IF cfgnumeroavisosusuariodspc>=10
             _messagebox(traducir(pcidioma, "* Para utilizar la aplicaci�n es necesario introducir los Datos de Cliente de DunaSoft.")+CHR(13)+CHR(13)+traducir(pcidioma, "Contacte con DunaSoft para obtener los datos correctos."), 48, tcnombreaplicacion)
             llretorno = 2
             RETURN (llretorno)
          ELSE
             llretorno = 1
             RETURN (llretorno)
          ENDIF
       ENDIF
       LOCAL lohttp
       IF  .NOT. llerror
          TRY
             lohttp = SuiteGetHttpLocal()
             lohttp.httpweb = pcurlwebdspc
             lcclienteok = "UN"
             lcmensaje = ""
             lnlicenciasred = 0
             lcmacaddress = ""
             lcmacaddress = getmacaddress()
             lohttp.dunasoft_comprobarversionspain(cfgclienteweb, cfgpasswordweb, cfglicenciasred, lcmacaddress, @lcclienteok, @lcmensaje, SYS(0), plrenting, cfgbloqueadodspc)
             DO CASE
                CASE lcclienteok=="OK"
                   cfgintentosactualizacionwebok = 0
                   llretorno = 1
                   IF cfgbloqueadodspc
                      cfgbloqueadodspc = .F.
                      SELECT empresa
                      SAVE TO MEMO config ALL LIKE CFG*
                      _messagebox(traducir(pcidioma, "Aplicaci�n RENTING desbloqueada."), 64, tcnombreaplicacion)
                   ENDIF
                CASE lcclienteok=="KO"
                   IF AT("Codigo Cliente o Password incorrectos", lohttp.msgerror)<>0
                      cfgclienteweb = ""
                      cfgpasswordweb = ""
                      SELECT empresa
                      SAVE TO MEMO config ALL LIKE CFG*
                      _messagebox(lcmensaje+CHR(13)+CHR(13)+traducir(pcidioma, "Contacte con DunaSoft para obtener los datos correctos."), 48, tcnombreaplicacion)
                      versiononlineok()
                   ELSE
                      cfgintentosactualizacionwebok = 10
                      cfgbloqueadodspc = .T.
                      SELECT empresa
                      SAVE TO MEMO config ALL LIKE CFG*
                      llretorno = 2
                      _messagebox(traducir(pcidioma, "Aplicaci�n RENTING bloqueada.")+CHR(13)+traducir(pcidioma, "Contacte con DunaSoft para activar la aplicaci�n"), 64, tcnombreaplicacion)
                   ENDIF
                OTHERWISE
                   IF cfgbloqueadodspc
                      llretorno = 2
                      _messagebox(traducir(pcidioma, "Aplicaci�n RENTING bloqueada.")+CHR(13)+traducir(pcidioma, "Contacte con DunaSoft para activar la aplicaci�n"), 64, tcnombreaplicacion)
                   ELSE
                      cfgintentosactualizacionwebok = cfgintentosactualizacionwebok+1
                      IF cfgintentosactualizacionwebok>=10
                         llretorno = 2
                         _messagebox(traducir(pcidioma, "Usted necesita conexi�n a internet para ejecutar la aplicaci�n.")+CHR(13)+traducir(pcidioma, "Compruebe que el antivirus no bloquea la aplicaci�n.")+CHR(13)+CHR(13)+traducir(pcidioma, "La aplicaci�n RENTING se cerrar�."), 48, tcnombreaplicacion)
                      ELSE
                         llretorno = 1
                         _messagebox(traducir(pcidioma, "Usted necesita conexi�n a internet para ejecutar la aplicaci�n.")+CHR(13)+traducir(pcidioma, "Compruebe que el antivirus no bloquea la aplicaci�n."), 48, tcnombreaplicacion)
                      ENDIF
                   ENDIF
             ENDCASE
          CATCH TO oerr
             IF cfgbloqueadodspc
                llretorno = 2
                _messagebox(traducir(pcidioma, "Aplicaci�n RENTING bloqueada.")+CHR(13)+traducir(pcidioma, "Contacte con DunaSoft para activar la aplicaci�n"), 64, tcnombreaplicacion)
             ELSE
                cfgintentosactualizacionwebok = cfgintentosactualizacionwebok+1
                IF cfgintentosactualizacionwebok>=10
                   llretorno = 2
                   _messagebox(traducir(pcidioma, "Usted necesita conexi�n a internet para ejecutar la aplicaci�n.")+CHR(13)+traducir(pcidioma, "Compruebe que el antivirus no bloquea la aplicaci�n.")+CHR(13)+CHR(13)+traducir(pcidioma, "La aplicaci�n RENTING se cerrar�."), 48, tcnombreaplicacion)
                ELSE
                   llretorno = 1
                   _messagebox(traducir(pcidioma, "Usted necesita conexi�n a internet para ejecutar la aplicaci�n.")+CHR(13)+traducir(pcidioma, "Compruebe que el antivirus no bloquea la aplicaci�n."), 48, tcnombreaplicacion)
                ENDIF
             ENDIF
          ENDTRY
       ENDIF
       RELEASE lohttp
    CASE pcversionpais=="ESP"
       IF plversiondemo
          llretorno = 1
          RETURN (llretorno)
       ENDIF
       LOCAL lohttp, llsaliraplicacion
       pcversionapp = 0
       IF  .NOT. llerror
          IF (EMPTY(cfgclienteweb) .OR. EMPTY(cfgpasswordweb))
             _SCREEN.visible = .F.
             DO FORM PedirUsuarioDspc WITH .T.
             READ EVENTS
             _SCREEN.visible = .T.
          ENDIF
          IF EMPTY(cfgclienteweb) .OR. EMPTY(cfgpasswordweb)
             IF cfgnumeroavisosusuariodspc>=10
                _messagebox(traducir(pcidioma, "* Para utilizar la aplicaci�n es necesario introducir los Datos de Cliente de DunaSoft.")+CHR(13)+CHR(13)+traducir(pcidioma, "Contacte con DunaSoft para obtener los datos correctos."), 48, tcnombreaplicacion)
                llretorno = 2
                RETURN (llretorno)
             ELSE
                llretorno = 1
                RETURN (llretorno)
             ENDIF
          ENDIF
          TRY
             lohttp = SuiteGetHttpLocal()
             lohttp.httpweb = pcurlwebdspc
             lcclienteok = "UN"
             lcmensaje = ""
             lnlicenciasred = 0
             lcmacaddress = ""
             lcmacaddress = getmacaddress()
             lohttp.dunasoft_comprobarversionspain(cfgclienteweb, cfgpasswordweb, cfglicenciasred, lcmacaddress, @lcclienteok, @lcmensaje, SYS(0), plrenting, cfgbloqueadodspc)
             DO CASE
                CASE lcclienteok=="OK"
                   llretorno = 1
                   IF cfgbloqueadodspc
                      cfgbloqueadodspc = .F.
                      SELECT empresa
                      SAVE TO MEMO config ALL LIKE CFG*
                      _messagebox(traducir(pcidioma, "Aplicaci�n desbloqueada."), 64, tcnombreaplicacion)
                   ENDIF
                   IF ALLTRIM(lcmensaje)=="OK-RENTING" .AND.  .NOT. plrenting
                      activarrenting()
                   ENDIF
                   cfgnumeroavisosusuariodspc = 0
                   SELECT empresa
                   SAVE TO MEMO config ALL LIKE CFG*
                CASE lcclienteok=="KO"
                   IF AT("Codigo Cliente o Password incorrectos", lohttp.msgerror)<>0
                      cfgclienteweb = ""
                      cfgpasswordweb = ""
                      SELECT empresa
                      SAVE TO MEMO config ALL LIKE CFG*
                      _messagebox(lcmensaje+CHR(13)+CHR(13)+traducir(pcidioma, "Contacte con DunaSoft para obtener los datos correctos."), 48, tcnombreaplicacion)
                      versiononlineok()
                   ELSE
                      cfgbloqueadodspc = .T.
                      SELECT empresa
                      SAVE TO MEMO config ALL LIKE CFG*
                      llretorno = 2
                      _messagebox(traducir(pcidioma, "Aplicaci�n bloqueada.")+CHR(13)+traducir(pcidioma, "Contacte con DunaSoft para activar la aplicaci�n"), 64, tcnombreaplicacion)
                   ENDIF
                OTHERWISE
                   IF cfgbloqueadodspc
                      llretorno = 2
                      _messagebox(traducir(pcidioma, "Aplicaci�n bloqueada.")+CHR(13)+traducir(pcidioma, "Contacte con DunaSoft para activar la aplicaci�n"), 64, tcnombreaplicacion)
                   ELSE
                      llretorno = 1
                   ENDIF
             ENDCASE
          CATCH TO oerr
             IF cfgbloqueadodspc
                llretorno = 2
                _messagebox(traducir(pcidioma, "Aplicaci�n bloqueada.")+CHR(13)+traducir(pcidioma, "Contacte con DunaSoft para activar la aplicaci�n"), 64, tcnombreaplicacion)
             ELSE
                llretorno = 1
             ENDIF
          ENDTRY
       ENDIF
       RELEASE lohttp
    CASE pcversionpais=="MEX"
       LOCAL lohttp, llsaliraplicacion
       pcversionapp = 2
       IF  .NOT. llerror
          TRY
             lohttp = SuiteGetHttpLocal()
             lohttp.httpweb = pcurlwebdspc
             IF (EMPTY(cfgclienteweb) .OR. EMPTY(cfgpasswordweb))
                _SCREEN.visible = .F.
                DO FORM AltaUsuario WITH .T.
                READ EVENTS
                _SCREEN.visible = .T.
             ENDIF
             IF EMPTY(cfgclienteweb) .OR. EMPTY(cfgpasswordweb)
                IF cfgnumeroavisosusuariodspc>=5
                   _messagebox(traducir(pcidioma, "* Para utilizar la aplicaci�n es necesario registrarse como nuevo usuario de Style for Mex.")+CHR(13)+CHR(13)+traducir(pcidioma, "Registrese al entrar a la aplicaci�n."), 48, tcnombreaplicacion)
                   llretorno = 2
                ELSE
                   cfgnumeroavisosusuariodspc = cfgnumeroavisosusuariodspc+1
                   SELECT empresa
                   SAVE TO MEMO config ALL LIKE CFG*
                   plversiondemo = .T.
                   pcversionapp = 0
                   llretorno = 1
                ENDIF
             ELSE
                lcclienteok = "UN"
                lcmensaje = ""
                lnlicenciasred = 0
                lcmacaddress = ""
                lcmacaddress = getmacaddress()
                lohttp.dunasoft_comprobarversionmexico(cfgclienteweb, cfgpasswordweb, pcversionpais, lcmacaddress, @lcclienteok, @lcmensaje, @lnlicenciasred, @pcversionapp, SYS(0))
                DO CASE
                   CASE lcclienteok=="OK"
                      llretorno = 1
                      IF lnlicenciasred=0
                         lnlicenciasred = 1
                      ENDIF
                      IF pcversionapp=2
                         lnlicenciasred = pclicenciasredfree
                      ENDIF
                      IF lnlicenciasred<>cfglicenciasred
                         cfglicenciasred = lnlicenciasred
                         SELECT empresa
                         SAVE TO MEMO config ALL LIKE CFG*
                         _messagebox(traducir(pcidioma, "Se ha detectado un cambio en el n�mero de Licencias de Red contratadas.")+CHR(13)+traducir(pcidioma, "Licencias de Red Contratadas:")+" "+ALLTRIM(STR(lnlicenciasred)), 64, traducir(pcidioma, "Atenci�n"))
                      ENDIF
                   CASE lcclienteok=="KO"
                      pcversionapp = 2
                      IF AT("Codigo Cliente o Password incorrectos", lohttp.msgerror)<>0
                         cfgclienteweb = ""
                         cfgpasswordweb = ""
                         SELECT empresa
                         SAVE TO MEMO config ALL LIKE CFG*
                         _messagebox(lcmensaje+CHR(13)+CHR(13)+traducir(pcidioma, "Registrese como Cliente de Style for Mex"), 48, tcnombreaplicacion)
                         versiononlineok()
                      ELSE
                         IF AT("ERROR: La Versi�n FREE ha dejado de existir.", lohttp.msgerror)<>0
                            plversiondemo = .T.
                            pcversionapp = 0
                            llretorno = 1
                         ELSE
                            llretorno = 2
                            _messagebox(lcmensaje+CHR(13)+CHR(13)+traducir(pcidioma, "Contacte con Style for Mex para activar la aplicaci�n"), 48, tcnombreaplicacion)
                         ENDIF
                      ENDIF
                   OTHERWISE
                      pcversionapp = 0
                      llretorno = 0
                      _messagebox(traducir(pcidioma, "Usted necesita conexi�n a internet para ejecutar la aplicaci�n.")+CHR(13)+traducir(pcidioma, "Compruebe que el antivirus no bloquea la aplicaci�n.")+CHR(13)+CHR(13)+traducir(pcidioma, "Se activar� la VERSI�N DEMOSTRACI�N hasta que disponga de Internet."), 48, tcnombreaplicacion)
                ENDCASE
             ENDIF
          CATCH TO oerr
             pcversionapp = 0
             llretorno = 0
             _messagebox(traducir(pcidioma, "Usted necesita conexi�n a internet para ejecutar la aplicaci�n.")+CHR(13)+traducir(pcidioma, "Compruebe que el antivirus no bloquea la aplicaci�n.")+CHR(13)+CHR(13)+traducir(pcidioma, "Se activar� la VERSI�N DEMOSTRACI�N hasta que disponga de Internet."), 48, tcnombreaplicacion)
          ENDTRY
       ENDIF
       RELEASE lohttp
    CASE pcversionpais=="FRA"
       LOCAL lohttp
       IF  .NOT. llerror
          TRY
             lohttp = SuiteGetHttpLocal()
             lohttp.httpweb = pcurlwebdspc
             IF EMPTY(cfgclienteweb) .OR. EMPTY(cfgpasswordweb)
                llretorno = 0
                _messagebox(traducir(pcidioma, "Usted debe indicar su ID Usuario y Contrase�a en la Configuraci�n de la Aplicaci�n.")+CHR(13)+CHR(13)+traducir(pcidioma, "Se activar� la VERSI�N DEMOSTRACI�N hasta su configuraci�n."), 48, tcnombreaplicacion)
             ELSE
                lcclienteok = "UN"
                lcmensaje = ""
                lohttp.dunasoft_comprobarversionfrancia(cfgclienteweb, cfgpasswordweb, @lcclienteok, @lcmensaje)
                DO CASE
                   CASE lcclienteok=="OK"
                      cfgintentosactualizacionwebok = 0
                      llretorno = 1
                   CASE lcclienteok=="KO"
                      cfgintentosactualizacionwebok = 20
                      llretorno = 0
                      _messagebox(lcmensaje+CHR(13)+CHR(13)+traducir(pcidioma, "Se activar� la VERSI�N DEMOSTRACI�N."), 48, tcnombreaplicacion)
                   OTHERWISE
                      cfgintentosactualizacionwebok = cfgintentosactualizacionwebok+1
                      IF cfgintentosactualizacionwebok>=20
                         llretorno = 2
                         _messagebox(traducir(pcidioma, "Usted necesita conexi�n a internet para ejecutar la aplicaci�n.")+CHR(13)+traducir(pcidioma, "Compruebe que el antivirus no bloquea la aplicaci�n.")+CHR(13)+CHR(13)+traducir(pcidioma, "La aplicaci�n se cerrar�."), 48, tcnombreaplicacion)
                      ELSE
                         llretorno = 1
                         _messagebox(traducir(pcidioma, "Usted necesita conexi�n a internet para ejecutar la aplicaci�n.")+CHR(13)+traducir(pcidioma, "Compruebe que el antivirus no bloquea la aplicaci�n."), 48, tcnombreaplicacion)
                      ENDIF
                ENDCASE
             ENDIF
          CATCH TO oerr
             cfgintentosactualizacionwebok = cfgintentosactualizacionwebok+1
             IF cfgintentosactualizacionwebok>=20
                llretorno = 2
                _messagebox(traducir(pcidioma, "Usted necesita conexi�n a internet para ejecutar la aplicaci�n.")+CHR(13)+traducir(pcidioma, "Compruebe que el antivirus no bloquea la aplicaci�n.")+CHR(13)+CHR(13)+traducir(pcidioma, "La aplicaci�n se cerrar�."), 48, tcnombreaplicacion)
             ELSE
                llretorno = 1
                _messagebox(traducir(pcidioma, "Usted necesita conexi�n a internet para ejecutar la aplicaci�n.")+CHR(13)+traducir(pcidioma, "Compruebe que el antivirus no bloquea la aplicaci�n."), 48, tcnombreaplicacion)
             ENDIF
          ENDTRY
       ENDIF
       RELEASE lohttp
    OTHERWISE
       llretorno = 1
 ENDCASE
 RETURN (llretorno)
ENDFUNC
**
FUNCTION Generar_Hash
 PARAMETER tcclaveprivadaxml, tctextooriginal, tcerror
 LOCAL lcretorno, llerror
 lcretorno = ""
 llerror = .F.
 TRY
    IF  .NOT. llerror
       lorsaencryptor = CREATEOBJECT('Chilkat.Rsa')
       lnsuccess = lorsaencryptor.unlockcomponent(pcclavechilkatrsa)
       IF (lnsuccess<>1)
          tcerror = "RSA component unlock failed"
          llerror = .T.
       ENDIF
    ENDIF
    IF  .NOT. llerror
       lnsuccess = lorsaencryptor.importprivatekey(tcclaveprivadaxml)
       IF (lnsuccess<>1)
          tcerror = lorsaencryptor.lasterrortext
          llerror = .T.
       ENDIF
    ENDIF
    IF  .NOT. llerror
       lorsaencryptor.littleendian = 0
       lorsaencryptor.charset = "utf-8"
       lorsaencryptor.encodingmode = "base64"
       lcretorno = lorsaencryptor.signstringenc(tctextooriginal, "sha-1")
    ENDIF
 CATCH TO loerr
    llerror = .T.
    lcretorno = ""
    tcerror = loerr.message
 ENDTRY
 RELEASE lorsaencryptor
 RETURN (lcretorno)
ENDFUNC
**
FUNCTION Generar_Hash_con_PEM
 PARAMETER tcclaveprivadapem, tctextooriginal, tcerror
 LOCAL lcretorno, llerror
 lcretorno = ""
 llerror = .F.
 TRY
    IF  .NOT. llerror
       lorsaencryptor = CREATEOBJECT('Chilkat.Rsa')
       lnsuccess = lorsaencryptor.unlockcomponent(pcclavechilkatrsa)
       IF (lnsuccess<>1)
          tcerror = "RSA component unlock failed"
          llerror = .T.
       ENDIF
    ENDIF
    IF  .NOT. llerror
       lcprivatekeypem = tcclaveprivadapem
       loprivkey = CREATEOBJECT('Chilkat.PrivateKey')
       lnsuccess = loprivkey.loadpem(lcprivatekeypem)
       IF (lnsuccess<>1)
          tcerror = loprivkey.lasterrortext
          llerror = .T.
       ENDIF
    ENDIF
    IF  .NOT. llerror
       lcprivatekeyxml = loprivkey.getxml()
       lnsuccess = lorsaencryptor.importprivatekey(lcprivatekeyxml)
       IF (lnsuccess<>1)
          tcerror = lorsaencryptor.lasterrortext
          llerror = .T.
       ENDIF
    ENDIF
    IF  .NOT. llerror
       lorsaencryptor.littleendian = 0
       lorsaencryptor.charset = "utf-8"
       lorsaencryptor.encodingmode = "base64"
       lcretorno = lorsaencryptor.signstringenc(tctextooriginal, "sha-1")
    ENDIF
 CATCH TO loerr
    llerror = .T.
    lcretorno = ""
    tcerror = loerr.message
 ENDTRY
 RELEASE lorsaencryptor
 RETURN (lcretorno)
ENDFUNC
**
FUNCTION Verificar_Hash_con_PrivateKey
 PARAMETER tcclaveprivadaxml, tchash, tctextooriginal, tcerror
 LOCAL llretorno, lorsaencryptor
 llretorno = .T.
 tcerror = ""
 TRY
    lorsaencryptor = CREATEOBJECT('Chilkat.Rsa')
    lnsuccess = lorsaencryptor.unlockcomponent(pcclavechilkatrsa)
    IF (lnsuccess<>1)
       tcerror = "RSA component unlock failed"
       llretorno = .F.
    ENDIF
    IF llretorno
       lnsuccess = lorsaencryptor.importprivatekey(tcclaveprivadaxml)
       IF (lnsuccess<>1)
          tcerror = lorsaencryptor.lasterrortext
          llretorno = .F.
       ENDIF
    ENDIF
    IF llretorno
       lorsaencryptor.littleendian = 1
       lorsaencryptor.oaeppadding = 1
       lorsaencryptor.charset = "utf-8"
       lorsaencryptor.encodingmode = "base64"
       lnsuccess = lorsaencryptor.verifystringenc(tctextooriginal, "sha-1", tchash)
       IF (lnsuccess=1)
          llretorno = .T.
       ELSE
          llretorno = .F.
          tcerror = lorsaencryptor.lasterrortext
       ENDIF
    ENDIF
 CATCH TO loerr
    llretorno = .F.
    tcerror = loerr.message
 ENDTRY
 RELEASE lorsaencryptor
 RETURN (llretorno)
ENDFUNC
**
FUNCTION Verificar_Hash_con_PublicKey
 PARAMETER tcclavepublicaxml, tchash, tctextooriginal, tcerror
 LOCAL llretorno, lorsaencryptor
 llretorno = .T.
 tcerror = ""
 TRY
    lorsaencryptor = CREATEOBJECT('Chilkat.Rsa')
    lnsuccess = lorsaencryptor.unlockcomponent(pcclavechilkatrsa)
    IF (lnsuccess<>1)
       tcerror = "RSA component unlock failed"
       llretorno = .F.
    ENDIF
    IF llretorno
       lnsuccess = lorsaencryptor.importpublickey(tcclavepublicaxml)
       IF (lnsuccess<>1)
          tcerror = lorsaencryptor.lasterrortext
          llretorno = .F.
       ENDIF
    ENDIF
    IF llretorno
       lorsaencryptor.littleendian = 1
       lorsaencryptor.oaeppadding = 1
       lorsaencryptor.charset = "utf-8"
       lorsaencryptor.encodingmode = "base64"
       lnsuccess = lorsaencryptor.verifystringenc(tctextooriginal, "sha-1", tchash)
       IF (lnsuccess=1)
          llretorno = .T.
       ELSE
          llretorno = .F.
          tcerror = lorsaencryptor.lasterrortext
       ENDIF
    ENDIF
 CATCH TO loerr
    llretorno = .F.
    tcerror = loerr.message
 ENDTRY
 RELEASE lorsaencryptor
 RETURN (llretorno)
ENDFUNC
**
FUNCTION Convertir_ClavePublica_PEM_a_XML
 PARAMETER tcclavepublicapem, tcerror
 LOCAL lcretorno, llerror
 lcretorno = ""
 llerror = .F.
 TRY
    IF  .NOT. llerror
       lopubkey = CREATEOBJECT('Chilkat.PublicKey')
       lnsuccess = lopubkey.loadopensslpemfile(tcclavepublicapem)
       IF (lnsuccess<>1)
          tcerror = lopubkey.lasterrortext
          llerror = .T.
       ENDIF
    ENDIF
    IF  .NOT. llerror
       lcretorno = lopubkey.getxml()
    ENDIF
 CATCH TO loerr
    llerror = .T.
    lcretorno = ""
    tcerror = loerr.message
 ENDTRY
 RELEASE lopubkey
 RETURN (lcretorno)
ENDFUNC
**
FUNCTION Convertir_ClavePrivada_PEM_a_XML
 PARAMETER tcclaveprivadapem, tcerror
 LOCAL lcretorno, llerror
 lcretorno = ""
 llerror = .F.
 TRY
    lopkey = CREATEOBJECT('Chilkat.PrivateKey')
    lopkey.loadpemfile(tcclaveprivadapem)
    lcretorno = lopkey.getxml()
 CATCH TO loerr
    llerror = .T.
    lcretorno = ""
    tcerror = loerr.message
 ENDTRY
 RELEASE lopkey
 RETURN (lcretorno)
ENDFUNC
**
FUNCTION FirmaTicketSaft
 PARAMETER tcfirmasaft
 lcfirma = ""
 IF pcpais=="POR" .AND.  .NOT. plversiondemo .AND.  .NOT. EMPTY(ALLTRIM(tcfirmasaft))
    lcfirma = SUBSTR(tcfirmasaft, 1, 1)
    lcfirma = lcfirma+SUBSTR(tcfirmasaft, 11, 1)
    lcfirma = lcfirma+SUBSTR(tcfirmasaft, 21, 1)
    lcfirma = lcfirma+SUBSTR(tcfirmasaft, 31, 1)
    lcfirma = lcfirma+"-Processado por Programa Certificado n.� "
    lcfirma = lcfirma+pcnumerocertificadosaft
    lcfirma = lcfirma+"/AT"
 ELSE
    IF pcpais=="POR" .AND. plversiondemo
       lcfirma = "Documento emitido para fins de Forma��o"
    ENDIF
 ENDIF
 RETURN lcfirma
ENDFUNC
**
FUNCTION ValidaCodigoBarrasBidimensional
 PARAMETER tcserie, tdfecha, tnnumfac
 IF pcversionpais<>"MEX" .AND. pcpais<>"MEX"
    RETURN .F.
 ENDIF
 LOCAL llseriesabierta, lctablaabierta, llavisarfecha, llavisarfactura
 llseriesabierta = .F.
 lctablaabierta = ALIAS()
 IF  .NOT. USED("seriesCBBD")
    USE SHARED dbf/series AGAIN ALIAS seriescbbd IN 0
    llseriesabierta = .F.
 ELSE
    llseriesabierta = .T.
 ENDIF
 llavisarfecha = .F.
 llavisarfactura = .F.
 SELECT seriescbbd
 SET ORDER TO serie
 IF SEEK(tcserie)
    IF seriescbbd.mxavifec .AND.  .NOT. EMPTY(seriescbbd.mxfecapr)
       IF EMPTY(seriescbbd.mxdiaavi)
          DO CASE
             CASE tdfecha>=(GOMONTH(seriescbbd.mxfecapr, 24)-seriescbbd.mxdiasant)
                llavisarfecha = .T.
             OTHERWISE
                llavisarfecha = .F.
          ENDCASE
       ELSE
          DO CASE
             CASE seriescbbd.mxdiaavi=seriescbbd.mxfecapr
                llavisarfecha = .F.
             CASE tdfecha>=(GOMONTH(seriescbbd.mxfecapr, 24)-seriescbbd.mxdiasant)
                llavisarfecha = .T.
             OTHERWISE
                llavisarfecha = .F.
          ENDCASE
       ENDIF
       IF llavisarfecha
          SELECT seriescbbd
          IF RLOCK("seriesCBBD")
             REPLACE seriescbbd.mxdiaavi WITH seriescbbd.mxfecapr
             UNLOCK IN seriescbbd
          ENDIF
          _messagebox(traducir(pcidioma, "El C�digo de Barras Bidimensional")+" "+traducir(pcidioma, "para la Impresi�n de Facturas caduca el d�a")+" "+DTOC(GOMONTH(seriescbbd.mxfecapr, 24))+"."+CHR(13)+CHR(13)+traducir(pcidioma, "Renu�velo lo antes posible."), 48, traducir(pcidioma, "Atenci�n"), .T.)
       ENDIF
    ENDIF
    IF seriescbbd.mxavinum .AND.  .NOT. EMPTY(seriescbbd.mxhnumfac) .AND. seriescbbd.mxhnumfac>seriescbbd.mxdnumfac
       IF EMPTY(seriescbbd.mxfacavi)
          DO CASE
             CASE tnnumfac>=seriescbbd.mxnumant
                llavisarfactura = .T.
             OTHERWISE
                llavisarfactura = .F.
          ENDCASE
       ELSE
          DO CASE
             CASE seriescbbd.mxfacavi=seriescbbd.mxfecapr
                llavisarfactura = .F.
             CASE tnnumfac>=seriescbbd.mxnumant
                llavisarfactura = .T.
             OTHERWISE
                llavisarfactura = .F.
          ENDCASE
       ENDIF
       IF llavisarfactura
          SELECT seriescbbd
          IF RLOCK("seriesCBBD")
             REPLACE seriescbbd.mxfacavi WITH seriescbbd.mxfecapr
             UNLOCK IN seriescbbd
          ENDIF
          _messagebox(traducir(pcidioma, "El C�digo de Barras Bidimensional")+" "+traducir(pcidioma, "para la Impresi�n de Facturas tiene validez hasta el N�mero")+" "+ALLTRIM(STR(seriescbbd.mxhnumfac))+"."+CHR(13)+CHR(13)+traducir(pcidioma, "Renu�velo lo antes posible."), 48, traducir(pcidioma, "Atenci�n"), .T.)
       ENDIF
    ENDIF
 ENDIF
 IF  .NOT. llseriesabierta .AND. USED("seriesCBBD")
    USE IN seriescbbd
 ENDIF
 IF  .NOT. EMPTY(lctablaabierta)
    SELECT (lctablaabierta)
 ENDIF
ENDFUNC
**
FUNCTION getMacAddress
 TRY
    LOCAL lccomputername, lowmiservice, loitems, loitem, lcmacaddress, lcmacaddress1
    lcmacaddress = ""
    lccomputername = "."
    lowmiservice = GETOBJECT("winmgmts:\\"+lccomputername+"\root\cimv2")
    loitems = lowmiservice.execquery("Select * from Win32_NetworkAdapter", , 48)
    FOR EACH loitem IN loitems
       lcmacaddress1 = loitem.macaddress
       IF  .NOT. ISNULL(lcmacaddress1)
          lcmacaddress = lcmacaddress+loitem.macaddress+","
       ENDIF
    ENDFOR
 CATCH TO oerr
    lcmacaddress = ""
 ENDTRY
 IF ( .NOT. EMPTY(lcmacaddress))
    lcmacaddress = LEFT(lcmacaddress, LEN(lcmacaddress)-1)
 ENDIF
 RETURN (lcmacaddress)
ENDFUNC
**
FUNCTION ResumenDiarioOnline
 RETURN .F.
ENDFUNC
**
FUNCTION __ResumenDiarioOnline_DUNASOFT_DISABLED
 IF  .NOT. cfgenviarresumenonline .OR. (pcversionpais="MEX")
    RETURN .F.
 ENDIF
 IF  .NOT. clienteconcontrato(traducir(pcidioma, "Resumen Diario Online"))
    RETURN .F.
 ENDIF
 TRY
    llresultado = .T.
    lcalias = ALIAS()
    ll_faccab_abierto = .F.
    IF  .NOT. USED("faccab")
       USE SHARED dbf/faccab AGAIN ALIAS faccab IN 0
    ELSE
       ll_faccab_abierto = .T.
    ENDIF
    ll_faclin_abierto = .F.
    IF  .NOT. USED("faclin")
       USE SHARED dbf/faclin AGAIN ALIAS faclin IN 0
    ELSE
       ll_faclin_abierto = .T.
    ENDIF
    ll_carcli_abierto = .F.
    IF  .NOT. USED("carcli")
       USE SHARED dbf/carcli AGAIN ALIAS carcli IN 0
    ELSE
       ll_carcli_abierto = .T.
    ENDIF
    ll_cieentsal_abierto = .F.
    IF  .NOT. USED("cieentsal")
       USE SHARED dbf/cieentsal AGAIN ALIAS cieentsal IN 0
    ELSE
       ll_cieentsal_abierto = .T.
    ENDIF
    ll_clientes_abierto = .F.
    IF  .NOT. USED("clientes")
       USE SHARED dbf/clientes AGAIN ALIAS clientes IN 0
    ELSE
       ll_clientes_abierto = .T.
    ENDIF
    ll_facproc_abierto = .F.
    IF  .NOT. USED("facproc")
       USE SHARED dbf/facproc AGAIN ALIAS facproc IN 0
    ELSE
       ll_facproc_abierto = .T.
    ENDIF
    ll_carpro_abierto = .F.
    IF  .NOT. USED("carpro")
       USE SHARED dbf/carpro AGAIN ALIAS carpro IN 0
    ELSE
       ll_carpro_abierto = .T.
    ENDIF
    ll_articulos_abierto = .F.
    IF  .NOT. USED("articulos")
       USE SHARED dbf/articulos AGAIN ALIAS articulos IN 0
    ELSE
       ll_articulos_abierto = .T.
    ENDIF
    ll_resumendia_abierto = .F.
    IF  .NOT. USED("resumendia")
       USE SHARED dbf/resumendia AGAIN ALIAS resumendia IN 0
    ELSE
       ll_resumendia_abierto = .T.
    ENDIF
    ll_plan2009_abierto = .F.
    IF  .NOT. USED("plan2009")
       USE SHARED dbf/plan2009 AGAIN ALIAS plan2009 IN 0
    ELSE
       ll_plan2009_abierto = .T.
    ENDIF
    SELECT resumendia
    SET ORDER TO diares
    lcdiaresumen = DATE()-8
    DO WHILE lcdiaresumen<DATE()
       SELECT resumendia
       IF SEEK(DTOS(lcdiaresumen))
          lcdiaresumen = lcdiaresumen+1
          LOOP
       ENDIF
       SELECT faclin
       SET ORDER TO linfac
       SELECT clientes
       SET ORDER TO codcli
       SELECT articulos
       SET ORDER TO codart
       SELECT faccab
       SET ORDER TO fecfac
       lntic00 = 0
       lnticres = 0
       ltotfac00 = 0
       ltotfacres = 0
       ltotdeuven = 0
       ltotser00 = 0
       ltotserres = 0
       lnser00 = 0
       lnserres = 0
       ltotpro00 = 0
       ltotprores = 0
       lnpro00 = 0
       lnprores = 0
       lnclim = 0
       lnclih = 0
       lnclin = 0
       lnclinue = 0
       lnclinuem = 0
       lnclinueh = 0
       lnclinuen = 0
       ltotcli = 0
       ltotsalcaj = 0
       ltotentcaj = 0
       ltotfaccom = 0
       ltotdeucom = 0
       lnreservas = 0
       lnresfac = 0
       lrestie = 0
       lrestiefac = 0
       SELECT faccab
       IF SEEK(lcdiaresumen)
          SCAN REST WHILE lcdiaresumen=faccab.fecfac
             IF ALLTRIM(faccab.serfac)=="00"
                lntic00 = lntic00+1
                ltotfac00 = ltotfac00+faccab.totfac
             ELSE
                lnticres = lnticres+1
                ltotfacres = ltotfacres+faccab.totfac
             ENDIF
             SELECT clientes
             IF SEEK(faccab.codcli)
                DO CASE
                   CASE clientes.sexo="M"
                      lnclim = lnclim+1
                   CASE clientes.sexo="H"
                      lnclih = lnclih+1
                   CASE clientes.sexo="N"
                      lnclin = lnclin+1
                   OTHERWISE
                      lnclim = lnclim+1
                ENDCASE
             ENDIF
             SELECT faclin
             IF SEEK(STR(faccab.ejefac, 4)+faccab.serfac+STR(faccab.numfac, 10))
                SCAN REST WHILE STR(faccab.ejefac, 4)+faccab.serfac+STR(faccab.numfac, 10)=STR(faclin.ejefac, 4)+faclin.serfac+STR(faclin.numfac, 10)
                   SELECT articulos
                   IF SEEK(faclin.codart)
                      IF articulos.matpri=1
                         IF ALLTRIM(faccab.serfac)=="00"
                            lnpro00 = lnpro00+1
                            ltotpro00 = ltotpro00+faclin.subtot
                         ELSE
                            lnprores = lnprores+1
                            ltotprores = ltotprores+faclin.subtot
                         ENDIF
                      ELSE
                         IF ALLTRIM(faccab.serfac)=="00"
                            lnser00 = lnser00+1
                            ltotser00 = ltotser00+faclin.subtot
                         ELSE
                            lnserres = lnserres+1
                            ltotserres = ltotserres+faclin.subtot
                         ENDIF
                      ENDIF
                   ENDIF
                ENDSCAN
             ENDIF
          ENDSCAN
       ENDIF
       SELECT clientes
       SET ORDER TO FECALTA
       IF SEEK(DTOS(lcdiaresumen))
          SCAN REST WHILE lcdiaresumen=clientes.fecalta
             lnclinue = lnclinue+1
             DO CASE
                CASE clientes.sexo="M"
                   lnclinuem = lnclinuem+1
                CASE clientes.sexo="H"
                   lnclinueh = lnclinueh+1
                CASE clientes.sexo="N"
                   lnclinuen = lnclinuen+1
                OTHERWISE
                   lnclinuem = lnclinuem+1
             ENDCASE
          ENDSCAN
       ENDIF
       ltotcli = RECCOUNT("clientes")
       SELECT cieentsal
       SET ORDER TO FECDOC
       IF SEEK(DTOS(lcdiaresumen))
          SCAN REST WHILE lcdiaresumen=cieentsal.fecdoc
             DO CASE
                CASE cieentsal.tipdoc="S"
                   ltotsalcaj = ltotsalcaj+cieentsal.impdoc
                CASE cieentsal.tipdoc="E"
                   ltotentcaj = ltotentcaj+cieentsal.impdoc
             ENDCASE
          ENDSCAN
       ENDIF
       SELECT facproc
       SET ORDER TO fecfacp
       IF SEEK(lcdiaresumen)
          SCAN REST WHILE lcdiaresumen=facproc.fecfacp
             ltotfaccom = ltotfaccom+facproc.totfacp
          ENDSCAN
       ENDIF
       SELECT carcli
       SET ORDER TO fecfac
       IF SEEK(lcdiaresumen)
          SCAN REST WHILE lcdiaresumen=carcli.fecfac
             IF ALLTRIM(faccab.serfac)<>"00"
                ltotdeuven = ltotdeuven+(carcli.imprec-carcli.impcob)
             ENDIF
          ENDSCAN
       ENDIF
       SELECT carpro
       SET ORDER TO fecfacp
       IF SEEK(lcdiaresumen)
          SCAN REST WHILE lcdiaresumen=carpro.fecfacp
             ltotdeucom = ltotdeucom+(carpro.imprec-carpro.imppag)
          ENDSCAN
       ENDIF
       SELECT plan2009
       SET ORDER TO fecha
       IF SEEK(lcdiaresumen)
          SCAN REST WHILE lcdiaresumen=plan2009.fecha
             lnreservas = lnreservas+1
             lrestie = lrestie+CTOT(DTOC(plan2009.fecha)+" "+plan2009.horfin)-CTOT(DTOC(plan2009.fecha)+" "+plan2009.horini)
             IF plan2009.facturado
                lnresfac = lnresfac+1
                lrestiefac = lrestiefac+CTOT(DTOC(plan2009.fecha)+" "+plan2009.horfin)-CTOT(DTOC(plan2009.fecha)+" "+plan2009.horini)
             ENDIF
          ENDSCAN
       ENDIF
       SELECT resumendia
       IF RLOCK("0", "resumendia")
          APPEND BLANK
          REPLACE diares WITH lcdiaresumen
          REPLACE enviar WITH .T.
          REPLACE ntic00 WITH lntic00
          REPLACE nticres WITH lnticres
          REPLACE totfac00 WITH ltotfac00
          REPLACE totfacres WITH ltotfacres
          REPLACE totdeuven WITH ltotdeuven
          REPLACE totser00 WITH ltotser00
          REPLACE totserres WITH ltotserres
          REPLACE nser00 WITH lnser00
          REPLACE nserres WITH lnserres
          REPLACE totpro00 WITH ltotpro00
          REPLACE totprores WITH ltotprores
          REPLACE npro00 WITH lnpro00
          REPLACE nprores WITH lnprores
          REPLACE nclim WITH lnclim
          REPLACE nclih WITH lnclih
          REPLACE nclin WITH lnclin
          REPLACE nclinue WITH lnclinue
          REPLACE nclinuem WITH lnclinuem
          REPLACE nclinueh WITH lnclinueh
          REPLACE nclinuen WITH lnclinuen
          REPLACE totcli WITH ltotcli
          REPLACE totsalcaj WITH ltotsalcaj
          REPLACE totentcaj WITH ltotentcaj
          REPLACE totfaccom WITH ltotfaccom
          REPLACE totdeucom WITH ltotdeucom
          REPLACE nreservas WITH lnreservas
          REPLACE nresfac WITH lnresfac
          REPLACE restie WITH lrestie
          REPLACE restiefac WITH lrestiefac
          UNLOCK IN resumendia
       ELSE
          _messagebox(traducir(pcidioma, "Tabla bloqueada. Vuelva a intentarlo en breves momentos.")+CHR(13)+"Resumen Diario", 48, "Atenci�n")
       ENDIF
       lcdiaresumen = lcdiaresumen+1
    ENDDO
    IF  .NOT. ll_faccab_abierto
       USE IN faccab
    ENDIF
    IF  .NOT. ll_faclin_abierto
       USE IN faclin
    ENDIF
    IF  .NOT. ll_carcli_abierto
       USE IN carcli
    ENDIF
    IF  .NOT. ll_cieentsal_abierto
       USE IN cieentsal
    ENDIF
    IF  .NOT. ll_clientes_abierto
       USE IN clientes
    ENDIF
    IF  .NOT. ll_facproc_abierto
       USE IN facproc
    ENDIF
    IF  .NOT. ll_carpro_abierto
       USE IN carpro
    ENDIF
    IF  .NOT. ll_articulos_abierto
       USE IN articulos
    ENDIF
    IF  .NOT. ll_plan2009_abierto
       USE IN plan2009
    ENDIF
    IF  .NOT. ll_resumendia_abierto
       USE IN resumendia
    ENDIF
    actualizarresumenfacturacion("")
    IF  .NOT. EMPTY(lcalias)
       SELECT (lcalias)
    ENDIF
 CATCH TO oerr
    llresultado = .F.
    _messagebox(traducir(pcidioma, "Error al Generar el Resumen Diario.")+CHR(13)+oerr.message, 48, traducir(pcidioma, "Atenci�n"))
 ENDTRY
 RETURN (llresultado)
ENDFUNC
**
FUNCTION ClienteConContrato
 RETURN .T.
ENDFUNC
**
FUNCTION __ClienteConContrato_DUNASOFT_DISABLED
 PARAMETER tctextomsg
 IF PCOUNT()<1
    tctextomsg = traducir(pcidioma, "Atenci�n")
 ENDIF
 LOCAL lohttp, llresultado
 llresultado = .T.
 TRY
    lohttp = SuiteGetHttpLocal()
    lohttp.httpweb = pcurlwebdspc
    IF  .NOT. lohttp.clienteconcontrato(ALLTRIM(cfgclienteweb), ALLTRIM(cfgpasswordweb))
       _messagebox(lohttp.msgerror, 48, tctextomsg)
       llresultado = .F.
    ELSE
    ENDIF
 CATCH TO oerr
    _messagebox(traducir(pcidioma, "Error al identificar cliente en DunaSoft.")+CHR(13)+oerr.message, 48, tctextomsg)
    llresultado = .F.
 ENDTRY
 RELEASE lohttp
 RETURN (llresultado)
ENDFUNC
**
FUNCTION ActualizarResumenFacturacion
 RETURN .T.
ENDFUNC
**
FUNCTION __ActualizarResumenFacturacion_DUNASOFT_DISABLED
 PARAMETER tcfiltro
 LOCAL lohttp, llresultado
 llresultado = .T.
 TRY
    ll_resumendia_abierto = .F.
    IF  .NOT. USED("resumendia")
       USE SHARED dbf/resumendia AGAIN ALIAS resumendia IN 0
    ELSE
       ll_resumendia_abierto = .T.
    ENDIF
    SELECT resumendia
    SET ORDER TO diares
    lohttp = SuiteGetHttpLocal()
    lohttp.httpweb = pcurlwebdspc
    IF  .NOT. EMPTY(tcfiltro)
       SELECT *  FROM resumendia  WHERE &tcfiltro  ORDER BY diares  INTO CURSOR tmpresumendia
    ELSE
       SELECT * FROM resumendia WHERE enviar ORDER BY diares INTO CURSOR tmpResumendia
    ENDIF
    SELECT tmpresumendia
    SCAN
       lcclientesnuevos = PADL(ALLTRIM(STR(tmpresumendia.nclinue)), 5, " ")+PADL(ALLTRIM(STR(tmpresumendia.nclinueh)), 5, " ")+PADL(ALLTRIM(STR(tmpresumendia.nclinuem)), 5, " ")+PADL(ALLTRIM(STR(tmpresumendia.nclinuen)), 5, " ")
       IF  .NOT. lohttp.styledunasoft_guardarresumenfacturacion(tmpresumendia.diares, tmpresumendia.ntic00, tmpresumendia.nticres, tmpresumendia.totfac00, tmpresumendia.totfacres, tmpresumendia.totdeuven, tmpresumendia.totser00, tmpresumendia.totserres, tmpresumendia.nser00, tmpresumendia.nserres, tmpresumendia.totpro00, tmpresumendia.totprores, tmpresumendia.npro00, tmpresumendia.nprores, tmpresumendia.nclih, tmpresumendia.nclim, tmpresumendia.nclin, lcclientesnuevos, tmpresumendia.totcli, tmpresumendia.totentcaj, tmpresumendia.totsalcaj, tmpresumendia.totfaccom, tmpresumendia.totdeucom, tmpresumendia.nreservas, tmpresumendia.nresfac, tmpresumendia.restie, tmpresumendia.restiefac)
          _messagebox("Resumen Facturaci�n:	"+ALLTRIM(DTOC(tmpresumendia.diares))+CHR(13)+lohttp.msgerror, 48, traducir(pcidioma, "Atenci�n"))
          llresultado = .F.
          EXIT
       ELSE
          SELECT resumendia
          IF SEEK(DTOS(tmpresumendia.diares))
             REPLACE enviar WITH .F.
          ENDIF
       ENDIF
    ENDSCAN
 CATCH TO oerr
    _messagebox(oerr.message+"||"+"[Proc.] "+oerr.procedure, 48, traducir(pcidioma, "Atenci�n"))
    llresultado = .F.
 ENDTRY
 IF  .NOT. ll_resumendia_abierto
    USE IN resumendia
 ENDIF
 IF USED("tmpResumendia")
    USE IN tmpresumendia
 ENDIF
 RELEASE lohttp
 RETURN (llresultado)
ENDFUNC
**
FUNCTION sectohour
 LPARAMETERS m.parm1
 LOCAL m.dummy, m.hora, m.minuto, m.segundo
 m.parm1 = INT(m.parm1)
 m.hora = INT(m.parm1/3600)
 m.parm1 = m.parm1-(m.hora*3600)
 m.minuto = INT(m.parm1/60)
 m.segundo = m.parm1-(m.minuto*60)
 m.parm1 = STRTRAN(STR(m.hora, 4, 0)+":"+STR(m.minuto, 2, 0)+":"+STR(m.segundo, 2, 0), " ", "0")
 IF m.parm1="0"
    m.parm1 = SUBSTR(m.parm1, 3)
    IF m.parm1="0"
       m.parm1 = SUBSTR(m.parm1, 2)
    ENDIF
 ENDIF
 RETURN m.parm1
ENDFUNC
**
FUNCTION Generar_eFactura
 PARAMETER tcfactura, tlerrormsg_efactura, tlfacturatest
 LOCAL lcaliasinicial, llempresaabierta, llresultado, llfaccababierta, lcfaccaborder, lnfaccabrecno, llfaclinabierta, lcfaclinorder, lnfaclinrecno, llclientesabierta, lcclientesorder, lnclientesrecno, lcpoint
 IF PCOUNT()<3
    tlfacturatest = .F.
 ENDIF
 IF tlfacturatest
    tcfactura = "Fact_Test"
 ELSE
    IF  .NOT. cfgefacturaprueba
       tlerrormsg_efactura = traducir(pcidioma, "Error en la generaci�n de la eFactura:")+" "+ALLTRIM(STR(faccab.ejefac, 4))+"/"+ALLTRIM(faccab.serfac)+"/"+ALLTRIM(STR(faccab.numfac, 10))+CHR(13)+traducir(pcidioma, "No se ha realizado la 'Prueba de eFactura' en la Configuraci�n de la Empresa.")
       RETURN (.F.)
    ENDIF
 ENDIF
 IF EMPTY(ALLTRIM(cfgefacturaarchivocer)) .OR. EMPTY(ALLTRIM(cfgefacturaarchivokey)) .OR.  .NOT. FILE(ALLTRIM(cfgefacturaarchivocer)) .OR.  .NOT. FILE(ALLTRIM(cfgefacturaarchivokey)) .OR. EMPTY(ALLTRIM(cfgefacturapasswordkey))
    tlerrormsg_efactura = traducir(pcidioma, "Error en la generaci�n de la eFactura:")+" "+IIF(tlfacturatest, "Factura Test", ALLTRIM(STR(faccab.ejefac, 4))+"/"+ALLTRIM(faccab.serfac)+"/"+ALLTRIM(STR(faccab.numfac, 10)))+CHR(13)+traducir(pcidioma, "Revise los Certificados en la Configuraci�n de la Empresa.")
    RETURN (.F.)
 ENDIF
 llresultado = .T.
 tntimbrerestantes = 0
 llempresaabierta = .T.
 llfaccababierta = .T.
 lcfaccaborder = ""
 lnfaccabrecno = 0
 llfaclinabierta = .T.
 lcfaclinorder = ""
 lnfaclinrecno = 0
 llclientesabierta = .T.
 lcclientesorder = ""
 lnclientesrecno = 0
 lcpoint = SET("Point")
 SET POINT TO "."
 lcaliasinicial = ALIAS()
 TRY
    IF  .NOT. tlfacturatest
       IF  .NOT. USED("empresa")
          llempresaabierta = .F.
          USE SHARED empresa AGAIN IN 0
       ENDIF
       SELECT empresa
       GOTO TOP
       IF  .NOT. USED("faccab")
          llfaccababierta = .F.
          USE SHARED dbf/faccab AGAIN IN 0
       ELSE
          SELECT faccab
          lcfaccaborder = ORDER()
          lnfaccabrecno = RECNO()
       ENDIF
       SELECT faccab
       SET ORDER TO numfac
       IF  .NOT. SEEK(tcfactura)
          tlerrormsg_efactura = traducir(pcidioma, "Error en la generaci�n de la eFactura:")+" "+ALLTRIM(STR(faccab.ejefac, 4))+"/"+ALLTRIM(faccab.serfac)+"/"+ALLTRIM(STR(faccab.numfac, 10))+CHR(13)+traducir(pcidioma, "No se encuentra la Factura.")
          llresultado = .F.
       ENDIF
       IF llresultado
          IF  .NOT. USED("Faclin")
             llfaclinabierta = .F.
             USE SHARED dbf/Faclin AGAIN IN 0
          ELSE
             SELECT faclin
             lcfaclinorder = ORDER()
             lnfaclinrecno = RECNO()
          ENDIF
          SELECT faclin
          SET ORDER TO linfac
       ENDIF
       IF llresultado
          IF  .NOT. USED("Clientes")
             llclientesabierta = .F.
             USE SHARED dbf/Clientes AGAIN IN 0
          ELSE
             SELECT clientes
             lcclientesorder = ORDER()
             lnclientesrecno = RECNO()
          ENDIF
          SELECT clientes
          SET ORDER TO codcli
          IF  .NOT. SEEK(faccab.codcli)
             tlerrormsg_efactura = traducir(pcidioma, "Error en la generaci�n de la eFactura:")+" "+ALLTRIM(STR(faccab.ejefac, 4))+"/"+ALLTRIM(faccab.serfac)+"/"+ALLTRIM(STR(faccab.numfac, 10))+CHR(13)+traducir(pcidioma, "No se encuentra el Cliente.")
             llresultado = .F.
          ENDIF
       ENDIF
    ENDIF
    IF llresultado
       LOCAL root AS IXMLDOMPROCESSINGINSTRUCTION
       LOCAL ncomprobante AS XMLNODE
       LOCAL nemisor AS XMLNODE
       LOCAL nrelacionados AS XMLNODE
       LOCAL nrelacionado AS XMLNODE
       LOCAL nreceptor AS XMLNODE
       LOCAL ndomicilofiscal AS XMLNODE
       LOCAL nexpedidoen AS XMLNODE
       LOCAL nregimenfiscal AS XMLNODE
       LOCAL nregimenfiscal2 AS XMLNODE
       LOCAL nconceptos AS XMLNODE
       LOCAL nconcepto AS XMLNODE
       LOCAL nimpuestos AS XMLNODE
       LOCAL ntraslados AS XMLNODE
       LOCAL ntraslado AS XMLNODE
       LOCAL ntraslado2 AS XMLNODE
       LOCAL ntraslado3 AS XMLNODE
       LOCAL ntraslado4 AS XMLNODE
       LOCAL ninformacionaduanera AS XMLNODE
       LOCAL naddenda AS XMLNODE
       LOCAL ninfoadicional AS XMLNODE
       LOCAL ncomplemento AS XMLNODE
       LOCAL nimpuestoslinea AS XMLNODE
       LOCAL ntrasladoslinea AS XMLNODE
       LOCAL ntrasladolinea AS XMLNODE
       LOCAL lcversioncfdi, lcnocertificado, lccertificado, lcstrsello, lccadenaoriginal
       lcversioncfdi = "3.3"
       lcformapagounica = "PAGO EN UNA SOLA EXHIBICION"
       lcnocertificado = ""
       lccertificado = ""
       lcstrsello = ""
       lccadenaoriginal = ""
       llresultado = efactura_getnocertificado(@tlerrormsg_efactura, @lcnocertificado)
       IF EMPTY(lcnocertificado)
          llresultado = .F.
       ENDIF
       lccadenaoriginal = efactura_cadenaoriginal(lcversioncfdi, lcformapagounica, tcfactura, tlfacturatest, lcnocertificado)
       IF EMPTY(lccadenaoriginal)
          llresultado = .F.
       ENDIF
       IF llresultado
          llresultado = efactura_sellodigital(@tlerrormsg_efactura, lccadenaoriginal, @lcstrsello, @lcnocertificado, @lccertificado)
       ENDIF
       IF llresultado
          cfdxml = CREATEOBJECT("msxml2.DOMDocument")
          root = cfdxml.createprocessinginstruction("xml", "version='1.0' encoding='UTF-8'")
          cfdxml.insertbefore(root, cfdxml.documentelement)
          ncomprobante = cfdxml.createnode(1, "cfdi:Comprobante", "http://www.sat.gob.mx/cfd/3")
          ncomprobante.setattribute("xmlns:cfdi", "http://www.sat.gob.mx/cfd/3")
          ncomprobante.setattribute("xmlns:xsi", "http://www.w3.org/2001/XMLSchema-instance")
          ncomprobante.setattribute("xsi:schemaLocation", "http://www.sat.gob.mx/cfd/3 http://www.sat.gob.mx/sitio_internet/cfd/3/cfdv33.xsd")
          IF LEN(qtarchrinval(lcversioncfdi))>0
             ncomprobante.setattribute("Version", qtarchrinval(lcversioncfdi))
          ENDIF
          IF LEN(qtarchrinval(IIF(tlfacturatest, "A", faccab.serfac)))>0
             ncomprobante.setattribute("Serie", IIF(tlfacturatest, "A", qtarchrinval(faccab.serfac)))
          ENDIF
          ncomprobante.setattribute("Folio", IIF(tlfacturatest, ALLTRIM(STR(YEAR(DATE())))+"/A/1", ALLTRIM(STR(faccab.ejefac, 4))+"/"+ALLTRIM(faccab.serfac)+"/"+ALLTRIM(STR(faccab.numfac, 10))))
          lcfechaformateada = IIF(tlfacturatest, ALLTRIM(STR(YEAR(DATE())))+"-"+PADL(ALLTRIM(STR(MONTH(DATE()))), 2, "0")+"-"+PADL(ALLTRIM(STR(DAY(DATE()))), 2, "0")+"T00:05:00", ALLTRIM(STR(YEAR(faccab.fecfac)))+"-"+PADL(ALLTRIM(STR(MONTH(faccab.fecfac))), 2, "0")+"-"+PADL(ALLTRIM(STR(DAY(faccab.fecfac))), 2, "0")+"T"+IIF( .NOT. EMPTY(ALLTRIM(faccab.hora)), ALLTRIM(faccab.hora), "00:00")+":00")
          IF LEN(qtarchrinval(lcfechaformateada))>0
             ncomprobante.setattribute("Fecha", qtarchrinval(lcfechaformateada))
          ENDIF
          IF LEN(qtarchrinval(lcstrsello))>0
             ncomprobante.setattribute("Sello", qtarchrinval(lcstrsello))
          ENDIF
          IF LEN(qtarchrinval(lcnocertificado))>0
             ncomprobante.setattribute("NoCertificado", qtarchrinval(lcnocertificado))
          ENDIF
          IF LEN(qtarchrinval(lccertificado))>0
             ncomprobante.setattribute("Certificado", qtarchrinval(lccertificado))
          ENDIF
          ncomprobante.setattribute("SubTotal", IIF(tlfacturatest, "86.21", ALLTRIM(STR(faccab.totimpbas, 12, 2))))
          IF LEN(qtarchrinval(lccertificado))>0
             ncomprobante.setattribute("Moneda", "MXN")
          ENDIF
          ncomprobante.setattribute("Total", IIF(tlfacturatest, "100.00", ALLTRIM(STR(faccab.totfac, 12, 2))))
          ncomprobante.setattribute("TipoDeComprobante", "I")
          IF LEN(qtarchrinval(IIF(tlfacturatest, "01", faccab.forpag1)))>0
             ncomprobante.setattribute("FormaPago", IIF(tlfacturatest, "01", qtarchrinval(damevalor("dbf/forpag", "fpefac", faccab.forpag1, "codfp"))))
          ENDIF
          ncomprobante.setattribute("MetodoPago", "PUE")
          ncomprobante.setattribute("CondicionesDePago", "CONTADO")
          ncomprobante.setattribute("TipoCambio", "1")
          IF LEN(qtarchrinval(empresa.pobemp))>0
             ncomprobante.setattribute("LugarExpedicion", qtarchrinval(empresa.codpos))
          ENDIF
          nemisor = cfdxml.createnode(1, "cfdi:Emisor", "http://www.sat.gob.mx/cfd/3")
          IF LEN(qtarchrinval(empresa.nifemp))>0
             nemisor.setattribute("Rfc", qtarchrinval(empresa.nifemp))
          ENDIF
          IF LEN(qtarchrinval(empresa.razemp))>0
             nemisor.setattribute("Nombre", qtarchrinval(empresa.razemp))
          ENDIF
          IF LEN(qtarchrinval(cfgregimenfiscalempresa))>0
             nemisor.setattribute("RegimenFiscal", qtarchrinval(cfgregimenfiscalempresa))
          ENDIF
          ncomprobante.appendchild(nemisor)
          nreceptor = cfdxml.createnode(1, "cfdi:Receptor", "http://www.sat.gob.mx/cfd/3")
          lcnifcliente = IIF(tlfacturatest, "XAXX010101000", IIF(EMPTY(ALLTRIM(clientes.dnicli)), "XAXX010101000", ALLTRIM(clientes.dnicli)))
          IF LEN(qtarchrinval(lcnifcliente))>0
             nreceptor.setattribute("Rfc", qtarchrinval(lcnifcliente))
          ENDIF
          lcnombreapellidoscliente = IIF(tlfacturatest, "CLIENTE PRUEBAS APELLIDOS", ALLTRIM(ALLTRIM(clientes.nomcli)+" "+ALLTRIM(clientes.ape1cli)))
          IF LEN(qtarchrinval(lcnombreapellidoscliente))>0
             nreceptor.setattribute("Nombre", qtarchrinval(lcnombreapellidoscliente))
          ENDIF
          nreceptor.setattribute("UsoCFDI", "P01")
          ncomprobante.appendchild(nreceptor)
          nconceptos = cfdxml.createnode(1, "cfdi:Conceptos", "http://www.sat.gob.mx/cfd/3")
          IF tlfacturatest
             nconcepto = cfdxml.createnode(1, "cfdi:Concepto", "http://www.sat.gob.mx/cfd/3")
             nconcepto.setattribute("ClaveProdServ", "01010101")
             nconcepto.setattribute("ClaveUnidad", "EA")
             nconcepto.setattribute("NoIdentificacion", "00101")
             nconcepto.setattribute("Cantidad", "1")
             nconcepto.setattribute("Unidad", "Unidad")
             nconcepto.setattribute("Descripcion", "ARTICULO PRUEBAS")
             nconcepto.setattribute("ValorUnitario", "86.21")
             nconcepto.setattribute("Importe", "86.21")
             nimpuestoslinea = cfdxml.createnode(1, "cfdi:Impuestos", "http://www.sat.gob.mx/cfd/3")
             ntrasladoslinea = cfdxml.createnode(1, "cfdi:Traslados", "http://www.sat.gob.mx/cfd/3")
             ntrasladolinea = cfdxml.createnode(1, "cfdi:Traslado", "http://www.sat.gob.mx/cfd/3")
             ntrasladolinea.setattribute("Base", "86.21")
             ntrasladolinea.setattribute("Impuesto", "002")
             ntrasladolinea.setattribute("TipoFactor", "Tasa")
             ntrasladolinea.setattribute("TasaOCuota", "0.160000")
             ntrasladolinea.setattribute("Importe", "13.79")
             ntrasladoslinea.appendchild(ntrasladolinea)
             nimpuestoslinea.appendchild(ntrasladoslinea)
             nconcepto.appendchild(nimpuestoslinea)
             nconceptos.appendchild(nconcepto)
          ELSE
             SELECT faclin
             IF SEEK(tcfactura)
                lnnumlineas = 0
                lnsumasiniva = 0
                lnsumaiva = 0
                SCAN REST WHILE STR(faclin.ejefac, 4)+faclin.serfac+STR(faclin.numfac, 10)=tcfactura
                   lnnumlineas = lnnumlineas+1
                   DIMENSION laarraylineas(lnnumlineas, 11)
                   lnsubtotlinea = 0
                   lcsubtotlinea = ""
                   lcvalorunitario = ""
                   lctipoiva = "faccab.iva"+ALLTRIM(STR(faclin.taniva))
                   lnporcentajeiva = &lctipoiva / 100
                   IF cfgivainc
                      lnsubtotlinea = ROUND( ( ( faclin.subtot / ( &lctipoiva + 100 ) ) * 100 ), 6 )
                      lnimporteiva = faclin.subtot-lnsubtotlinea
                   ELSE
                      lnsubtotlinea = ROUND(faclin.subtot, 6)
                      lnimporteiva = ROUND(lnporcentajeiva*lnsubtotlinea, 6)
                   ENDIF
                   lnvalorunitario = ROUND(lnsubtotlinea/faclin.cant, 6)
                   laarraylineas(lnnumlineas, 1) = faclin.codart
                   laarraylineas(lnnumlineas, 2) = faclin.cant
                   laarraylineas(lnnumlineas, 3) = faclin.desart
                   laarraylineas(lnnumlineas, 4) = lnsubtotlinea
                   laarraylineas(lnnumlineas, 5) = "Unidad"
                   laarraylineas(lnnumlineas, 6) = lnvalorunitario
                   laarraylineas(lnnumlineas, 7) = "002"
                   laarraylineas(lnnumlineas, 8) = "Tasa"
                   laarraylineas(lnnumlineas, 9) = lnporcentajeiva
                   laarraylineas(lnnumlineas, 10) = lnimporteiva
                   laarraylineas(lnnumlineas, 11) = damevalor("dbf/articulos", "matpri", faclin.codart, "codart")
                   lnsumasiniva = lnsumasiniva+lnsubtotlinea
                   lnsumaiva = lnsumaiva+lnimporteiva
                   SELECT faclin
                ENDSCAN
                IF ROUND(lnsumasiniva, cfgredond)<>ROUND(faccab.totimpbas, cfgredond)
                   laarraylineas(1, 4) = laarraylineas(1, 4)+(ROUND(faccab.totimpbas, cfgredond)-ROUND(lnsumasiniva, cfgredond))
                   laarraylineas(1, 6) = ROUND(laarraylineas(1, 4)/laarraylineas(lnnumlineas, 2), cfgredond)
                ENDIF
                IF ROUND(lnsumaiva, cfgredond)<>ROUND(faccab.totimpiva, cfgredond)
                   laarraylineas(1, 10) = laarraylineas(1, 10)+(ROUND(faccab.totimpiva, cfgredond)-ROUND(lnsumaiva, cfgredond))
                ENDIF
                FOR lncontnodo = 1 TO lnnumlineas
                   nconcepto = cfdxml.createnode(1, "cfdi:Concepto", "http://www.sat.gob.mx/cfd/3")
                   nconcepto.setattribute("ClaveProdServ", "01010101")
                   nconcepto.setattribute("ClaveUnidad", IIF(laarraylineas(lncontnodo, 11)=1, "EA", "E48"))
                   IF LEN(qtarchrinval(laarraylineas(lncontnodo, 1)))>0
                      nconcepto.setattribute("NoIdentificacion", qtarchrinval(laarraylineas(lncontnodo, 1)))
                   ENDIF
                   IF LEN(qtarchrinval(ALLTRIM(STR(laarraylineas(lncontnodo, 2), 10, cfgredcant))))>0
                      nconcepto.setattribute("Cantidad", qtarchrinval(ALLTRIM(STR(laarraylineas(lncontnodo, 2), 10, cfgredcant))))
                   ENDIF
                   nconcepto.setattribute("Unidad", laarraylineas(lncontnodo, 5))
                   IF LEN(qtarchrinval(laarraylineas(lncontnodo, 3)))>0
                      nconcepto.setattribute("Descripcion", qtarchrinval(laarraylineas(lncontnodo, 3)))
                   ENDIF
                   IF LEN(qtarchrinval(ALLTRIM(STR(laarraylineas(lncontnodo, 6), 12, cfgredond))))>0
                      nconcepto.setattribute("ValorUnitario", qtarchrinval(ALLTRIM(STR(laarraylineas(lncontnodo, 6), 12, 6))))
                   ENDIF
                   IF LEN(qtarchrinval(ALLTRIM(STR(laarraylineas(lncontnodo, 4), 12, cfgredond))))>0
                      nconcepto.setattribute("Importe", qtarchrinval(ALLTRIM(STR(laarraylineas(lncontnodo, 4), 12, 6))))
                   ENDIF
                   nimpuestoslinea = cfdxml.createnode(1, "cfdi:Impuestos", "http://www.sat.gob.mx/cfd/3")
                   ntrasladoslinea = cfdxml.createnode(1, "cfdi:Traslados", "http://www.sat.gob.mx/cfd/3")
                   ntrasladolinea = cfdxml.createnode(1, "cfdi:Traslado", "http://www.sat.gob.mx/cfd/3")
                   ntrasladolinea.setattribute("Base", qtarchrinval(ALLTRIM(STR(laarraylineas(lncontnodo, 4), 12, 6))))
                   ntrasladolinea.setattribute("Impuesto", laarraylineas(lncontnodo, 7))
                   ntrasladolinea.setattribute("TipoFactor", laarraylineas(lncontnodo, 8))
                   ntrasladolinea.setattribute("TasaOCuota", qtarchrinval(ALLTRIM(STR(laarraylineas(lncontnodo, 9), 12, 6))))
                   ntrasladolinea.setattribute("Importe", qtarchrinval(ALLTRIM(STR(laarraylineas(lncontnodo, 10), 12, 6))))
                   ntrasladoslinea.appendchild(ntrasladolinea)
                   nimpuestoslinea.appendchild(ntrasladoslinea)
                   nconcepto.appendchild(nimpuestoslinea)
                   nconceptos.appendchild(nconcepto)
                ENDFOR
             ENDIF
          ENDIF
          ncomprobante.appendchild(nconceptos)
          nimpuestos = cfdxml.createnode(1, "cfdi:Impuestos", "http://www.sat.gob.mx/cfd/3")
          IF tlfacturatest
             nimpuestos.setattribute("TotalImpuestosTrasladados", "13.79")
          ELSE
             nimpuestos.setattribute("TotalImpuestosTrasladados", qtarchrinval(ALLTRIM(STR(faccab.totimpiva, 12, cfgredond))))
          ENDIF
          ntraslados = cfdxml.createnode(1, "cfdi:Traslados", "http://www.sat.gob.mx/cfd/3")
          IF tlfacturatest
             ntraslado = cfdxml.createnode(1, "cfdi:Traslado", "http://www.sat.gob.mx/cfd/3")
             ntraslado.setattribute("Impuesto", "002")
             ntraslado.setattribute("TipoFactor", "Tasa")
             ntraslado.setattribute("TasaOCuota", "0.160000")
             ntraslado.setattribute("Importe", "13.79")
             ntraslados.appendchild(ntraslado)
          ELSE
             IF faccab.impiva1<>0
                ntraslado = cfdxml.createnode(1, "cfdi:Traslado", "http://www.sat.gob.mx/cfd/3")
                ntraslado.setattribute("Impuesto", "002")
                ntraslado.setattribute("TipoFactor", "Tasa")
                ntraslado.setattribute("TasaOCuota", qtarchrinval(ALLTRIM(STR(faccab.iva1/100, 12, 6))))
                ntraslado.setattribute("Importe", qtarchrinval(ALLTRIM(STR(faccab.impiva1, 12, cfgredond))))
                ntraslados.appendchild(ntraslado)
             ENDIF
             IF faccab.impiva2<>0
                ntraslado2 = cfdxml.createnode(1, "cfdi:Traslado", "http://www.sat.gob.mx/cfd/3")
                ntraslado.setattribute("Impuesto", "002")
                ntraslado.setattribute("TipoFactor", "Tasa")
                ntraslado.setattribute("TasaOCuota", qtarchrinval(ALLTRIM(STR(faccab.iva2/100, 12, 6))))
                ntraslado.setattribute("Importe", qtarchrinval(ALLTRIM(STR(faccab.impiva2, 12, cfgredond))))
                ntraslados.appendchild(ntraslado2)
             ENDIF
             IF faccab.impiva3<>0
                ntraslado3 = cfdxml.createnode(1, "cfdi:Traslado", "http://www.sat.gob.mx/cfd/3")
                ntraslado.setattribute("Impuesto", "002")
                ntraslado.setattribute("TipoFactor", "Tasa")
                ntraslado.setattribute("TasaOCuota", qtarchrinval(ALLTRIM(STR(faccab.iva3/100, 12, 6))))
                ntraslado.setattribute("Importe", qtarchrinval(ALLTRIM(STR(faccab.impiva3, 12, cfgredond))))
                ntraslados.appendchild(ntraslado3)
             ENDIF
             IF faccab.impiva4<>0
                ntraslado4 = cfdxml.createnode(1, "cfdi:Traslado", "http://www.sat.gob.mx/cfd/3")
                ntraslado.setattribute("Impuesto", "002")
                ntraslado.setattribute("TipoFactor", "Tasa")
                ntraslado.setattribute("TasaOCuota", qtarchrinval(ALLTRIM(STR(faccab.iva4/100, 12, 6))))
                ntraslado.setattribute("Importe", qtarchrinval(ALLTRIM(STR(faccab.impiva4, 12, cfgredond))))
                ntraslados.appendchild(ntraslado4)
             ENDIF
             IF faccab.impbas4<>0 .AND. faccab.impiva4=0
                ntraslado4 = cfdxml.createnode(1, "cfdi:Traslado", "http://www.sat.gob.mx/cfd/3")
                ntraslado.setattribute("Impuesto", "002")
                ntraslado.setattribute("TipoFactor", "Tasa")
                ntraslado.setattribute("TasaOCuota", qtarchrinval(ALLTRIM(STR(faccab.iva4/100, 12, 6))))
                ntraslado.setattribute("Importe", qtarchrinval(ALLTRIM(STR(faccab.impiva4, 12, cfgredond))))
                ntraslados.appendchild(ntraslado4)
             ENDIF
          ENDIF
          nimpuestos.appendchild(ntraslados)
          ncomprobante.appendchild(nimpuestos)
          cfdxml.appendchild(ncomprobante)
          IF  .NOT. tlfacturatest
             SELECT faccab
             IF RLOCK("faccab")
                REPLACE hash WITH lcstrsello
                REPLACE hash1 WITH lccadenaoriginal
                REPLACE cert WITH lccertificado
                REPLACE nocert WITH lcnocertificado
                REPLACE bloqueado WITH .T.
                UNLOCK IN faccab
             ELSE
                tlerrormsg_efactura = traducir(pcidioma, "Error en la generaci�n de la eFactura:")+" "+IIF(tlfacturatest, "Factura Test", ALLTRIM(STR(faccab.ejefac, 4))+"/"+ALLTRIM(faccab.serfac)+"/"+ALLTRIM(STR(faccab.numfac, 10)))+CHR(13)+traducir(pcidioma, "Registro bloqueado. Vuelva a intentarlo en breves momentos.")
                llresultado = .F.
             ENDIF
          ENDIF
          IF llresultado
             lcfolfis = ""
             lcfecfolfis = ""
             lchashsat = ""
             lchash1sat = ""
             lcnocertsat = ""
             lctimbrexml = ""
             tntimbrerestantes = 0
             lcrfcsat = ""
             lcleysat = ""
             ows = CREATEOBJECT("CFDI_ComercioDigital_WebService", tlfacturatest)
             ows.gettimbre(cfdxml, ALLTRIM(cfgefacturausuariopac), ALLTRIM(cfgefacturapasswordpac), @lcfolfis, @lcfecfolfis, @lchashsat, @lchash1sat, @lcnocertsat, @tntimbrerestantes, @lctimbrexml, @lcrfcsat, @lcleysat)
             IF ows.istatus<>0
                tlerrormsg_efactura = traducir(pcidioma, "Error en la generaci�n de la eFactura:")+" "+IIF(tlfacturatest, "Factura Test", ALLTRIM(STR(faccab.ejefac, 4))+"/"+ALLTRIM(faccab.serfac)+"/"+ALLTRIM(STR(faccab.numfac, 10)))+CHR(13)+CHR(13)+"["+traducir(pcidioma, "Mensaje de Error del PAC:")+"] "+ows.serror
                llresultado = .F.
             ENDIF
             IF llresultado
                IF  .NOT. DIRECTORY(ADDBS(ADDBS(SYS(5)+SYS(2003))+ALLTRIM(cfgefacturarutaxml)))
                   MD (ADDBS(ADDBS(SYS(5)+SYS(2003))+ALLTRIM(cfgefacturarutaxml)))
                ENDIF
                lcarchivoxml = ADDBS(ADDBS(SYS(5)+SYS(2003))+ALLTRIM(cfgefacturarutaxml))+"Factura_"+IIF(tlfacturatest, "Test", ALLTRIM(STR(faccab.ejefac, 4))+"-"+ALLTRIM(faccab.serfac)+"-"+ALLTRIM(STR(faccab.numfac, 10)))+".xml"
                cfdxml.save(lcarchivoxml)
                IF  .NOT. FILE(lcarchivoxml)
                   tlerrormsg_efactura = traducir(pcidioma, "Error en la generaci�n de la eFactura:")+" "+IIF(tlfacturatest, "Factura Test", ALLTRIM(STR(faccab.ejefac, 4))+"/"+ALLTRIM(faccab.serfac)+"/"+ALLTRIM(STR(faccab.numfac, 10)))+CHR(13)+traducir(pcidioma, "No se ha generado el fichero XML")
                   llresultado = .F.
                ENDIF
             ENDIF
             IF llresultado
                IF  .NOT. insertatimbre(lcarchivoxml, lctimbrexml)
                   tlerrormsg_efactura = traducir(pcidioma, "Error en la generaci�n de la eFactura:")+" "+IIF(tlfacturatest, "Factura Test", ALLTRIM(STR(faccab.ejefac, 4))+"/"+ALLTRIM(faccab.serfac)+"/"+ALLTRIM(STR(faccab.numfac, 10)))+CHR(13)+traducir(pcidioma, "No se ha podido a�adir el Timbre al XML.")
                   llresultado = .F.
                ENDIF
             ENDIF
             IF  .NOT. tlfacturatest
                IF llresultado
                   SELECT faccab
                   IF RLOCK("faccab")
                      REPLACE folfis WITH lcfolfis
                      REPLACE fecfolfis WITH lcfecfolfis
                      REPLACE hashsat WITH lchashsat
                      REPLACE hash1sat WITH lchash1sat
                      REPLACE nocertsat WITH lcnocertsat
                      REPLACE timbrepac WITH lctimbrexml
                      REPLACE rfcsat WITH lcrfcsat
                      REPLACE leysat WITH lcleysat
                      UNLOCK IN faccab
                   ELSE
                      tlerrormsg_efactura = traducir(pcidioma, "Error en la generaci�n de la eFactura:")+" "+IIF(tlfacturatest, "Factura Test", ALLTRIM(STR(faccab.ejefac, 4))+"/"+ALLTRIM(faccab.serfac)+"/"+ALLTRIM(STR(faccab.numfac, 10)))+CHR(13)+traducir(pcidioma, "Registro bloqueado. Vuelva a intentarlo en breves momentos.")
                      llresultado = .F.
                   ENDIF
                ENDIF
             ENDIF
          ENDIF
          IF llresultado
             lcrutaqr = ADDBS(ADDBS(SYS(5)+SYS(2003))+ALLTRIM(cfgefacturarutaxml))+"Factura_"+IIF(tlfacturatest, "Test", ALLTRIM(STR(faccab.ejefac, 4))+"-"+ALLTRIM(faccab.serfac)+"-"+ALLTRIM(STR(faccab.numfac, 10)))+"_QR.jpg"
             lctextoqr = "https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx" +  "?id=" + ALLTRIM( lcfolfis ) +  "&re=" + ALLTRIM( empresa.nifemp ) +  "&rr=" + IIF( tlfacturatest, "XAXX010101000", IIF( EMPTY( ALLTRIM( clientes.dnicli ) ), "XAXX010101000", ALLTRIM( clientes.dnicli ) ) ) +  "&tt=" + IIF( tlfacturatest, "100.00", ALLTRIM(STR( faccab.totfac, 12, 2 ) ) ) +  "&fe=" + RIGHT( ALLTRIM( lcstrsello ), 8 )
             DECLARE INTEGER SetConfiguration IN BarCodeLibrary.dll INTEGER, INTEGER
             DECLARE INTEGER GenerateFile IN BarCodeLibrary.dll STRING, STRING
             setconfiguration(6, 1)
             generatefile(lctextoqr, lcrutaqr)
             IF  .NOT. FILE(lcrutaqr)
                tlerrormsg_efactura = traducir(pcidioma, "Error en la generaci�n de la eFactura:")+" "+IIF(tlfacturatest, "Factura Test", ALLTRIM(STR(faccab.ejefac, 4))+"/"+ALLTRIM(faccab.serfac)+"/"+ALLTRIM(STR(faccab.numfac, 10)))+CHR(13)+traducir(pcidioma, "No se ha generado el c�digo de barras bidimensional.")
                llresultado = .F.
             ELSE
                IF  .NOT. tlfacturatest
                   SELECT faccab
                   IF RLOCK("faccab")
                      REPLACE rutaqr WITH lcrutaqr
                      UNLOCK IN faccab
                   ELSE
                      tlerrormsg_efactura = traducir(pcidioma, "Error en la generaci�n de la eFactura:")+" "+IIF(tlfacturatest, "Factura Test", ALLTRIM(STR(faccab.ejefac, 4))+"/"+ALLTRIM(faccab.serfac)+"/"+ALLTRIM(STR(faccab.numfac, 10)))+CHR(13)+traducir(pcidioma, "Registro bloqueado. Vuelva a intentarlo en breves momentos.")
                      llresultado = .F.
                   ENDIF
                ENDIF
             ENDIF
          ENDIF
       ENDIF
    ENDIF
 CATCH TO oerr
    tlerrormsg_efactura = traducir(pcidioma, "Error en la generaci�n de la eFactura:")+" "+IIF(tlfacturatest, "Factura Test", ALLTRIM(STR(faccab.ejefac, 4))+"/"+ALLTRIM(faccab.serfac)+"/"+ALLTRIM(STR(faccab.numfac, 10)))+CHR(13)+oerr.message
    llresultado = .F.
 ENDTRY
 SET POINT TO &lcpoint 
 IF  .NOT. tlfacturatest
    IF USED("empresa")
       IF  .NOT. llempresaabierta
          USE IN empresa
       ENDIF
    ENDIF
    IF USED("Faccab")
       IF  .NOT. llfaccababierta
          USE IN faccab
       ELSE
          SELECT faccab
          IF  .NOT. EMPTY(lcfaccaborder)
             SET ORDER TO &lcfaccaborder 
          ENDIF
          IF lnfaccabrecno<>0
             GOTO (lnfaccabrecno)
          ENDIF
       ENDIF
    ENDIF
    IF USED("faclin")
       IF  .NOT. llfaclinabierta
          USE IN faclin
       ELSE
          SELECT faclin
          IF  .NOT. EMPTY(lcfaclinorder)
             SET ORDER TO &lcfaclinorder 
          ENDIF
          IF lnfaclinrecno<>0
             GOTO (lnfaclinrecno)
          ENDIF
       ENDIF
    ENDIF
    IF USED("Clientes")
       IF  .NOT. llclientesabierta
          USE IN clientes
       ELSE
          SELECT clientes
          IF  .NOT. EMPTY(lcclientesorder)
             SET ORDER TO &lcclientesorder 
          ENDIF
          IF lnclientesrecno<>0
             GOTO (lnclientesrecno)
          ENDIF
       ENDIF
    ENDIF
 ENDIF
 SELECT &lcaliasinicial
 IF llresultado .AND. tntimbrerestantes=0
    _messagebox(traducir(pcidioma, "Aviso de N�mero de Timbres Restantes para Facturas Electr�nicas:")+CHR(13)+CHR(13)+traducir(pcidioma, "Timbres Restantes:")+" "+ALLTRIM(STR(tntimbrerestantes)), 64, traducir(pcidioma, "Atenci�n"))
 ELSE
    IF llresultado .AND. cfgefacturaavisotimbres<>0 .AND. tntimbrerestantes<=cfgefacturaavisotimbres
       _messagebox(traducir(pcidioma, "Aviso de N�mero de Timbres Restantes para Facturas Electr�nicas:")+CHR(13)+CHR(13)+traducir(pcidioma, "Timbres Restantes:")+" "+ALLTRIM(STR(tntimbrerestantes)), 64, traducir(pcidioma, "Atenci�n"))
    ENDIF
 ENDIF
 RETURN (llresultado)
ENDFUNC
**
FUNCTION QtarChrInval
 PARAMETER dato
 dato = ALLTRIM(dato)
 dato = CHRTRAN(dato, [&><"'], '.....')
 charanterior = ""
 newdato = ""
 FOR iq = 1 TO LEN(dato)
    charactual = SUBSTR(dato, iq, 1)
    IF  .NOT. (charanterior=" " .AND. charactual=" ")
       newdato = newdato+charactual
    ENDIF
    charanterior = charactual
 ENDFOR
 RETURN newdato
ENDFUNC
**
FUNCTION eFactura_CadenaOriginal
 PARAMETER tcversion, tcformapagounica, tcfactura, tlfacturatest, tcnocertificado
 LOCAL stroriginal
 stroriginal = ""
 stroriginal = stroriginal+"||"
 stroriginal = stroriginal+IIF(LEN(qtarchrinval(tcversion))=0, "", qtarchrinval(tcversion)+"|")
 stroriginal = stroriginal+IIF(tlfacturatest, "A", ALLTRIM(faccab.serfac))+"|"
 stroriginal = stroriginal+IIF(tlfacturatest, ALLTRIM(STR(YEAR(DATE())))+"/A/1", ALLTRIM(STR(faccab.ejefac, 4))+"/"+ALLTRIM(faccab.serfac)+"/"+ALLTRIM(STR(faccab.numfac, 10)))+"|"
 lcfechaformateada = IIF(tlfacturatest, ALLTRIM(STR(YEAR(DATE())))+"-"+PADL(ALLTRIM(STR(MONTH(DATE()))), 2, "0")+"-"+PADL(ALLTRIM(STR(DAY(DATE()))), 2, "0")+"T00:05:00", ALLTRIM(STR(YEAR(faccab.fecfac)))+"-"+PADL(ALLTRIM(STR(MONTH(faccab.fecfac))), 2, "0")+"-"+PADL(ALLTRIM(STR(DAY(faccab.fecfac))), 2, "0")+"T"+IIF( .NOT. EMPTY(ALLTRIM(faccab.hora)), ALLTRIM(faccab.hora), "00:00")+":00")
 stroriginal = stroriginal+IIF(LEN(qtarchrinval(lcfechaformateada))=0, "", qtarchrinval(lcfechaformateada)+"|")
 stroriginal = stroriginal+IIF(LEN(IIF(tlfacturatest, "01", qtarchrinval(damevalor("dbf/forpag", "fpefac", faccab.forpag1, "codfp"))))=0, "", IIF(tlfacturatest, "01", qtarchrinval(damevalor("dbf/forpag", "fpefac", faccab.forpag1, "codfp")))+"|")
 stroriginal = stroriginal+tcnocertificado+"|"
 stroriginal = stroriginal+"CONTADO"+"|"
 stroriginal = stroriginal+IIF(LEN(IIF(tlfacturatest, "86.21", qtarchrinval(ALLTRIM(STR(faccab.totimpbas, 12, cfgredond)))))=0, "", IIF(tlfacturatest, "86.21", qtarchrinval(ALLTRIM(STR(faccab.totimpbas, 12, cfgredond))))+"|")
 stroriginal = stroriginal+"MXN"+"|"
 stroriginal = stroriginal+"1"+"|"
 stroriginal = stroriginal+IIF(LEN(IIF(tlfacturatest, "100.00", qtarchrinval(ALLTRIM(STR(faccab.totfac, 12, cfgredond)))))=0, "", IIF(tlfacturatest, "100.00", qtarchrinval(ALLTRIM(STR(faccab.totfac, 12, cfgredond))))+"|")
 stroriginal = stroriginal+"I"+"|"
 stroriginal = stroriginal+"PUE"+"|"
 stroriginal = stroriginal+IIF(LEN(qtarchrinval(empresa.codpos))=0, "", qtarchrinval(empresa.codpos)+"|")
 stroriginal = stroriginal+IIF(LEN(qtarchrinval(empresa.nifemp))=0, "", qtarchrinval(empresa.nifemp)+"|")
 stroriginal = stroriginal+IIF(LEN(qtarchrinval(empresa.razemp))=0, "", qtarchrinval(empresa.razemp)+"|")
 stroriginal = stroriginal+IIF(LEN(qtarchrinval(cfgregimenfiscalempresa))=0, "", qtarchrinval(cfgregimenfiscalempresa)+"|")
 lcnifcliente = IIF(tlfacturatest, "XAXX010101000", IIF(EMPTY(ALLTRIM(clientes.dnicli)), "XAXX010101000", ALLTRIM(clientes.dnicli)))
 stroriginal = stroriginal+IIF(LEN(qtarchrinval(lcnifcliente))=0, "", qtarchrinval(lcnifcliente)+"|")
 lcnombreapellidoscliente = IIF(tlfacturatest, "CLIENTE PRUEBAS APELLIDOS", ALLTRIM(ALLTRIM(clientes.nomcli)+" "+ALLTRIM(clientes.ape1cli)))
 stroriginal = stroriginal+IIF(LEN(qtarchrinval(lcnombreapellidoscliente))=0, "", qtarchrinval(lcnombreapellidoscliente)+"|")
 stroriginal = stroriginal+"P01"+"|"
 IF tlfacturatest
    stroriginal = stroriginal+"01010101"+"|"
    stroriginal = stroriginal+"00101"+"|"
    stroriginal = stroriginal+"1"+"|"
    stroriginal = stroriginal+"EA"+"|"
    stroriginal = stroriginal+"Unidad"+"|"
    stroriginal = stroriginal+"ARTICULO PRUEBAS"+"|"
    stroriginal = stroriginal+"86.21"+"|"
    stroriginal = stroriginal+"86.21"+"|"
    stroriginal = stroriginal+"86.21"+"|"
    stroriginal = stroriginal+"002"+"|"
    stroriginal = stroriginal+"Tasa"+"|"
    stroriginal = stroriginal+"0.160000"+"|"
    stroriginal = stroriginal+"13.79"+"|"
 ELSE
    SELECT faclin
    IF SEEK(tcfactura)
       lnnumlineas = 0
       lnsumasiniva = 0
       lnsumaiva = 0
       SCAN REST WHILE STR(faclin.ejefac, 4)+faclin.serfac+STR(faclin.numfac, 10)=tcfactura
          lnnumlineas = lnnumlineas+1
          DIMENSION laarraylineas(lnnumlineas, 11)
          lnsubtotlinea = 0
          lcsubtotlinea = ""
          lcvalorunitario = ""
          lctipoiva = "faccab.iva"+ALLTRIM(STR(faclin.taniva))
          lnporcentajeiva = &lctipoiva / 100
          IF cfgivainc
             lnsubtotlinea = ROUND( ( ( faclin.subtot / ( &lctipoiva + 100 ) ) * 100 ), 6 )
             lnimporteiva = faclin.subtot-lnsubtotlinea
          ELSE
             lnsubtotlinea = ROUND(faclin.subtot, 6)
             lnimporteiva = ROUND(lnporcentajeiva*lnsubtotlinea, 6)
          ENDIF
          lnvalorunitario = ROUND(lnsubtotlinea/faclin.cant, 6)
          laarraylineas(lnnumlineas, 1) = faclin.codart
          laarraylineas(lnnumlineas, 2) = faclin.cant
          laarraylineas(lnnumlineas, 3) = faclin.desart
          laarraylineas(lnnumlineas, 4) = lnsubtotlinea
          laarraylineas(lnnumlineas, 5) = "Unidad"
          laarraylineas(lnnumlineas, 6) = lnvalorunitario
          laarraylineas(lnnumlineas, 7) = "002"
          laarraylineas(lnnumlineas, 8) = "Tasa"
          laarraylineas(lnnumlineas, 9) = lnporcentajeiva
          laarraylineas(lnnumlineas, 10) = lnimporteiva
          laarraylineas(lnnumlineas, 11) = damevalor("dbf/articulos", "matpri", faclin.codart, "codart")
          lnsumasiniva = lnsumasiniva+lnsubtotlinea
          lnsumaiva = lnsumaiva+lnimporteiva
          SELECT faclin
       ENDSCAN
       IF ROUND(lnsumasiniva, cfgredond)<>ROUND(faccab.totimpbas, cfgredond)
          laarraylineas(1, 4) = laarraylineas(1, 4)+(ROUND(faccab.totimpbas, cfgredond)-ROUND(lnsumasiniva, cfgredond))
          laarraylineas(1, 6) = ROUND(laarraylineas(1, 4)/laarraylineas(lnnumlineas, 2), cfgredond)
       ENDIF
       IF ROUND(lnsumaiva, cfgredond)<>ROUND(faccab.totimpiva, cfgredond)
          laarraylineas(1, 10) = laarraylineas(1, 10)+(ROUND(faccab.totimpiva, cfgredond)-ROUND(lnsumaiva, cfgredond))
       ENDIF
       FOR lncontnodo = 1 TO lnnumlineas
          stroriginal = stroriginal+"01010101"+"|"
          stroriginal = stroriginal+IIF(LEN(qtarchrinval(laarraylineas(lncontnodo, 1)))=0, "", qtarchrinval(laarraylineas(lncontnodo, 1))+"|")
          stroriginal = stroriginal+IIF(LEN(qtarchrinval(ALLTRIM(STR(laarraylineas(lncontnodo, 2), 10, cfgredcant))))=0, "", qtarchrinval(ALLTRIM(STR(laarraylineas(lncontnodo, 2), 10, cfgredcant)))+"|")
          stroriginal = stroriginal+IIF(laarraylineas(lncontnodo, 11)=1, "EA", "E48")+"|"
          stroriginal = stroriginal+IIF(LEN(qtarchrinval(laarraylineas(lncontnodo, 5)))=0, "", qtarchrinval(laarraylineas(lncontnodo, 5))+"|")
          stroriginal = stroriginal+IIF(LEN(qtarchrinval(laarraylineas(lncontnodo, 3)))=0, "", qtarchrinval(laarraylineas(lncontnodo, 3))+"|")
          stroriginal = stroriginal+IIF(LEN(qtarchrinval(ALLTRIM(STR(laarraylineas(lncontnodo, 6), 12, 6))))=0, "", qtarchrinval(ALLTRIM(STR(laarraylineas(lncontnodo, 6), 12, 6)))+"|")
          stroriginal = stroriginal+IIF(LEN(qtarchrinval(ALLTRIM(STR(laarraylineas(lncontnodo, 4), 12, 6))))=0, "", qtarchrinval(ALLTRIM(STR(laarraylineas(lncontnodo, 4), 12, 6)))+"|")
          stroriginal = stroriginal+IIF(LEN(qtarchrinval(ALLTRIM(STR(laarraylineas(lncontnodo, 4), 12, 6))))=0, "", qtarchrinval(ALLTRIM(STR(laarraylineas(lncontnodo, 4), 12, 6)))+"|")
          stroriginal = stroriginal+IIF(LEN(qtarchrinval(laarraylineas(lncontnodo, 7)))=0, "", qtarchrinval(laarraylineas(lncontnodo, 7))+"|")
          stroriginal = stroriginal+IIF(LEN(qtarchrinval(laarraylineas(lncontnodo, 8)))=0, "", qtarchrinval(laarraylineas(lncontnodo, 8))+"|")
          stroriginal = stroriginal+IIF(LEN(qtarchrinval(ALLTRIM(STR(laarraylineas(lncontnodo, 9), 12, 6))))=0, "", qtarchrinval(ALLTRIM(STR(laarraylineas(lncontnodo, 9), 12, 6)))+"|")
          stroriginal = stroriginal+IIF(LEN(qtarchrinval(ALLTRIM(STR(laarraylineas(lncontnodo, 10), 12, 6))))=0, "", qtarchrinval(ALLTRIM(STR(laarraylineas(lncontnodo, 10), 12, 6)))+"|")
       ENDFOR
    ENDIF
 ENDIF
 IF tlfacturatest
    stroriginal = stroriginal+"002"+"|"
    stroriginal = stroriginal+"Tasa"+"|"
    stroriginal = stroriginal+"0.160000"+"|"
    stroriginal = stroriginal+"13.79"+"|"
    stroriginal = stroriginal+"13.79"+"|"
 ELSE
    IF faccab.impiva1<>0
       stroriginal = stroriginal+"002"+"|"
       stroriginal = stroriginal+"Tasa"+"|"
       stroriginal = stroriginal+IIF(LEN(qtarchrinval(ALLTRIM(STR(faccab.iva1, 5, 2))))=0, "", qtarchrinval(ALLTRIM(STR(faccab.iva1/100, 12, 6)))+"|")
       stroriginal = stroriginal+IIF(LEN(qtarchrinval(ALLTRIM(STR(faccab.impiva1, 12, cfgredond))))=0, "", qtarchrinval(ALLTRIM(STR(faccab.impiva1, 12, cfgredond)))+"|")
    ENDIF
    IF faccab.impiva2<>0
       stroriginal = stroriginal+"002"+"|"
       stroriginal = stroriginal+"Tasa"+"|"
       stroriginal = stroriginal+IIF(LEN(qtarchrinval(ALLTRIM(STR(faccab.iva2, 5, 2))))=0, "", qtarchrinval(ALLTRIM(STR(faccab.iva2/100, 12, 6)))+"|")
       stroriginal = stroriginal+IIF(LEN(qtarchrinval(ALLTRIM(STR(faccab.impiva2, 12, cfgredond))))=0, "", qtarchrinval(ALLTRIM(STR(faccab.impiva2, 12, cfgredond)))+"|")
    ENDIF
    IF faccab.impiva3<>0
       stroriginal = stroriginal+"002"+"|"
       stroriginal = stroriginal+"Tasa"+"|"
       stroriginal = stroriginal+IIF(LEN(qtarchrinval(ALLTRIM(STR(faccab.iva3, 5, 2))))=0, "", qtarchrinval(ALLTRIM(STR(faccab.iva3/100, 12, 6)))+"|")
       stroriginal = stroriginal+IIF(LEN(qtarchrinval(ALLTRIM(STR(faccab.impiva3, 12, cfgredond))))=0, "", qtarchrinval(ALLTRIM(STR(faccab.impiva3, 12, cfgredond)))+"|")
    ENDIF
    IF faccab.impiva4<>0
       stroriginal = stroriginal+"002"+"|"
       stroriginal = stroriginal+"Tasa"+"|"
       stroriginal = stroriginal+IIF(LEN(qtarchrinval(ALLTRIM(STR(faccab.iva4, 5, 2))))=0, "", qtarchrinval(ALLTRIM(STR(faccab.iva4/100, 12, 6)))+"|")
       stroriginal = stroriginal+IIF(LEN(qtarchrinval(ALLTRIM(STR(faccab.impiva4, 12, cfgredond))))=0, "", qtarchrinval(ALLTRIM(STR(faccab.impiva4, 12, cfgredond)))+"|")
    ENDIF
    stroriginal = stroriginal+IIF(LEN(qtarchrinval(ALLTRIM(STR(faccab.totimpiva, 12, cfgredond))))=0, "", qtarchrinval(ALLTRIM(STR(faccab.totimpiva, 12, cfgredond)))+"|")
 ENDIF
 stroriginal = stroriginal+"|"
 RETURN (stroriginal)
ENDFUNC
**
FUNCTION eFactura_SelloDigital
 PARAMETER tcerror, tcstroriginal, tcsello, tcnocertificado, tccertificado
 LOCAL lopkey
 LOCAL lnsuccess
 LOCAL lcpkeyxml
 LOCAL lorsa
 LOCAL lcfiledata
 LOCAL lcbase64sig
 LOCAL locert
 LOCAL lcretorno, llerror
 lcretorno = ""
 llerror = .F.
 TRY
    IF  .NOT. llerror
       lorsa = CREATEOBJECT('Chilkat.Rsa')
       lnsuccess = lorsa.unlockcomponent(pcclavechilkatrsa)
       IF (lnsuccess<>1)
          tcerror = "RSA component unlock failed"
          llerror = .T.
       ENDIF
    ENDIF
    IF  .NOT. llerror
       lopkey = CREATEOBJECT('Chilkat.PrivateKey')
       locert = CREATEOBJECT('Chilkat.Cert')
       locert.loadfromfile(ALLTRIM(cfgefacturaarchivocer))
       lopkey.loadpkcs8encryptedfile(ALLTRIM(cfgefacturaarchivokey), ALLTRIM(cfgefacturapasswordkey))
       lcpkeyxml = lopkey.getxml()
       lnsuccess = lorsa.importprivatekey(lcpkeyxml)
       IF (lnsuccess<>1)
          tcerror = lorsa.lasterrortext
          llerror = .T.
       ENDIF
       IF  .NOT. llerror
          lorsa.littleendian = 0
          lorsa.charset = "utf-8"
          lorsa.encodingmode = "base64"
          tcsello = lorsa.signstringenc(tcstroriginal, "SHA-256")
          n = locert.serialnumber
          tcnocertificado = SUBSTR(n, 02, 1)+SUBSTR(n, 04, 1)+SUBSTR(n, 06, 1)+SUBSTR(n, 08, 1)+SUBSTR(n, 10, 1)+SUBSTR(n, 12, 1)+SUBSTR(n, 14, 1)+SUBSTR(n, 16, 1)+SUBSTR(n, 18, 1)+SUBSTR(n, 20, 1)+SUBSTR(n, 22, 1)+SUBSTR(n, 24, 1)+SUBSTR(n, 26, 1)+SUBSTR(n, 28, 1)+SUBSTR(n, 30, 1)+SUBSTR(n, 32, 1)+SUBSTR(n, 34, 1)+SUBSTR(n, 36, 1)+SUBSTR(n, 38, 1)+SUBSTR(n, 40, 1)+SUBSTR(n, 42, 1)+SUBSTR(n, 44, 1)+SUBSTR(n, 46, 1)+SUBSTR(n, 48, 1)+SUBSTR(n, 50, 1)
          tccertificado = SUBSTR(locert.getencoded(), 1, LEN(locert.getencoded())-2)
          tccertificado = STRTRAN(tccertificado, CHR(13)+CHR(10), "")
       ENDIF
    ENDIF
 CATCH TO loerr
    llerror = .T.
    lcretorno = ""
    tcerror = loerr.message
 ENDTRY
 RELEASE lorsa
 RETURN ( .NOT. llerror)
ENDFUNC
**
FUNCTION eFactura_GetnoCertificado
 PARAMETER tcerror, tcnocertificado
 LOCAL lnsuccess
 LOCAL locert
 LOCAL lcretorno, llerror
 lcretorno = ""
 llerror = .F.
 TRY
    IF  .NOT. llerror
       locert = CREATEOBJECT('Chilkat.Cert')
       locert.loadfromfile(ALLTRIM(cfgefacturaarchivocer))
       IF  .NOT. llerror
          n = locert.serialnumber
          tcnocertificado = SUBSTR(n, 02, 1)+SUBSTR(n, 04, 1)+SUBSTR(n, 06, 1)+SUBSTR(n, 08, 1)+SUBSTR(n, 10, 1)+SUBSTR(n, 12, 1)+SUBSTR(n, 14, 1)+SUBSTR(n, 16, 1)+SUBSTR(n, 18, 1)+SUBSTR(n, 20, 1)+SUBSTR(n, 22, 1)+SUBSTR(n, 24, 1)+SUBSTR(n, 26, 1)+SUBSTR(n, 28, 1)+SUBSTR(n, 30, 1)+SUBSTR(n, 32, 1)+SUBSTR(n, 34, 1)+SUBSTR(n, 36, 1)+SUBSTR(n, 38, 1)+SUBSTR(n, 40, 1)+SUBSTR(n, 42, 1)+SUBSTR(n, 44, 1)+SUBSTR(n, 46, 1)+SUBSTR(n, 48, 1)+SUBSTR(n, 50, 1)
       ENDIF
    ENDIF
 CATCH TO loerr
    llerror = .T.
    lcretorno = ""
    tcerror = loerr.message
 ENDTRY
 RETURN ( .NOT. llerror)
ENDFUNC
**
PROCEDURE RtnError
 swerror = .T.
 RETURN
ENDPROC
**
FUNCTION URLDecode
 LPARAMETERS tcinput
 tcinput = CHRTRAN(tcinput, "+", " ")
 DECLARE INTEGER UrlUnescape IN shlwapi.Dll AS UrlUnescape STRING, STRING @, INTEGER @, INTEGER
 LOCAL lcoutput, lnlength
 lnlength = LEN(tcinput)+1
 lcoutput = REPLICATE(CHR(0), lnlength)
 IF 0=urlunescape(tcinput, @lcoutput, @lnlength, 0)
    lcoutput = LEFT(lcoutput, lnlength)
    RETURN lcoutput
 ELSE
    RETURN ""
 ENDIF
ENDFUNC
**
FUNCTION UrlEncode
 LPARAMETERS saddressurl
 DECLARE INTEGER InternetCanonicalizeUrl IN wininet STRING, STRING @, INTEGER @, INTEGER
 LOCAL snewurl, nresult
 nresult = 250
 snewurl = REPLICATE(CHR(0), nresult)
 IF internetcanonicalizeurl(saddressurl, @snewurl, @nresult, 33554432)<>0
    RETURN LEFT(snewurl, nresult)
 ELSE
    RETURN ""
 ENDIF
ENDFUNC
**
FUNCTION InsertaTimbre
 PARAMETER lsfilename, lstext
 lcficheroxml = FILETOSTR(lsfilename)
 lcficheroxml = STRTRAN(lcficheroxml, "</cfdi:Comprobante>", "<cfdi:Complemento>"+lstext+"</cfdi:Complemento></cfdi:Comprobante>")
 STRTOFILE(lcficheroxml, lsfilename)
 RETURN .T.
ENDFUNC
**
FUNCTION CheckHttpConnection
 PARAMETER surl
 lnstatus = 0
 TRY
    LOCAL ohttp AS MICROSOFT.XMLHTTP
    ohttp = CREATEOBJECT("Microsoft.XMLHTTP")
    ohttp.open("GET", surl, .F.)
    ohttp.send()
 CATCH TO oerr
    lnstatus = -1
 ENDTRY
 lnstatus = ohttp.status
 RETURN (lnstatus=200)
ENDFUNC
**
PROCEDURE ComprobarDescargaTarifasONE
 DO FORM DescargarTarifasONE WITH .T.
ENDPROC
**
FUNCTION ValidarCCC_Spain
 PARAMETER ccc
 LOCAL retorno, digit1, digit2, suma1, suma2, parc1, parc2
 IF  .NOT. cfgvalidarcccspain .OR. pcversionpais=="MEX"
    RETURN .T.
 ENDIF
 retorno = .F.
 digit1 = 0
 digit2 = 0
 suma1 = 0
 suma2 = 0
 parc1 = 0
 parc2 = 0
 IF LEN(ccc)=23
    ccc = STRTRAN(ccc, "/", "")
 ENDIF
 IF LEN(ccc)=20
    digit1 = VAL(SUBSTR(ccc, 9, 1))
    digit2 = VAL(SUBSTR(ccc, 10, 1))
    suma1 = VAL(SUBSTR(ccc, 1, 1))*4+VAL(SUBSTR(ccc, 2, 1))*8+VAL(SUBSTR(ccc, 3, 1))*5
    suma1 = suma1+VAL(SUBSTR(ccc, 4, 1))*10+VAL(SUBSTR(ccc, 5, 1))*9+VAL(SUBSTR(ccc, 6, 1))*7
    suma1 = suma1+VAL(SUBSTR(ccc, 7, 1))*3+VAL(SUBSTR(ccc, 8, 1))*6
    parc1 = 11-MOD(suma1, 11)
    parc1 = IIF((parc1>9), 11-parc1, parc1)
    suma2 = VAL(SUBSTR(ccc, 11, 1))*1+VAL(SUBSTR(ccc, 12, 1))*2+VAL(SUBSTR(ccc, 13, 1))*4
    suma2 = suma2+VAL(SUBSTR(ccc, 14, 1))*8+VAL(SUBSTR(ccc, 15, 1))*5+VAL(SUBSTR(ccc, 16, 1))*10
    suma2 = suma2+VAL(SUBSTR(ccc, 17, 1))*9+VAL(SUBSTR(ccc, 18, 1))*7+VAL(SUBSTR(ccc, 19, 1))*3
    suma2 = suma2+VAL(SUBSTR(ccc, 20, 1))*6
    parc2 = 11-MOD(suma2, 11)
    parc2 = IIF((parc2>9), 11-parc2, parc2)
    IF (digit1=parc1 .AND. digit2=parc2)
       retorno = .T.
    ENDIF
 ELSE
    retorno = .F.
 ENDIF
 RETURN retorno
ENDFUNC
**
FUNCTION Calcular_Digito_Control_CCC_Spain
 LPARAMETERS tcentidad, tcoficina, tcctacte
 LOCAL lnindi
 LOCAL lccc1, lccc2, lncct
 LOCAL lndcontrol1, lndcontrol2
 LOCAL lannumeros[10]
 lccc1 = tcentidad+tcoficina
 lccc2 = tcctacte
 lncct = 0
 lannumeros[1] = 1
 lannumeros[2] = 2
 lannumeros[3] = 4
 lannumeros[4] = 8
 lannumeros[5] = 5
 lannumeros[6] = 10
 lannumeros[7] = 9
 lannumeros[8] = 7
 lannumeros[9] = 3
 lannumeros[10] = 6
 FOR lnindi = 3 TO 10
    lncct = lncct+VAL(SUBSTR(lccc1, lnindi-2, 1))*lannumeros(lnindi)
 ENDFOR
 lndcontrol1 = 11-MOD(lncct, 11)
 IF lndcontrol1=10
    lndcontrol1 = 1
 ENDIF
 IF lndcontrol1=11
    lndcontrol1 = 0
 ENDIF
 lncct = 0
 FOR lnindi = 1 TO 10
    lncct = lncct+VAL(SUBSTR(lccc2, lnindi, 1))*lannumeros(lnindi)
 ENDFOR
 lndcontrol2 = 11-MOD(lncct, 11)
 IF lndcontrol2=10
    lndcontrol2 = 1
 ENDIF
 IF lndcontrol2=11
    lndcontrol2 = 0
 ENDIF
 RETURN ALLTRIM(STR(lndcontrol1))+ALLTRIM(STR(lndcontrol2))
ENDFUNC
**
FUNCTION BuscarOfertasArticulo
 PARAMETER tccodart, tdfecha, tndto, tnpvp, tnpvpcom, tlsinmensajes, tcmensajeerror
 IF PCOUNT()<6
    tlsinmensajes = .F.
    tcmensajeerror = ""
 ENDIF
 LOCAL llresultado
 llresultado = .T.
 lcinicialalias = ALIAS()
 llarticulosabierta = .T.
 lcarticulosorder = ""
 lnarticulosrecno = 0
 TRY
    IF  .NOT. USED("articulos")
       llarticulosabierta = .F.
       USE SHARED dbf/articulos AGAIN IN 0
    ELSE
       SELECT articulos
       lcarticulosorder = ORDER()
       lnarticulosrecno = RECNO()
    ENDIF
    SELECT articulos
    SET ORDER TO codart
    IF  .NOT. SEEK(tccodart)
       llresultado = .F.
    ENDIF
    IF llresultado
       ll_ofertas_abierto = .F.
       IF  .NOT. USED("ofertas")
          USE SHARED dbf/ofertas AGAIN ALIAS ofertas IN 0
       ELSE
          ll_ofertas_abierto = .T.
       ENDIF
       SELECT ofertas
       SET ORDER TO FECINIOFE DESCENDING
       ll_ofertasart_abierto = .F.
       IF  .NOT. USED("ofertasart")
          USE SHARED dbf/ofertasart AGAIN ALIAS ofertasart IN 0
       ELSE
          ll_ofertasart_abierto = .T.
       ENDIF
       SELECT ofertasart
       SET ORDER TO codofe
       ll_ofertasfam_abierto = .F.
       IF  .NOT. USED("ofertasfam")
          USE SHARED dbf/ofertasfam AGAIN ALIAS ofertasfam IN 0
       ELSE
          ll_ofertasfam_abierto = .T.
       ENDIF
       SELECT ofertasfam
       SET ORDER TO codofe
       SELECT ofertas
       SCAN
          IF ofertas.obsoleto
             LOOP
          ENDIF
          ldfechainicio = IIF(EMPTY(ofertas.feciniofe), tdfecha-1, ofertas.feciniofe)
          ldfechafin = IIF(EMPTY(ofertas.fecfinofe), tdfecha+1, ofertas.fecfinofe)
          IF  .NOT. BETWEEN(tdfecha, ldfechainicio, ldfechafin)
             LOOP
          ENDIF
          lcdow = SET("Fdow")
          SET FDOW TO 1
          lcdowfecha = DOW(tdfecha)
          llloop = .F.
          DO CASE
             CASE lcdowfecha=1 .AND.  .NOT. ofertas.domingo
                llloop = .T.
             CASE lcdowfecha=2 .AND.  .NOT. ofertas.lunes
                llloop = .T.
             CASE lcdowfecha=3 .AND.  .NOT. ofertas.martes
                llloop = .T.
             CASE lcdowfecha=4 .AND.  .NOT. ofertas.miercoles
                llloop = .T.
             CASE lcdowfecha=5 .AND.  .NOT. ofertas.jueves
                llloop = .T.
             CASE lcdowfecha=6 .AND.  .NOT. ofertas.viernes
                llloop = .T.
             CASE lcdowfecha=7 .AND.  .NOT. ofertas.sabado
                llloop = .T.
          ENDCASE
          SET FDOW TO &lcdow 
          IF llloop
             LOOP
          ENDIF
          SELECT ofertasart
          IF SEEK(ofertas.codofe+tccodart)
             IF ofertasart.pvpcom<>0
                tnpvpcom = ofertasart.pvpcom
             ENDIF
             IF ofertasart.dto<>0
                tndto = ofertasart.dto
             ENDIF
             IF ofertasart.pvp<>0
                tnpvp = ofertasart.pvp
             ENDIF
             EXIT
          ENDIF
          IF  .NOT. EMPTY(ALLTRIM(articulos.familia1))
             SELECT ofertasfam
             IF SEEK(ofertas.codofe+articulos.familia1)
                IF ofertasfam.dto<>0
                   tndto = ofertasfam.dto
                ENDIF
                EXIT
             ENDIF
          ENDIF
          IF ofertas.productos .AND. articulos.matpri=1
             IF ofertas.dtoprod<>0
                tndto = ofertas.dtoprod
                EXIT
             ENDIF
          ENDIF
          IF ofertas.servicios .AND. articulos.matpri=2
             IF ofertas.dtoserv<>0
                tndto = ofertas.dtoserv
                EXIT
             ENDIF
          ENDIF
       ENDSCAN
    ENDIF
 CATCH TO oerr
    IF tlsinmensajes
       tcmensajeerror = oerr.message+"||"+"[Proc.] "+oerr.procedure
    ELSE
       _messagebox(oerr.message+"||"+"[Proc.] "+oerr.procedure, 48, traducir(pcidioma, "Atenci�n"))
    ENDIF
    llresultado = .F.
 ENDTRY
 IF  .NOT. ll_ofertas_abierto .AND. USED("ofertas")
    USE IN ofertas
 ENDIF
 IF  .NOT. ll_ofertasart_abierto .AND. USED("ofertasart")
    USE IN ofertasart
 ENDIF
 IF  .NOT. ll_ofertasfam_abierto .AND. USED("ofertasfam")
    USE IN ofertasfam
 ENDIF
 IF USED("articulos")
    IF  .NOT. llarticulosabierta
       USE IN articulos
    ELSE
       SELECT articulos
       IF  .NOT. EMPTY(lcarticulosorder)
          SET ORDER TO &lcarticulosorder 
       ENDIF
       IF lnarticulosrecno<>0
          GOTO (lnarticulosrecno)
       ENDIF
    ENDIF
 ENDIF
 IF  .NOT. EMPTY(lcinicialalias)
    SELECT &lcinicialalias
 ENDIF
 RETURN (llresultado)
ENDFUNC
**
FUNCTION DameTicketTurno
 PARAMETER tddiaturno
 IF pcversionapp=2
    RETURN .F.
 ENDIF
 LOCAL llresultado
 llresultado = .T.
 lcinicialalias = ALIAS()
 TRY
    ll_turnos_abierto = .F.
    IF  .NOT. USED("turnos")
       USE SHARED dbf/turnos AGAIN ALIAS turnos IN 0
    ELSE
       ll_turnos_abierto = .T.
    ENDIF
    ll_reports_abierto = .F.
    IF  .NOT. USED("reports")
       USE SHARED dbf/reports AGAIN ALIAS reports IN 0
    ELSE
       ll_reports_abierto = .T.
    ENDIF
    ll_empresa_abierto = .F.
    IF  .NOT. USED("empresa")
       USE SHARED empresa AGAIN ALIAS empresa IN 0
    ELSE
       ll_empresa_abierto = .T.
    ENDIF
    SELECT turnos
    SET ORDER TO diatur
    IF SEEK(tddiaturno)
       IF RLOCK("turnos")
          REPLACE turno WITH turno+1
          UNLOCK IN turnos
       ELSE
          _messagebox(traducir(pcidioma, "Tabla bloqueada. Vuelva a intentarlo en breves momentos.")+CHR(13)+"Turnos", 48, "Atenci�n")
       ENDIF
    ELSE
       IF RLOCK("0", "turnos")
          APPEND BLANK
          REPLACE diatur WITH tddiaturno
          REPLACE turno WITH 1
          UNLOCK IN turnos
       ELSE
          _messagebox(traducir(pcidioma, "Tabla bloqueada. Vuelva a intentarlo en breves momentos.")+CHR(13)+"Turnos", 48, "Atenci�n")
       ENDIF
    ENDIF
    SELECT turnos.diatur, turnos.turno FROM turnos WHERE turnos.diatur=tddiaturno INTO CURSOR consulta
    LOCAL lcinforme
    lcinforme = ""
    SELECT reports
    SET FILTER TO UPPER(ALLTRIM(idgrupo))=="IMPTURNO"
    GOTO TOP
    IF  .NOT. EOF()
       LOCATE FOR predet
       IF FOUND()
          lcinforme = ALLTRIM(reports.nomfrx)
       ENDIF
    ENDIF
    IF EMPTY(lcinforme)
       USE IN consulta
       _messagebox(traducir(pcidioma, "No hay configurado ning�n listado para imprimir Turno"), 64, traducir(pcidioma, "Atenci�n"))
       RETURN .F.
    ENDIF
    lcimpresora = "T"
    SELECT consulta
    IF setprintto(rutafrx(lcinforme), lcimpresora, "")
       REPORT FORM rutafrx(lcinforme) TO PRINTER NOCONSOLE
    ENDIF
    USE IN consulta
 CATCH TO oerr
    _messagebox(oerr.message+"||"+"[Proc.] "+oerr.procedure, 48, traducir(pcidioma, "Atenci�n"))
    llresultado = .F.
 ENDTRY
 IF  .NOT. ll_turnos_abierto
    USE IN turnos
 ENDIF
 IF  .NOT. ll_reports_abierto
    USE IN reports
 ENDIF
 IF  .NOT. ll_empresa_abierto
    USE IN empresa
 ENDIF
 IF  .NOT. EMPTY(lcinicialalias)
    SELECT &lcinicialalias
 ENDIF
 RETURN (llresultado)
ENDFUNC
**
FUNCTION urlEncode
 PARAMETER tcvalue, llnoplus
 LOCAL lcresult, lcchar, lnsize, lnx
 lcresult = ""
 tcvalue = STRTRAN(tcvalue, "'", " ")
 FOR lnx = 1 TO LEN(tcvalue)
    lcchar = SUBSTR(tcvalue, lnx, 1)
    IF ATC(lcchar, "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")>0
       lcresult = lcresult+lcchar
       LOOP
    ENDIF
    IF lcchar=" " .AND.  .NOT. llnoplus
       lcresult = lcresult+"+"
       LOOP
    ENDIF
    lcresult = lcresult+"%"+RIGHT(TRANSFORM(ASC(lcchar), "@0"), 2)
 ENDFOR
 RETURN lcresult
ENDFUNC
**
FUNCTION Calcular_IBAN
 PARAMETER tcccc
 tcccc = STRTRAN(ALLTRIM(tcccc), "-", "")
 IF LEN(tcccc)<>20
    RETURN ("")
 ENDIF
 lcbanco = LEFT(tcccc, 4)
 lcsucursal = SUBSTR(tcccc, 5, 4)
 lcdc = SUBSTR(tcccc, 9, 2)
 lccuenta = RIGHT(tcccc, 10)
 ciban = lcbanco+lcsucursal
 nmod_1 = MOD(VAL(ciban), 97)
 ciban = ALLTRIM(STR(nmod_1))+lcdc+LEFT(lccuenta, 2)
 nmod_1 = MOD(VAL(ciban), 97)
 ciban = ALLTRIM(STR(nmod_1))+RIGHT(lccuenta, 8)+"142800"
 nmod_1 = MOD(VAL(ciban), 97)
 ccc_iban = PADL(ALLTRIM(STR(98-nmod_1)), 2, "0")
 lcretorno = "ES"+ccc_iban+tcccc
 RETURN (lcretorno)
ENDFUNC
**
FUNCTION CrearBono
 PARAMETER tcbononuevo, tccodbonnuevo, tnimportenuevo, tdfechanuevo, tcbonoantiguo, tcimporteantiguo, tcbonconfig, tlesrecargabono, tccodcli, tccodemp
 IF PCOUNT()<7
    tcbonconfig = ""
 ENDIF
 tlesrecargabono = .F.
 IF  .NOT. EMPTY(tcbonoantiguo)
    SELECT bonoscli
    SET ORDER TO CODBONCLI
    IF SEEK(tcbonoantiguo)
       REPLACE importe WITH importe-tcimporteantiguo
       REPLACE enviar WITH .T.
       SELECT bonos
       SET ORDER TO codbon
       IF SEEK(bonoscli.codbon)
          IF bonos.tipo=3
             SELECT bonosart2
             SET ORDER TO CODBONCLI
             SELECT bonosart1
             SET ORDER TO codbon
             IF SEEK(bonos.codbon)
                SCAN REST WHILE bonos.codbon=bonosart1.codbon
                   SELECT bonosart2
                   IF SEEK(bonoscli.codboncli+bonosart1.codart)
                      REPLACE cant WITH bonosart2.cant-bonosart1.cant
                      REPLACE cantmax WITH bonosart2.cantmax-bonosart1.cantmax
                   ENDIF
                ENDSCAN
             ENDIF
          ENDIF
       ENDIF
       _messagebox(traducir(pcidioma, "Se ha modificado el importe del BONO N�'")+ALLTRIM(tcbonoantiguo)+"'"+CHR(13)+traducir(pcidioma, "Si desea eliminar el BONO deber� hacerlo desde 'Ventas -> Bonos Emitidos a Clientes'."), 48, traducir(pcidioma, "Atenci�n"))
    ENDIF
 ENDIF
 IF  .NOT. EMPTY(tcbononuevo)
    SELECT bonoscli
    SET ORDER TO CODBONCLI
    IF  .NOT. SEEK(tcbononuevo)
       APPEND BLANK
       REPLACE codboncli WITH tcbononuevo
       REPLACE codbon WITH tccodbonnuevo
       REPLACE codcli WITH tccodcli
       REPLACE codemp WITH tccodemp
       REPLACE fecha WITH tdfechanuevo
       REPLACE enviar WITH .T.
       SELECT bonos
       SET ORDER TO codbon
       IF SEEK(bonoscli.codbon)
          IF  .NOT. bonos.obsoleto
             SELECT bonoscli
             REPLACE importe WITH tnimportenuevo
             REPLACE nocaduca WITH bonos.nocaduca
             REPLACE dto WITH bonos.dto
             REPLACE ntickets WITH bonos.ntickets
             DO CASE
                CASE UPPER(ALLTRIM(bonos.diamesany))=="D"
                   REPLACE fecven WITH bonoscli.fecha+bonos.caduca
                CASE UPPER(ALLTRIM(bonos.diamesany))=="M"
                   REPLACE fecven WITH GOMONTH(bonoscli.fecha, bonos.caduca)
                CASE UPPER(ALLTRIM(bonos.diamesany))=="A"
                   REPLACE fecven WITH GOMONTH(bonoscli.fecha, bonos.caduca*12)
             ENDCASE
             IF bonos.tipo=3
                IF EMPTY(tcbonconfig)
                   SELECT bonosart2
                   SET ORDER TO CODBONCLI
                   SELECT bonosart1
                   SET ORDER TO codbon
                   IF SEEK(bonos.codbon)
                      SCAN REST WHILE bonos.codbon=bonosart1.codbon
                         SELECT bonosart2
                         APPEND BLANK
                         REPLACE codboncli WITH bonoscli.codboncli
                         REPLACE cant WITH bonosart1.cant
                         REPLACE cantmax WITH bonosart1.cantmax
                         REPLACE codart WITH bonosart1.codart
                         REPLACE pvp WITH bonosart1.pvp
                         REPLACE cantgas WITH 0
                      ENDSCAN
                   ENDIF
                ELSE
                   lncont = 0
                   DO WHILE .T.
                      lccantx = 0
                      lccodartx = ""
                      lcpvpartx = 0
                      lccantx = VAL(SUBSTR(tcbonconfig, 1+(39*lncont), 12))
                      lccodartx = SUBSTR(tcbonconfig, 13+(39*lncont), 15)
                      lcpvpartx = VAL(SUBSTR(tcbonconfig, 28+(39*lncont), 12))
                      IF  .NOT. EMPTY(lccodartx)
                         SELECT bonosart2
                         APPEND BLANK
                         REPLACE codboncli WITH bonoscli.codboncli
                         REPLACE cant WITH lccantx
                         REPLACE cantmax WITH lccantx
                         REPLACE codart WITH lccodartx
                         REPLACE pvp WITH lcpvpartx
                         REPLACE cantgas WITH 0
                      ELSE
                         EXIT
                      ENDIF
                      lncont = lncont+1
                   ENDDO
                ENDIF
             ENDIF
          ENDIF
       ENDIF
    ELSE
       SELECT bonos
       SET ORDER TO codbon
       IF  .NOT. SEEK(bonoscli.codbon)
          _messagebox(traducir(pcidioma, "No se ha generado el ticket. No se encuentra el Tipo de Bono."), 48, traducir(pcidioma, "Atenci�n"))
          RETURN .F.
       ENDIF
       lctipocodbon = bonos.tipo
       IF  .NOT. SEEK(tccodbonnuevo)
          _messagebox(traducir(pcidioma, "No se ha generado el ticket. No se encuentra el Tipo de Bono."), 48, traducir(pcidioma, "Atenci�n"))
          RETURN .F.
       ENDIF
       IF  .NOT. (INLIST(bonos.tipo, 2, 3) .AND. lctipocodbon=bonos.tipo)
          IF  .NOT. (ALLTRIM(tccodbonnuevo)==ALLTRIM(bonoscli.codbon))
             _messagebox(traducir(pcidioma, "El N� de Bono ya existe con distinto TIPO DE BONO.")+CHR(13)+traducir(pcidioma, "No se ha generado el ticket. Introduzca otro N� de Bono."), 48, traducir(pcidioma, "Atenci�n"))
             RETURN .F.
          ENDIF
       ENDIF
       SELECT bonoscli
       IF  .NOT. (ALLTRIM(tcbononuevo)==ALLTRIM(tcbonoantiguo))
          IF _messagebox(traducir(pcidioma, "El N� de Bono ya existe.")+CHR(13)+traducir(pcidioma, "�Desea hacer una recarga del bono?"), 036, traducir(pcidioma, "Atenci�n"))=6
             REPLACE importe WITH importe+tnimportenuevo
             REPLACE ntickets WITH ntickets+IIF(tnimportenuevo<0, -1*bonos.ntickets, bonos.ntickets)
             REPLACE enviar WITH .T.
             IF bonos.tipo=3
                IF EMPTY(tcbonconfig)
                   SELECT bonosart2
                   SET ORDER TO CODBONCLI
                   SELECT bonosart1
                   SET ORDER TO codbon
                   IF SEEK(bonos.codbon)
                      SCAN REST WHILE bonos.codbon=bonosart1.codbon
                         SELECT bonosart2
                         IF  .NOT. SEEK(bonoscli.codboncli+bonosart1.codart)
                            APPEND BLANK
                            REPLACE codboncli WITH bonoscli.codboncli
                            REPLACE cant WITH IIF(tnimportenuevo<0, -1*bonosart1.cant, bonosart1.cant)
                            REPLACE cantmax WITH IIF(tnimportenuevo<0, -1*bonosart1.cantmax, bonosart1.cantmax)
                            REPLACE codart WITH bonosart1.codart
                            REPLACE pvp WITH bonosart1.pvp
                            REPLACE cantgas WITH 0
                         ELSE
                            REPLACE cant WITH bonosart2.cant+IIF(tnimportenuevo<0, -1*bonosart1.cant, bonosart1.cant)
                            REPLACE cantmax WITH bonosart2.cantmax+IIF(tnimportenuevo<0, -1*bonosart1.cantmax, bonosart1.cantmax)
                         ENDIF
                      ENDSCAN
                   ENDIF
                ELSE
                   SELECT bonosart2
                   SET ORDER TO CODBONCLI
                   lncont = 0
                   DO WHILE .T.
                      lccantx = 0
                      lccodartx = ""
                      lcpvpartx = 0
                      lccantx = VAL(SUBSTR(tcbonconfig, 1+(39*lncont), 12))
                      lccodartx = SUBSTR(tcbonconfig, 13+(39*lncont), 15)
                      lcpvpartx = VAL(SUBSTR(tcbonconfig, 28+(39*lncont), 12))
                      IF  .NOT. EMPTY(lccodartx)
                         SELECT bonosart2
                         IF  .NOT. SEEK(bonoscli.codboncli+lccodartx)
                            APPEND BLANK
                            REPLACE codboncli WITH bonoscli.codboncli
                            REPLACE cant WITH IIF(tnimportenuevo<0, -1*lccantx, lccantx)
                            REPLACE cantmax WITH IIF(tnimportenuevo<0, -1*lccantx, lccantx)
                            REPLACE codart WITH lccodartx
                            REPLACE pvp WITH lcpvpartx
                            REPLACE cantgas WITH 0
                         ELSE
                            REPLACE cant WITH bonosart2.cant+IIF(tnimportenuevo<0, -1*lccantx, lccantx)
                            REPLACE cantmax WITH bonosart2.cantmax+IIF(tnimportenuevo<0, -1*lccantx, lccantx)
                         ENDIF
                      ELSE
                         EXIT
                      ENDIF
                      lncont = lncont+1
                   ENDDO
                ENDIF
             ENDIF
             tlesrecargabono = .T.
          ELSE
             _messagebox(traducir(pcidioma, "No se ha generado el ticket. Introduzca otro N� de Bono."), 48, traducir(pcidioma, "Atenci�n"))
             RETURN .F.
          ENDIF
       ELSE
          REPLACE ntickets WITH ntickets+IIF(tnimportenuevo<0, -1*bonos.ntickets, bonos.ntickets)
          REPLACE importe WITH importe+tnimportenuevo
          REPLACE enviar WITH .T.
          IF bonos.tipo=3
             IF EMPTY(tcbonconfig)
                SELECT bonosart2
                SET ORDER TO CODBONCLI
                SELECT bonosart1
                SET ORDER TO codbon
                IF SEEK(bonos.codbon)
                   SCAN REST WHILE bonos.codbon=bonosart1.codbon
                      SELECT bonosart2
                      IF  .NOT. SEEK(bonoscli.codboncli+bonosart1.codart)
                         APPEND BLANK
                         REPLACE codboncli WITH bonoscli.codboncli
                         REPLACE cant WITH IIF(tnimportenuevo<0, -1*bonosart1.cant, bonosart1.cant)
                         REPLACE cantmax WITH IIF(tnimportenuevo<0, -1*bonosart1.cantmax, bonosart1.cantmax)
                         REPLACE codart WITH bonosart1.codart
                         REPLACE pvp WITH bonosart1.pvp
                         REPLACE cantgas WITH 0
                      ELSE
                         REPLACE cant WITH bonosart2.cant+IIF(tnimportenuevo<0, -1*bonosart1.cant, bonosart1.cant)
                         REPLACE cantmax WITH bonosart2.cantmax+IIF(tnimportenuevo<0, -1*bonosart1.cantmax, bonosart1.cantmax)
                      ENDIF
                   ENDSCAN
                ENDIF
             ELSE
                SELECT bonosart2
                SET ORDER TO CODBONCLI
                lncont = 0
                DO WHILE .T.
                   lccantx = 0
                   lccodartx = ""
                   lcpvpartx = 0
                   lccantx = VAL(SUBSTR(tcbonconfig, 1+(39*lncont), 12))
                   lccodartx = SUBSTR(tcbonconfig, 13+(39*lncont), 15)
                   lcpvpartx = VAL(SUBSTR(tcbonconfig, 28+(39*lncont), 12))
                   IF  .NOT. EMPTY(lccodartx)
                      SELECT bonosart2
                      IF  .NOT. SEEK(bonoscli.codboncli+lccodartx)
                         APPEND BLANK
                         REPLACE codboncli WITH bonoscli.codboncli
                         REPLACE cant WITH IIF(tnimportenuevo<0, -1*lccantx, lccantx)
                         REPLACE cantmax WITH IIF(tnimportenuevo<0, -1*lccantx, lccantx)
                         REPLACE codart WITH lccodartx
                         REPLACE pvp WITH lcpvpartx
                         REPLACE cantgas WITH 0
                      ELSE
                         REPLACE cant WITH bonosart2.cant+IIF(tnimportenuevo<0, -1*lccantx, lccantx)
                         REPLACE cantmax WITH bonosart2.cantmax+IIF(tnimportenuevo<0, -1*lccantx, lccantx)
                      ENDIF
                   ELSE
                      EXIT
                   ENDIF
                   lncont = lncont+1
                ENDDO
             ENDIF
          ENDIF
       ENDIF
    ENDIF
 ENDIF
 TRY
    IF USED("bonoscli")
       = SuiteAfterEntitySave("bonoscli", bonoscli.codboncli, "UPD")
    ENDIF
 CATCH
 ENDTRY
 RETURN .T.
ENDFUNC
**
FUNCTION Facebook
 PARAMETER tcopcion, tctexto, tcobservaciones, tcfoto
 LOCAL louploads, llresultado
 llresultado = .T.
 IF  .NOT. cfgfacebook
    _messagebox(traducir(pcidioma, "Debe activar la conexi�n con Facebook"), 48, traducir(pcidioma, "Facebook"))
    RETURN .F.
 ENDIF
 IF  .NOT. cfgfacebookprueba
    _messagebox(traducir(pcidioma, "Debe realizar la Conexi�n con Facebook desde la Configuracion de la Aplicacion"), 48, traducir(pcidioma, "Facebook"))
    RETURN .F.
 ENDIF
 IF  .NOT. clienteconcontrato(traducir(pcidioma, "Facebook"))
    RETURN .F.
 ENDIF
 TRY
    louploads = CREATEOBJECT("uploads")
    louploads.urlweb = cfgfacebookftpurlweb
    louploads.direccionftp = cfgfacebookftpurl
    louploads.usuarioftp = cfgfacebookftpusu
    louploads.passwordftp = cfgfacebookftppass
    tcobservaciones = ALLTRIM(tcobservaciones)+CHR(13)+CHR(10)+CHR(13)+CHR(10)+traducir(pcidioma, "Enviado desde")+" "+tcnombreaplicacion
    IF  .NOT. louploads.facebook_enviarmensaje(tcopcion, tctexto, tcobservaciones, tcfoto)
       llresultado = .F.
    ENDIF
 CATCH TO oerr
    _messagebox(traducir(pcidioma, "Error al publicar mensaje en Facebook")+CHR(13)+oerr.message, 48, traducir(pcidioma, "Facebook"))
    llresultado = .F.
 ENDTRY
 RELEASE lohttp
 IF llresultado
    _messagebox(traducir(pcidioma, "Publicaci�n en Facebook realizada con �xito"), 64, traducir(pcidioma, "Facebook"))
 ENDIF
 RETURN llresultado
ENDFUNC
**
FUNCTION FacebookPruebaConexion
 LOCAL lohttp, llresultado
 llresultado = .T.
 IF  .NOT. cfgfacebook
    _messagebox(traducir(pcidioma, "Debe activar la conexi�n con Facebook"), 64, traducir(pcidioma, "Facebook"))
    RETURN .F.
 ENDIF
 IF EMPTY(cfgfacebookmail)
    _messagebox(traducir(pcidioma, "Debe indicar cuenta de Email vinculada con Facebook"), 64, traducir(pcidioma, "Facebook"))
    RETURN .F.
 ENDIF
 IF EMPTY(cfgclienteweb)
    IF pcversionpais=="MEX"
       _messagebox(traducir(pcidioma, "Debe indicar C�digo Cliente de Style for Mex"), 64, traducir(pcidioma, "Facebook"))
    ELSE
       _messagebox(traducir(pcidioma, "Debe indicar C�digo Cliente de DunaSoft"), 64, traducir(pcidioma, "Facebook"))
    ENDIF
    RETURN .F.
 ENDIF
 IF  .NOT. clienteconcontrato(traducir(pcidioma, "Facebook"))
    RETURN .F.
 ENDIF
 TRY
    lohttp = SuiteGetHttpLocal()
    lohttp.httpweb = "https://facebook.dunasoftpc.com"
    IF  .NOT. lohttp.facebookpruebaconexion(ALLTRIM(cfgclienteweb), ALLTRIM(cfgfacebookmail))
       _messagebox(lohttp.msgerror, 48, traducir(pcidioma, "Facebook"))
       llresultado = .F.
    ENDIF
 CATCH TO oerr
    _messagebox(traducir(pcidioma, "Error al validar la conexi�n con Facebook")+CHR(13)+oerr.message, 48, traducir(pcidioma, "Facebook"))
    llresultado = .F.
 ENDTRY
 RELEASE lohttp
 RETURN (llresultado)
ENDFUNC
**
PROCEDURE Start_ServiciosOnline
 TRY
    IF FILE(ADDBS(SYS(5)+SYS(2003))+"Online.exe")
       DO CASE
          CASE pcversionpais="ESP"
             lcnombreaplicacion = "Online DunaSoft"
          CASE pcversionpais="FRA"
             lcnombreaplicacion = "Online DunaSoft"
          CASE pcversionpais="MEX"
             lcnombreaplicacion = "Online Style for Mex"
          CASE otherwise
             lcnombreaplicacion = "Online DunaSoft"
       ENDCASE
       IF  .NOT. isactive(lcnombreaplicacion)
          shellexec(ADDBS(SYS(5)+SYS(2003))+"Online.exe", "", "", SYS(5)+SYS(2003))
       ENDIF
    ENDIF
 CATCH TO oerr
 ENDTRY
ENDPROC
**
FUNCTION IsActive
 LPARAMETERS tccaption
 DECLARE INTEGER FindWindow IN WIN32API STRING, STRING
 RETURN findwindow(0, tccaption)<>0
ENDFUNC
**
PROCEDURE AbrirPlanificador
 PARAMETER tlmodal, tdfecha
 IF PCOUNT()<2
    tdfecha = CTOD("//")
 ENDIF
 LOCAL lncont, llencontrado, lofrmplan
 llencontrado = .F.
 FOR lncont = 1 TO _SCREEN.formcount
    IF UPPER(_SCREEN.forms(lncont).class)=="FRM_PLAN"
       lofrmplan = _SCREEN.forms(lncont)
       llencontrado = .T.
       EXIT
    ENDIF
 ENDFOR
 IF  .NOT. llencontrado
    DO FORM plan2009 WITH .F., tdfecha
 ELSE
    FOR lncontscreen = _SCREEN.formcount TO 1 STEP -1
       IF UPPER(_SCREEN.forms(lncontscreen).class)=="NEWSCREEN" .OR. UPPER(_SCREEN.forms(lncontscreen).class)=="NEWSCREEN_STYLEMEX"
          _SCREEN.forms(lncontscreen).ocultarmenu()
          EXIT
       ENDIF
    ENDFOR
    lofrmplan.abrirplanificador(tdfecha)
 ENDIF
ENDPROC
**
PROCEDURE AbrirPlanificadorRecursos
 PARAMETER tlmodal, tdfecha
 IF PCOUNT()<2
    tdfecha = CTOD("//")
 ENDIF
 LOCAL lncont, llencontrado, lofrmplan
 llencontrado = .F.
 FOR lncont = 1 TO _SCREEN.formcount
    IF UPPER(_SCREEN.forms(lncont).class)=="FRM_PLAN_R"
       lofrmplan = _SCREEN.forms(lncont)
       llencontrado = .T.
       EXIT
    ENDIF
 ENDFOR
 IF  .NOT. llencontrado
    DO FORM plan2009_r WITH .F., tdfecha
 ELSE
    FOR lncontscreen = _SCREEN.formcount TO 1 STEP -1
       IF UPPER(_SCREEN.forms(lncontscreen).class)=="NEWSCREEN" .OR. UPPER(_SCREEN.forms(lncontscreen).class)=="NEWSCREEN_STYLEMEX"
          _SCREEN.forms(lncontscreen).ocultarmenu()
          EXIT
       ENDIF
    ENDFOR
    lofrmplan.abrirplanificador(tdfecha)
 ENDIF
ENDPROC
**
PROCEDURE MostrarPantallaEspera
 LOCAL _verificar, lcfondo, lclogo
 DO CASE
    CASE pltpvbar
       lcfondo = "fondo_BAR_screen.jpg"
       lclogo = "logo_BAR_dunasoft_screen_open.png"
    CASE  .NOT. pltpvpeluqueria
       lcfondo = "fondo_TPV_screen.jpg"
       lclogo = "logo_TPV_dunasoft_screen_open.png"
    OTHERWISE
       lcfondo = "fondo_screen.jpg"
       lclogo = "logo_dunasoft_screen_open.png"
 ENDCASE
 _verificar = "_screen.oImg"
 IF !(VARTYPE(&_verificar)#"U") 
    _SCREEN.addobject("oImg", "image")
    _SCREEN.oimg.picture = lcfondo
    _SCREEN.oimg.visible = .T.
    _SCREEN.oimg.stretch = 2
    _SCREEN.oimg.width = _SCREEN.width
    _SCREEN.oimg.height = _SCREEN.height
    _SCREEN.oimg.top = 0
    _SCREEN.oimg.left = 0
 ENDIF
 _verificar = "_screen.oImgLogo"
 IF !(VARTYPE(&_verificar )#"U") 
    _SCREEN.addobject("oImgLogo", "image")
    _SCREEN.oimglogo.picture = lclogo
    _SCREEN.oimglogo.visible = .T.
    _SCREEN.oimglogo.stretch = 0
    _SCREEN.oimglogo.top = (_SCREEN.height/2)-(_SCREEN.oimglogo.height/2)
    _SCREEN.oimglogo.left = (_SCREEN.width/2)-(_SCREEN.oimglogo.width/2)
 ENDIF
ENDPROC
**
FUNCTION EnviarTicketEmail
 PARAMETER tcnumeroticket
 IF  .NOT. cfgenviarticketemailaclientes
    RETURN .T.
 ENDIF
 LOCAL lcalias
 lcalias = ALIAS()
 SELECT faccab
 SET ORDER TO numfac
 IF SEEK(tcnumeroticket)
    SELECT clientes
    SET ORDER TO codcli
    IF SEEK(faccab.codcli)
       IF clientes.envticmail .AND.  .NOT. EMPTY(ALLTRIM(clientes.email))
          IF cfgtipoenvioemailclientes=1
             DO FORM impfac WITH .T., 0, .T., "", 0, tcnumeroticket, "PDF", ALLTRIM(clientes.email)
          ELSE
             DO FORM impfac WITH .T., 0, .T., "", 0, tcnumeroticket, "XML", ALLTRIM(clientes.email)
          ENDIF
       ENDIF
    ENDIF
 ENDIF
 SELECT &lcalias
 RETURN .T.
ENDFUNC
**
FUNCTION CASHDRO_COBRAR
 PARAMETER tnidventa, tnimporte
 IF TYPE("tnIdVenta")="N"
    tnidventa = ALLTRIM(STR(tnidventa, 15))
 ENDIF
 IF  .NOT. cashdro_revisar_carpetas()
    RETURN .F.
 ENDIF
 lcfichero = ADDBS(FULLPATH(cfgcashdrorutapeticiones))+"V"+ALLTRIM(tnidventa)+".*"
 DELETE FILE &lcfichero
 lcfichero = ADDBS(FULLPATH(cfgcashdrorutarespuestas))+"V"+ALLTRIM(tnidventa)+".*"
 DELETE FILE &lcfichero
 lcfichero = ADDBS(FULLPATH(cfgcashdrorutapeticiones))+"V"+ALLTRIM(tnidventa)+".CD"
 lccontenido = ALLTRIM(STR(ROUND(tnimporte*100, 0), 12))+CHR(10)+CHR(13)+"0"
 STRTOFILE(lccontenido, lcfichero, 0)
 RETURN .T.
ENDFUNC
**
FUNCTION CASHDRO_COBRAR_VERIFICAR
 PARAMETER tnidventa
 IF TYPE("tnIdVenta")="N"
    tnidventa = ALLTRIM(STR(tnidventa, 15))
 ENDIF
 LOCAL lcerrorxml, lccontenidofichero, lninicioerror, lnfinerror, llresultadocobro
 llresultadocobro = 0
 lcerrorxml = ""
 lccontenidofichero = ""
 lninicioerror = 0
 lnfinerror = 0
 IF  .NOT. cashdro_revisar_carpetas()
    llresultadocobro = 1
    RETURN (llresultadocobro)
 ENDIF
 lcfichero = ADDBS(FULLPATH(cfgcashdrorutarespuestas))+"V"+ALLTRIM(tnidventa)+".OK"
 IF FILE(lcfichero)
    DELETE FILE &lcfichero
    lcfichero = ADDBS(FULLPATH(cfgcashdrorutarespuestas))+"V"+ALLTRIM(tnidventa)+".CD"
    IF FILE(lcfichero)
       DELETE FILE &lcfichero
    ENDIF
    llresultadocobro = 2
    RETURN (llresultadocobro)
 ENDIF
 lcfichero = ADDBS(FULLPATH(cfgcashdrorutarespuestas))+"V"+ALLTRIM(tnidventa)+".KO"
 IF FILE(lcfichero)
    lccontenidofichero = FILETOSTR(lcfichero)
    lninicioerror = AT("<MensajeError>", lccontenidofichero, 1)
    lnfinerror = AT("</MensajeError>", lccontenidofichero, 1)
    lcerrorxml = SUBSTR(lccontenidofichero, lninicioerror, lnfinerror-lnfinerror)
    DELETE FILE &lcfichero
    lcfichero = ADDBS(FULLPATH(cfgcashdrorutarespuestas))+"V"+ALLTRIM(tnidventa)+".CD"
    IF FILE(lcfichero)
       DELETE FILE &lcfichero
    ENDIF
    _messagebox(traducir(pcidioma, "Cobro Cashdro Cancelado")+CHR(13)+lcerrorxml, 48, traducir(pcidioma, "Cashdro"))
    llresultadocobro = 1
    RETURN (llresultadocobro)
 ENDIF
 RETURN (llresultadocobro)
ENDFUNC
**
FUNCTION CASHDRO_REVISAR_CARPETAS
 LOCAL lcfichero, lccontenido, lnnumficheros, laficheros, lncontadorficheros, lcnombrefichero, llresultado
 llresultado = .T.
 TRY
    IF  .NOT. EMPTY(cfgcashdrorutapeticiones)
       lcfichero = FULLPATH(cfgcashdrorutapeticiones)
       IF  .NOT. DIRECTORY(lcfichero)
          MKDIR &lcfichero
       ENDIF
    ENDIF
    IF  .NOT. EMPTY(cfgcashdrorutarespuestas)
       lcfichero = FULLPATH(cfgcashdrorutarespuestas)
       IF  .NOT. DIRECTORY(lcfichero)
          MKDIR &lcfichero
       ENDIF
    ENDIF
    IF EMPTY(cfgcashdrorutapeticiones) .OR.  .NOT. DIRECTORY(cfgcashdrorutapeticiones)
       _messagebox(traducir(pcidioma, "Debe configurar la Ruta para Peticiones de Cashdro"), 48, traducir(pcidioma, "Cashdro"))
       llresultado = .F.
    ENDIF
    IF llresultado
       IF EMPTY(cfgcashdrorutarespuestas) .OR.  .NOT. DIRECTORY(cfgcashdrorutarespuestas)
          _messagebox(traducir(pcidioma, "Debe configurar la Ruta para Respuestas de Cashdro"), 48, traducir(pcidioma, "Cashdro"))
          llresultado = .F.
       ENDIF
    ENDIF
    IF llresultado
       DIMENSION laficheros(1)
       lnnumficheros = ADIR(laficheros, ADDBS(FULLPATH(cfgcashdrorutarespuestas))+"*.*")
       FOR lncontadorficheros = 1 TO lnnumficheros
          lcnombrefichero = ADDBS(FULLPATH(cfgcashdrorutarespuestas))+laficheros(lncontadorficheros, 1)
          IF INLIST(UPPER(JUSTEXT(lcnombrefichero)), "CD")
             DELETE FILE &lcnombrefichero 
          ENDIF
       ENDFOR
    ENDIF
 CATCH TO oerr
    _messagebox(traducir(pcidioma, "Error revisando carpetas CASHDRO")+CHR(13)+oerr.message, 48, traducir(pcidioma, "Cashdro"))
    llresultado = .F.
 ENDTRY
 RETURN (llresultado)
ENDFUNC
**
FUNCTION CASHDRO_CANCELAR
 lcfichero = ADDBS(FULLPATH(cfgcashdrorutapeticiones))+"CANCEL.txt"
 IF  .NOT. FILE(lcfichero)
    STRTOFILE("", lcfichero, 0)
 ENDIF
 RETURN .T.
ENDFUNC
**
FUNCTION CASHDRO_PAGAR
 PARAMETER tnidpago, tnimporte
 IF TYPE("tnIdPago")="N"
    tnidpago = ALLTRIM(STR(tnidpago, 15))
 ENDIF
 IF  .NOT. cashdro_revisar_carpetas()
    RETURN .F.
 ENDIF
 tnimporte = ABS(tnimporte)
 lcfichero = ADDBS(FULLPATH(cfgcashdrorutapeticiones))+"P"+ALLTRIM(tnidpago)+".*"
 DELETE FILE &lcfichero
 lcfichero = ADDBS(FULLPATH(cfgcashdrorutarespuestas))+"P"+ALLTRIM(tnidpago)+".*"
 DELETE FILE &lcfichero
 lcfichero = ADDBS(FULLPATH(cfgcashdrorutapeticiones))+"P"+ALLTRIM(tnidpago)+".CD"
 lccontenido = ALLTRIM(STR(ROUND(tnimporte*100, 0), 12))+CHR(10)+CHR(13)+"0"
 STRTOFILE(lccontenido, lcfichero, 0)
 RETURN .T.
ENDFUNC
**
FUNCTION CASHDRO_PAGAR_VERIFICAR
 PARAMETER tnidpago
 IF TYPE("tnIdPago")="N"
    tnidpago = ALLTRIM(STR(tnidpago, 15))
 ENDIF
 LOCAL lcerrorxml, lccontenidofichero, lninicioerror, lnfinerror, llresultadocobro
 llresultadocobro = 0
 lcerrorxml = ""
 lccontenidofichero = ""
 lninicioerror = 0
 lnfinerror = 0
 IF  .NOT. cashdro_revisar_carpetas()
    llresultadocobro = 1
    RETURN (llresultadocobro)
 ENDIF
 lcfichero = ADDBS(FULLPATH(cfgcashdrorutarespuestas))+"P"+ALLTRIM(tnidpago)+".OK"
 IF FILE(lcfichero)
    DELETE FILE &lcfichero
    lcfichero = ADDBS(FULLPATH(cfgcashdrorutarespuestas))+"P"+ALLTRIM(tnidpago)+".CD"
    IF FILE(lcfichero)
       DELETE FILE &lcfichero
    ENDIF
    llresultadocobro = 2
    RETURN (llresultadocobro)
 ENDIF
 lcfichero = ADDBS(FULLPATH(cfgcashdrorutarespuestas))+"P"+ALLTRIM(tnidpago)+".KO"
 IF FILE(lcfichero)
    lccontenidofichero = FILETOSTR(lcfichero)
    lninicioerror = AT("<MensajeError>", lccontenidofichero, 1)
    lnfinerror = AT("</MensajeError>", lccontenidofichero, 1)
    lcerrorxml = SUBSTR(lccontenidofichero, lninicioerror, lnfinerror-lnfinerror)
    DELETE FILE &lcfichero
    lcfichero = ADDBS(FULLPATH(cfgcashdrorutarespuestas))+"P"+ALLTRIM(tnidpago)+".CD"
    IF FILE(lcfichero)
       DELETE FILE &lcfichero
    ENDIF
    _messagebox(traducir(pcidioma, "Pago Cashdro Cancelado")+CHR(13)+lcerrorxml, 48, traducir(pcidioma, "Cashdro"))
    llresultadocobro = 1
    RETURN (llresultadocobro)
 ENDIF
 RETURN (llresultadocobro)
ENDFUNC
**
FUNCTION CASHDRO_ENTRADA
 PARAMETER tnidventa, tnimporte
 IF TYPE("tnIdVenta")="N"
    tnidventa = ALLTRIM(STR(tnidventa, 15))
 ENDIF
 IF  .NOT. cashdro_revisar_carpetas()
    RETURN .F.
 ENDIF
 lcfichero = ADDBS(FULLPATH(cfgcashdrorutapeticiones))+"E"+ALLTRIM(tnidventa)+".*"
 DELETE FILE &lcfichero
 lcfichero = ADDBS(FULLPATH(cfgcashdrorutarespuestas))+"E"+ALLTRIM(tnidventa)+".*"
 DELETE FILE &lcfichero
 lcfichero = ADDBS(FULLPATH(cfgcashdrorutapeticiones))+"E"+ALLTRIM(tnidventa)+".CD"
 lccontenido = ALLTRIM(STR(ROUND(tnimporte*100, 0), 12))+CHR(10)+CHR(13)+"0"
 STRTOFILE(lccontenido, lcfichero, 0)
 RETURN .T.
ENDFUNC
**
FUNCTION CASHDRO_ENTRADA_VERIFICAR
 PARAMETER tnidventa
 IF TYPE("tnIdVenta")="N"
    tnidventa = ALLTRIM(STR(tnidventa, 15))
 ENDIF
 LOCAL lcerrorxml, lccontenidofichero, lninicioerror, lnfinerror, llresultadocobro
 llresultadocobro = 0
 lcerrorxml = ""
 lccontenidofichero = ""
 lninicioerror = 0
 lnfinerror = 0
 IF  .NOT. cashdro_revisar_carpetas()
    llresultadocobro = 1
    RETURN (llresultadocobro)
 ENDIF
 lcfichero = ADDBS(FULLPATH(cfgcashdrorutarespuestas))+"E"+ALLTRIM(tnidventa)+".OK"
 IF FILE(lcfichero)
    DELETE FILE &lcfichero
    lcfichero = ADDBS(FULLPATH(cfgcashdrorutarespuestas))+"E"+ALLTRIM(tnidventa)+".CD"
    IF FILE(lcfichero)
       DELETE FILE &lcfichero
    ENDIF
    llresultadocobro = 2
    RETURN (llresultadocobro)
 ENDIF
 lcfichero = ADDBS(FULLPATH(cfgcashdrorutarespuestas))+"E"+ALLTRIM(tnidventa)+".KO"
 IF FILE(lcfichero)
    lccontenidofichero = FILETOSTR(lcfichero)
    lninicioerror = AT("<MensajeError>", lccontenidofichero, 1)
    lnfinerror = AT("</MensajeError>", lccontenidofichero, 1)
    lcerrorxml = SUBSTR(lccontenidofichero, lninicioerror, lnfinerror-lnfinerror)
    DELETE FILE &lcfichero
    lcfichero = ADDBS(FULLPATH(cfgcashdrorutarespuestas))+"E"+ALLTRIM(tnidventa)+".CD"
    IF FILE(lcfichero)
       DELETE FILE &lcfichero
    ENDIF
    _messagebox(traducir(pcidioma, "Entrada Cashdro Cancelada")+CHR(13)+lcerrorxml, 48, traducir(pcidioma, "Cashdro"))
    llresultadocobro = 1
    RETURN (llresultadocobro)
 ENDIF
 RETURN (llresultadocobro)
ENDFUNC
**
FUNCTION CASHDRO_SALIDA
 PARAMETER tnidventa, tnimporte
 IF TYPE("tnIdVenta")="N"
    tnidventa = ALLTRIM(STR(tnidventa, 15))
 ENDIF
 IF  .NOT. cashdro_revisar_carpetas()
    RETURN .F.
 ENDIF
 lcfichero = ADDBS(FULLPATH(cfgcashdrorutapeticiones))+"P"+ALLTRIM(tnidventa)+".*"
 DELETE FILE &lcfichero
 lcfichero = ADDBS(FULLPATH(cfgcashdrorutarespuestas))+"P"+ALLTRIM(tnidventa)+".*"
 DELETE FILE &lcfichero
 lcfichero = ADDBS(FULLPATH(cfgcashdrorutapeticiones))+"P"+ALLTRIM(tnidventa)+".CD"
 lccontenido = ALLTRIM(STR(ROUND(tnimporte*100, 0), 12))+CHR(10)+CHR(13)+"0"
 STRTOFILE(lccontenido, lcfichero, 0)
 RETURN .T.
ENDFUNC
**
FUNCTION CASHDRO_SALIDA_VERIFICAR
 PARAMETER tnidventa
 IF TYPE("tnIdVenta")="N"
    tnidventa = ALLTRIM(STR(tnidventa, 15))
 ENDIF
 LOCAL lcerrorxml, lccontenidofichero, lninicioerror, lnfinerror, llresultadocobro
 llresultadocobro = 0
 lcerrorxml = ""
 lccontenidofichero = ""
 lninicioerror = 0
 lnfinerror = 0
 IF  .NOT. cashdro_revisar_carpetas()
    llresultadocobro = 1
    RETURN (llresultadocobro)
 ENDIF
 lcfichero = ADDBS(FULLPATH(cfgcashdrorutarespuestas))+"P"+ALLTRIM(tnidventa)+".OK"
 IF FILE(lcfichero)
    DELETE FILE &lcfichero
    lcfichero = ADDBS(FULLPATH(cfgcashdrorutarespuestas))+"P"+ALLTRIM(tnidventa)+".CD"
    IF FILE(lcfichero)
       DELETE FILE &lcfichero
    ENDIF
    llresultadocobro = 2
    RETURN (llresultadocobro)
 ENDIF
 lcfichero = ADDBS(FULLPATH(cfgcashdrorutarespuestas))+"P"+ALLTRIM(tnidventa)+".KO"
 IF FILE(lcfichero)
    lccontenidofichero = FILETOSTR(lcfichero)
    lninicioerror = AT("<MensajeError>", lccontenidofichero, 1)
    lnfinerror = AT("</MensajeError>", lccontenidofichero, 1)
    lcerrorxml = SUBSTR(lccontenidofichero, lninicioerror, lnfinerror-lnfinerror)
    DELETE FILE &lcfichero
    lcfichero = ADDBS(FULLPATH(cfgcashdrorutarespuestas))+"P"+ALLTRIM(tnidventa)+".CD"
    IF FILE(lcfichero)
       DELETE FILE &lcfichero
    ENDIF
    _messagebox(traducir(pcidioma, "Salida Cashdro Cancelada")+CHR(13)+lcerrorxml, 48, traducir(pcidioma, "Cashdro"))
    llresultadocobro = 1
    RETURN (llresultadocobro)
 ENDIF
 RETURN (llresultadocobro)
ENDFUNC
**
FUNCTION CASHDRO_SALDO
 PARAMETER tnidventa, tnimporte
 IF TYPE("tnIdVenta")="N"
    tnidventa = ALLTRIM(STR(tnidventa, 15))
 ENDIF
 IF  .NOT. cashdro_revisar_carpetas()
    RETURN .F.
 ENDIF
 lcfichero = ADDBS(FULLPATH(cfgcashdrorutapeticiones))+"E"+ALLTRIM(tnidventa)+".*"
 DELETE FILE &lcfichero
 lcfichero = ADDBS(FULLPATH(cfgcashdrorutarespuestas))+"E"+ALLTRIM(tnidventa)+".*"
 DELETE FILE &lcfichero
 lcfichero = ADDBS(FULLPATH(cfgcashdrorutapeticiones))+"E"+ALLTRIM(tnidventa)+".CD"
 lccontenido = ALLTRIM(STR(ROUND(tnimporte*100, 0), 12))+CHR(10)+CHR(13)+"0"
 STRTOFILE(lccontenido, lcfichero, 0)
 RETURN .T.
ENDFUNC
**
FUNCTION CASHDRO_SALDO_VERIFICAR
 PARAMETER tnidventa
 IF TYPE("tnIdVenta")="N"
    tnidventa = ALLTRIM(STR(tnidventa, 15))
 ENDIF
 LOCAL lcerrorxml, lccontenidofichero, lninicioerror, lnfinerror, llresultadocobro
 llresultadocobro = 0
 lcerrorxml = ""
 lccontenidofichero = ""
 lninicioerror = 0
 lnfinerror = 0
 IF  .NOT. cashdro_revisar_carpetas()
    llresultadocobro = 1
    RETURN (llresultadocobro)
 ENDIF
 lcfichero = ADDBS(FULLPATH(cfgcashdrorutarespuestas))+"E"+ALLTRIM(tnidventa)+".OK"
 IF FILE(lcfichero)
    DELETE FILE &lcfichero
    lcfichero = ADDBS(FULLPATH(cfgcashdrorutarespuestas))+"E"+ALLTRIM(tnidventa)+".CD"
    IF FILE(lcfichero)
       DELETE FILE &lcfichero
    ENDIF
    llresultadocobro = 2
    RETURN (llresultadocobro)
 ENDIF
 lcfichero = ADDBS(FULLPATH(cfgcashdrorutarespuestas))+"E"+ALLTRIM(tnidventa)+".KO"
 IF FILE(lcfichero)
    lccontenidofichero = FILETOSTR(lcfichero)
    lninicioerror = AT("<MensajeError>", lccontenidofichero, 1)
    lnfinerror = AT("</MensajeError>", lccontenidofichero, 1)
    lcerrorxml = SUBSTR(lccontenidofichero, lninicioerror, lnfinerror-lnfinerror)
    DELETE FILE &lcfichero
    lcfichero = ADDBS(FULLPATH(cfgcashdrorutarespuestas))+"E"+ALLTRIM(tnidventa)+".CD"
    IF FILE(lcfichero)
       DELETE FILE &lcfichero
    ENDIF
    _messagebox(traducir(pcidioma, "Saldo Apertura Cashdro Cancelado")+CHR(13)+lcerrorxml, 48, traducir(pcidioma, "Cashdro"))
    llresultadocobro = 1
    RETURN (llresultadocobro)
 ENDIF
 RETURN (llresultadocobro)
ENDFUNC
**
