* Activa sync manual (solo desarrollo / emergencia).
* Produccion: usar Duna.exe con ReFox Replace — no hace falta este script.

SET SAFETY OFF
LOCAL lcb, lcSource, lcLoad, lcSavErr, lcErr, laTry, i, lcPath, lclocal, lcFxp, lcLic

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
   DIMENSION laTry(4)
   laTry(1) = IIF( .NOT. EMPTY(GETENV("STYLE_HOME")), ADDBS(GETENV("STYLE_HOME")), "")
   laTry(2) = "C:\Duna\Style-Suite-Test\"
   laTry(3) = "C:\Style-Dunasoft\"
   laTry(4) = "Z:\Style-Dunasoft\"
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

IF TYPE("pcidioma")#"C"
   PUBLIC pcidioma, pcpais, pcversionpais
   pcidioma = "CA"
   pcpais = "ESP"
   pcversionpais = "ESP"
ENDIF

IF TYPE("plSuiteSyncEnabled")="L" AND plSuiteSyncEnabled
   PUBLIC pcSuiteStyleRoot
   pcSuiteStyleRoot = lcb
   DO Suite_SyncInit
   WAIT WINDOW NOWAIT "Sync ya activa. Log: "+lcb+"Usuarios\_suite_sync.log"
   RETURN
ENDIF

SET DEFAULT TO (lcb)
SET PATH TO (lcb), (lcb+"PROGS"), (lcb+"vcx") ADDITIVE

lcLic = lcb+"vcx\licencias.vcx"
IF FILE(lcLic)
   SET CLASSLIB TO (lcLic) ADDITIVE
ENDIF

lcLoad = ""
IF FILE(lcb+"PROGS\suite_full_unlock.fxp")
   lcLoad = lcb+"PROGS\suite_full_unlock.fxp"
ENDIF

IF EMPTY(lcLoad)
   IF FILE(lcb+"PROGS\suite_full_unlock.prg")
      lcSource = lcb+"PROGS\suite_full_unlock.prg"
   ELSE
      IF FILE(lcb+"suite_full_unlock.prg")
         lcSource = lcb+"suite_full_unlock.prg"
      ENDIF
   ENDIF
   IF EMPTY(lcSource)
      MESSAGEBOX("Falta suite_full_unlock en PROGS\", 16, "Suite sync")
      RETURN
   ENDIF
   lclocal = lcb+"PROGS\_suite_unlock_compile.prg"
   lcFxp = lcb+"PROGS\_suite_unlock_compile.fxp"
   STRTOFILE(FILETOSTR(lcSource), lclocal, .F.)
   IF FILE(lcFxp)
      ERASE (lcFxp)
   ENDIF
   lcSavErr = ON("ERROR")
   lcErr = ""
   ON ERROR lcErr = MESSAGE()
   COMPILE (lclocal)
   ON ERROR &lcSavErr
   IF FILE(lcFxp)
      lcLoad = lcFxp
   ELSE
      MESSAGEBOX("No se pudo compilar suite_full_unlock."+CHR(13)+lcErr, 16, "Suite sync")
      RETURN
   ENDIF
ENDIF

lcSavErr = ON("ERROR")
lcErr = ""
ON ERROR lcErr = ALLTRIM(STR(ERROR()))+": "+MESSAGE()
SET PROCEDURE TO (lcLoad) ADDITIVE
PUBLIC pcSuiteStyleRoot
pcSuiteStyleRoot = lcb
DO SuiteApplyFullUnlock
DO Suite_SyncInit
ON ERROR &lcSavErr

WAIT WINDOW NOWAIT "Sync OK (externo). Log: "+lcb+"Usuarios\_suite_sync.log"
