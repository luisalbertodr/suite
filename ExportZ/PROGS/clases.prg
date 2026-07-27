**
DEFINE CLASS DetectActivity AS Timer
 justinthisapp = .T.
 inactivityinterval = cfgsegundosinactividad
 interval = 1000
 lastcursorpos = ""
 lastkeybstate = ""
 lastactivity = DATETIME()
 cursorpos = ""
 keybstate = ""
 ignorenext = .T.
**
   PROCEDURE Init
    DECLARE INTEGER GetKeyboardState IN WIN32API STRING @
    DECLARE INTEGER GetCursorPos IN WIN32API STRING @
    DECLARE INTEGER GetForegroundWindow IN WIN32API
   ENDPROC
**
   PROCEDURE Destroy
    CLEAR DLLS  'GETKEYBOARDSTATE', 'GETCURSORPOS', 'GETFOREGROUNDWINDOW'
   ENDPROC
**
   PROCEDURE Timer
    WITH this
       IF  .NOT. .checkactivity()
          IF  .NOT. ISNULL(.lastactivity) .AND. DATETIME()-.lastactivity>cfgsegundosinactividad
             .lastactivity = .NULL.
             .oninactivity()
          ENDIF
       ENDIF
    ENDWITH
   ENDPROC
**
   FUNCTION CheckActivity
    LOCAL lret
    WITH this
       IF .justinthisapp
          IF getforegroundwindow()<>_VFP.hwnd
             RETURN lret
          ENDIF
       ENDIF
       .getcurstate()
       IF ( .NOT. .cursorpos==.lastcursorpos .OR.  .NOT. .keybstate==.lastkeybstate)
          IF  .NOT. .ignorenext
             lret = .T.
             .onactivity()
             .lastactivity = DATETIME()
          ELSE
             .ignorenext = .F.
          ENDIF
          .lastcursorpos = .cursorpos
          .lastkeybstate = .keybstate
       ENDIF
    ENDWITH
    RETURN lret
   ENDFUNC
**
   PROCEDURE GetCurState
    LOCAL spos, sstate
    WITH this
       spos = SPACE(8)
       sstate = SPACE(256)
       getcursorpos(@spos)
       getkeyboardstate(@sstate)
       .cursorpos = spos
       .keybstate = sstate
    ENDWITH
   ENDPROC
**
   PROCEDURE OnInactivity
    IF cfgseguridad .AND. cfgactivarinactividad
       DO FORM login WITH .T., .T.
    ENDIF
   ENDPROC
**
   PROCEDURE OnActivity
**
** ReFox - este procedimiento es vacío **
**
   ENDPROC
**
ENDDEFINE
**
DEFINE CLASS WeToolBar AS Toolbar
 ADD OBJECT botarticulos AS weboton
 ADD OBJECT sep1 AS separator
 ADD OBJECT botclientes AS weboton
 ADD OBJECT sep2 AS separator
 ADD OBJECT botproveedor AS weboton
 ADD OBJECT sep3 AS separator
 ADD OBJECT botempleados AS weboton
 ADD OBJECT sep4 AS separator
 ADD OBJECT botfamilia1 AS weboton
 ADD OBJECT sep5 AS separator
 ADD OBJECT botfacturas AS weboton
 ADD OBJECT sep7 AS separator
 ADD OBJECT botpedpro AS weboton
 ADD OBJECT sep8 AS separator
 ADD OBJECT botalbpro AS weboton
 botarticulos.caption = "Articulos"
 botclientes.caption = "Clientes"
 botproveedor.caption = "Proveedores"
 botempleados.caption = "Empleados"
 botfamilia1.caption = "Familias"
 botfacturas.caption = "Facturas"
 botpedpro.caption = "Pedidos P."
 botalbpro.caption = "Albaranes P."
 left = 1
 top = 1
 width = 60
 caption = "Opciones"
**
   PROCEDURE BOTARTICULOS.CLICK
    DO FORM articulos
   ENDPROC
**
   PROCEDURE BOTCLIENTES.CLICK
    DO FORM CLIENTES
   ENDPROC
**
   PROCEDURE BOTPROVEEDOR.CLICK
    DO FORM PROVEEDOR
   ENDPROC
**
   PROCEDURE BOTEMPLEADOS.CLICK
    DO FORM EMPLEADOS
   ENDPROC
**
   PROCEDURE BOTFAMILIA1.CLICK
    DO FORM FAMILIA1
   ENDPROC
**
   PROCEDURE BOTFACTURAS.CLICK
    DO FORM FACTURAS
   ENDPROC
**
   PROCEDURE BOTPEDPRO.CLICK
    DO FORM PEDPRO
   ENDPROC
**
   PROCEDURE BOTALBPRO.CLICK
    DO FORM ALBPRO
   ENDPROC
**
ENDDEFINE
**
DEFINE CLASS ConversorFRXaWord AS custom
 cnombrefrx = ""
 cconsulta = ""
 cnombreword = ""
 oconversor = .F.
 coldalias = ""
**
   PROCEDURE Init
    this.oconversor = CREATEOBJECT("frx2word")
   ENDPROC
**
   FUNCTION ConvertirFRXaWORD
    PARAMETER tcnombrefrx, tcconsulta, tcnombreword
    LOCAL lcretorno, lnretorno
    lcretorno = "OK"
    lnretorno = 0
    WITH this
       .coldalias = ALIAS()
       IF PCOUNT()<>3
          lcretorno = "Numero de parametros incorrecto"
          RETURN (lcretorno)
       ENDIF
       .cconsulta = tcconsulta
       .cnombrefrx = tcnombrefrx
       .cnombreword = tcnombreword
       SELECT (.cconsulta)
       .oconversor.doc_filename = .cnombreword
       lnretorno = .oconversor.reportform(.cnombrefrx)
       DO CASE
          CASE lnretorno=0
             lcretorno = "OK"
          CASE lnretorno=-6
             lcretorno = "No se ha podido instanciar la aplicacion de WORD"
          CASE lnretorno=-91
             lcretorno = "No se ha podido crear el documento de WORD"
          CASE lnretorno=-92
             lcretorno = "Html no puede ser creado"
          CASE lnretorno=-93
             lcretorno = "Word/Rtf Word no se puede crear"
          CASE lnretorno=-100
             lcretorno = "Interrumpido"
          OTHERWISE
             lcretorno = "Error "+ALLTRIM(STR(lnretorno, 4))
       ENDCASE
       SELECT (.coldalias)
       RETURN (lcretorno)
    ENDWITH
   ENDFUNC
**
ENDDEFINE
**
DEFINE CLASS olePaintFirma AS OLEBOUNDCONTROL
 oleclass = "Paint.Picture"
 oletypeallowed = 1
 top = 164
 left = 255
 height = 200
 width = 300
 stretch = 0
 autoverbmenu = .F.
 autoactivate = 1
 visible = .T.
ENDDEFINE
**
DEFINE CLASS CFDI_ComercioDigital_WebService AS CUSTOM
 serror = ""
 istatus = 0
 crutaproduccion_comerciodigital = ""
 crutatest_comerciodigital = ""
 ltest = .F.
**
   PROCEDURE Init
    PARAMETER pltest
    this.ltest = pltest
    this.istatus = 0
    this.serror = ""
    this.crutaproduccion_comerciodigital = "https://ws.comercio-digital.mx"
    this.crutatest_comerciodigital = "https://pruebas.comercio-digital.mx"
   ENDPROC
**
   FUNCTION GetTimbre
    LPARAMETERS tcfacturaxml, tcusuario, tcpassword, tcfolfis, tcfecfolfis, tchashsat, tchash1sat, tcnocertsat, tntimbrerestantes, tctimbrexml, tcrfcsat, tcleysat
    sxmlrequest = this.crearequest(tcfacturaxml)
    pxmlresponse = ""
    this.istatus = this.ejecutaws(IIF(this.ltest, this.crutatest_comerciodigital, this.crutaproduccion_comerciodigital), sxmlrequest, @pxmlresponse, tcusuario, tcpassword, @tchash1sat, @tntimbrerestantes)
    IF this.istatus<>0
       RETURN .F.
    ENDIF
    tcfolfis = this.obtenerdatoxml("UUID", pxmlresponse)
    IF EMPTY(tcfolfis)
       this.istatus = -1
       this.serror = pxmlresponse
       RETURN .F.
    ENDIF
    tcfecfolfis = this.obtenerdatoxml("FechaTimbrado", pxmlresponse)
    IF EMPTY(tcfecfolfis)
       this.istatus = -1
       this.serror = pxmlresponse
       RETURN .F.
    ENDIF
    tchashsat = this.obtenerdatoxml("SelloSAT", pxmlresponse)
    IF EMPTY(tchashsat)
       this.istatus = -1
       this.serror = pxmlresponse
       RETURN .F.
    ENDIF
    tcsellocfd = this.obtenerdatoxml("SelloCFD", pxmlresponse)
    IF EMPTY(tcsellocfd)
       this.istatus = -1
       this.serror = pxmlresponse
       RETURN .F.
    ENDIF
    tcnocertsat = this.obtenerdatoxml("NoCertificadoSAT", pxmlresponse)
    IF EMPTY(tcnocertsat)
       this.istatus = -1
       this.serror = pxmlresponse
       RETURN .F.
    ENDIF
    tcrfcsat = this.obtenerdatoxml("RfcProvCertif", pxmlresponse)
    IF EMPTY(tcrfcsat)
       this.istatus = -1
       this.serror = pxmlresponse
       RETURN .F.
    ENDIF
    tcversionsat = this.obtenerdatoxml("Version", pxmlresponse)
    IF EMPTY(tcversionsat)
       this.istatus = -1
       this.serror = pxmlresponse
       RETURN .F.
    ENDIF
    tcleysat = ""
    tcleysat = this.obtenerdatoxml("Leyenda", pxmlresponse)
    tchash1sat = "||"+ALLTRIM(tcversionsat)+"|"+ALLTRIM(tcfolfis)+"|"+ALLTRIM(tcfecfolfis)+"|"+ALLTRIM(tcrfcsat)+"|"+IIF( .NOT. EMPTY(tcleysat), ALLTRIM(tcleysat)+"|", "")+ALLTRIM(tcsellocfd)+"|"+ALLTRIM(tcnocertsat)+"||"
    tctimbrexml = pxmlresponse
    RETURN .T.
   ENDFUNC
**
   FUNCTION EjecutaWS
    LPARAMETERS purl_wsdl, pfilerequest, tcfileresponse, tcusuario, tcpassword, tchash1sat, tntimbrerestantes
    TRY
       lresolve = 90000
       lconnect = 90000
       lsend = 90000
       lreceive = 90000
       tcfileresponse = ""
       ohttp = CREATEOBJECT('Msxml2.ServerXMLHTTP.6.0')
       ohttp.settimeouts(lresolve, lconnect, lsend, lreceive)
       purl_wsdl = purl_wsdl+"/timbre/timbrarv5.aspx"
       pfilerequest = STRTRAN(pfilerequest, '<?xml version="1.0"?>', '<?xml version="1.0" encoding="UTF-8"?>')
       lccontentlen = ALLTRIM(STR(LEN(pfilerequest)))
       ohttp.open("POST", purl_wsdl, .F.)
       ohttp.setrequestheader("Content-Type", "text/xml")
       ohttp.setrequestheader("Content-Length", lccontentlen)
       ohttp.setrequestheader("Connection", "Keep-Alive")
       ohttp.setrequestheader("Expect", "100-continue")
       ohttp.setrequestheader("usrws", ALLTRIM(tcusuario))
       ohttp.setrequestheader("pwdws", ALLTRIM(tcpassword))
       ohttp.setrequestheader("tipo", "TIMBRE")
       ohttp.send(pfilerequest)
    CATCH TO loerr
       this.serror = "Error: "+TRANSFORM(loerr.errorno)+" Mensaje: "+loerr.message
       this.istatus = -1
    ENDTRY
    IF this.istatus<>0
       RETURN -1
    ENDIF
    IF ohttp.status=200
       lcnerror_webservice = ohttp.getresponseheader("codigo")
       lcerror_webservice = ohttp.getresponseheader("errmsg")
       IF VAL(lcnerror_webservice)<>0
          this.serror = "["+ALLTRIM(lcnerror_webservice)+"] "+lcerror_webservice
          this.istatus = -1
          RETURN -1
       ELSE
          respuestaws = ohttp.responsetext
          tcfileresponse = STRCONV(respuestaws, 9)
          tchash1sat = ""
          tntimbrerestantes = VAL(ohttp.getresponseheader("saldo"))
          this.istatus = 0
          this.serror = ""
          RETURN 0
       ENDIF
    ELSE
       this.serror = "Error: No se logró la conexión con el Web Service."
       this.istatus = -1
       RETURN -1
    ENDIF
   ENDFUNC
**
   FUNCTION CreaRequest
    LPARAMETERS tcfacturaxml
    lctextofacturaxml = tcfacturaxml.xml
    RETURN lctextofacturaxml
   ENDFUNC
**
   FUNCTION ObtenerDatoXML
    LPARAMETERS tcdatoxml, tcxml
    lcinfodato = ""
    lnposiciondato = AT(tcdatoxml, tcxml)
    IF lnposiciondato<>0
       lnposicion1comilla = 0
       lnposicion2comilla = 0
       lntotal = LEN(tcxml)
       DO WHILE .T.
          lccaracter = SUBSTR(tcxml, lnposiciondato, 1)
          IF lccaracter='"' .AND. lnposicion1comilla=0
             lnposicion1comilla = lnposiciondato
          ELSE
             IF lccaracter='"' .AND. lnposicion2comilla=0
                lnposicion2comilla = lnposiciondato
             ENDIF
          ENDIF
          IF lnposicion1comilla<>0 .AND. lnposicion2comilla<>0
             lcinfodato = SUBSTR(tcxml, lnposicion1comilla+1, lnposicion2comilla-lnposicion1comilla-1)
             EXIT
          ENDIF
          lnposiciondato = lnposiciondato+1
          IF lnposiciondato>lntotal
             EXIT
          ENDIF
       ENDDO
    ENDIF
    RETURN (lcinfodato)
   ENDFUNC
**
ENDDEFINE
**
