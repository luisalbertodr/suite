 PARAMETER tnantiguaversion
 IF tnantiguaversion<"14.1.5"
    IF FILE("dbf/CARPRO.dbf")
       USE SHARED dbf/CARPRO IN 0
       USE SHARED dbf/FACPROC IN 0
       USE SHARED dbf/PAGOS IN 0
       SELECT facproc
       SET ORDER TO NUMFACP
       SELECT carpro
       SCAN
          SELECT facproc
          IF  .NOT. SEEK(STR(carpro.ejefacp, 4)+carpro.serfacp+STR(carpro.numfacp, 10))
             SELECT carpro
             DELETE IN carpro
          ENDIF
       ENDSCAN
       SELECT pagos
       SCAN
          SELECT facproc
          IF  .NOT. SEEK(STR(pagos.ejefacp, 4)+pagos.serfacp+STR(pagos.numfacp, 10))
             SELECT pagos
             DELETE IN pagos
          ENDIF
       ENDSCAN
       USE IN carpro
       USE IN pagos
       USE IN facproc
    ENDIF
 ENDIF
 IF tnantiguaversion<"16.1.1"
    IF FILE("dbf/CIEENTSAL.dbf")
       USE SHARED dbf/CIEENTSAL IN 0
       SELECT cieentsal
       SCAN
          DO CASE
             CASE cieentsal.tipdoc="SALDO"
                REPLACE tipdoc WITH "A"
             CASE cieentsal.tipdoc="SALIDA"
                REPLACE tipdoc WITH "S"
             CASE cieentsal.tipdoc="ENTRADA"
                REPLACE tipdoc WITH "E"
          ENDCASE
       ENDSCAN
       USE IN cieentsal
    ENDIF
    IF FILE("dbf/CARCLI.dbf")
       USE SHARED dbf/CARCLI IN 0
       SELECT carcli
       SCAN
          DO CASE
             CASE carcli.estado="Pendiente"
                REPLACE estado WITH "P"
             CASE carcli.estado="Cobrado"
                REPLACE estado WITH "C"
             CASE carcli.estado="Impagado"
                REPLACE estado WITH "I"
          ENDCASE
       ENDSCAN
       USE IN carcli
    ENDIF
    IF FILE("dbf/CARPRO.dbf")
       USE SHARED dbf/CARPRO IN 0
       SELECT carpro
       SCAN
          DO CASE
             CASE carpro.estado="Pendiente"
                REPLACE estado WITH "P"
             CASE carpro.estado="Pagado"
                REPLACE estado WITH "C"
             CASE carpro.estado="Impagado"
                REPLACE estado WITH "I"
          ENDCASE
       ENDSCAN
       USE IN carpro
    ENDIF
    IF FILE("dbf/REPORTS.dbf")
       USE SHARED dbf/REPORTS IN 0
       SELECT reports
       SET ORDER TO NOMFRX
       IF SEEK("IMPMOV1")
          REPLACE predet WITH .F.
       ENDIF
       USE IN reports
    ENDIF
 ENDIF
 RETURN .T.
ENDFUNC
**
