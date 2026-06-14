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
 = SuiteLoadUnlockFromFunciones(lcStyleRoot)
 IF TYPE("Suite_SyncInit")="U"
    DO SuiteLoadUnlockProgram WITH lcStyleRoot
 ENDIF
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
       DO CONTA.EXE WITH "INICIO"
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
 IF TYPE("SuiteShutdown")#"U"
    ON SHUTDOWN DO SuiteShutdown
 ELSE
    ON SHUTDOWN CLEAR EVENTS
 ENDIF
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
 IF TYPE("SuiteApplyFullUnlock")#"U"
    DO SuiteApplyFullUnlock
 ELSE
    DO SuiteLoadUnlockProgram WITH IIF(TYPE("pcSuiteStyleRoot")="C" .AND. .NOT. EMPTY(pcSuiteStyleRoot), ADDBS(pcSuiteStyleRoot), ADDBS(SYS(5)+SYS(2003)))
    IF TYPE("SuiteApplyFullUnlock")#"U"
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
             tmrcheck = CREATEOBJECT("DetectActivity")
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
PROCEDURE SuiteLoadUnlockProgram
 PARAMETER tcStyleRoot
 LOCAL lcSavErr, llEmbProc, lcerr
 IF TYPE("SuiteApplyFullUnlock")#"U" AND TYPE("Suite_SyncInit")#"U"
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
 * Sync embebida en Duna.exe (BUILD mscomctl.pjx con suite_full_unlock.prg)
 lcSavErr = ON("ERROR")
 lcerr = ""
 ON ERROR lcerr = MESSAGE()
 SET PROCEDURE TO suite_full_unlock ADDITIVE
 llEmbProc = (TYPE("Suite_SyncInit")#"U")
 ON ERROR &lcSavErr
 IF llEmbProc
    DO SuiteBootstrapLog WITH "[BOOT-04] embebido exe OK (suite_full_unlock en Duna.exe)"
    RETURN
 ENDIF
 IF  .NOT. EMPTY(lcerr)
    DO SuiteBootstrapLog WITH "[BOOT-05] embebido sin SyncInit: "+lcerr
 ENDIF
 DO SuiteBootstrapLog WITH "[BOOT-07] FALLO: recompilar Duna.exe (BUILD-DUNA.bat en Export)"
ENDPROC
**
PROCEDURE SuiteStartSyncIfReady
 LOCAL lcRoot, lccfg
 lcRoot = IIF(TYPE("pcSuiteStyleRoot")="C" .AND. .NOT. EMPTY(pcSuiteStyleRoot), ADDBS(pcSuiteStyleRoot), ADDBS(SYS(5)+SYS(2003)))
 DO SuiteBootstrapLog WITH "[BOOT-01] SuiteStartSyncIfReady root="+lcRoot+" cwd="+SYS(5)+SYS(2003)
 IF TYPE("SuiteApplyFullUnlock")#"U"
    DO SuiteApplyFullUnlock
    DO SuiteBootstrapLog WITH "[BOOT-02] SuiteApplyFullUnlock ejecutado"
 ELSE
    DO SuiteBootstrapLog WITH "[BOOT-02] SuiteApplyFullUnlock NO disponible"
 ENDIF
 IF TYPE("Suite_SyncInit")="U"
    IF TYPE("SuiteLoadUnlockFromFunciones")#"U"
       = SuiteLoadUnlockFromFunciones(lcRoot)
    ENDIF
    IF TYPE("Suite_SyncInit")="U"
       DO SuiteLoadUnlockProgram WITH lcRoot
    ENDIF
 ENDIF
 IF TYPE("SuiteSyncEnsureLoaded")#"U"
    = SuiteSyncEnsureLoaded()
 ENDIF
 IF TYPE("Suite_SyncInit")="U"
    DO SuiteBootstrapLog WITH "[BOOT-07] FALLO: sync no cargada — falta suite_full_unlock en exe o PROGS\"
    RETURN
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
 DO Suite_SyncInit
ENDPROC
**
FUNCTION SuiteUnlockLibPath
 PARAMETER tcStyleRoot
 LOCAL lcPrg
 * Embebido en exe: no pasar nombre suelto a NEWOBJECT (provoca error 1732)
 IF TYPE("SuiteApplyFullUnlock")#"U"
    RETURN ""
 ENDIF
 IF TYPE("Suite_SyncInit")="U" AND TYPE("SuiteApplyFullUnlock")="U"
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
    IF TYPE("SuiteBootstrapLog")#"U"
       DO SuiteBootstrapLog WITH "[BOOT-CLS] "+tcClass+" err="+ALLTRIM(STR(ERROR()))+" "+MESSAGE()
    ENDIF
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
    IF  .NOT. DBC()
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
 IF DBC()
    RETURN .T.
 ENDIF
 lcSavDbc = ON("ERROR")
 ON ERROR *
 OPEN DATABASE (lcDbfRoot+"wedb") SHARED
 ON ERROR &lcSavDbc
 RETURN DBC()
ENDFUNC
**
