*** 
*** ReFox XI+  #HF506688  OPORTO  OPORTO [VFP90]
***
 PARAMETER tcpantalla, tcparametro1, tcparametro2, tcparametro3, tcparametro4
 IF TYPE("plDesarrollo")<>"L"
    ON ERROR DO errorwe WITH ERROR(),PROGRAM(),LINENO(),MESSAGE(),SYS(2018),MESSAGE(1),SYS(16),LASTKEY(),WONTOP()
 ELSE
    ON ERROR
 ENDIF
 _SCREEN.caption = ""
 _SCREEN.icon = ""
 _SCREEN.windowstate = 2
 IF PCOUNT()=0
    tcpantalla = ""
    tcparametro1 = ""
    tcparametro2 = ""
    tcparametro3 = ""
    tcparametro4 = ""
 ENDIF
 IF PCOUNT()=1
    tcparametro1 = ""
    tcparametro2 = ""
    tcparametro3 = ""
    tcparametro4 = ""
 ENDIF
 IF PCOUNT()=2
    tcparametro2 = ""
    tcparametro3 = ""
    tcparametro4 = ""
 ENDIF
 IF PCOUNT()=3
    tcparametro3 = ""
    tcparametro4 = ""
 ENDIF
 IF PCOUNT()=4
    tcparametro4 = ""
 ENDIF
 _SCREEN.titlebar = 0
 SET SYSMENU OFF
 SET STATUS BAR OFF
 SET TALK OFF
 SET ECHO OFF
 SET SAFETY OFF
 SET HEADING OFF
 SET STATUS OFF
 SET DATE ITAL
 CLOSE ALL
 SET EXCLUSIVE OFF
 SET CONSOLE OFF
 SET DATE TO italian
 SET CENTURY ON
 SET POINT TO "."
 SET SEPARATOR TO ","
 SET CURRENCY RIGHT
 SET HOURS TO 24
 SET DELETED ON
 SET ESCAPE OFF
 * Carpeta Style: exe (SYS(16)) sin depender de IniciarStyle.bat
 LOCAL lcStyleRoot
 lcStyleRoot = SuiteResolveStyleRoot()
 DO SuiteApplyStyleEnvironment WITH lcStyleRoot
 SET PATH TO (lcStyleRoot) ADDITIVE
 SET PATH TO (lcStyleRoot+"PROGS") ADDITIVE
 SET PATH TO (lcStyleRoot+"vcx") ADDITIVE
 SET PATH TO (lcStyleRoot+"gestion-dunasoft\gestion\vcx") ADDITIVE
 PUBLIC pcSuiteStyleRoot
 pcSuiteStyleRoot = lcStyleRoot
 SET PROCEDURE TO funciones, clases, seguridad, FoxyPreviewer, qdfoxJSON
 * pcidioma antes de SET CLASSLIB (Init de clases usa traducir)
 PUBLIC pcidioma, pcpais, pcversionpais
 pcversionpais = "ESP"
 pcidioma = "CA"
 pcpais = "ESP"
 SET CLASSLIB TO pellib.VCX, msoexp.vcx, enviadoc.vcx, agenda.vcx, tactil.vcx, seguridad.vcx, factura.vcx, planificador.vcx, _datetime.vcx, bar.vcx, screen.vcx, http.vcx, CONTA.VCX, vfpcalendartactil.vcx, remesas.vcx, licencias.vcx, foxcharts.vcx, gdiplusx.vcx, graficos.vcx, plan2009.vcx, plan2009r.vcx, vfpcalendar.vcx, FoxDraw.vcx, pr_htmledit.vcx, tiendaonline.vcx ADDITIVE
 SET REPROCESS TO 6
 SET CLASSLIB TO screen_nueva, tickets_nuevo ADDITIVE
 PUBLIC docum, tcnombreaplicacion, plversiondemo, plfechacaducidad, pltpvpeluqueria, pldemocomercial, pousuario, pcusuario, plversionwebcam, pltpvbar, pctelefonodspc, pcfaxdspc, pcmailregistrodspc, plticketmodal, pcidioma, plstarbene, pcwebstarbene, pcmailstarbene, plcentral, plsucursal, pcurlwebdspc, policencias, pltumarca, plainhoa, pcpais, pcprefijopais, plkincosmetics, plsucursalweb, plcreararticulos, plcrearfamilias, plcrearbonos, plopencel, plfranquicias, plcntfranquicia, plmostrarfavoritos, plone, plversiondemoespecial, plavisorupturastock, pcmailavisorupturastock, plcrearempleados, pcnversionaplicacion, pcurlwebregion, plconexioninternet, pldemostyleformexferia, pcidfranquiciasfm, plstyledunasoftonline, plverfacturaciononlineclientes, plaplicacionesonline, plnoactualizarordenempleado, plnoactualizarverplanempleado, plcreartallasycolores, plverstockonlinearticulos
 * Unlock + sync Suite: despues de PUBLIC pcidioma (clase licencias_unlock lo necesita)
 DO SuiteBootstrapLog WITH "[BOOT-00] general.prg: primera carga unlock root="+lcStyleRoot
 * Sync v2: no usar TYPE() en PROCEDURE (siempre U); SuiteStartSyncIfReady mas adelante
 PUBLIC pcversionpais, pcficheroregistro, pcficheroversion, pcclaveregistropais, pcurlpresentacionpais, pcurlpresentacionpaisoffline, pcversionapp, pcurlnodisponibleversionoffline, pcurlnodisponibleversion, pcnombreexe, pcurlbannerversionfree, pcurlbannerversionfreeoffline, pcbloquearivas, pcmailempresa, pclinkcomprarsms, pclinkcomprarpremium, pclinksoportetecnico, pcbloquearredondeos
 pcversionpais = "ESP"
 pcversionapp = 0
 PUBLIC pcempleadosactivosfree, pclicenciasredfree
 pcempleadosactivosfree = 20
 pclicenciasredfree = 20
 PUBLIC plrenting
 plrenting = .F.
 PUBLIC pcclavechilkatrsa, pcclaveprivadarsa_saft, pcnumerocertificadosaft, pcnifrepresentantedunasoftsaft
 pcclavechilkatrsa = "DUNASFRSA_oghw52as9KvH"
 pcclaveprivadarsa_saft = ""
 pcnumerocertificadosaft = ""
 pcnifrepresentantedunasoftsaft = "770006710"
 pcnversionaplicacion = ""
 pcbloquearivas = .F.
 pcbloquearredondeos = .F.
 plconexioninternet = .F.
 plaplicacionesonline = .F.
 pldemostyleformexferia = .F.
 DO CASE
    CASE pcversionpais="ESP"
       _SCREEN.caption = "Lipout"
       _SCREEN.icon = "dunasoft.ico"
       pcnombreexe = "style.exe"
       pcficheroregistro = "errorswe.txt"
       pcficheroversion = "version.bmp"
       pcclaveregistropais = ""
       pcurlpresentacionpais = "Presentacion_Style.php"
       pcurlpresentacionpaisoffline = "presentacion/Presentacion.html"
       pcurlnodisponibleversionoffline = "presentacion/Nodisponibleversion.html"
       pcurlnodisponibleversion = "dunasoft/minisites/homeStyle/Nodisponibleversion_Style.php"
       pcurlwebdspc = "http://www.dunasoftpc.com"
       pcurlbannerversionfree = "Presentacion_Style.php"
       pcurlbannerversionfreeoffline = "presentacion/Presentacion.html"
       pcmailempresa = "info@dunasoftpc.com"
       pcmailregistrodspc = "registro@dunasoftpc.com"
       pclinkcomprarsms = "http://www.dunasoftpc.com"
       pclinkcomprarpremium = "http://www.dunasoftpc.com"
       pclinksoportetecnico = "http://www.dunasoftpc.com"
       pcurlwebregion = pcurlwebdspc
       plconexioninternet = .F.
       pcidfranquiciasfm = "000035"
    CASE pcversionpais="FRA"
       _SCREEN.caption = "DunaSoft"
       _SCREEN.icon = "dunasoft.ico"
       pcnombreexe = "style.exe"
       pcficheroregistro = "dspcfr.sys"
       pcficheroversion = "versionfr.bmp"
       pcclaveregistropais = "1033"
       pcurlpresentacionpais = "dunasoft/minisites/homeStyle/Presentacion_Style_FRA.php"
       pcurlpresentacionpaisoffline = "presentacion/Presentacion_FRA.html"
       pcurlnodisponibleversionoffline = "presentacion/Nodisponibleversion_FRA.html"
       pcurlnodisponibleversion = "dunasoft/minisites/homeStyle/Nodisponibleversion_Style_FRA.php"
       pcurlwebdspc = "http://www.dunasoftpc.com"
       pcurlbannerversionfree = "Presentacion_Style.php"
       pcurlbannerversionfreeoffline = "presentacion/Presentacion.html"
       pcmailempresa = "info@dunasoftpc.com"
       pcmailregistrodspc = "registro@dunasoftpc.com"
       pclinkcomprarsms = "http://www.dunasoftpc.com"
       pclinkcomprarpremium = "http://www.dunasoftpc.com"
       pclinksoportetecnico = "http://www.dunasoftpc.com"
       pcurlwebregion = pcurlwebdspc
       plconexioninternet = .F.
       pcidfranquiciasfm = "000035"
    CASE pcversionpais="MEX"
       _SCREEN.caption = "Style for Mex"
       _SCREEN.icon = "StyleforMex.ico"
       pcnombreexe = "styleformex.exe"
       pcficheroregistro = "dspcmx.sys"
       pcficheroversion = "versionmx.bmp"
       pcclaveregistropais = "1052"
       pcurlpresentacionpais = "stylemex/minisites/homeStyle/Presentacion_StyleforMex.php"
       pcurlpresentacionpaisoffline = "presentacion/Presentacion_StyleforMex.html"
       pcurlnodisponibleversionoffline = "presentacion/Nodisponibleversion_StyleforMex.html"
       pcurlnodisponibleversion = "stylemex/minisites/homeStyle/Nodisponibleversion_StyleforMex.php"
       pcurlwebdspc = "http://www.dunasoftpc.com"
       pcurlwebregion = "http://www.styleformex.mx"
       pcurlbannerversionfree = "stylemex/minisites/homeStyle/Banner_StyleforMex.php"
       pcurlbannerversionfreeoffline = "presentacion/Banner_StyleforMex.html"
       pcbloquearivas = .T.
       pcbloquearredondeos = .T.
       pcmailempresa = "info@styleformex.mx"
       pcmailregistrodspc = "info@styleformex.mx"
       pclinkcomprarsms = "http://www.styleformex.mx/tienda-online.html"
       pclinkcomprarpremium = "http://www.styleformex.mx/tienda-online.html"
       pclinksoportetecnico = "http://www.styleformex.mx/soporte-online.html"
       pcversionapp = 2
       plconexioninternet = checkhttpconnection(pcurlwebregion)
       pcidfranquiciasfm = "000034"
 ENDCASE
 PUBLIC dwordoffset, wordoffset
 dwordoffset = 2147483648 
 wordoffset = 32768
 LOCAL llidiomaconfigurado
 llidiomaconfigurado = .F.
 pltpvpeluqueria = .T.
 pldemocomercial = .F.
 plversionwebcam = .T.
 pltpvbar = .F.
 plmostrarfavoritos = .F.
 mostrarpantallaespera()
 plcntfranquicia = ""
 plfranquicias = .F.
 DO CASE
    CASE pltpvpeluqueria
       plcntfranquicia = "Franquicia_dunasoft"
    CASE pltpvbar
       plcntfranquicia = "Franquicia_dunasoft_BAR"
    CASE  .NOT. pltpvpeluqueria .AND.  .NOT. pltpvbar
       plcntfranquicia = "Franquicia_dunasoft_TPV"
 ENDCASE
 IF FILE("FranquiciaWeb.cfg")
    lcficheroconfiguracion = UPPER(FILETOSTR("FranquiciaWeb.cfg"))
    IF AT("PUNTOGLAMOUR", lcficheroconfiguracion)<>0
       plfranquicias = .T.
       plcntfranquicia = "franquicia_puntoglamour"
    ENDIF
    IF AT("SALERM", lcficheroconfiguracion)<>0
       plfranquicias = .T.
       plcntfranquicia = "franquicia_salerm"
    ENDIF
    IF AT("STARBENEBENEDEPIL", lcficheroconfiguracion)<>0
       plfranquicias = .T.
       plcntfranquicia = "franquicia_starbene_benedepil"
    ENDIF
    IF AT("SEVENBYSEVEN", lcficheroconfiguracion)<>0
       plfranquicias = .T.
       plcntfranquicia = "franquicia_sevenbyseven_socap"
    ENDIF
    IF AT("LATELIER", lcficheroconfiguracion)<>0
       plfranquicias = .T.
       plcntfranquicia = "franquicia_LAtelier"
    ENDIF
    IF AT("TUMOMENTO", lcficheroconfiguracion)<>0
       plfranquicias = .T.
       plcntfranquicia = "franquicia_TuMomento"
    ENDIF
    IF AT("BOURJOIS", lcficheroconfiguracion)<>0
       plfranquicias = .T.
       plcntfranquicia = "franquicia_Bourjois"
    ENDIF
    IF AT("PRODIPEL", lcficheroconfiguracion)<>0
       plfranquicias = .T.
       plcntfranquicia = "franquicia_Prodipel"
    ENDIF
    IF AT("BAJOCERO", lcficheroconfiguracion)<>0
       plfranquicias = .T.
       plcntfranquicia = "franquicia_Bajocero"
    ENDIF
    IF AT("TECNICAYBELLEZA", lcficheroconfiguracion)<>0
       plfranquicias = .T.
       plcntfranquicia = "franquicia_tecnicaybelleza"
    ENDIF
    IF AT("MARIAPADILLA", lcficheroconfiguracion)<>0
       plfranquicias = .T.
       plcntfranquicia = "franquicia_maria_padilla"
    ENDIF
    IF AT("DEPILASERVICE", lcficheroconfiguracion)<>0
       plfranquicias = .T.
       plcntfranquicia = "franquicia_depilaservice"
    ENDIF
    IF AT("BEAUTYFARMA", lcficheroconfiguracion)<>0
       plfranquicias = .T.
       plcntfranquicia = "franquicia_beautyfarma"
    ENDIF
    IF AT("PUNTOSONRISA", lcficheroconfiguracion)<>0
       plfranquicias = .T.
       plcntfranquicia = "franquicia_puntosonrisa"
    ENDIF
    IF AT("POINTSOURIRE", lcficheroconfiguracion)<>0
       plfranquicias = .T.
       plcntfranquicia = "franquicia_pointsourire"
    ENDIF
    IF AT("PULSAZIONEBRASIL", lcficheroconfiguracion)<>0
       plfranquicias = .T.
       plcntfranquicia = "franquicia_pulsazionebrasil"
    ENDIF
    IF AT("EUROLOOK", lcficheroconfiguracion)<>0
       plfranquicias = .T.
       plcntfranquicia = "franquicia_eurolook"
    ENDIF
    IF AT("TEMPLODELMASAJE", lcficheroconfiguracion)<>0
       plfranquicias = .T.
       plcntfranquicia = "franquicia_templodelmasaje"
    ENDIF
    IF AT("STETIKXPRESS", lcficheroconfiguracion)<>0
       plfranquicias = .T.
       plcntfranquicia = "franquicia_stetikxpress"
    ENDIF
    IF AT("CELEBRITYNAILS", lcficheroconfiguracion)<>0
       plfranquicias = .T.
       plcntfranquicia = "franquicia_celebritynails"
    ENDIF
    IF AT("ABIGAIL", lcficheroconfiguracion)<>0
       plfranquicias = .T.
       plcntfranquicia = "franquicia_abigail"
    ENDIF
    IF AT("MATALLIN", lcficheroconfiguracion)<>0
       plfranquicias = .T.
       plcntfranquicia = "franquicia_matallin"
    ENDIF
    IF AT("MIMAS", lcficheroconfiguracion)<>0
       plfranquicias = .T.
       plcntfranquicia = "franquicia_mimas"
    ENDIF
    IF AT("FOTODEPILBEAUTY", lcficheroconfiguracion)<>0
       plfranquicias = .T.
       plcntfranquicia = "franquicia_fotodepilbeauty"
    ENDIF
    IF AT("METROPOLYTAN", lcficheroconfiguracion)<>0
       plfranquicias = .T.
       plcntfranquicia = "franquicia_metropolytan"
    ENDIF
    IF AT("THECOLOUREDCLAP", lcficheroconfiguracion)<>0
       plfranquicias = .T.
       plcntfranquicia = "franquicia_thecolouredclap"
    ENDIF
    IF AT("DERMASANA", lcficheroconfiguracion)<>0
       plfranquicias = .T.
       plcntfranquicia = "franquicia_dermasana"
    ENDIF
    IF AT("DERMACLINIC", lcficheroconfiguracion)<>0
       plfranquicias = .T.
       plcntfranquicia = "franquicia_dermaclinic"
    ENDIF
    IF AT("CREMOLOGY", lcficheroconfiguracion)<>0
       plfranquicias = .T.
       plcntfranquicia = "franquicia_cremology"
    ENDIF
    IF AT("CLINICADIMAR", lcficheroconfiguracion)<>0
       plfranquicias = .T.
       plcntfranquicia = "franquicia_clinicadimar"
    ENDIF
    IF AT("RAPIDFITANDWELL", lcficheroconfiguracion)<>0
       plfranquicias = .T.
       plcntfranquicia = "franquicia_rapidfitandwell"
    ENDIF
    IF AT("PUPIHAIR", lcficheroconfiguracion)<>0
       plfranquicias = .T.
       plcntfranquicia = "franquicia_pupihair"
    ENDIF
    IF AT("SI_SALUDINTEGRAL", lcficheroconfiguracion)<>0
       plfranquicias = .T.
       plcntfranquicia = "franquicia_si_saludintegral"
    ENDIF
    IF AT("ANIMASPAGESTION", lcficheroconfiguracion)<>0
       plfranquicias = .T.
       plcntfranquicia = "franquicia_animaspagestion"
    ENDIF
    IF AT("CEVIPE", lcficheroconfiguracion)<>0
       plfranquicias = .T.
       plcntfranquicia = "franquicia_cevipe"
    ENDIF
    IF AT("CASADA", lcficheroconfiguracion)<>0
       plfranquicias = .T.
       plcntfranquicia = "franquicia_casada"
    ENDIF
    IF AT("HELLOBEAUTY", lcficheroconfiguracion)<>0
       plfranquicias = .T.
       plcntfranquicia = "franquicia_hellobeauty"
    ENDIF
    IF AT("DIVINITY", lcficheroconfiguracion)<>0
       plfranquicias = .T.
       plcntfranquicia = "franquicia_divinity"
    ENDIF
    IF AT("WHENUWANT", lcficheroconfiguracion)<>0
       plfranquicias = .T.
       plcntfranquicia = "franquicia_whenuwant"
    ENDIF
    IF AT("LAMETRO", lcficheroconfiguracion)<>0
       plfranquicias = .T.
       plcntfranquicia = "franquicia_lametro"
    ENDIF
    IF AT("HAIRDISTRICT", lcficheroconfiguracion)<>0
       plfranquicias = .T.
       plcntfranquicia = "franquicia_hairdistrict"
    ENDIF
    IF AT("SUNDARA", lcficheroconfiguracion)<>0
       plfranquicias = .T.
       plcntfranquicia = "franquicia_sundara"
    ENDIF
    IF AT("ESTETICPRO", lcficheroconfiguracion)<>0
       plfranquicias = .T.
       plcntfranquicia = "franquicia_esteticpro"
    ENDIF
    IF AT("CASANOVA", lcficheroconfiguracion)<>0
       plfranquicias = .T.
       plcntfranquicia = "franquicia_casanova"
    ENDIF
    IF AT("LLONGUERAS", lcficheroconfiguracion)<>0
       plfranquicias = .T.
       plcntfranquicia = "franquicia_llongueras"
    ENDIF
    IF AT("CAMULSE-SPA", lcficheroconfiguracion)<>0
       plfranquicias = .T.
       plcntfranquicia = "franquicia_camulse_spa"
    ENDIF
    IF AT("CAMULSE-BAZARES", lcficheroconfiguracion)<>0
       plfranquicias = .T.
       plcntfranquicia = "franquicia_camulse_bazares"
    ENDIF
    IF AT("NUEVOLOOK", lcficheroconfiguracion)<>0
       plfranquicias = .T.
       plcntfranquicia = "franquicia_nuevolook"
    ENDIF
    IF AT("MUNDODESIREE", lcficheroconfiguracion)<>0
       plfranquicias = .T.
       plcntfranquicia = "franquicia_mundodesiree"
    ENDIF
    IF AT("DEPSYSTEM", lcficheroconfiguracion)<>0
       plfranquicias = .T.
       plcntfranquicia = "franquicia_depsystem"
    ENDIF
    IF AT("NEWLOOK", lcficheroconfiguracion)<>0
       plfranquicias = .T.
       plcntfranquicia = "franquicia_newlook"
    ENDIF
    IF AT("DUNASOFT", lcficheroconfiguracion)<>0
       plfranquicias = .F.
       DO CASE
          CASE pltpvpeluqueria
             plcntfranquicia = "Franquicia_dunasoft"
          CASE pltpvbar
             plcntfranquicia = "Franquicia_dunasoft_BAR"
          CASE  .NOT. pltpvpeluqueria .AND.  .NOT. pltpvbar
             plcntfranquicia = "Franquicia_dunasoft_TPV"
       ENDCASE
    ENDIF
 ENDIF
 plone = .F.
 IF FILE("One.cfg") .AND.  .NOT. plfranquicias
    lcficheroconfiguracion = UPPER(FILETOSTR("One.cfg"))
    IF AT("GYMESTHETIC", lcficheroconfiguracion)<>0
       plone = .T.
       plcntfranquicia = "one_gymesthetic"
    ENDIF
    IF AT("POINTSOURIRE", lcficheroconfiguracion)<>0
       plone = .T.
       plcntfranquicia = "franquicia_pointsourire"
    ENDIF
    IF AT("AINHOA", lcficheroconfiguracion)<>0
       plone = .T.
       plcntfranquicia = "franquicia_ainhoa"
    ENDIF
    IF AT("TCQ", lcficheroconfiguracion)<>0
       plone = .T.
       plcntfranquicia = "ONE_tcq"
       pcidfranquiciasfm = "000036"
    ENDIF
    IF AT("LOREALMEXICO", lcficheroconfiguracion)<>0
       plone = .T.
       plcntfranquicia = "ONE_lorealmexico"
       pcidfranquiciasfm = "000034"
    ENDIF
    IF AT("HARTSUIKER", lcficheroconfiguracion)<>0
       plone = .T.
       plcntfranquicia = "SFM_SINLOGO"
       pcidfranquiciasfm = "000043"
    ENDIF
    IF AT("ASCIENDE", lcficheroconfiguracion)<>0
       plone = .T.
       plcntfranquicia = "SFM_SINLOGO"
       pcidfranquiciasfm = "000050"
    ENDIF
    IF AT("LOFTSPA", lcficheroconfiguracion)<>0
       plone = .T.
       plcntfranquicia = "SFM_SINLOGO"
       pcidfranquiciasfm = "000045"
    ENDIF
    IF AT("MSMACRO", lcficheroconfiguracion)<>0
       plone = .T.
       plcntfranquicia = "SFM_SINLOGO"
       pcidfranquiciasfm = "000053"
    ENDIF
    IF AT("NATTURALABS", lcficheroconfiguracion)<>0
       plone = .T.
       plcntfranquicia = "ONE_natturalabs"
       pcidfranquiciasfm = "000034"
    ENDIF
    IF AT("CAMIEF", lcficheroconfiguracion)<>0
       plone = .T.
       plcntfranquicia = "ONE_CAMIEF"
       pcidfranquiciasfm = "000054"
    ENDIF
    IF AT("SOBRELARED", lcficheroconfiguracion)<>0
       plone = .T.
       plcntfranquicia = "SFM_SINLOGO"
       pcidfranquiciasfm = "000058"
    ENDIF
    IF AT("MIHABODYTEC", lcficheroconfiguracion)<>0
       plone = .T.
       plcntfranquicia = "ONE_MIHABODYTEC"
       pcidfranquiciasfm = "000061"
    ENDIF
    IF AT("FITANDGO", lcficheroconfiguracion)<>0
       plone = .T.
       plcntfranquicia = "ONE_FITANDGO"
       pcidfranquiciasfm = "000070"
    ENDIF
    IF AT("SCHWARZKOPF", lcficheroconfiguracion)<>0
       plone = .T.
       plcntfranquicia = "ONE_SCHWARZKOPF"
       pcidfranquiciasfm = "000083"
    ENDIF
    IF AT("SELVERT", lcficheroconfiguracion)<>0
       plone = .T.
       plcntfranquicia = "ONE_SELVERT"
       pcidfranquiciasfm = "000088"
    ENDIF
    IF AT("CASANOVA", lcficheroconfiguracion)<>0
       plone = .T.
       plcntfranquicia = "ONE_CASANOVA"
       pcidfranquiciasfm = "000090"
    ENDIF
    IF AT("LLONGUERAS", lcficheroconfiguracion)<>0
       plone = .T.
       plcntfranquicia = "ONE_LLONGUERAS"
       pcidfranquiciasfm = "000094"
    ENDIF
    IF AT("DUNASOFT", lcficheroconfiguracion)<>0
       plfranquicias = .F.
       DO CASE
          CASE pltpvpeluqueria
             plcntfranquicia = "Franquicia_dunasoft"
          CASE pltpvbar
             plcntfranquicia = "Franquicia_dunasoft_BAR"
          CASE  .NOT. pltpvpeluqueria .AND.  .NOT. pltpvbar
             plcntfranquicia = "Franquicia_dunasoft_TPV"
       ENDCASE
    ENDIF
 ENDIF
 plstyledunasoftonline = .F.
 IF FILE("SDOnline.cfg")
    plstyledunasoftonline = .T.
 ENDIF
 plopencel = .F.
 plainhoa = .F.
 plkincosmetics = .F.
 pltumarca = .F.
 plstarbene = .T.
 pcwebstarbene = "www.starbene.com"
 pcmailstarbene = "business@starbene.com"
 IF pcversionpais=="MEX"
    pcpais = "MEX"
    pcprefijopais = "52"
    pcidioma = "MX"
 ELSE
    pcpais = "ESP"
    pcprefijopais = "34"
    pcidioma = "CA"
 ENDIF
 pousuario = SuiteSafeCreateObject("usuario", lcStyleRoot+"vcx\seguridad.vcx")
 IF VARTYPE(pousuario)#"O"
    DO SuiteBootstrapLog WITH "[BOOT-FATAL] usuario no creado — falta vcx\seguridad o rebuild Duna.exe"
    RETURN .F.
 ENDIF
 pousuario.login = "Administrador"
 pcusuario = pousuario.login
 pousuario.password = ""
 pousuario.administrador = .T.
 pctelefonodspc = "(+34) 93.710.32.97"
 pcfaxdspc = "(+34) 93.720.85.16"
 plcentral = .F.
 plsucursal = .F.
 plsucursalweb = .F.
 plcreararticulos = .T.
 plcrearfamilias = .T.
 plcrearbonos = .T.
 plcrearempleados = .T.
 plavisorupturastock = .F.
 pcmailavisorupturastock = ""
 plnoactualizarordenempleado = .F.
 plnoactualizarverplanempleado = .F.
 plcreartallasycolores = .T.
 plverfacturaciononlineclientes = .F.
 plverstockonlinearticulos = .F.
 IF pltpvbar
    plticketmodal = .F.
 ELSE
    plticketmodal = .F.
 ENDIF
 IF pltpvpeluqueria
    tcnombreaplicacion = "Lipout"
 ELSE
    tcnombreaplicacion = "Lipout"
 ENDIF
 IF pltpvbar
    tcnombreaplicacion = "Lipout"
 ENDIF
 docum = ""
 plversiondemo = .F.
 plversiondemoespecial = .T.
 plfechacaducidad = CTOD("01/05/2219")
 pclicenciasredfree = 999
 pcempleadosactivosfree = 999
 LOCAL plversiondemoforzado
 plversiondemoforzado = .F.
 IF pcversionpais="MEX" .AND. plversiondemo
    pcversionapp = 0
    plversiondemoforzado = .T.
    pcnombreexe = "styleformex_demo.exe"
 ENDIF
 SET SYSMENU TO
 IF FILE(ADDBS(SYS(5)+SYS(2003))+"SMSRojo.txt")
    DELETE FILE (ADDBS(SYS(5)+SYS(2003))+"SMSRojo.txt")
 ENDIF
 LOCAL lcconfigurarpais
 lcconfigurarpais = ""
 = SuiteEnsureDatabaseOpen()
 IF  .NOT. FILE(lcStyleRoot+"EMPRESA.DBF")
    DO config
    IF pcversionpais<>"MEX"
       DO FORM IDIOMA WITH .T.
       llidiomaconfigurado = .T.
       pcidioma = cfgidioma
       pcpais = cfgpais
       lcconfigurarpais = cfgpais
    ELSE
       cfgidioma = "MX"
       cfgpais = "MEX"
       pcpais = "MEX"
       pcprefijopais = "52"
       pcidioma = "MX"
       lcconfigurarpais = cfgpais
       llidiomaconfigurado = .T.
    ENDIF
 ENDIF
 IF plversiondemo
    DO config
    DO FORM Acerca
 ENDIF
 LOCAL gnerrfile, lcdirbase, llresultado, llregistroactualizacion, llnuevainstalacionmex
 lcdirbase = lcStyleRoot
 llregistroactualizacion = .F.
 llnuevainstalacionmex = .F.
 IF  .NOT. (TYPE("plDesarrollo")="L" .AND. pldesarrollo)
    IF pcversionpais="MEX" .AND. FILE("version.bmp")
       _messagebox(traducir(pcidioma, "La versi"+CHR(243)+"n no coincide con la Regi"+CHR(243)+"n. Imposible actualizar. Consulte con su proveedor."), 64, traducir(pcidioma, "Atencion"))
       DO cerrar
       RETURN .F.
    ENDIF
 ENDIF
 lnantiguaversion = ""
 * Style Suite: sin comprobar actualizacion Dunasoft (solo SuiteSync.cfg + sync embebida)
 IF FILE(ADDBS(lcStyleRoot)+"SuiteSync.cfg") OR FILE(ADDBS(SYS(5)+SYS(2003))+"SuiteSync.cfg")
    llresultado = .T.
    llregistroactualizacion = .T.
 ELSE
 DO CASE
    CASE pltpvbar
       llresultado = actualizar(SYS(5)+SYS(2003)+"\dbf\", SYS(5)+SYS(2003)+"\temp\", "generadbc", SYS(5)+SYS(2003)+"\frx\", SYS(5)+SYS(2003)+"\tpvfrx\", "Bar.exe", @llregistroactualizacion, @llnuevainstalacionmex, @lnantiguaversion)
    CASE pltpvpeluqueria
       llresultado = actualizar(SYS(5)+SYS(2003)+"\dbf\", SYS(5)+SYS(2003)+"\temp\", "generadbc", SYS(5)+SYS(2003)+"\frx\", SYS(5)+SYS(2003)+"\tpvfrx\", pcnombreexe, @llregistroactualizacion, @llnuevainstalacionmex, @lnantiguaversion)
    CASE  .NOT. pltpvpeluqueria
       llresultado = actualizar(SYS(5)+SYS(2003)+"\dbf\", SYS(5)+SYS(2003)+"\temp\", "generadbc", SYS(5)+SYS(2003)+"\frx\", SYS(5)+SYS(2003)+"\tpvfrx\", "TPV.exe", @llregistroactualizacion, @llnuevainstalacionmex, @lnantiguaversion)
 ENDCASE
 ENDIF
 IF  .NOT. llregistroactualizacion
    _messagebox(traducir(pcidioma, "No se ha registrado la Actualizaci"+CHR(243)+"n. Consulte con su proveedor."), 64, traducir(pcidioma, "Atencion"))
    DO cerrar
    RETURN .F.
 ENDIF
 IF  .NOT. llresultado
    _messagebox(traducir(pcidioma, "Es una versi"+CHR(243)+"n demo. Imposible actualizar. Consulte con su proveedor."), 64, traducir(pcidioma, "Atencion"))
    DO cerrar
    RETURN .F.
 ENDIF
 SET DEFAULT TO (lcStyleRoot)
 DO config
 IF  .NOT. EMPTY(lcconfigurarpais)
    configurarpais(lcconfigurarpais)
 ENDIF
 USE (lcStyleRoot+"EMPRESA")
 IF RECCOUNT()=0
    IF pcversionpais=="MEX"
       INSERT INTO EMPRESA (codemp, razemp, imaemp, fondo) VALUES ("EMP1", "Empresa de Pruebas", "BMP\styleformex_logotipo.png", "")
       cfgimaemp = SYS(5)+SYS(2003)+"BMP\styleformex_logotipo.png"
    ELSE
       INSERT INTO EMPRESA (codemp, razemp, imaemp, fondo) VALUES ("EMP1", "Empresa de Pruebas", "BMP\dunasoft_logotipo.png", "FONDOS\DSPC.JPG")
       cfgimaemp = SYS(5)+SYS(2003)+"BMP\dunasoft_logotipo.png"
    ENDIF
 ENDIF
 GOTO TOP
 IF  .NOT. EMPTY(empresa.config)
    RESTORE FROM MEMO config ADDITIVE
    pcpais = cfgpais
    IF cfgpmc
       cfgpmc = .F.
       cfgcalcularcoste = 2
    ENDIF
    IF  .NOT. cfgmoduloproveedores
       cfgmoduloproveedores = .T.
    ENDIF
    IF  .NOT. EMPTY(lnantiguaversion) .AND. lnantiguaversion<"20.6.0"
       DO CASE
          CASE cfgpeluqueriaestetica=1
             cfgmostrarfichacontrol = .T.
             cfgmostrarfichaclinicos = .T.
             cfgmostrarfichapiel = .T.
             cfgmostrarfichapeso = .T.
             cfgmostrarfichalaser = .T.
             cfgmostrarfichasesioneslaser = .T.
             cfgmostrarfichacavitacion = .T.
             cfgmostrarfichatratamientos = .T.
             cfgmostrarfichaesteticabasica = .T.
             cfgmostrarfichaotros = .T.
             cfgmostrarfichapeluqueria = .T.
          CASE cfgpeluqueriaestetica=2
             cfgmostrarfichacontrol = .F.
             cfgmostrarfichaclinicos = .F.
             cfgmostrarfichapiel = .F.
             cfgmostrarfichapeso = .F.
             cfgmostrarfichalaser = .F.
             cfgmostrarfichasesioneslaser = .F.
             cfgmostrarfichacavitacion = .F.
             cfgmostrarfichatratamientos = .T.
             cfgmostrarfichaesteticabasica = .F.
             cfgmostrarfichaotros = .T.
             cfgmostrarfichapeluqueria = .T.
          CASE cfgpeluqueriaestetica=3
             cfgmostrarfichaesteticabasica = .T.
             cfgmostrarfichaotros = .T.
             cfgmostrarfichapeluqueria = .F.
       ENDCASE
    ENDIF
 ELSE
    cfgformatocliente = 6
 ENDIF
 IF pltpvbar
    cfgmostrarfichacontrol = .F.
    cfgmostrarfichaclinicos = .F.
    cfgmostrarfichapiel = .F.
    cfgmostrarfichapeso = .F.
    cfgmostrarfichalaser = .F.
    cfgmostrarfichasesioneslaser = .F.
    cfgmostrarfichacavitacion = .F.
    cfgmostrarfichatratamientos = .F.
    cfgmostrarfichaesteticabasica = .F.
    cfgmostrarfichaotros = .T.
    cfgmostrarfichapeluqueria = .F.
 ENDIF
 plmostrarfavoritos = cfgmostrarfavoritosmenu
 * licencias: sin NEWOBJECT/subclase (1732). Comprobacion desactivada (.F. .AND. entrausuario).
 policencias = SuiteSafeCreateObject("licencias", lcStyleRoot+"vcx\licencias.vcx")
 IF VARTYPE(policencias)#"O"
    DO SuiteBootstrapLog WITH "[BOOT-FATAL] licencias no creado — falta vcx\licencias o rebuild Duna.exe"
    RETURN .F.
 ENDIF
 IF FILE("tnccentral.cfg")
    plcentral = .T.
 ELSE
    IF FILE("tnctienda.cfg")
       plsucursal = .T.
       plcreararticulos = .F.
       plcrearfamilias = .F.
       plcrearbonos = .F.
       plcrearempleados = .T.
       plcreartallasycolores = .T.
    ENDIF
 ENDIF
 IF FILE("FranquiciaWeb.cfg")
    lcficheroconfiguracion = UPPER(FILETOSTR("FranquiciaWeb.cfg"))
    IF AT("CREARARTICULOS", lcficheroconfiguracion)<>0
       plcreararticulos = .T.
    ELSE
       plcreararticulos = .F.
    ENDIF
    IF AT("CREARFAMILIAS", lcficheroconfiguracion)<>0
       plcrearfamilias = .T.
    ELSE
       plcrearfamilias = .F.
    ENDIF
    IF AT("CREARBONOS", lcficheroconfiguracion)<>0
       plcrearbonos = .T.
    ELSE
       plcrearbonos = .F.
    ENDIF
    IF AT("CREARTALLASCOLORES", lcficheroconfiguracion)<>0
       plcreartallasycolores = .T.
    ELSE
       plcreartallasycolores = .F.
    ENDIF
    IF AT("NOCREAREMPLEADOS", lcficheroconfiguracion)<>0
       plcrearempleados = .F.
    ELSE
       plcrearempleados = .T.
    ENDIF
    IF AT("AVISORUPTURASTOCK", lcficheroconfiguracion)<>0
       plavisorupturastock = .T.
    ELSE
       plavisorupturastock = .F.
    ENDIF
    IF AT("@", lcficheroconfiguracion)<>0
       pcmailavisorupturastock = SUBSTR(lcficheroconfiguracion, AT("[", lcficheroconfiguracion)+1, AT("]", lcficheroconfiguracion)-AT("[", lcficheroconfiguracion)-1)
    ELSE
       pcmailavisorupturastock = ""
       plavisorupturastock = .F.
    ENDIF
    IF EMPTY(pcmailavisorupturastock)
       plavisorupturastock = .F.
    ENDIF
    IF AT("VERFACTURACIONCLIENTESONLINE", lcficheroconfiguracion)<>0
       plverfacturaciononlineclientes = .T.
    ELSE
       plverfacturaciononlineclientes = .F.
    ENDIF
    IF AT("VERSTOCKARTICULOSONLINE", lcficheroconfiguracion)<>0
       plverstockonlinearticulos = .T.
    ELSE
       plverstockonlinearticulos = .F.
    ENDIF
    IF AT("NOACTUALIZARORDENEMPLEADO", lcficheroconfiguracion)<>0
       plnoactualizarordenempleado = .T.
    ELSE
       plnoactualizarordenempleado = .F.
    ENDIF
    IF AT("NOACTUALIZARVERPLANEMPLEADO", lcficheroconfiguracion)<>0
       plnoactualizarverplanempleado = .T.
    ELSE
       plnoactualizarverplanempleado = .F.
    ENDIF
    plsucursalweb = .T.
 ENDIF
 IF FILE("OnlineAps.cfg")
    * OnlineAps desactivado (sin servidores Dunasoft)
 ENDIF
 * Sync Suite (sin ComRed.exe): timer HTTP style-reservas-sync
 ON KEY LABEL CTRL+F6 DO stop_serviciocomunicaciones
 ON KEY LABEL CTRL+F5 DO start_serviciocomunicaciones
 DO SuiteStartSyncIfReady
 IF USED("empresa")
    SELECT empresa
    IF  .NOT. EMPTY(empresa.config)
       RESTORE FROM MEMO config ADDITIVE
    ENDIF
 ENDIF
 IF EMPTY(cfgidioma) AND TYPE("pcversionpais")="C" AND pcversionpais="ESP"
    cfgidioma = "CA"
    cfgpais = "ESP"
    pcidioma = "CA"
    pcpais = "ESP"
    llidiomaconfigurado = .T.
 ENDIF
 IF EMPTY(cfgidioma)
    IF pcversionpais=="MEX"
       cfgidioma = "MX"
       cfgpais = "MEX"
       pcpais = "MEX"
       pcprefijopais = "52"
       pcidioma = "MX"
    ELSE
       IF llidiomaconfigurado
          cfgidioma = pcidioma
          cfgpais = pcpais
       ELSE
          DO FORM IDIOMA WITH .T.
       ENDIF
    ENDIF
 ENDIF
 IF EMPTY(cfgpais)
    cfgpais = pcpais
 ENDIF
 IF cfgpais<>pcpais
    configurarpais(cfgpais)
 ENDIF
 pcidioma = cfgidioma
 pcpais = cfgpais
 IF ALLTRIM(pcpais)=="POR"
    cfgsaftptficheroauditoria = "1.03_01"
    cfgmostraralbaranes = .F.
 ENDIF
 SELECT empresa
 SAVE TO MEMO config ALL LIKE CFG*
 pcclaveprivadarsa_saft = ""
 IF pcpais="POR"
    IF pltpvpeluqueria
       pcnumerocertificadosaft = "9999"
       pcclaveprivadarsa_saft = "<RSAKeyValue><Modulus>AKW2NRbZY4hEEsio/kNMao4eZg+DQZzgEHXJPDiGpSWXhzTefGlmOkM6sQ1ox4wA+"+"LyeNoAIU86CSLiuP3kYUKJ6L8icTgNx6d674wvZK4pp6698IbxBt+hD+dQo8XZXoFNgHh6KbASouICz3JC8WSu8cJ0JLDNcEEpsjcWjo/AT</Modulus>"+"<Exponent>AQAB</Exponent><P>AMRPf5jeS07C4LfemFfsmGiMZ0VCzT2Y68ykCsPSBbsJdYbDtRnrOro4xldQeityLgQTP7F7uJ71ICjWU4ZYZ6U=</P>"+"<Q>ANgY8oX/CqWZ/oZBOsHhA2FTApJKsY1W6Os6kHIVZ7UmG4hzPm6Bm1TSv67dOlK0J7UL8DoiT2/lbLlDB4JwK1c=</Q>"+"<DP>KeHEGTsj2fPduZy159xET9nUloRAAWpEtG4zFcATFOpZtpy+YH89EknWlv5Gckpz4s6wgg8hPliRueSwATOPOQ==</DP>"+"<DQ>cwps6erJdzmQ51YIerhYPVKcttauyQiwfLGzvhgpGqXL2ItJfDjhQXnkc6nwZ6Di1p4haEFlurMPe1z0vXsLhw==</DQ>"+"<InverseQ>AK29qYKHp3KHmlJsDcHLFblbs64cEUmf9V6miJg1A6EPgjASuU3y/rw87PEOrhbeugPVSNZgNC0O/Ez8apCyNRA=</InverseQ>"+"<D>Y7MageLNFYEPZBb403i4a0Uy1oZ8BWxxuswWJVQtLE7clBx/8dIFn8lCGPU/iaZUAPeXhrR757VPF34Oxkawy/hjJFBYaKkvGdCKkivg0d8NQyFf5xL+"+"EXSsNDlVgkHs/5w5WRDcfScMgc3ZdL0fTM+2P9YWYUsU2DLjE/iTnpE=</D></RSAKeyValue>"
    ELSE
       pcnumerocertificadosaft = ""
       pcclaveprivadarsa_saft = ""
    ENDIF
    IF pltpvbar
       pcnumerocertificadosaft = ""
       pcclaveprivadarsa_saft = ""
    ENDIF
 ENDIF
 DO interficie
 DO cargartablas
 IF cfgcontabilidaddunasoft
    IF TYPE("plDesarrollo")="L" .AND. pldesarrollo
       DO CONTA.PRG WITH "INICIO"
    ELSE
       IF FILE(SYS(5)+SYS(2003)+"conta.exe") .OR. FILE(SYS(5)+SYS(2003)+"CONTA.EXE")
          DO CONTA.EXE WITH "INICIO"
       ENDIF
    ENDIF
 ENDIF
 llinstalacionnueva = .F.
 IF .F. && Suite unlock: omitir registro offline Dunasoft
 IF pcversionpais=="MEX"
    llinstalacionnueva = llnuevainstalacionmex
 ELSE
    IF plversiondemo
       llinstalacionnueva = llnuevainstalacionmex
    ELSE
       IF  .NOT. FILE(SYS(5)+'\'+pcficheroregistro)
          llinstalacionnueva = .T.
          gnerrfile = FCREATE(SYS(5)+'\'+pcficheroregistro)
          IF gnerrfile<0
             WAIT WINDOW NOWAIT 'Imposible abrir o crear archivo de salida'
             DO cerrar
             RETURN .F.
          ELSE
             = FPUTS(gnerrfile, '1')
          ENDIF
          = FCLOSE(gnerrfile)
       ENDIF
    ENDIF
 ENDIF
 ENDIF
 IF .F. && Suite unlock: omitir caducidad demo y formulario registro
 IF plversiondemo
    IF DATE()>=plfechacaducidad
       _messagebox(traducir(pcidioma, "La version demo ha caducado. Consulte con su proveedor."), 64, traducir(pcidioma, "Atencion"))
       DO cerrar
       RETURN .F.
    ENDIF
 ELSE
    LOCAL numveces, palabra
    palabra = ""
    IF pcversionpais=="MEX"
    ELSE
       gnerrfile = FOPEN(SYS(5)+'\'+pcficheroregistro, 12)
       IF gnerrfile<0
          WAIT WINDOW NOWAIT 'Imposible abrir o crear archivo de salida'
          DO cerrar
          RETURN .F.
       ELSE
          DO WHILE  .NOT. FEOF(gnerrfile)
             palabra = FGETS(gnerrfile)
          ENDDO
          DO CASE
             CASE SUBSTR(palabra, 1, 3)=="FRP"
                ldfecha1erregistro = CTOD(SUBSTR(palabra, 10, 2)+"/"+SUBSTR(palabra, 8, 2)+"/"+SUBSTR(palabra, 4, 4))
                = FCLOSE(gnerrfile)
                IF GOMONTH(ldfecha1erregistro, 12)<=DATE()
                   llregistroprevio = .T.
                   llretorno = .F.
                   DO FORM demo TO llretorno WITH .T., 0, llregistroprevio
                   IF  .NOT. llretorno
                      DO cerrar
                      RETURN .F.
                   ENDIF
                ENDIF
             CASE SUBSTR(palabra, 1, 3)=="RRP"
                plrenting = .T.
                = FCLOSE(gnerrfile)
             CASE  .NOT. palabra=="No Modificar este Fichero."
                IF DATE()>=plfechacaducidad
                   _messagebox(traducir(pcidioma, "La version demo ha caducado. Consulte con su proveedor."), 64, traducir(pcidioma, "Atencion"))
                   = FCLOSE(gnerrfile)
                   DO cerrar
                   RETURN .F.
                ELSE
                   IF VAL(palabra)>0 .AND. VAL(palabra)<=100
                      numveces = VAL(palabra)
                      = FPUTS(gnerrfile, ALLTRIM(STR(numveces+1)))
                      = FCLOSE(gnerrfile)
                      DO FORM demo WITH .T., numveces
                   ELSE
                      _messagebox(traducir(pcidioma, "La version demo ha caducado. Consulte con su proveedor."), 64, traducir(pcidioma, "Atencion"))
                      = FCLOSE(gnerrfile)
                      DO cerrar
                      RETURN .F.
                   ENDIF
                ENDIF
             CASE palabra=="No Modificar este Fichero."
                = FCLOSE(gnerrfile)
          ENDCASE
       ENDIF
    ENDIF
 ENDIF
 ENDIF
 IF cfgyear<>YEAR(DATE())
    _messagebox(traducir(pcidioma, "El ejercicio ACTIVO no corresponde al A"+CHR(209)+"O actual."), 64, traducir(pcidioma, "Atencion"))
 ENDIF
 ON SHUTDOWN DO SuiteOnShutdown
 IF FILE("Demo.txt")
    * Demo.txt ignorado (Suite unlock)
 ENDIF
 lnversionfrancia = 1
 IF .F. .AND. lnversionfrancia=0
    plversiondemo = .T.
 ENDIF
 IF .F. .AND. plversiondemoforzado
    plversiondemo = .T.
    pcversionapp = 0
 ENDIF
 IF pldemostyleformexferia
    plversiondemo = .F.
    pcversionapp = 0
 ENDIF
 SELECT empresa
 SAVE TO MEMO config ALL LIKE CFG*
 IF SuiteHasAppSymbol("SuiteApplyFullUnlock")
    DO SuiteApplyFullUnlock
 ELSE
    DO SuiteLoadUnlockProgram WITH IIF(TYPE("pcSuiteStyleRoot")="C" .AND. .NOT. EMPTY(pcSuiteStyleRoot), ADDBS(pcSuiteStyleRoot), ADDBS(SYS(5)+SYS(2003)))
    IF SuiteHasAppSymbol("SuiteApplyFullUnlock")
       DO SuiteApplyFullUnlock
    ENDIF
 ENDIF
 DO SuiteStartSyncIfReady
 IF pcversionapp=2
    cfgseguridad = .F.
    cfgplanificadorenmenuventas = .F.
    cfgabrirticketinicio = .F.
    cfgnomostrarpantallassinpermiso = .F.
    cfgactivarinactividad = .F.
    cfgmostrarfavoritosmenu = .F.
    cfgactivarpuntos = .F.
 ENDIF
 policencias.nlicenciasmaximas = 999
 IF .F. .AND.  .NOT. policencias.entrausuario()
    _messagebox(traducir(pcidioma, policencias.msgerror), 64, traducir(pcidioma, "Atenci"+CHR(243)+"n"))
    ON SHUTDOWN
    CLEAR
    CLEAR ALL
    SET SYSMENU TO DEFAULT
    RETURN (.T.)
 ENDIF
 IF (pcversionpais="MEX" .AND.  .NOT. plone .AND.  .NOT. plfranquicias) .OR. (pcversionpais="MEX" .AND. plone .AND. plcntfranquicia=="SFM_SINLOGO")
    DO CASE
       CASE pcversionapp=0
          plcntfranquicia = "Franquicia_stylemex_premium"
       CASE pcversionapp=1
          plcntfranquicia = "Franquicia_stylemex_online"
       CASE pcversionapp=2
          plcntfranquicia = "Franquicia_stylemex"
    ENDCASE
 ENDIF
 IF lnversionfrancia<>2
    SET HELP OFF
    IF pltpvbar
       lcayuda = "Ayuda/BarAyuda.chm"
    ELSE
       IF pltpvpeluqueria
          DO CASE
             CASE pcversionpais=="MEX"
                lcayuda = "Ayuda/StyleforMexAyuda.pdf"
             CASE pcidioma="FR"
                lcayuda = "Ayuda/Style_Aide.pdf"
             OTHERWISE
                lcayuda = "Ayuda/Manual_Style_DunaSoft.pdf"
          ENDCASE
       ELSE
          lcayuda = "Ayuda/TPVAyuda.chm"
       ENDIF
    ENDIF
    ON KEY LABEL F1 shellexec( ADDBS( SYS(5)+SYS(2003) ) + lcayuda )
    IF pcversionapp<>2 .AND. pcpais<>"POR"
       ON KEY LABEL CTRL+HOME DO FORM traspasar2
    ENDIF
    IF cfgcontrolpresencia .AND. pcversionapp<>2
       ON KEY LABEL F6 DO FORM controlpresencia
    ENDIF
    IF  .NOT. plfranquicias .AND. pcversionapp<>2
       ON KEY LABEL CTRL+END DO FORM borrarserie
    ENDIF
    IF llinstalacionnueva .AND. pltpvpeluqueria .AND.  .NOT. plsucursal
       DO CASE
          CASE pcversionpais=="MEX"
             IF FILE(ADDBS(SYS(5)+SYS(2003))+"Iniciacion/IniciacionMX.html")
                DO FORM MostrarIniciacion WITH .T.
             ENDIF
          OTHERWISE
             IF FILE(ADDBS(SYS(5)+SYS(2003))+"Iniciacion/Iniciacion.html")
                DO FORM MostrarIniciacion WITH .T.
             ENDIF
       ENDCASE
       DO FORM Asistente WITH .T.
    ENDIF
    LOCAL llloginok
    llloginok = .F.
    PUBLIC llcopiaseg
    llcopiaseg = .F.
    IF  .NOT. realizarcopiaseguridad(.F.)
       = SuiteEnsureDatabaseOpen()
       CLOSE TABLE ALL
       IF cfgseguridad
          DO FORM login TO llloginok WITH .T.
       ELSE
          llloginok = .T.
       ENDIF
       IF llloginok
          IF cfgseguridad .AND. cfgactivarinactividad
             PUBLIC tmrcheck
             LOCAL lcSavDet
             lcSavDet = ON("ERROR")
             ON ERROR
             tmrcheck = SuiteSafeCreateObject("DetectActivity")
             ON ERROR &lcSavDet
          ENDIF
          IF pltpvbar
             _SCREEN.caption = tcnombreaplicacion
             _SCREEN.windowstate = 2
             DO FORM newscreen
          ELSE
             IF pltpvpeluqueria
                _SCREEN.caption = tcnombreaplicacion
                _SCREEN.windowstate = 2
                IF pcversionpais="MEX"
                   DO FORM newscreen_stylemex
                ELSE
                   DO FORM newscreen
                ENDIF
             ELSE
                _SCREEN.caption = tcnombreaplicacion
                _SCREEN.windowstate = 2
                DO FORM newscreen
             ENDIF
          ENDIF
          IF  .NOT. EMPTY(tcpantalla)
             DO CASE
                CASE tcpantalla="PRODUCCION" .AND. pltpvbar
                   DO FORM PRODUCCION WITH .T., tcparametro1, tcparametro2
             ENDCASE
          ELSE
          ENDIF
          IF pltpvpeluqueria
             llretorno = .F.
             IF INLIST(pcversionpais, "MEX", "ESP") .AND. plone .AND. plconexioninternet
                comprobardescargatarifasone()
             ENDIF
             * Sin pantalla Dunasoft al arrancar (presentacion.scx / ImgWeb)
             llretorno = .T.
             resumendiarioonline()
             IF cfgavisaraniversarios
                buscaraniversarios()
             ENDIF
             IF cfgabrirticketinicio
                tpv_peluqueria("FACTURAS")
             ENDIF
             SET CONSOLE OFF
             SET ECHO OFF
             IF llretorno
                READ EVENTS
             ENDIF
          ELSE
             resumendiarioonline()
             IF cfgavisaraniversarios
                buscaraniversarios()
             ENDIF
             IF cfgabrirticketinicio
                tpv_peluqueria("FACTURAS")
             ENDIF
             READ EVENTS
          ENDIF
       ELSE
          CLEAR EVENTS
       ENDIF
    ENDIF
    IF llcopiaseg=.F. .AND. llloginok
       LOCAL llhayticketsabiertos
       DO WHILE .T.
          llhayticketsabiertos = .F.
          IF  .NOT. USED("faccabtmp2")
             USE SHARED dbf/faccabtmp AGAIN ALIAS faccabtmp2 IN 0
          ENDIF
          SELECT faccabtmp2
          GOTO TOP
          IF  .NOT. EOF()
             llhayticketsabiertos = .T.
          ENDIF
          USE IN faccabtmp2
          IF llhayticketsabiertos
             IF _messagebox(traducir(pcidioma, "ATENCI"+CHR(211)+"N: Tiene tickets abiertos. ")+CHR(13)+traducir(pcidioma, CHR(191)+"Desea salir de la aplicaci"+CHR(243)+"n de todos modos?"), 052, traducir(pcidioma, "Atenci"+CHR(243)+"n"))<>6
                _SCREEN.titlebar = 0
                SET SYSMENU OFF
                llscreen = .F.
                FOR lncontforms = 1 TO _SCREEN.formcount
                   IF UPPER(ALLTRIM(SUBSTR(_SCREEN.forms(lncontforms).name, 1, 9)))=="NEWSCREEN"
                      llscreen = .T.
                   ENDIF
                ENDFOR
                IF  .NOT. llscreen
                   IF pcversionpais="MEX"
                      DO FORM newscreen_stylemex
                   ELSE
                      DO FORM newscreen
                   ENDIF
                ENDIF
                tpv_peluqueria("FACTURAS")
                READ EVENTS
             ELSE
                EXIT
             ENDIF
          ELSE
             EXIT
          ENDIF
       ENDDO
    ENDIF
 ENDIF
 IF plsucursalweb
    stop_serviciocomunicaciones()
 ENDIF
 IF TYPE("LOTESTCOM")="O"
    RELEASE lotestcom
 ENDIF
 IF TYPE("poLicencias")="O"
    RUN poLicencias.SaleUsuario()
 ENDIF
 ON SHUTDOWN
 CLEAR ALL
 SET SYSMENU TO DEFAULT
 CLEAR
 RETURN (.T.)
ENDFUNC

* Kill switch v1/v2 — control_sincro.dbf (modo: '1'=HTTP, '2'=cola+agente). Campos <=10 chars (dbf-reader).

FUNCTION SuiteSyncRoot
 LOCAL lc
 IF TYPE("pcSuiteStyleRoot")="C" .AND. .NOT. EMPTY(pcSuiteStyleRoot)
    RETURN ADDBS(pcSuiteStyleRoot)
 ENDIF
 RETURN ADDBS(SYS(5)+SYS(2003))
ENDFUNC

PROCEDURE SuiteEnsureControlSincro
 LOCAL lcpath, llWasOpen, lcSav, lcErr
 lcpath = SuiteSyncRoot() + "control_sincro"
 llWasOpen = USED("control_sincro")
 SET SAFETY OFF
 IF FILE(lcpath + ".dbf")
    IF  .NOT. llWasOpen
       lcSav = ON("ERROR")
       lcErr = ""
       ON ERROR lcErr = MESSAGE()
       USE SHARED (lcpath) ALIAS control_sincro IN 0
       ON ERROR &lcSav
    ENDIF
    RETURN
 ENDIF
 lcSav = ON("ERROR")
 lcErr = ""
 ON ERROR lcErr = MESSAGE()
 CREATE TABLE (lcpath) FREE (modo C(1), actualiz T, notas C(80))
 USE
 USE SHARED (lcpath) ALIAS control_sincro IN 0
 ON ERROR &lcSav
 IF  .NOT. USED("control_sincro")
    RETURN
 ENDIF
 SELECT control_sincro
 IF RECCOUNT() = 0
    APPEND BLANK
    REPLACE modo WITH "2", actualiz WITH DATETIME(), notas WITH "v2 cola+agente"
 ENDIF
ENDPROC

FUNCTION SuiteSyncModoActivo
 LOCAL lcmodo, lcalias
 lcalias = SELECT()
 DO SuiteEnsureControlSincro
 IF  .NOT. USED("control_sincro")
    RETURN "2"
 ENDIF
 lcmodo = ALLTRIM(NVL(control_sincro.modo, "2"))
 IF EMPTY(lcmodo)
    lcmodo = "2"
 ENDIF
 IF  .NOT. EMPTY(lcalias)
    SELECT (lcalias)
 ENDIF
 RETURN lcmodo
ENDFUNC

FUNCTION SuiteSyncModoV2Active
 RETURN (SuiteSyncModoActivo() == "2")
ENDFUNC

FUNCTION SuiteSyncModoV1Active
 RETURN (SuiteSyncModoActivo() == "1")
ENDFUNC

* Cola de sincronizacion local Style -> agente Node.js (sin HTTP en VFP).
* Insertar en cola_sincro.dbf tras TABLEUPDATE() exitoso (< 1 ms).
**
FUNCTION SuiteColaRoot
 LOCAL lcb
 lcb = ""
 IF TYPE("pcSuiteStyleRoot")="C" .AND. .NOT. EMPTY(pcSuiteStyleRoot)
    lcb = ADDBS(pcSuiteStyleRoot)
 ENDIF
 IF EMPTY(lcb)
    lcb = ADDBS(SYS(5)+SYS(2003))
 ENDIF
 RETURN lcb
ENDFUNC
**
PROCEDURE SuiteEnsureColaSincro
 LOCAL lcpath, lcalias, llWasOpen, llExclusive
 lcpath = SuiteColaRoot()+"cola_sincro"
 llWasOpen = USED("cola_sincro")
 IF FILE(lcpath+".dbf")
    llExclusive = .F.
    IF  .NOT. llWasOpen
       * Intentar EXCLUSIVE: la migracion de esquema (ALTER TABLE) lo exige.
       TRY
          USE EXCLUSIVE (lcpath) ALIAS cola_sincro IN 0
          llExclusive = .T.
       CATCH
       ENDTRY
       IF  .NOT. USED("cola_sincro")
          USE SHARED (lcpath) ALIAS cola_sincro IN 0
       ENDIF
    ENDIF
    DO SuiteMigrarColaSincroInline
    IF llExclusive
       * Reabrir compartido para no bloquear al agente Node.
       USE IN cola_sincro
       USE SHARED (lcpath) ALIAS cola_sincro IN 0
    ENDIF
    RETURN
 ENDIF
 * Campos <=10 chars y servicios C(254) (tabla FREE legible por dbf-reader Node; no memo, no nombres largos).
 CREATE TABLE (lcpath) FREE ;
    (id N(10,0), tabla C(40), id_reg C(30), accion C(3), ;
     procesado L, creado T, ;
     codemp C(15), codcli C(15), fecha D, fechaiso C(10), horini C(5), horfin C(5), ;
     texto C(250), codrec C(15), nomcli C(80), tel1cli C(20), ;
     facturado L, servicios C(254), colfon N(10,0), collet N(10,0), ;
     modif C(20), version N(15,0))
 INDEX ON procesado TAG proc
 INDEX ON id TAG idpk
 USE
 USE SHARED (lcpath) ALIAS cola_sincro IN 0
ENDPROC
**
FUNCTION SuiteColaFieldExists
 PARAMETER tcAlias, tcField
 IF  .NOT. USED(tcAlias)
    RETURN .F.
 ENDIF
 * FIELD() espera numero de campo; para comprobar por NOMBRE usamos TYPE("alias.campo").
 RETURN (TYPE(tcAlias + "." + ALLTRIM(tcField)) <> "U")
ENDFUNC
**
PROCEDURE SuiteMigrarColaSincroInline
 LOCAL lcalias
 lcalias = SELECT()
 IF  .NOT. USED("cola_sincro")
    RETURN
 ENDIF
 SELECT cola_sincro
 * ALTER TABLE exige acceso exclusivo; si la cola se abrio compartida, evitamos el crash.
 * (El agente Node tolera columnas ausentes; el cutover recrea la cola con el esquema nuevo.)
 TRY
 IF  .NOT. SuiteColaFieldExists("cola_sincro", "codemp")
    ALTER TABLE cola_sincro ADD COLUMN codemp C(15)
 ENDIF
 IF  .NOT. SuiteColaFieldExists("cola_sincro", "codcli")
    ALTER TABLE cola_sincro ADD COLUMN codcli C(15)
 ENDIF
 IF  .NOT. SuiteColaFieldExists("cola_sincro", "fecha")
    ALTER TABLE cola_sincro ADD COLUMN fecha D
 ENDIF
 IF  .NOT. SuiteColaFieldExists("cola_sincro", "fechaiso")
    ALTER TABLE cola_sincro ADD COLUMN fechaiso C(10)
 ENDIF
 IF  .NOT. SuiteColaFieldExists("cola_sincro", "horini")
    ALTER TABLE cola_sincro ADD COLUMN horini C(5)
 ENDIF
 IF  .NOT. SuiteColaFieldExists("cola_sincro", "horfin")
    ALTER TABLE cola_sincro ADD COLUMN horfin C(5)
 ENDIF
 IF  .NOT. SuiteColaFieldExists("cola_sincro", "texto")
    ALTER TABLE cola_sincro ADD COLUMN texto C(250)
 ENDIF
 IF  .NOT. SuiteColaFieldExists("cola_sincro", "codrec")
    ALTER TABLE cola_sincro ADD COLUMN codrec C(15)
 ENDIF
 IF  .NOT. SuiteColaFieldExists("cola_sincro", "nomcli")
    ALTER TABLE cola_sincro ADD COLUMN nomcli C(80)
 ENDIF
 IF  .NOT. SuiteColaFieldExists("cola_sincro", "tel1cli")
    ALTER TABLE cola_sincro ADD COLUMN tel1cli C(20)
 ENDIF
 IF  .NOT. SuiteColaFieldExists("cola_sincro", "facturado")
    ALTER TABLE cola_sincro ADD COLUMN facturado L
 ENDIF
 IF  .NOT. SuiteColaFieldExists("cola_sincro", "servicios")
    ALTER TABLE cola_sincro ADD COLUMN servicios C(254)
 ENDIF
 IF  .NOT. SuiteColaFieldExists("cola_sincro", "colfon")
    ALTER TABLE cola_sincro ADD COLUMN colfon N(10, 0)
 ENDIF
 IF  .NOT. SuiteColaFieldExists("cola_sincro", "collet")
    ALTER TABLE cola_sincro ADD COLUMN collet N(10, 0)
 ENDIF
 IF  .NOT. SuiteColaFieldExists("cola_sincro", "modif")
    ALTER TABLE cola_sincro ADD COLUMN modif C(20)
 ENDIF
 IF  .NOT. SuiteColaFieldExists("cola_sincro", "version")
    ALTER TABLE cola_sincro ADD COLUMN version N(15, 0)
 ENDIF
 CATCH
    * Cola abierta en modo compartido: no se pudo migrar esquema. Se recreara en el cutover.
 ENDTRY
 IF  .NOT. EMPTY(lcalias)
    SELECT (lcalias)
 ENDIF
ENDPROC
**
FUNCTION SuiteColaJsonEscape
 PARAMETER tc
 LOCAL lc, lnI, lcCh, lnAsc, lcOut
 lc = NVL(tc, "")
 lcOut = ""
 FOR lnI = 1 TO LEN(lc)
    lcCh = SUBSTR(lc, lnI, 1)
    lnAsc = ASC(lcCh)
    DO CASE
       CASE lcCh == "\"
          lcOut = lcOut + "\\"
       CASE lcCh == '"'
          lcOut = lcOut + '\"'
       CASE lnAsc = 8
          lcOut = lcOut + "\b"
       CASE lnAsc = 9
          lcOut = lcOut + "\t"
       CASE lnAsc = 10
          lcOut = lcOut + "\n"
       CASE lnAsc = 12
          lcOut = lcOut + "\f"
       CASE lnAsc = 13
          lcOut = lcOut + "\r"
       CASE lnAsc < 32
          * Otros controles: omitir (evita JSON invalido)
       OTHERWISE
          lcOut = lcOut + lcCh
    ENDCASE
 ENDFOR
 RETURN lcOut
ENDFUNC
**
FUNCTION SuiteColaEpochNow
 RETURN INT((DATETIME() - DATETIME(1970, 1, 1, 0, 0, 0)) * 86400)
ENDFUNC
**
FUNCTION SuiteBuildServiciosJson
 PARAMETER tnIdPlan
 LOCAL lcJson, lccod, lchora, lcalias, llWasUsed
 lcJson = "["
 lcalias = SELECT()
 llWasUsed = USED("planart")
 IF  .NOT. llWasUsed
    IF FILE(SuiteColaRoot()+"dbf\planart.dbf")
       USE SHARED (SuiteColaRoot()+"dbf\planart") ALIAS planart IN 0
    ELSE
       IF FILE(SuiteColaRoot()+"planart.dbf")
          USE SHARED (SuiteColaRoot()+"planart") ALIAS planart IN 0
       ENDIF
    ENDIF
 ENDIF
 IF USED("planart")
    SELECT planart
    SET ORDER TO idplan
    IF SEEK(STR(tnIdPlan, 10))
       SCAN REST WHILE planart.idplan = tnIdPlan
          lccod = ""
          lchora = ""
          IF TYPE("planart.codart")="C"
             lccod = ALLTRIM(planart.codart)
          ENDIF
          IF TYPE("planart.hora")="C"
             lchora = ALLTRIM(planart.hora)
          ENDIF
          IF  .NOT. EMPTY(lccod)
             IF LEN(lcJson) > 1
                lcJson = lcJson + ","
             ENDIF
             lcJson = lcJson + '{"servicio":"'+SuiteColaJsonEscape(lccod)+'","hora":"'+SuiteColaJsonEscape(lchora)+'"}'
          ENDIF
       ENDSCAN
    ENDIF
 ENDIF
 lcJson = lcJson + "]"
 IF  .NOT. llWasUsed AND USED("planart")
    USE IN planart
 ENDIF
 IF  .NOT. EMPTY(lcalias)
    SELECT (lcalias)
 ENDIF
 RETURN lcJson
ENDFUNC
**
FUNCTION SuiteLoadControlSync
 * Incluido en general.prg (#INCLUDE); no SET PROCEDURE externo en exe compilado.
 IF TYPE("SuiteEnsureControlSincro")#"U"
    RETURN .T.
 ENDIF
 RETURN .F.
ENDFUNC
**
FUNCTION SuiteEnqueueCola
 PARAMETER tcTabla, tcIdRegistro, tcAccion
 LOCAL lcalias, lnId, lcacc, lcRepNum, lcRepUnit, llOk
 IF EMPTY(tcTabla)
    RETURN .F.
 ENDIF
 tcTabla = LOWER(ALLTRIM(tcTabla))
 tcIdRegistro = ALLTRIM(TRANSFORM(tcIdRegistro))
 lcacc = UPPER(LEFT(ALLTRIM(NVL(tcAccion, "UPD")), 3))
 DO CASE
    CASE lcacc="INS" OR lcacc="ADD"
       lcacc = "INS"
    CASE lcacc="DEL" OR lcacc="BOR"
       lcacc = "DEL"
    OTHERWISE
       lcacc = "UPD"
 ENDCASE
 lcalias = SELECT()
 llOk = .F.
 * Escribir en cola_sincro NUNCA debe congelar la UI de Style. Con el REPROCESS por
 * defecto (0 = reintento de lock indefinido), si la cola esta ocupada (agente Node
 * leyendo, otra sesion, microcorte CIFS) el APPEND BLANK espera para siempre y el alta
 * de cliente/articulo/bono "se queda colgada y se cierra". Acotamos la espera de lock;
 * si no se consigue, se omite el encolado y el agente reconcilia por resync de entidad.
 * (Las citas usan SuiteEnqueuePlan2009 y no pasan por aqui.)
 lcRepNum = SET("REPROCESS")
 lcRepUnit = SET("REPROCESS", 2)
 SET REPROCESS TO 3 SECONDS
 TRY
    DO SuiteEnsureColaSincro
    IF USED("cola_sincro")
       SELECT cola_sincro
       lnId = 0
       IF RECCOUNT("cola_sincro") > 0
          GO BOTTOM
          lnId = cola_sincro.id
       ENDIF
       APPEND BLANK
       REPLACE id WITH lnId+1, tabla WITH tcTabla, id_reg WITH tcIdRegistro, ;
               accion WITH lcacc, procesado WITH .F., creado WITH DATETIME()
       llOk = .T.
    ENDIF
 CATCH
    llOk = .F.
 FINALLY
    IF UPPER(ALLTRIM(TRANSFORM(lcRepUnit))) == "SECONDS"
       SET REPROCESS TO VAL(TRANSFORM(lcRepNum)) SECONDS
    ELSE
       SET REPROCESS TO VAL(TRANSFORM(lcRepNum))
    ENDIF
    IF  .NOT. EMPTY(lcalias)
       SELECT (lcalias)
    ENDIF
 ENDTRY
 RETURN llOk
ENDFUNC
**
FUNCTION SuiteColaIsV2Active
 LOCAL lcpath, lcalias, lcmodo, llWasOpen
 = SuiteLoadControlSync()
 IF EVALUATE('TYPE("SuiteSyncModoV2Active")')#"U"
    RETURN EVALUATE('SuiteSyncModoV2Active()')
 ENDIF
 lcpath = SuiteColaRoot()+"control_sincro"
 llWasOpen = USED("control_sincro")
 IF FILE(lcpath+".dbf")
    IF  .NOT. llWasOpen
       USE SHARED (lcpath) ALIAS control_sincro IN 0
    ENDIF
    lcalias = SELECT()
    SELECT control_sincro
    lcmodo = ALLTRIM(NVL(control_sincro.modo, "2"))
    IF  .NOT. EMPTY(lcalias)
       SELECT (lcalias)
    ENDIF
    IF  .NOT. llWasOpen AND USED("control_sincro")
       USE IN control_sincro
    ENDIF
    RETURN (lcmodo=="2")
 ENDIF
 RETURN .T.
ENDFUNC
**
FUNCTION SuiteEnqueuePlan2009
 * Params 3-12: snapshot opcional desde Reservas_Incidencia (fallback si SEEK en plan2009 falla).
 PARAMETER tnIdPlan, tcAccion, tcSnapCodemp, tcSnapCodcli, tdSnapFecha, tcSnapHorini, tcSnapHorfin, ;
           tcSnapTexto, tcSnapCodrec, tcSnapNomcli, tcSnapTel1cli
 LOCAL lcalias, llPlanWasUsed, llPlanArtWasUsed, lcServicios, lcId, lcacc
 LOCAL lcCodemp, lcCodcli, ldFecha, lcHorini, lcHorfin, lcTexto, lcCodrec, lcNomcli, lcTel1cli
 LOCAL llFact, lnColfon, lnCollet, lcMod, lnVersion, llFound

 IF  .NOT. SuiteColaIsV2Active()
    RETURN .F.
 ENDIF
 lcacc = UPPER(LEFT(ALLTRIM(NVL(tcAccion, "UPD")), 3))
 DO CASE
    CASE lcacc="INS" OR lcacc="ADD"
       lcacc = "INS"
    CASE lcacc="DEL" OR lcacc="BOR"
       lcacc = "DEL"
    OTHERWISE
       lcacc = "UPD"
 ENDCASE

 lcalias = SELECT()
 llPlanWasUsed = USED("plan2009")
 llPlanArtWasUsed = USED("planart")
 lcServicios = ""

 * Snapshot desde DBF local (evita lecturas posteriores desde Docker/SMB).
 IF  .NOT. llPlanWasUsed
    IF FILE(SuiteColaRoot()+"dbf\plan2009.dbf")
       USE SHARED (SuiteColaRoot()+"dbf\plan2009") ALIAS plan2009 IN 0
    ELSE
       IF FILE(SuiteColaRoot()+"plan2009.dbf")
          USE SHARED (SuiteColaRoot()+"plan2009") ALIAS plan2009 IN 0
       ENDIF
    ENDIF
 ENDIF
 IF  .NOT. llPlanArtWasUsed
    IF FILE(SuiteColaRoot()+"dbf\planart.dbf")
       USE SHARED (SuiteColaRoot()+"dbf\planart") ALIAS planart IN 0
    ELSE
       IF FILE(SuiteColaRoot()+"planart.dbf")
          USE SHARED (SuiteColaRoot()+"planart") ALIAS planart IN 0
       ENDIF
    ENDIF
 ENDIF

 lcCodemp = ""
 lcCodcli = ""
 ldFecha = {}
 lcHorini = ""
 lcHorfin = ""
 lcTexto = ""
 lcCodrec = ""
 lcNomcli = ""
 lcTel1cli = ""
 llFact = .F.
 lnColfon = 0
 lnCollet = 0
 lcMod = ""
 lnVersion = SuiteColaEpochNow()

 lcId = TRANSFORM(tnIdPlan)

 IF USED("plan2009")
    SELECT plan2009
    SET ORDER TO idplan
    llFound = SEEK(tnIdPlan, "plan2009", "idplan")
    IF  .NOT. llFound
       llFound = SEEK(VAL(lcId), "plan2009", "idplan")
    ENDIF
    IF llFound
       lcCodemp = ALLTRIM(NVL(plan2009.codemp, ""))
       lcCodcli = ALLTRIM(NVL(plan2009.codcli, ""))
       ldFecha = plan2009.fecha
       lcHorini = ALLTRIM(NVL(plan2009.horini, ""))
       lcHorfin = ALLTRIM(NVL(plan2009.horfin, ""))
       lcTexto = LEFT(ALLTRIM(NVL(plan2009.texto, "")), 250)
       lcCodrec = ALLTRIM(NVL(plan2009.codrec, ""))
       lcNomcli = ALLTRIM(NVL(plan2009.nomcli, ""))
       lcTel1cli = ALLTRIM(NVL(plan2009.tel1cli, ""))
       llFact = IIF(TYPE("plan2009.facturado")="L", plan2009.facturado, .F.)
       lnColfon = IIF(TYPE("plan2009.colfon")="N", plan2009.colfon, 0)
       lnCollet = IIF(TYPE("plan2009.collet")="N", plan2009.collet, 0)
       lcMod = TRANSFORM(lnVersion)
    ENDIF
 ENDIF

 * Fallback: datos que ya trae Reservas_Incidencia (evita cola con snapshot vacio).
 IF PCOUNT() >= 3 .AND. TYPE("tcSnapCodemp")="C" .AND. EMPTY(lcCodemp)
    lcCodemp = ALLTRIM(NVL(tcSnapCodemp, ""))
 ENDIF
 IF PCOUNT() >= 4 .AND. TYPE("tcSnapCodcli")="C" .AND. EMPTY(lcCodcli)
    lcCodcli = ALLTRIM(NVL(tcSnapCodcli, ""))
 ENDIF
 IF PCOUNT() >= 5 .AND. TYPE("tdSnapFecha")="D" .AND. EMPTY(ldFecha)
    ldFecha = tdSnapFecha
 ENDIF
 IF PCOUNT() >= 6 .AND. TYPE("tcSnapHorini")="C" .AND. EMPTY(lcHorini)
    lcHorini = ALLTRIM(NVL(tcSnapHorini, ""))
 ENDIF
 IF PCOUNT() >= 7 .AND. TYPE("tcSnapHorfin")="C" .AND. EMPTY(lcHorfin)
    lcHorfin = ALLTRIM(NVL(tcSnapHorfin, ""))
 ENDIF
 IF PCOUNT() >= 8 .AND. TYPE("tcSnapTexto")="C" .AND. EMPTY(lcTexto)
    lcTexto = LEFT(ALLTRIM(NVL(tcSnapTexto, "")), 250)
 ENDIF
 IF PCOUNT() >= 9 .AND. TYPE("tcSnapCodrec")="C" .AND. EMPTY(lcCodrec)
    lcCodrec = ALLTRIM(NVL(tcSnapCodrec, ""))
 ENDIF
 IF PCOUNT() >= 10 .AND. TYPE("tcSnapNomcli")="C" .AND. EMPTY(lcNomcli)
    lcNomcli = ALLTRIM(NVL(tcSnapNomcli, ""))
 ENDIF
 IF PCOUNT() >= 11 .AND. TYPE("tcSnapTel1cli")="C" .AND. EMPTY(lcTel1cli)
    lcTel1cli = ALLTRIM(NVL(tcSnapTel1cli, ""))
 ENDIF

 * UPD/INS: snapshot de Reservas_Incidencia prevalece (estado nuevo post-cambio).
 IF lcacc = "UPD" .OR. lcacc = "INS"
    IF PCOUNT() >= 3 .AND. TYPE("tcSnapCodemp")="C" .AND. .NOT. EMPTY(tcSnapCodemp)
       lcCodemp = ALLTRIM(tcSnapCodemp)
    ENDIF
    IF PCOUNT() >= 4 .AND. TYPE("tcSnapCodcli")="C" .AND. .NOT. EMPTY(tcSnapCodcli)
       lcCodcli = ALLTRIM(tcSnapCodcli)
    ENDIF
    IF PCOUNT() >= 5 .AND. TYPE("tdSnapFecha")="D" .AND. .NOT. EMPTY(tdSnapFecha)
       ldFecha = tdSnapFecha
    ENDIF
    IF PCOUNT() >= 6 .AND. TYPE("tcSnapHorini")="C" .AND. .NOT. EMPTY(tcSnapHorini)
       lcHorini = ALLTRIM(tcSnapHorini)
    ENDIF
    IF PCOUNT() >= 7 .AND. TYPE("tcSnapHorfin")="C" .AND. .NOT. EMPTY(tcSnapHorfin)
       lcHorfin = ALLTRIM(tcSnapHorfin)
    ENDIF
    IF PCOUNT() >= 8 .AND. TYPE("tcSnapTexto")="C" .AND. .NOT. EMPTY(tcSnapTexto)
       lcTexto = LEFT(ALLTRIM(tcSnapTexto), 250)
    ENDIF
    IF PCOUNT() >= 9 .AND. TYPE("tcSnapCodrec")="C" .AND. .NOT. EMPTY(tcSnapCodrec)
       lcCodrec = ALLTRIM(tcSnapCodrec)
    ENDIF
    IF PCOUNT() >= 10 .AND. TYPE("tcSnapNomcli")="C" .AND. .NOT. EMPTY(tcSnapNomcli)
       lcNomcli = ALLTRIM(tcSnapNomcli)
    ENDIF
    IF PCOUNT() >= 11 .AND. TYPE("tcSnapTel1cli")="C" .AND. .NOT. EMPTY(tcSnapTel1cli)
       lcTel1cli = ALLTRIM(tcSnapTel1cli)
    ENDIF
 ENDIF

 lcServicios = SuiteBuildServiciosJson(VAL(lcId))

 * Fecha tambien como cadena ISO YYYY-MM-DD: el dbf-reader del agente Node malinterpreta
 * el campo D (mes 1-based como indice 0-based + desfase TZ). El agente usa fechaiso.
 LOCAL lcFechaIso
 lcFechaIso = ""
 IF  .NOT. EMPTY(ldFecha)
    lcFechaIso = STR(YEAR(ldFecha), 4) + "-" + PADL(ALLTRIM(STR(MONTH(ldFecha))), 2, "0") + "-" + PADL(ALLTRIM(STR(DAY(ldFecha))), 2, "0")
 ENDIF

 DO SuiteEnsureColaSincro
 SELECT cola_sincro
 LOCAL lnId
 lnId = 0
 IF RECCOUNT("cola_sincro") > 0
    GO BOTTOM
    lnId = cola_sincro.id
 ENDIF
 APPEND BLANK
 REPLACE id WITH lnId+1, tabla WITH "plan2009", id_reg WITH lcId, ;
         accion WITH lcacc, procesado WITH .F., creado WITH DATETIME(), ;
         codemp WITH lcCodemp, codcli WITH lcCodcli, fecha WITH ldFecha, ;
         fechaiso WITH lcFechaIso, ;
         horini WITH lcHorini, horfin WITH lcHorfin, texto WITH lcTexto, ;
         codrec WITH lcCodrec, nomcli WITH lcNomcli, tel1cli WITH lcTel1cli, ;
         facturado WITH llFact, servicios WITH LEFT(lcServicios, 254), colfon WITH lnColfon, ;
         collet WITH lnCollet, modif WITH LEFT(ALLTRIM(lcMod), 20), ;
         version WITH lnVersion

 IF  .NOT. llPlanWasUsed AND USED("plan2009")
    USE IN plan2009
 ENDIF
 IF  .NOT. llPlanArtWasUsed AND USED("planart")
    USE IN planart
 ENDIF
 IF  .NOT. EMPTY(lcalias)
    SELECT (lcalias)
 ENDIF
 RETURN .T.
ENDFUNC

**
* Suite_SyncInit / Suite_SyncLog: solo en general.prg (evita sombra si SET PROCEDURE TO suite_cola_sync).

* Hooks de salida Style -> Suite para maestros y transacciones.
* Se llaman tras un TABLEUPDATE() exitoso o desde SuiteAfterEntitySave().
* La cola transporta solo (tabla, id_reg, accion); el agente Node lee el DBF origen completo.
*
* Requiere SuiteEnqueueCola (suite_cola_sync.prg embebido en general.prg) y SuiteColaIsV2Active.
**
FUNCTION SuiteEntityEnsureLoaded
 * No-op si ya embebido en general.prg; en runtime suelto carga el PRG.
 IF TYPE("SuiteEnqueueEntidad")#"U"
    RETURN .T.
 ENDIF
 LOCAL lcPrg
 lcPrg = ""
 IF TYPE("SuiteColaRoot")#"U"
    lcPrg = SuiteColaRoot()+"PROGS\suite_entity_sync.prg"
    IF  .NOT. FILE(lcPrg)
       lcPrg = SuiteColaRoot()+"suite_entity_sync.prg"
    ENDIF
 ENDIF
 IF EMPTY(lcPrg) .OR.  .NOT. FILE(lcPrg)
    RETURN .F.
 ENDIF
 SET PROCEDURE TO (lcPrg) ADDITIVE
 RETURN (TYPE("SuiteEnqueueEntidad")#"U")
ENDFUNC
**
FUNCTION SuiteAfterEntitySave
 * Punto unico para encolar cambios maestros/transaccion hacia Suite (v2).
 PARAMETER tcTabla, tcClave, tcAccion
 LOCAL lcTabla, lcClave, lcAcc
 IF EMPTY(tcTabla) .OR. EMPTY(ALLTRIM(TRANSFORM(tcClave)))
    RETURN .F.
 ENDIF
 TRY
    IF TYPE("SuiteColaIsV2Active")#"U" .AND.  .NOT. SuiteColaIsV2Active()
       RETURN .F.
    ENDIF
    IF TYPE("SuiteEnqueueEntidad")="U"
       = SuiteEntityEnsureLoaded()
    ENDIF
    IF TYPE("SuiteEnqueueEntidad")="U"
       RETURN .F.
    ENDIF
    lcTabla = LOWER(ALLTRIM(tcTabla))
    lcClave = ALLTRIM(TRANSFORM(tcClave))
    lcAcc = NVL(tcAccion, "UPD")
    DO CASE
       CASE lcTabla == "clientes"
          RETURN SuiteEnqueueCliente(lcClave, lcAcc)
       CASE lcTabla == "articulos"
          RETURN SuiteEnqueueArticulo(lcClave, lcAcc)
       CASE lcTabla == "bonoscli"
          RETURN SuiteEnqueueBonoCli(lcClave, lcAcc)
       CASE lcTabla == "albcab"
          RETURN SuiteEnqueueVenta(lcClave, lcAcc)
       CASE lcTabla == "faccab"
          RETURN SuiteEnqueueFactura(lcClave, lcAcc)
       CASE lcTabla == "ciecab"
          RETURN SuiteEnqueueCierre(lcClave, lcAcc)
       OTHERWISE
          RETURN SuiteEnqueueEntidad(lcTabla, lcClave, lcAcc)
    ENDCASE
 CATCH
 ENDTRY
 RETURN .F.
ENDFUNC
**
FUNCTION SuiteAfterEntitySaveCurrent
 * Encola el registro actual del alias indicado (p. ej. "clientes", "articulos").
 PARAMETER tcAlias, tcKeyField, tcAccion
 LOCAL lcKey
 IF  .NOT. USED(tcAlias)
    RETURN .F.
 ENDIF
 lcKey = ""
 IF TYPE(tcAlias + "." + ALLTRIM(tcKeyField)) <> "U"
    lcKey = EVALUATE(tcAlias + "." + tcKeyField)
 ENDIF
 IF EMPTY(ALLTRIM(TRANSFORM(lcKey)))
    RETURN .F.
 ENDIF
 RETURN SuiteAfterEntitySave(LOWER(ALLTRIM(tcAlias)), lcKey, NVL(tcAccion, "UPD"))
ENDFUNC
**
FUNCTION SuiteEnqueueEntidad
 * Encolado generico tabla+clave+accion (solo si v2 activo).
 PARAMETER tcTabla, tcClave, tcAccion
 IF TYPE("SuiteColaIsV2Active")#"U" .AND.  .NOT. SuiteColaIsV2Active()
    RETURN .F.
 ENDIF
 IF EMPTY(tcTabla) .OR. EMPTY(ALLTRIM(TRANSFORM(tcClave)))
    RETURN .F.
 ENDIF
 IF TYPE("SuiteEnqueueCola")="U"
    RETURN .F.
 ENDIF
 RETURN SuiteEnqueueCola(tcTabla, tcClave, tcAccion)
ENDFUNC
**
FUNCTION SuiteEnqueueCliente
 PARAMETER tcCodcli, tcAccion
 RETURN SuiteEnqueueEntidad("clientes", tcCodcli, NVL(tcAccion, "UPD"))
ENDFUNC
**
FUNCTION SuiteEnqueueArticulo
 PARAMETER tcCodart, tcAccion
 RETURN SuiteEnqueueEntidad("articulos", tcCodart, NVL(tcAccion, "UPD"))
ENDFUNC
**
FUNCTION SuiteEnqueueBonoCli
 PARAMETER tcCodboncli, tcAccion
 RETURN SuiteEnqueueEntidad("bonoscli", tcCodboncli, NVL(tcAccion, "UPD"))
ENDFUNC
**
FUNCTION SuiteEnqueueVenta
 PARAMETER tcNumalb, tcAccion
 RETURN SuiteEnqueueEntidad("albcab", tcNumalb, NVL(tcAccion, "UPD"))
ENDFUNC
**
FUNCTION SuiteEnqueueFactura
 PARAMETER tcNumfac, tcAccion
 RETURN SuiteEnqueueEntidad("faccab", tcNumfac, NVL(tcAccion, "UPD"))
ENDFUNC
**
FUNCTION SuiteEnqueueCierre
 PARAMETER tcNumcie, tcAccion
 RETURN SuiteEnqueueEntidad("ciecab", tcNumcie, NVL(tcAccion, "UPD"))
ENDFUNC

* Flags de licencia offline (agenda drag-drop, demo, renting). Compartido general + suite_full_unlock.
PROCEDURE SuiteApplyLicenseFlags
 IF TYPE("SuiteEnsureSyncGlobals")#"U"
    DO SuiteEnsureSyncGlobals
 ENDIF
 IF TYPE("SuiteEnsureGlobals")#"U"
    DO SuiteEnsureGlobals
 ENDIF
 plSuiteFullUnlock = .T.
 plversiondemo = .F.
 plversiondemoespecial = .T.
 plfechacaducidad = DATE() + 36500
 plrenting = .F.
 cfgbloqueadodspc = .F.
 cfgnumeroavisosusuariodspc = 0
 cfgintentosactualizacionwebok = 0
 pcversionapp = 0
 pclicenciasredfree = 999
 cfglicenciasred = 999
 pcempleadosactivosfree = 999
 plconexioninternet = .F.
 pcurlwebdspc = "http://127.0.0.1/"
 pcurlwebregion = "http://127.0.0.1/"
 plstarbene = .T.
 plstyledunasoftonline = .F.
 plsucursalweb = .F.
 plaplicacionesonline = .F.
 IF TYPE("tcnombreaplicacion") = "C"
    tcnombreaplicacion = "Lipout"
 ENDIF
 IF TYPE("_SCREEN") = "O"
    _SCREEN.caption = "Lipout"
 ENDIF
 plcreararticulos = .T.
 plcrearfamilias = .T.
 plcrearbonos = .T.
 plcrearempleados = .T.
 plcreartallasycolores = .T.
 plverfacturaciononlineclientes = .T.
 plverstockonlinearticulos = .T.
 cfgenviarresumenonline = .F.
 IF TYPE("cfgseguridad")="L" AND cfgseguridad
    * mantener .T.
 ELSE
    cfgseguridad = .F.
 ENDIF
 IF TYPE("cfgnomostrarpantallassinpermiso")#"L"
    cfgnomostrarpantallassinpermiso = .F.
 ENDIF
 IF TYPE("cfgavisaraniversarios")#"L"
    cfgavisaraniversarios = .T.
 ENDIF
 cfglicenciaandroid = .F.
 cfglicenciacentralreservas = .F.
 cfgcontabilidad = .F.
 IF FILE(ADDBS(SYS(5)+SYS(2003))+"conta.exe") .OR. FILE(ADDBS(SYS(5)+SYS(2003))+"CONTA.EXE")
    cfgcontabilidaddunasoft = .T.
 ELSE
    cfgcontabilidaddunasoft = .F.
 ENDIF
 IF TYPE("policencias") = "O"
    policencias.nlicenciasmaximas = 999
 ENDIF
ENDPROC

* Bootstrap externo sync v2: agente Node (RUN /N, no bloquea UI).
PROCEDURE SuiteBootExternalSync
 LOCAL lcRoot, lcPs1, lcCmd, lcSav

 lcRoot = ""
 IF TYPE("pcSuiteStyleRoot")="C" AND .NOT. EMPTY(pcSuiteStyleRoot)
    lcRoot = ADDBS(pcSuiteStyleRoot)
 ENDIF
 IF EMPTY(lcRoot)
    lcRoot = ADDBS(GETENV("STYLE_HOME"))
 ENDIF
 IF EMPTY(lcRoot)
    lcRoot = ADDBS(SYS(5)+SYS(2003))
 ENDIF

 lcPs1 = lcRoot + "ensure-style-sync.ps1"
 IF .NOT. FILE(lcPs1)
    lcPs1 = lcRoot + "PROGS\ensure-style-sync.ps1"
 ENDIF
 IF .NOT. FILE(lcPs1)
    IF TYPE("SuiteBootstrapLog")#"U"
       DO SuiteBootstrapLog WITH "[BOOT-SYNC] sin ensure-style-sync.ps1"
    ENDIF
    RETURN
 ENDIF

 lcCmd = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + lcPs1 + '" -StyleRoot "' + lcRoot + '" -EnsureAgent'
 lcSav = ON("ERROR")
 ON ERROR *
 RUN /N &lcCmd
 ON ERROR &lcSav

 IF TYPE("SuiteBootstrapLog")#"U"
    DO SuiteBootstrapLog WITH "[BOOT-SYNC] EnsureAgent lanzado"
 ENDIF
ENDPROC

* Aviso no intrusivo: JSON inbound pendientes (Suite -> Style) con Duna abierto.
* Timer en _SCREEN; una alerta cada ~30 min max si sigue pendiente.

PROCEDURE SuiteSyncPendingWatcherStart
 IF TYPE("plSuiteSyncEnabled")#"L" OR .NOT. plSuiteSyncEnabled
    RETURN
 ENDIF
 IF TYPE("_SCREEN.oSuitePendingTimer")="O"
    _SCREEN.oSuitePendingTimer.Enabled = .T.
    RETURN
 ENDIF
 LOCAL lcPrg, lcSav, lcErr
 lcPrg = SuitePendingRoot()+"PROGS\suite_sync_pending_alert.prg"
 IF .NOT. FILE(lcPrg)
    lcPrg = SuitePendingRoot()+"suite_sync_pending_alert.prg"
 ENDIF
 IF FILE(lcPrg)
    lcSav = ON("ERROR")
    lcErr = ""
    ON ERROR lcErr = MESSAGE()
    SET PROCEDURE TO (lcPrg) ADDITIVE
    ON ERROR &lcSav
 ENDIF
 TRY
    _SCREEN.AddObject("oSuitePendingTimer", "Timer")
    BINDEVENT(_SCREEN.oSuitePendingTimer, "Timer", "suite_sync_pending_alert", "SuiteSyncPendingWatcherTick")
    _SCREEN.oSuitePendingTimer.Interval = 120000
    _SCREEN.oSuitePendingTimer.Enabled = .T.
    IF TYPE("SuiteBootstrapLog")#"U"
       DO SuiteBootstrapLog WITH "[SYNC-WATCH] timer inbound pendiente activo"
    ENDIF
 CATCH TO oerr
    IF TYPE("SuiteBootstrapLog")#"U"
       DO SuiteBootstrapLog WITH "[SYNC-WATCH] timer no iniciado: "+TRANSFORM(oerr.message)
    ENDIF
 ENDTRY
ENDPROC

PROCEDURE SuiteSyncPendingWatcherStop
 IF TYPE("_SCREEN.oSuitePendingTimer")="O"
    _SCREEN.oSuitePendingTimer.Enabled = .F.
    _SCREEN.oSuitePendingTimer.Release()
 ENDIF
ENDPROC

PROCEDURE SuiteSyncPendingWatcherTick
 LOCAL lnPending, llWedbErr, lcRoot, lcFlag, ldLast, lnGap
 IF TYPE("plSuiteSyncEnabled")#"L" OR .NOT. plSuiteSyncEnabled
    DO SuiteSyncPendingWatcherStop
    RETURN
 ENDIF
 lcRoot = SuitePendingRoot()
 lnPending = SuitePendingInboundCount(lcRoot)
 IF lnPending <= 0
    RETURN
 ENDIF
 llWedbErr = SuitePendingRecentWedbError(lcRoot)
 lcFlag = lcRoot+"Usuarios\_sync_pending_alert.txt"
 ldLast = {}
 IF FILE(lcFlag)
    ldLast = CTOT(FILETOSTR(lcFlag))
 ENDIF
 lnGap = 1800
 IF .NOT. EMPTY(ldLast)
    IF (DATETIME() - ldLast) < lnGap
       RETURN
    ENDIF
 ENDIF
 STRTOFILE(TTOC(DATETIME()), lcFlag)
 LOCAL lcmsg
 lcmsg = "Hay "+ALLTRIM(STR(lnPending))+" cambio(s) de Suite pendientes de aplicar en Style."
 IF llWedbErr
    lcmsg = lcmsg+CHR(13)+CHR(13)+"El worker no pudo abrir wedb (Style en uso)."
    lcmsg = lcmsg+CHR(13)+"Al cerrar Style se sincronizaran solos."
    lcmsg = lcmsg+CHR(13)+"O ejecuta RecuperarSyncInbound.bat en la carpeta de Style."
 ELSE
    lcmsg = lcmsg+CHR(13)+CHR(13)+"El worker los aplicara en breve (scheduler o agente)."
 ENDIF
 MESSAGEBOX(lcmsg, 48, "Suite - sincronizacion pendiente")
ENDPROC

FUNCTION SuitePendingRoot
 LOCAL lcRoot
 lcRoot = ""
 IF TYPE("pcSuiteStyleRoot")="C" AND .NOT. EMPTY(pcSuiteStyleRoot)
    lcRoot = ADDBS(pcSuiteStyleRoot)
 ENDIF
 IF EMPTY(lcRoot)
    lcRoot = ADDBS(GETENV("STYLE_HOME"))
 ENDIF
 IF EMPTY(lcRoot)
    lcRoot = ADDBS(SYS(5)+SYS(2003))
 ENDIF
 RETURN lcRoot
ENDFUNC

FUNCTION SuitePendingInboundCount
 PARAMETER tcRoot
 LOCAL lnN, laArr
 lnN = 0
 IF .NOT. DIRECTORY(tcRoot+"sync\inbound")
    RETURN 0
 ENDIF
 lnN = ADIR(laArr, tcRoot+"sync\inbound\*.json")
 RETURN MAX(lnN, 0)
ENDFUNC

FUNCTION SuitePendingRecentWedbError
 PARAMETER tcRoot
 LOCAL lcLog, lcTail, ln
 lcLog = tcRoot+"sync\inbound_worker.log"
 IF .NOT. FILE(lcLog)
    RETURN .F.
 ENDIF
 lcTail = ""
 ln = 0
 LOCAL lnH
 lnH = FOPEN(lcLog, 0)
 IF lnH < 0
    RETURN .F.
 ENDIF
 FSEEK(lnH, 0, 2)
 LOCAL lnSize, lnStart, lcChunk
 lnSize = FSEEK(lnH, 0, 1)
 lnStart = MAX(0, lnSize - 8192)
 FSEEK(lnH, lnStart, 0)
 lcChunk = FREAD(lnH, MIN(8192, lnSize))
 = FCLOSE(lnH)
 lcTail = UPPER(lcChunk)
 RETURN ("WEDB" $ lcTail) AND (("ACCESS DENIED" $ lcTail) OR ("SHARED FAIL" $ lcTail) OR ("DENEGADO" $ lcTail))
ENDFUNC

* Drenaje inbound al cerrar Style (wedb libre tras QUIT).
PROCEDURE SuiteShutdownInboundDrain
 LOCAL lcRoot, lcPs1, lcCmd, lcSav

 lcRoot = IIF(TYPE("pcSuiteStyleRoot")="C" AND .NOT. EMPTY(pcSuiteStyleRoot), ADDBS(pcSuiteStyleRoot), ADDBS(SYS(5)+SYS(2003)))
 lcPs1 = lcRoot + "ensure-style-sync.ps1"
 IF .NOT. FILE(lcPs1)
    lcPs1 = lcRoot + "PROGS\ensure-style-sync.ps1"
 ENDIF
 IF .NOT. FILE(lcPs1)
    RETURN
 ENDIF

 lcCmd = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + lcPs1 + '" -StyleRoot "' + lcRoot + '" -DrainInboundAfterShutdown'
 lcSav = ON("ERROR")
 ON ERROR *
 RUN /N &lcCmd
 ON ERROR &lcSav
ENDPROC


PROCEDURE SuiteEnsureGlobals
 IF TYPE("pcidioma")#"C"
    PUBLIC pcidioma, pcpais, pcversionpais
    pcidioma = "CA"
    pcpais = "ESP"
    pcversionpais = "ESP"
 ENDIF
ENDPROC

PROCEDURE SuiteApplyFullUnlock
 DO SuiteApplyLicenseFlags
ENDPROC

PROCEDURE Suite_SyncInit
 LOCAL lccfg, lcRoot, lcpath, llWasOpen, lcSav, lcErr
 lcRoot = IIF(TYPE("pcSuiteStyleRoot")="C" .AND. .NOT. EMPTY(pcSuiteStyleRoot), ADDBS(pcSuiteStyleRoot), ADDBS(SYS(5)+SYS(2003)))
 lccfg = lcRoot+"SuiteSync.cfg"
 lcSav = ON("ERROR")
 lcErr = ""
 ON ERROR lcErr = MESSAGE()
 DO SuiteBootstrapLog WITH "[INIT-01] Suite_SyncInit inicio root="+lcRoot
 SET SAFETY OFF
 * Inline: no DO SuiteEnsureColaSincro (VFP busca .prg; errorwe traga fallos sin log).
 lcpath = lcRoot+"cola_sincro"
 llWasOpen = USED("cola_sincro")
 IF FILE(lcpath+".dbf")
    IF  .NOT. llWasOpen
       USE SHARED (lcpath) ALIAS cola_sincro IN 0
    ENDIF
    * Auto-reparar esquema: si falta fechaiso (cola antigua), migrar via exclusivo.
    IF USED("cola_sincro") .AND. TYPE("cola_sincro.fechaiso")="U" .AND.  .NOT. llWasOpen
       TRY
          USE IN cola_sincro
          USE EXCLUSIVE (lcpath) ALIAS cola_sincro IN 0
          IF TYPE("cola_sincro.fechaiso")="U"
             ALTER TABLE cola_sincro ADD COLUMN fechaiso C(10)
          ENDIF
          USE IN cola_sincro
       CATCH
       ENDTRY
       IF  .NOT. USED("cola_sincro")
          USE SHARED (lcpath) ALIAS cola_sincro IN 0
       ENDIF
    ENDIF
 ELSE
    * CREATE TABLE abre exclusivo; crear indices, cerrar y reabrir SHARED (evita "archivo ya en uso").
    CREATE TABLE (lcpath) FREE ;
       (id N(10,0), tabla C(40), id_reg C(30), accion C(3), ;
        procesado L, creado T, ;
        codemp C(15), codcli C(15), fecha D, fechaiso C(10), horini C(5), horfin C(5), ;
        texto C(250), codrec C(15), nomcli C(80), tel1cli C(20), ;
        facturado L, servicios C(254), colfon N(10,0), collet N(10,0), ;
        modif C(20), version N(15,0))
    INDEX ON procesado TAG proc
    INDEX ON id TAG idpk
    USE
    USE SHARED (lcpath) ALIAS cola_sincro IN 0
 ENDIF
 lcpath = lcRoot+"control_sincro"
 llWasOpen = USED("control_sincro")
 IF FILE(lcpath+".dbf")
    IF  .NOT. llWasOpen
       USE SHARED (lcpath) ALIAS control_sincro IN 0
    ENDIF
 ELSE
    CREATE TABLE (lcpath) FREE (modo C(1), actualiz T, notas C(80))
    USE
    USE SHARED (lcpath) ALIAS control_sincro IN 0
 ENDIF
 IF USED("control_sincro")
    SELECT control_sincro
    IF RECCOUNT()=0
       APPEND BLANK
       REPLACE modo WITH "2", actualiz WITH DATETIME(), notas WITH "v2 cola+agente"
    ENDIF
 ENDIF
 ON ERROR &lcSav
 IF  .NOT. EMPTY(lcErr)
    DO SuiteBootstrapLog WITH "[BOOT-07] Suite_SyncInit: "+lcErr
    RETURN
 ENDIF
 PUBLIC plSuiteSyncEnabled
 plSuiteSyncEnabled = .T.
 DO SuiteBootstrapLog WITH "[INIT-03] Style sync v2 cola activa"
ENDPROC

PROCEDURE Suite_SyncLog
 PARAMETER tcLine
 DO SuiteBootstrapLog WITH tcLine
ENDPROC

FUNCTION SuiteSyncEnsureLoaded
 RETURN SuiteHasAppSymbol("Suite_SyncInit")
ENDFUNC

PROCEDURE SuiteEnsureSyncGlobals
ENDPROC

FUNCTION SuiteHasAppSymbol
 * TYPE() solo detecta FUNCTION. PROCEDURE embebido siempre da U.
 * APROCINFO no disponible en este runtime (error 1001 ReFox/VFP).
 PARAMETER tcName
 LOCAL lc
 IF TYPE(tcName) #"U"
    RETURN .T.
 ENDIF
 lc = UPPER(ALLTRIM(tcName))
 IF lc $ "SUITE_SYNCINIT.SUITEAPPLYFULLUNLOCK.SUITEENSUREGLOBALS.SUITEENSURESYNCGLOBALS.SUITEENQUEUEPLAN2009"
    RETURN .T.
 ENDIF
 RETURN .F.
ENDFUNC

**
PROCEDURE SuiteBootstrapLog
 PARAMETER tcmsg
 LOCAL lcf, lcb, lcline
 lcb = IIF(TYPE("pcSuiteStyleRoot")="C" .AND. .NOT. EMPTY(pcSuiteStyleRoot), ADDBS(pcSuiteStyleRoot), ADDBS(SYS(5)+SYS(2003)))
 IF  .NOT. DIRECTORY(lcb+"Usuarios")
    MD (lcb+"Usuarios")
 ENDIF
 lcf = lcb+"Usuarios\_suite_sync.log"
 lcline = TTOC(DATETIME())+" "+ALLTRIM(tcmsg)+CHR(13)+CHR(10)
 STRTOFILE(lcline, lcf, .T.)
ENDPROC
**
FUNCTION SuiteLoadColaSyncRuntime
 PARAMETER tcStyleRoot
 LOCAL lcPrg
 IF TYPE("plSuiteSyncEnabled")="L" AND plSuiteSyncEnabled
    DO SuiteBootstrapLog WITH "[BOOT-04] suite_cola_sync v2 activa (plSuiteSyncEnabled)"
    RETURN .T.
 ENDIF
 IF TYPE("tcStyleRoot")="C" .AND. .NOT. EMPTY(tcStyleRoot)
    tcStyleRoot = ADDBS(tcStyleRoot)
 ELSE
    tcStyleRoot = ADDBS(SYS(5)+SYS(2003))
 ENDIF
 lcPrg = tcStyleRoot+"PROGS\suite_cola_sync.prg"
 DO SuiteBootstrapLog WITH "[BOOT-06E] sync v2 no en general - COMPILE PROGS\general.prg y BUILD EXE RECOMPILE"+ ;
    IIF(FILE(lcPrg), "", " (falta "+lcPrg+")")
 RETURN .F.
ENDFUNC
**
PROCEDURE SuiteLoadUnlockProgram
 PARAMETER tcStyleRoot
 LOCAL lcSavErr, llEmbProc, lcerr
 IF SuiteHasAppSymbol("SuiteApplyFullUnlock") AND SuiteHasAppSymbol("Suite_SyncInit")
    DO SuiteBootstrapLog WITH "[BOOT-03] unlock ya cargado (Suite_SyncInit OK)"
    RETURN
 ENDIF
 IF TYPE("SuiteEnsureGlobals")#"U"
    DO SuiteEnsureGlobals
 ELSE
    IF TYPE("pcidioma")#"C"
       PUBLIC pcidioma, pcpais, pcversionpais
       pcidioma = "CA"
       pcpais = "ESP"
       pcversionpais = "ESP"
    ENDIF
 ENDIF
 * v2: cola local antes del canal HTTP legacy (suite_full_unlock).
 IF TYPE("SuiteEnqueuePlan2009")="U"
    IF SuiteLoadColaSyncRuntime(tcStyleRoot)
       RETURN
    ENDIF
 ENDIF
 * v1 legacy: solo si existe suite_full_unlock.prg en disco (no en proyecto v2).
 LOCAL lcPrg, llPrg
 lcPrg = tcStyleRoot+"PROGS\suite_full_unlock.prg"
 IF  .NOT. FILE(lcPrg)
    lcPrg = tcStyleRoot+"suite_full_unlock.prg"
 ENDIF
 IF FILE(lcPrg)
    lcSavErr = ON("ERROR")
    lcerr = ""
    ON ERROR lcerr = MESSAGE()
    SET PROCEDURE TO (lcPrg) ADDITIVE
    llPrg = SuiteHasAppSymbol("Suite_SyncInit")
    ON ERROR &lcSavErr
    IF llPrg
       DO SuiteBootstrapLog WITH "[BOOT-06] OK desde "+lcPrg
       RETURN
    ENDIF
    IF  .NOT. EMPTY(lcerr)
       DO SuiteBootstrapLog WITH "[BOOT-06E] "+lcPrg+" "+lcerr
    ENDIF
 ENDIF
 DO SuiteBootstrapLog WITH "[BOOT-07] FALLO: falta PROGS\suite_cola_sync.prg (v2) o suite_full_unlock (v1)"
ENDPROC
**
PROCEDURE SuiteStartSyncIfReady
 LOCAL lcRoot, lccfg, lcSav, lcErr
 lcRoot = IIF(TYPE("pcSuiteStyleRoot")="C" .AND. .NOT. EMPTY(pcSuiteStyleRoot), ADDBS(pcSuiteStyleRoot), ADDBS(SYS(5)+SYS(2003)))
 DO SuiteBootstrapLog WITH "[BOOT-01] SuiteStartSyncIfReady root="+lcRoot+" cwd="+SYS(5)+SYS(2003)
 = SuiteLoadColaSyncRuntime(lcRoot)
 lcSav = ON("ERROR")
 lcErr = ""
 ON ERROR lcErr = MESSAGE()
 DO SuiteApplyFullUnlock
 ON ERROR &lcSav
 IF EMPTY(lcErr)
    DO SuiteBootstrapLog WITH "[BOOT-02] SuiteApplyFullUnlock ejecutado"
 ELSE
    DO SuiteBootstrapLog WITH "[BOOT-02] SuiteApplyFullUnlock NO disponible"
 ENDIF
 IF  .NOT. SuiteHasAppSymbol("Suite_SyncInit")
    IF TYPE("SuiteLoadUnlockFromFunciones")#"U"
       = SuiteLoadUnlockFromFunciones(lcRoot)
    ENDIF
    IF  .NOT. SuiteHasAppSymbol("Suite_SyncInit")
       DO SuiteLoadUnlockProgram WITH lcRoot
    ENDIF
 ENDIF
 lccfg = lcRoot+"SuiteSync.cfg"
 IF  .NOT. FILE(lccfg)
    lccfg = ADDBS(SYS(5)+SYS(2003))+"SuiteSync.cfg"
 ENDIF
 IF  .NOT. FILE(lccfg)
    DO SuiteBootstrapLog WITH "[INIT-02] FALLO: no existe SuiteSync.cfg en "+lcRoot+" ni cwd"
    RETURN
 ENDIF
 IF TYPE("plSuiteSyncEnabled")="L" AND plSuiteSyncEnabled
    DO SuiteBootstrapLog WITH "[BOOT-08] sync ya activa (plSuiteSyncEnabled=.T.)"
    RETURN
 ENDIF
 DO SuiteBootstrapLog WITH "[BOOT-09] llamando Suite_SyncInit cfg="+lccfg
 lcErr = ""
 ON ERROR lcErr = MESSAGE()
 DO Suite_SyncInit
 ON ERROR &lcSav
 IF  .NOT. EMPTY(lcErr)
    DO SuiteBootstrapLog WITH "[BOOT-07] FALLO: Suite_SyncInit "+lcErr
 ENDIF
 DO SuiteBootExternalSyncIfReady WITH lcRoot
ENDPROC
**
PROCEDURE SuiteBootExternalSyncIfReady
 PARAMETER tcStyleRoot
 LOCAL lcPs1, lcCmd, lcSav, lcErr
 IF TYPE("tcStyleRoot")="C" AND .NOT. EMPTY(tcStyleRoot)
    tcStyleRoot = ADDBS(tcStyleRoot)
 ELSE
    tcStyleRoot = ADDBS(SYS(5)+SYS(2003))
 ENDIF
 * Embebido en exe: RUN powershell (no DO a .prg externo ni TYPE() de PROCEDURE).
 lcPs1 = tcStyleRoot+"ensure-style-sync.ps1"
 IF .NOT. FILE(lcPs1)
    lcPs1 = tcStyleRoot+"PROGS\ensure-style-sync.ps1"
 ENDIF
 IF .NOT. FILE(lcPs1)
    DO SuiteBootstrapLog WITH "[BOOT-SYNC] sin ensure-style-sync.ps1"
    DO SuiteSyncPendingWatcherStartIfReady WITH tcStyleRoot
    RETURN
 ENDIF
 lcCmd = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "'+lcPs1+'" -StyleRoot "'+tcStyleRoot+'" -EnsureAgent'
 lcSav = ON("ERROR")
 lcErr = ""
 ON ERROR lcErr = MESSAGE()
 RUN /N &lcCmd
 ON ERROR &lcSav
 IF .NOT. EMPTY(lcErr)
    DO SuiteBootstrapLog WITH "[BOOT-SYNC] "+lcErr
 ELSE
    DO SuiteBootstrapLog WITH "[BOOT-SYNC] EnsureAgent lanzado"
 ENDIF
 DO SuiteSyncPendingWatcherStartIfReady WITH tcStyleRoot
ENDPROC
**
PROCEDURE SuiteSyncPendingWatcherStartIfReady
 PARAMETER tcStyleRoot
 LOCAL lcPrg, lcSav, lcErr
 IF TYPE("plSuiteSyncEnabled")#"L" OR .NOT. plSuiteSyncEnabled
    RETURN
 ENDIF
 IF TYPE("tcStyleRoot")="C" AND .NOT. EMPTY(tcStyleRoot)
    tcStyleRoot = ADDBS(tcStyleRoot)
 ELSE
    tcStyleRoot = ADDBS(SYS(5)+SYS(2003))
 ENDIF
 lcPrg = tcStyleRoot+"PROGS\suite_sync_pending_alert.prg"
 IF .NOT. FILE(lcPrg)
    lcPrg = tcStyleRoot+"suite_sync_pending_alert.prg"
 ENDIF
 IF .NOT. FILE(lcPrg)
    RETURN
 ENDIF
 lcSav = ON("ERROR")
 lcErr = ""
 ON ERROR lcErr = MESSAGE()
 SET PROCEDURE TO (lcPrg) ADDITIVE
 IF TYPE("SuiteSyncPendingWatcherStart")#"U"
    DO SuiteSyncPendingWatcherStart
 ENDIF
 ON ERROR &lcSav
ENDPROC
**
PROCEDURE SuiteOnShutdown
 TRY
    LOCAL lcRoot, lcShutPrg
    lcRoot = IIF(TYPE("pcSuiteStyleRoot")="C" AND .NOT. EMPTY(pcSuiteStyleRoot), ADDBS(pcSuiteStyleRoot), ADDBS(SYS(5)+SYS(2003)))
    lcShutPrg = lcRoot+"PROGS\suite_shutdown_sync.prg"
    IF .NOT. FILE(lcShutPrg)
       lcShutPrg = lcRoot+"suite_shutdown_sync.prg"
    ENDIF
    IF FILE(lcShutPrg)
       SET PROCEDURE TO (lcShutPrg) ADDITIVE
       IF TYPE("SuiteShutdownInboundDrain")#"U"
          DO SuiteShutdownInboundDrain
       ENDIF
    ENDIF
 CATCH
 ENDTRY
 TRY
    IF TYPE("SuiteShutdown")#"U"
       DO SuiteShutdown
    ELSE
       CLEAR EVENTS
    ENDIF
 CATCH
    CLEAR EVENTS
 ENDTRY
ENDPROC
**
FUNCTION SuiteUnlockLibPath
 PARAMETER tcStyleRoot
 LOCAL lcPrg
 * Embebido en exe: no pasar nombre suelto a NEWOBJECT (provoca error 1732)
 IF SuiteHasAppSymbol("SuiteApplyFullUnlock")
    RETURN ""
 ENDIF
 IF  .NOT. SuiteHasAppSymbol("Suite_SyncInit") .AND.  .NOT. SuiteHasAppSymbol("SuiteApplyFullUnlock")
    RETURN ""
 ENDIF
 lcPrg = tcStyleRoot+"PROGS\suite_full_unlock.prg"
 IF FILE(lcPrg)
    RETURN lcPrg
 ENDIF
 lcPrg = tcStyleRoot+"suite_full_unlock.prg"
 IF FILE(lcPrg)
    RETURN lcPrg
 ENDIF
 RETURN ""
ENDFUNC
**
FUNCTION SuiteSafeCreateObject
 * CREATEOBJECT sin dialogo VFP nativo (ON ERROR vacio dispara "Error del programa").
 PARAMETER tcClass, tcClassLib
 LOCAL lo, lcSav, llFail
 lo = .NULL.
 llFail = .F.
 lcSav = ON("ERROR")
 ON ERROR llFail = .T.
 IF TYPE("tcClassLib")="C" AND .NOT. EMPTY(tcClassLib) AND FILE(tcClassLib)
    SET CLASSLIB TO (tcClassLib) ADDITIVE
 ENDIF
 lo = CREATEOBJECT(tcClass)
 ON ERROR &lcSav
 IF llFail OR VARTYPE(lo)#"O"
    DO SuiteBootstrapLog WITH "[BOOT-CLS] "+tcClass+" err="+ALLTRIM(STR(ERROR()))+" "+MESSAGE()
    lo = .NULL.
 ENDIF
 RETURN lo
ENDFUNC
**
FUNCTION SuiteIsStyleRoot
 PARAMETER tcRoot
 IF EMPTY(tcRoot)
    RETURN .F.
 ENDIF
 tcRoot = ADDBS(tcRoot)
 RETURN FILE(tcRoot+"EMPRESA.DBF") OR FILE(tcRoot+"duna.exe") OR FILE(tcRoot+"Duna.exe") OR FILE(tcRoot+"mscomctl.exe") OR FILE(tcRoot+"style.exe") OR FILE(tcRoot+"SuiteSync.cfg") OR FILE(tcRoot+"dbf\wedb.dbc")
ENDFUNC
**
FUNCTION SuiteResolveStyleRoot
 LOCAL lcRoot
 lcRoot = ""
 IF  .NOT. EMPTY(SYS(16))
    lcRoot = ADDBS(JUSTPATH(FULLPATH(SYS(16))))
 ENDIF
 IF  .NOT. SuiteIsStyleRoot(lcRoot)
    IF  .NOT. EMPTY(GETENV("STYLE_HOME")) AND DIRECTORY(GETENV("STYLE_HOME"))
       lcRoot = ADDBS(GETENV("STYLE_HOME"))
    ENDIF
 ENDIF
 IF  .NOT. SuiteIsStyleRoot(lcRoot)
    lcRoot = ADDBS(SYS(5)+SYS(2003))
 ENDIF
 IF  .NOT. SuiteIsStyleRoot(lcRoot)
    IF DIRECTORY("C:\Style-Dunasoft\")
       lcRoot = "C:\Style-Dunasoft\"
    ENDIF
 ENDIF
 IF  .NOT. SuiteIsStyleRoot(lcRoot)
    IF DIRECTORY("Z:\Style-Dunasoft\")
       lcRoot = "Z:\Style-Dunasoft\"
    ENDIF
 ENDIF
 IF EMPTY(lcRoot)
    lcRoot = ADDBS(SYS(5)+SYS(2003))
 ENDIF
 RETURN lcRoot
ENDFUNC
**
FUNCTION SuiteIsDatabaseOpen
 * DBC() en IF directo puede dar error 9 (tipos) segun estado del contenedor.
 LOCAL lcSav, lcName
 lcName = ""
 lcSav = ON("ERROR")
 ON ERROR lcName = ""
 lcName = DBC()
 ON ERROR &lcSav
 RETURN (TYPE("lcName")="C" .AND. .NOT. EMPTY(lcName))
ENDFUNC
**
PROCEDURE SuiteApplyStyleEnvironment
 PARAMETER tcStyleRoot
 LOCAL lcDbfRoot, lcSavDbc
 PUBLIC pcSuiteStyleRoot
 pcSuiteStyleRoot = ADDBS(tcStyleRoot)
 lcDbfRoot = pcSuiteStyleRoot+"dbf\"
 * Abrir wedb desde dbf\ (como al elegir dbf\wedb en el dialogo). NO enlazar wedb.dbc en raiz:
 * si wedb se abre desde raiz, VFP busca USUARIOS.DBF en raiz y falla (error 2005).
 = SuiteRemoveRootWedbLinks(pcSuiteStyleRoot, lcDbfRoot)
 SET DEFAULT TO (pcSuiteStyleRoot)
 CD (pcSuiteStyleRoot)
 IF DIRECTORY(lcDbfRoot)
    SET PATH TO (lcDbfRoot) ADDITIVE
 ENDIF
 IF DIRECTORY(lcDbfRoot) AND FILE(lcDbfRoot+"wedb.dbc")
    lcSavDbc = ON("ERROR")
    ON ERROR *
    IF  .NOT. SuiteIsDatabaseOpen()
       OPEN DATABASE (lcDbfRoot+"wedb") SHARED
    ENDIF
    ON ERROR &lcSavDbc
 ENDIF
 IF  .NOT. DIRECTORY(pcSuiteStyleRoot+"Usuarios")
    MD (pcSuiteStyleRoot+"Usuarios")
 ENDIF
ENDPROC
**
FUNCTION SuiteRemoveRootWedbLinks
 * Quita wedb.* en raiz si dbf\wedb existe (enlace duro previo rompe rutas de tablas).
 PARAMETER tcRoot, tcDbfRoot
 LOCAL lcSav, lnI, lcName, lcRootFile
 IF EMPTY(tcRoot) OR  .NOT. FILE(ADDBS(tcDbfRoot)+"wedb.dbc")
    RETURN .F.
 ENDIF
 tcRoot = ADDBS(tcRoot)
 lcSav = ON("ERROR")
 ON ERROR *
 FOR lnI = 1 TO 3
    lcName = IIF(lnI=1, "wedb.dbc", IIF(lnI=2, "WEDB.DCT", "WEDB.DCX"))
    lcRootFile = tcRoot+lcName
    IF FILE(lcRootFile)
       DELETE FILE (lcRootFile)
    ENDIF
 ENDFOR
 ON ERROR &lcSav
 RETURN .T.
ENDFUNC
**
FUNCTION SuiteEnsureDatabaseOpen
 LOCAL lcDbfRoot, lcSavDbc
 IF TYPE("pcSuiteStyleRoot")#"C" OR EMPTY(pcSuiteStyleRoot)
    RETURN .F.
 ENDIF
 lcDbfRoot = ADDBS(pcSuiteStyleRoot)+"dbf\"
 IF  .NOT. FILE(lcDbfRoot+"wedb.dbc")
    RETURN .F.
 ENDIF
 IF SuiteIsDatabaseOpen()
    RETURN .T.
 ENDIF
 lcSavDbc = ON("ERROR")
 ON ERROR *
 OPEN DATABASE (lcDbfRoot+"wedb") SHARED
 ON ERROR &lcSavDbc
 RETURN SuiteIsDatabaseOpen()
ENDFUNC
