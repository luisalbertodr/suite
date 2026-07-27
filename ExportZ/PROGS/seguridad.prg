**
FUNCTION TieneAcceso
 PARAMETER tcusuario, tcpantalla
 IF  .NOT. cfgseguridad .OR. ALLTRIM(tcpantalla)==""
    RETURN .T.
 ENDIF
 LOCAL lcalias, lltieneacceso
 lltieneacceso = pousuario.tienepermiso(tcpantalla)
 RETURN (lltieneacceso)
ENDFUNC
**
FUNCTION GuardaSeguridad
 PARAMETER tcgrupo
 LOCAL lcalias, llretorno
 lcalias = ALIAS()
 llretorno = .F.
 IF  .NOT. USED("accesos")
    USE SHARED dbf/accesos AGAIN ALIAS accesos IN 0
 ENDIF
 SELECT accesos
 SET ORDER TO grupan
 IF RLOCK("0", "Accesos")
    IF SEEK(tcgrupo)
       SCAN REST WHILE tcgrupo=accesos.codgru
          DELETE IN accesos
       ENDSCAN
    ENDIF
    SELECT permisos
    SCAN
       IF permisos.permiso
          INSERT INTO accesos (codgru, codpan) VALUES (tcgrupo, permisos.codpan)
       ENDIF
    ENDSCAN
 ENDIF
 UNLOCK IN accesos ALL
 SELECT (lcalias)
 RETURN (llretorno)
ENDFUNC
**
