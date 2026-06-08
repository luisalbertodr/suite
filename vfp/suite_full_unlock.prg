* Suite: sin servidores Dunasoft + todas las funciones deslimitadas.

* Cargar con: SET PROCEDURE TO suite_full_unlock ADDITIVE



PUBLIC plSuiteFullUnlock

plSuiteFullUnlock = .T.



**

PROCEDURE SuiteApplyFullUnlock

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

 plconexioninternet = .T.

 pcurlwebdspc = "http://127.0.0.1/"

 pcurlwebregion = "http://127.0.0.1/"

 plsucursalweb = .F.

 plaplicacionesonline = .F.

 plcreararticulos = .T.

 plcrearfamilias = .T.

 plcrearbonos = .T.

 plcrearempleados = .T.

 plcreartallasycolores = .T.

 plverfacturaciononlineclientes = .T.

 plverstockonlinearticulos = .T.

 cfgenviarresumenonline = .F.

 cfgseguridad = .F.

 cfglicenciaandroid = .F.

 cfglicenciacentralreservas = .F.

 IF TYPE("policencias") = "O"

    policencias.nlicenciasmaximas = 999

 ENDIF

ENDPROC

**

PROCEDURE start_serviciocomunicaciones

 TRY

    DO Suite_SyncInit IN suite_reservas_sync.prg

 CATCH

 ENDTRY

ENDPROC

**

PROCEDURE stop_serviciocomunicaciones

 TRY

    DO Suite_SyncStopTimer IN suite_reservas_sync.prg

 CATCH

 ENDTRY

ENDPROC

**

PROCEDURE start_serviciosonline

 RETURN

ENDPROC

**

DEFINE CLASS licencias_unlock AS licencias

 nlicenciasmaximas = 999

 msgerror = ""

 nhandlelicencia = 0

**

 FUNCTION compruebalicencias

  RETURN .T.

 ENDFUNC

**

 FUNCTION entrausuario

  LOCAL lcruta, lcfichero, lcnompc

  lcruta = ADDBS(SYS(5)+SYS(2003))+"Usuarios\"

  IF .NOT. DIRECTORY(lcruta)

     MD (lcruta)

  ENDIF

  lcnompc = ALLTRIM(SUBSTR(ID(), 1, AT("#", ID())-1))

  lcfichero = lcruta + lcnompc + ".lic"

  STRTOFILE("", lcfichero)

  this.nhandlelicencia = FOPEN(lcfichero, 2)

  RETURN .T.

 ENDFUNC

**

 FUNCTION saleusuario

  IF this.nhandlelicencia > 0

     = FCLOSE(this.nhandlelicencia)

     this.nhandlelicencia = 0

  ENDIF

  RETURN .T.

 ENDFUNC

ENDDEFINE

**

DEFINE CLASS httpasp_local AS Custom

 httpweb = ""

 msgerror = ""

 resultado = "OK"

 esservidorphp = 1

**

 FUNCTION Init

  this.AddObject("oxmlhttp", "MSXML2.ServerXMLHTTP.6.0")

 ENDFUNC

**

 FUNCTION validarrespuesta

  RETURN .T.

 ENDFUNC

**

 FUNCTION servidorphp

  RETURN 1

 ENDFUNC

**

 FUNCTION androidonline_validarlicencia

  LPARAMETERS tccodcli, tcpassword

  RETURN .T.

 ENDFUNC

**

 FUNCTION centralreservasonline_validarlicencia

  LPARAMETERS tccodcli, tcpassword

  RETURN .T.

 ENDFUNC

**

 PROCEDURE Unknown

  LPARAMETERS lcMethod

  RETURN .T.

 ENDPROC

ENDDEFINE

**

FUNCTION SuiteCreateHttp

 RETURN CREATEOBJECT("httpasp_local")

ENDFUNC

