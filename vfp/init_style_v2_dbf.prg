* Crear control_sincro + cola_sincro v2 en la raiz de Style.
* Ejecutar desde C:\Style-Dunasoft (usar init_style_v2_dbf.bat).
LPARAMETERS lcDummy
LOCAL lcpath, lclog, lcRoot, lcErr
lcRoot = ADDBS(SYS(5) + SYS(2003))
lclog = lcRoot + "sync\init_v2_dbf.log"
SET SAFETY OFF
SET DEFAULT TO (lcRoot)
ON ERROR lcErr = MESSAGE()
lcErr = ""

* --- control_sincro ---
lcpath = lcRoot + "control_sincro"
IF  .NOT. FILE(lcpath + ".dbf")
   CREATE TABLE (lcpath) FREE (modo C(1), actualiz T, notas C(80))
   USE
ENDIF
USE EXCLUSIVE (lcpath) ALIAS _ctl IN 0
SELECT _ctl
IF RECCOUNT() = 0
   APPEND BLANK
ENDIF
REPLACE modo WITH "2", actualiz WITH DATETIME(), notas WITH "v2 cola+agente Suite"
USE IN _ctl
IF  .NOT. EMPTY(lcErr)
   STRTOFILE("ERR control: " + lcErr + CHR(13), lclog, .T.)
   lcErr = ""
ENDIF
STRTOFILE("OK control_sincro modo=2 en " + lcRoot + CHR(13), lclog, .T.)

* --- cola_sincro ---
lcpath = lcRoot + "cola_sincro"
IF FILE(lcpath + ".dbf")
   USE EXCLUSIVE (lcpath) ALIAS _cola IN 0
   SELECT _cola
   ZAP
   USE IN _cola
   STRTOFILE("OK cola_sincro vacia (ZAP)" + CHR(13), lclog, .T.)
ELSE
   CREATE TABLE (lcpath) FREE ;
      (id N(10,0), tabla C(40), id_reg C(30), accion C(3), ;
       procesado L, creado T, ;
       codemp C(15), codcli C(15), fecha D, fechaiso C(10), horini C(5), horfin C(5), ;
       texto C(250), codrec C(15), nomcli C(80), tel1cli C(20), ;
       facturado L, servicios C(254), colfon N(10,0), collet N(10,0), ;
       modif C(20), version N(15,0))
   INDEX ON id TAG idpk
   USE
   STRTOFILE("OK cola_sincro creada vacia" + CHR(13), lclog, .T.)
ENDIF
IF  .NOT. EMPTY(lcErr)
   STRTOFILE("ERR cola: " + lcErr + CHR(13), lclog, .T.)
ENDIF
QUIT
