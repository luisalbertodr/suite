* Precarga sync Suite antes del bootstrap embebido en Duna.exe (exe Z sin rebuild).
* Invocado desde config.fpw: COMMAND=DO PROGS\suite_preload_sync.prg
* Requiere STYLE_HOME (IniciarStyle.bat) o DEFAULT en config.fpw.
LOCAL lcRoot, lcPrg, lcSav, lcErr

lcRoot = ADDBS(GETENV("STYLE_HOME"))
IF EMPTY(lcRoot)
   lcRoot = ADDBS(SYS(5)+SYS(2003))
ENDIF
IF  .NOT. (FILE(lcRoot+"Duna.exe") OR FILE(lcRoot+"EMPRESA.DBF") OR FILE(lcRoot+"SuiteSync.cfg"))
   IF DIRECTORY("C:\Duna\Style-Suite-Test")
      lcRoot = "C:\Duna\Style-Suite-Test\"
   ENDIF
ENDIF

lcPrg = lcRoot+"PROGS\suite_full_unlock.prg"
IF  .NOT. FILE(lcPrg)
   lcPrg = lcRoot+"suite_full_unlock.prg"
ENDIF
IF  .NOT. FILE(lcPrg)
   RETURN
ENDIF

IF TYPE("Suite_SyncInit")#"U"
   RETURN
ENDIF

lcSav = ON("ERROR")
lcErr = ""
ON ERROR lcErr = MESSAGE()
SET PROCEDURE TO (lcPrg) ADDITIVE
ON ERROR &lcSav

LOCAL lclog, lcline
lclog = lcRoot+"Usuarios\_suite_sync.log"
IF  .NOT. DIRECTORY(lcRoot+"Usuarios")
   MD (lcRoot+"Usuarios")
ENDIF
lcline = TTOC(DATETIME())+" [PRELOAD] "
DO CASE
   CASE TYPE("Suite_SyncInit")#"U"
      lcline = lcline+"suite_full_unlock OK root="+lcRoot
   CASE  .NOT. EMPTY(lcErr)
      lcline = lcline+"ERROR "+lcErr+" prg="+lcPrg
   OTHERWISE
      lcline = lcline+"sin Suite_SyncInit prg="+lcPrg
ENDCASE
lcline = lcline+CHR(13)+CHR(10)
STRTOFILE(lcline, lclog, .T.)

IF TYPE("SuiteBootstrapLog")#"U" AND TYPE("Suite_SyncInit")#"U"
   DO SuiteBootstrapLog WITH "[PRELOAD] suite_full_unlock.prg OK root="+lcRoot
ENDIF
RETURN
