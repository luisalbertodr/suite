 CLOSE DATABASES ALL
 SET EXCLUSIVE OFF
 SET DELETED ON
 SET CONSOLE OFF
 SET TALK OFF
 SET DATE TO dmy
 SET CENTURY ON
 USE SHARED dbf/faccab AGAIN IN 0
 USE SHARED dbf/faclin AGAIN IN 0
 USE SHARED dbf/carcli AGAIN IN 0
 USE SHARED dbf/cobros AGAIN IN 0
 LOCAL lcserie, lnnumfac
 SELECT * FROM faccab WHERE ejefac=2008 AND YEAR(fecfac)=2009 INTO CURSOR Traspasos
 SELECT faccab
 SET ORDER TO numfac
 SELECT faclin
 SET ORDER TO linfac
 SELECT carcli
 SET ORDER TO NUMFAC
 SELECT traspasos
 GOTO TOP
 TRY
    BEGIN TRANSACTION
    SCAN
       SELECT faccab
       IF SEEK(STR(traspasos.ejefac, 4)+traspasos.serfac+STR(traspasos.numfac, 10))
          SELECT STR(ejefac, 4)+serfac+STR(numfac, 10)+STR(linfac, 5) AS clave FROM faclin WHERE STR(ejefac, 4)+serfac+STR(numfac, 10)+STR(linfac, 5)=STR(traspasos.ejefac, 4)+traspasos.serfac+STR(traspasos.numfac, 10) INTO CURSOR tmpFaclin
          SELECT tmpfaclin
          SCAN
             SELECT faclin
             IF SEEK(tmpfaclin.clave)
                DELETE IN faclin
             ENDIF
          ENDSCAN
          USE IN tmpfaclin
          SELECT STR(ejefac, 4)+serfac+STR(numfac, 10)+STR(numrec, 12) AS clave FROM carcli WHERE STR(ejefac, 4)+serfac+STR(numfac, 10)+STR(numrec, 12)=STR(traspasos.ejefac, 4)+traspasos.serfac+STR(traspasos.numfac, 10) INTO CURSOR tmpcarcli
          SELECT tmpcarcli
          SCAN
             SELECT carcli
             IF SEEK(tmpcarcli.clave)
                DELETE IN carcli
             ENDIF
          ENDSCAN
          USE IN tmpcarcli
          SELECT numcob AS clave FROM cobros WHERE STR(ejefac, 4)+serfac+STR(numfac, 10)+STR(numrec, 12)=STR(traspasos.ejefac, 4)+traspasos.serfac+STR(traspasos.numfac, 10) INTO CURSOR tmpcobros
          SELECT tmpcobros
          SCAN
             SELECT cobros
             SET ORDER TO numcob
             IF SEEK(tmpcobros.clave)
                DELETE IN cobros
             ENDIF
          ENDSCAN
          USE IN tmpcobros
          SELECT faccab
          DELETE IN faccab
       ENDIF
    ENDSCAN
    END TRANSACTION
 CATCH TO oerr
    lcmensaje = "Ocurrió un error al realizar el traspaso."+CHR(13)+"ERROR:"+" "+ALLTRIM(STR(oerr.errorno))
    ROLLBACK
    MESSAGEBOX(lcmensaje, 48, "Atención")
 ENDTRY
 IF USED("traspasos")
    USE IN traspasos
 ENDIF
 CLOSE DATABASES ALL
 MESSAGEBOX("Proceso finalizado", 64, "DunaSoft")
 RETURN .T.
ENDFUNC
**
