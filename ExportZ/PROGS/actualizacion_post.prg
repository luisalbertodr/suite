 PARAMETER tnantiguaversion
 IF tnantiguaversion<"16.2.8"
    IF FILE("planart.dbf")
       USE SHARED planart IN 0
       IF FILE("planificador.dbf")
          USE SHARED planificador IN 0
          SELECT planificador
          SCAN
             IF  .NOT. EMPTY(planificador.codart)
                SELECT planart
                APPEND BLANK
                REPLACE idplan WITH planificador.idplan
                REPLACE codart WITH planificador.codart
                REPLACE hora WITH planificador.hora
             ENDIF
          ENDSCAN
          USE IN planificador
          USE IN planart
       ENDIF
    ENDIF
 ENDIF
 IF tnantiguaversion<"16.3.3"
    IF FILE("clilopd.dbf")
       USE SHARED clilopd IN 0
       IF FILE("clitra.dbf")
          USE SHARED clitra IN 0
          SELECT clilopd
          SCAN
             IF  .NOT. EMPTY(clilopd.dato49)
                SELECT clitra
                APPEND BLANK
                REPLACE codcli WITH clilopd.codcli
                REPLACE fecini WITH CTOD(descodificar(clilopd.dato49))
                REPLACE fecfin WITH CTOD(descodificar(clilopd.dato50))
                REPLACE sesact WITH ALLTRIM(descodificar(clilopd.dato41))
                REPLACE sestot WITH ALLTRIM(descodificar(clilopd.dato42))
                REPLACE tecemp WITH ALLTRIM(descodificar(clilopd.dato43))
                REPLACE aparatos WITH ALLTRIM(descodificar(clilopd.dato44))
                REPLACE cosme WITH ALLTRIM(descodificar(clilopd.dato45))
                REPLACE apodom WITH ALLTRIM(descodificar(clilopd.dato46))
                REPLACE otros WITH ALLTRIM(descodificar(clilopd.dato51))
                REPLACE resultado WITH ALLTRIM(descodificar(clilopd.dato52))
                REPLACE destra WITH ""
             ENDIF
          ENDSCAN
          USE IN clilopd
          USE IN clitra
       ENDIF
    ENDIF
 ENDIF
 IF tnantiguaversion<"16.4.4"
    IF FILE("plan2009.dbf")
       USE SHARED plan2009 IN 0
       USE SHARED planificador IN 0
       USE clientes IN 0
       SELECT clientes
       SET ORDER TO codcli
       SELECT planificador
       SET ORDER TO idplan
       SCAN FOR EMPTY(planificador.idplanrel)
          SELECT plan2009
          APPEND BLANK
          REPLACE idplan WITH planificador.idplan
          REPLACE codemp WITH planificador.codemp
          REPLACE fecha WITH planificador.fecha
          REPLACE horini WITH planificador.hora
          REPLACE horfin WITH planificador.horafin
          REPLACE texto WITH ALLTRIM(planificador.observ)
          REPLACE codrec WITH planificador.codrec
          REPLACE tel1cli WITH planificador.telefono
          REPLACE colfon WITH planificador.color
          REPLACE collet WITH 0
          REPLACE facturado WITH planificador.facturado
          IF planificador.clientebd
             REPLACE codcli WITH ALLTRIM(planificador.cliente)
             SELECT clientes
             IF SEEK(ALLTRIM(planificador.cliente))
                SELECT plan2009
                REPLACE nomcli WITH ALLTRIM(clientes.nomcli)+" "+ALLTRIM(clientes.ape1cli)
             ENDIF
          ELSE
             REPLACE codcli WITH ""
             REPLACE nomcli WITH planificador.cliente
          ENDIF
          SELECT plan2009
       ENDSCAN
       USE IN plan2009
       USE IN planificador
       USE IN clientes
    ENDIF
    USE clientes IN 0
    SELECT clientes
    REPLACE tel1cli WITH formateartelefono(tel1cli), tel2cli WITH formateartelefono(tel2cli), faxcli WITH formateartelefono(faxcli) ALL
    USE IN clientes
    USE PROVEEDOR IN 0
    SELECT proveedor
    REPLACE tel1pro WITH formateartelefono(tel1pro), tel2pro WITH formateartelefono(tel2pro), tel3pro WITH formateartelefono(tel3pro) ALL
    USE IN proveedor
    USE EMPLEADOS IN 0
    SELECT empleados
    REPLACE tel1emp WITH formateartelefono(tel1emp), tel2emp WITH formateartelefono(tel2emp), tel3emp WITH formateartelefono(tel3emp) ALL
    USE IN empleados
 ENDIF
 IF tnantiguaversion<"20.0.0"
    IF FILE("clitra.dbf")
       USE SHARED clitra IN 0
       USE SHARED registros IN 0
       SELECT clitra
       SET ORDER TO CODCLI
       SCAN FOR EMPTY(clitra.idclitra)
          REPLACE idclitra WITH damenumero("Tratamientos Clientes", "CLITRA", "", 0, .F.)
       ENDSCAN
       USE IN clitra
       USE IN registros
    ENDIF
 ENDIF
 IF tnantiguaversion<"20.6.0"
    USE SHARED clientes IN 0
    USE SHARED clitra IN 0
    USE SHARED clipel IN 0
    SELECT clientes
    SCAN
       IF  .NOT. EMPTY(ALLTRIM(clientes.proutip)) .OR.  .NOT. EMPTY(ALLTRIM(clientes.sesionesp)) .OR.  .NOT. EMPTY(ALLTRIM(clientes.frecuenp)) .OR.  .NOT. EMPTY(ALLTRIM(clientes.fecinip)) .OR.  .NOT. EMPTY(ALLTRIM(clientes.fecfinp))
          SELECT clitra
          APPEND BLANK
          REPLACE codcli WITH clientes.codcli
          REPLACE fecini WITH CTOD(descodificar(clientes.fecinip))
          REPLACE fecfin WITH CTOD(descodificar(clientes.fecfinp))
          REPLACE sesact WITH ""
          REPLACE sestot WITH ALLTRIM(descodificar(clientes.sesionesp))
          REPLACE tecemp WITH ALLTRIM(descodificar(clientes.frecuenp))
          REPLACE aparatos WITH ""
          REPLACE cosme WITH ""
          REPLACE apodom WITH ""
          REPLACE otros WITH ALLTRIM(descodificar(clientes.proutip))
          REPLACE resultado WITH ""
          REPLACE destra WITH ""
       ENDIF
       IF  .NOT. EMPTY(ALLTRIM(clientes.prouticp)) .OR.  .NOT. EMPTY(ALLTRIM(clientes.formulasp)) .OR.  .NOT. EMPTY(ALLTRIM(clientes.tecnicap)) .OR.  .NOT. EMPTY(ALLTRIM(clientes.tieexpp))
          SELECT clipel
          APPEND BLANK
          REPLACE codcli WITH clientes.codcli
          REPLACE fecha WITH clientes.fecalta
          REPLACE prouticp WITH ALLTRIM(descodificar(clientes.prouticp))
          REPLACE formulasp WITH ALLTRIM(descodificar(clientes.formulasp))
          REPLACE tecnicap WITH ALLTRIM(descodificar(clientes.tecnicap))
          REPLACE tieexpp WITH ALLTRIM(descodificar(clientes.tieexpp))
       ENDIF
    ENDSCAN
    USE IN clientes
    USE IN clitra
    USE IN clipel
 ENDIF
 IF tnantiguaversion<"20.9.1"
    IF FILE("remrec.dbf")
       USE SHARED remrec IN 0
       IF FILE("cobros.dbf")
          USE SHARED cobros IN 0
          SELECT cobros
          SET ORDER TO numrec
          IF FILE("carcli.dbf")
             USE SHARED carcli IN 0
             SELECT carcli
             SCAN
                IF  .NOT. EMPTY(carcli.idrem)
                   SELECT remrec
                   APPEND BLANK
                   REPLACE idrem WITH carcli.idrem
                   REPLACE serrem WITH carcli.serrem
                   REPLACE ejerem WITH carcli.ejerem
                   REPLACE numrec WITH carcli.numrec
                   REPLACE serfac WITH carcli.serfac
                   REPLACE ejefac WITH carcli.ejefac
                   REPLACE numfac WITH carcli.numfac
                   REPLACE importe WITH carcli.imprec
                   REPLACE estado WITH "C"
                   SELECT cobros
                   IF SEEK(STR(carcli.ejefac, 4)+carcli.serfac+STR(carcli.numfac, 10)+STR(carcli.numrec, 12))
                      SCAN REST WHILE STR(carcli.ejefac, 4)+carcli.serfac+STR(carcli.numfac, 10)+STR(carcli.numrec, 12)=STR(cobros.ejefac, 4)+cobros.serfac+STR(cobros.numfac, 10)+STR(cobros.numrec, 12)
                         IF cobros.impcob=carcli.imprec
                            REPLACE idrem WITH carcli.idrem
                            REPLACE serrem WITH carcli.serrem
                            REPLACE ejerem WITH carcli.ejerem
                         ENDIF
                      ENDSCAN
                   ENDIF
                   SELECT carcli
                   REPLACE idrem WITH 0
                   REPLACE serrem WITH ""
                   REPLACE ejerem WITH 0
                ENDIF
             ENDSCAN
             USE IN carcli
             USE IN remrec
             USE IN cobros
          ENDIF
       ENDIF
    ENDIF
 ENDIF
 RETURN .T.
ENDFUNC
**
