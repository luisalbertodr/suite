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
 cfgcontabilidad = .T.
 cfgcontabilidaddunasoft = .T.
 IF TYPE("policencias") = "O"
    policencias.nlicenciasmaximas = 999
 ENDIF
ENDPROC
