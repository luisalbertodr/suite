 PARAMETER m.numerror, m.programa, m.lineae, m.mensaje, m.messpar, m.instruccio, m.prog16, m.ultkey, m.wontop
 SET CONSOLE OFF
 LOCAL laerror(7)
 IF  .NOT. TYPE("m.numerror")="N"
    m.numerror = 0
 ENDIF
 IF  .NOT. TYPE("m.mensaje")="C"
    m.mensaje = ""
 ENDIF
 IF  .NOT. TYPE("m.messpar")="C"
    m.messpar = ""
 ENDIF
 IF  .NOT. TYPE("m.instruccio")="C"
    m.instruccio = ""
 ENDIF
 IF  .NOT. TYPE("m.Prog16")="C"
    m.prog16 = ""
 ENDIF
 IF  .NOT. TYPE("m.programa")="C"
    m.programa = ""
 ENDIF
 IF  .NOT. TYPE("m.lineae")="N"
    m.lineae = 0
 ENDIF
 IF  .NOT. TYPE("m.UltKey")="N"
    m.ultkey = 0
 ENDIF
 IF  .NOT. TYPE("m.WONTop")="C"
    m.wontop = ""
 ENDIF
 AERROR(laerror)
 SET SAFETY OFF
 DISPLAY MEMO TO FILE variables.log NOCONSOLE
 m.alias = ALIAS()
 PRIVATE lcconsole, lcsetdev, lcsetprt, lccursor, lconerror, lcaddinfo, llundefquit
 lconerror = ON('ERROR')
 lcconsole = SYS(100)
 lcmensaje = ""
 lnerror = 0
 lcaddinfo = ''
 lcsetdev = SYS(101)
 lcsetprt = SYS(102)
 lccursor = SET('CURSOR')
 SET PRINTER OFF
 SET DEVICE TO SCREEN
 SET CURSOR ON
 CLEAR TYPEAHEAD
 lcaddinfo = CHR(13)+CHR(13)+'ERROR   : '+ALLTRIM(STR(m.numerror))+CHR(13)+'MENSAJE : '+m.mensaje+CHR(13)+'PROGRAMA: '+IIF(EMPTY(m.programa), m.prog16, m.programa)+CHR(13)+'LINEA   : '+ALLTRIM(STR(m.lineae))+CHR(13)+'INSTRUC.: '+m.instruccio
 lcaddinfo = lcaddinfo+CHR(13)+CHR(13)+"Reporte el error al Administrador del Sistema"
 lcaddinfo = lcaddinfo+CHR(13)+"(puede perder parte de los datos no guardados)"
 DO CASE
    CASE m.numerror=39
       lcmensaje = 'Algún dato numérico ha rebasado la capacidad prevista.'+CHR(13)+'No se actualizarán los datos.'
    CASE m.numerror=1884
       lcmensaje = "El registro que desea guardar ya existe. "+"No se actualizarán los datos."
    CASE INLIST(m.numerror, 1, 1162, 1802)
       lcmensaje = 'El fichero '+ALLTRIM(UPPER(m.messpar))+' no se encuentra '
    CASE INLIST(m.numerror, 3, 108, 1106, 1503)
       lcmensaje = 'Un fichero necesario para este programa está siendo usado '+CHR(13)+'por otro usuario. Intente usarlo más tarde.'
    CASE m.numerror=6
       lcmensaje = 'Demasiados ficheros abiertos.'
    CASE INLIST(m.numerror, 19, 20, 114, 1141, 1683)
       lcmensaje = 'Hay un problema con un índice.'
    CASE m.numerror=56
       lcmensaje = 'No hay suficiente espacio en disco.'
    CASE INLIST(m.numerror, 109, 130, 1502)
       lcmensaje = 'El registro está siendo utilizado por otro usuario.'
    CASE m.numerror=124
       lcmensaje = 'No se ha establecido una ruta a una impresora'+CHR(13)+'o bien el dispositivo de impresión no puede compartirse.'
    CASE m.numerror=125
       lcmensaje = 'Impresora no preparada.'
    CASE m.numerror=1104
       lcmensaje = 'Error al leer el archivo.'
    CASE m.numerror=1105
       lcmensaje = 'El sistema operativo ha devuelto un error '+CHR(13)+'cuando intentaba escribir en un archivo.'
    CASE m.numerror=1112
       lcmensaje = 'Error al cerrar el archivo.'
    CASE m.numerror=1705
       lcmensaje = 'Denegado el acceso al archivo.'
    CASE m.numerror=1707
       lcmensaje = 'No se encuentra el archivo .CDX estructural'
    CASE m.numerror=1831
       lcmensaje = 'SQL: error al generar el índice temporal '+'probablemente por falta de espacio en disco.'
    CASE m.numerror=1839
       lcmensaje = '¿Cancelar la actual consulta?'
    CASE m.numerror=1429
       lcmensaje = laerror(1, 3)
    CASE m.numerror=1586
       lcmensaje = "La función requiere el modo de almacenamiento en búfer de filas o tablas"
    OTHERWISE
       lcmensaje = m.mensaje
 ENDCASE
 grabaerrlog()
 _messagebox(lcaddinfo, 48, "Error")
 finsesion = .T.
 programa = ""
 LOCAL lnfor
 FOR lnfor = 1 TO 255
    SELECT (lnfor)
    IF  .NOT. EMPTY(ALIAS()) .AND. CURSORGETPROP('BUFFERING')<>1
       = TABLEREVERT()
    ENDIF
 ENDFOR
 ON ERROR
 SET TALK OFF
 CLOSE DATABASES ALL
 ON SHUTDOWN
 CANCEL
 SET CLASSLIB TO
 CLEAR ALL
 SET SYSMENU TO DEFAULT
 RELEASE ALL EXTENDED
 QUIT
ENDPROC
**
PROCEDURE GrabaErrLog
 LOCAL lclog, lcdat, lny
 lclog = SYS(5)+SYS(2003)+"\errorlog.dbf"
 m.rastro = rastrear()
 IF  .NOT. FILE(lclog)
    CREATE DBF &lclog FREE ( fecha      d( 8), hora       c( 5), ALIAS      c(25), programa   c(25), lineae     n( 6), numerror   n(6), mensaje    m, variable   m, instruccio m, messpar    c(80), prog16     c(254), ultkey     n (5), WONTOP    c(25), rastro     m )		
 ENDIF
 IF  .NOT. USED("errorlog")
    USE &lclog IN 0 SHARED ALIAS errorlog
 ENDIF
 m.fecha = DATE()
 m.hora = TIME()
 INSERT INTO &lclog FROM MEMVAR
 SELECT errorlog
 APPEND MEMO variable FROM variables.log
 RETURN
ENDPROC
**
FUNCTION rastrear
 PRIVATE ind, x
 ind = 1
 x = ''
 DO WHILE  .NOT. EMPTY(PROGRAM(ind)) .AND. PROGRAM(ind)<>'ERRHND'
    x = x+'\'+ALLTRIM(PROGRAM(ind))
    ind = ind+1
 ENDDO
 RETURN x
ENDFUNC
**
