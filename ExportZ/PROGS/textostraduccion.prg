 USE c:\clientes\fuentes\tpv-dunasoft\tpv\idiomas\traductor.dbf IN 0
 SELECT traductor
 SET ORDER TO IDITRA
 USE c:\clientes\fuentes\tpv-dunasoft\tpv\idiomas\FRANCES.dbf IN 0
 SELECT frances
 lncontadorbuenas = 0
 lncontadormalas = 0
 SCAN
    SELECT traductor
    IF SEEK(frances.ididi+frances.caption)
       REPLACE traduccion WITH frances.traduccion
       lncontadorbuenas = lncontadorbuenas+1
    ELSE
       lncontadormalas = lncontadormalas+1
    ENDIF
 ENDSCAN
 CLOSE DATABASES ALL
ENDPROC
**
