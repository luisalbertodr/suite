* Activa sync manual (solo desarrollo / emergencia).
* Produccion: usar Duna.exe con ReFox Replace — no hace falta este script.

LOCAL lcb, lcSource, lcLoad, lcSavErr, lcErr, laTry, i, lcPath, llNetwork, lclocal, lcFxp

lcb = ""

IF  .NOT. EMPTY(SYS(16))
   lcPath = ADDBS(JUSTPATH(SYS(16)))
   IF FILE(lcPath+"Duna.exe") OR FILE(lcPath+"SuiteSync.cfg")
      lcb = lcPath
   ENDIF
ENDIF

IF EMPTY(lcb)
   lcPath = ADDBS(SYS(5)+SYS(2003))
   IF FILE(lcPath+"Duna.exe") OR FILE(lcPath+"SuiteSync.cfg")
      lcb = lcPath
   ENDIF
ENDIF

IF EMPTY(lcb)
   DIMENSION laTry(3)
   laTry(1) = IIF( .NOT. EMPTY(GETENV("STYLE_HOME")), ADDBS(GETENV("STYLE_HOME")), "")
   laTry(2) = "C:\Style-Dunasoft\"
   laTry(3) = "Z:\Style-Dunasoft\"
   FOR i = 1 TO ALEN(laTry)
      IF EMPTY(laTry(i))
         LOOP
      ENDIF
      IF DIRECTORY(laTry(i)) AND FILE(laTry(i)+"SuiteSync.cfg")
         lcb = laTry(i)
         EXIT
      ENDIF
   ENDFOR
ENDIF

IF EMPTY(lcb)
   MESSAGEBOX("No se encuentra Style-Dunasoft (SuiteSync.cfg).", 16, "Suite sync")
   RETURN
ENDIF

* Ya embebido en duna.exe (ReFox Replace)
IF TYPE("Suite_SyncInit")#"U"
   PUBLIC pcSuiteStyleRoot
   pcSuiteStyleRoot = lcb
   IF TYPE("plSuiteSyncEnabled")#"L" OR .NOT. plSuiteSyncEnabled
      DO Suite_SyncInit
   ENDIF
   WAIT WINDOW NOWAIT "Sync ya cargada en duna.exe. Log: "+lcb+"Usuarios\_suite_sync.log"
   RETURN
ENDIF

SET DEFAULT TO (lcb)
SET PATH TO (lcb) ADDITIVE
SET PATH TO (lcb+"PROGS") ADDITIVE

lcSource = ""
IF FILE(lcb+"PROGS\suite_full_unlock.prg")
   lcSource = lcb+"PROGS\suite_full_unlock.prg"
ELSE
   IF FILE(lcb+"suite_full_unlock.prg")
      lcSource = lcb+"suite_full_unlock.prg"
   ENDIF
ENDIF

IF EMPTY(lcSource)
   MESSAGEBOX("Sync no embebida en duna.exe y falta suite_full_unlock.prg."+CHR(13)+CHR(13)+ ;
      "Solucion: ReFox Replace en Duna.exe (general, funciones, suite_full_unlock)."+CHR(13)+ ;
      "Ver vfp\README.md", 16, "Suite sync")
   RETURN
ENDIF

llNetwork = (UPPER(LEFT(lcb, 2))="Z:") OR (AT("\\", lcb)>0)
lcLoad = lcSource

IF llNetwork
   * FXP/PRG en Z: no cargan bien — compilar a TEMP local
   lclocal = ADDBS(GETENV("TEMP"))+"suite_full_unlock.prg"
   lcFxp = ADDBS(GETENV("TEMP"))+"suite_full_unlock.fxp"
   STRTOFILE(FILETOSTR(lcSource), lclocal, .F.)
   COMPILE (lclocal) TO (lcFxp)
   IF FILE(lcFxp)
      lcLoad = lcFxp
   ELSE
      lcLoad = lclocal
   ENDIF
ENDIF

lcSavErr = ON("ERROR")
lcErr = ""
ON ERROR lcErr = MESSAGE()
SET PROCEDURE TO (lcLoad) ADDITIVE
ON ERROR &lcSavErr

IF TYPE("SuiteApplyFullUnlock")="U"
   MESSAGEBOX("No se pudo cargar suite_full_unlock."+CHR(13)+CHR(13)+ ;
      "Use Duna.exe con ReFox Replace (recomendado)."+CHR(13)+ ;
      IIF( .NOT. EMPTY(lcErr), "Error: "+lcErr, ""), 16, "Suite sync")
   RETURN
ENDIF

PUBLIC pcSuiteStyleRoot
pcSuiteStyleRoot = lcb
DO SuiteApplyFullUnlock
DO Suite_SyncInit

WAIT WINDOW NOWAIT "Sync OK (modo externo). Log: "+lcb+"Usuarios\_suite_sync.log"
