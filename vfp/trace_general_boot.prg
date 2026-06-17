* Simula el arranque de general.prg (lineas 58-80) con traza en cada paso.
SET SAFETY OFF
SET TALK OFF
SET ESCAPE OFF
LOCAL lcRoot, lcSavErr, llFail, lcErr, i, lcLib, laLibs(27)
lcRoot = "C:\Duna\Style-Suite-Test\"
IF .NOT. DIRECTORY(lcRoot+"Usuarios")
   MD (lcRoot+"Usuarios")
ENDIF
STRTOFILE("=== trace_general_boot "+TTOC(DATETIME())+" ==="+CHR(13)+CHR(10), lcRoot+"Usuarios\style_boot_trace.log", .F.)
SET PROCEDURE TO suite_boot_trace ADDITIVE
DO SuiteBootTrace WITH "[00] inicio trace_general_boot"
SET DEFAULT TO (lcRoot)
CD (lcRoot)
DO SuiteBootTrace WITH "[01] SET DEFAULT cwd="+SYS(5)+SYS(2003)
lcSavErr = ON("ERROR")
llFail = .F.
ON ERROR DO SuiteBootTraceErr WITH "ON ERROR"
* --- SuiteResolveStyleRoot (simplificado) ---
PUBLIC pcSuiteStyleRoot
pcSuiteStyleRoot = lcRoot
DO SuiteBootTrace WITH "[02] pcSuiteStyleRoot="+pcSuiteStyleRoot
* --- PATH ---
SET PATH TO (lcRoot) ADDITIVE
SET PATH TO (lcRoot+"PROGS") ADDITIVE
SET PATH TO (lcRoot+"vcx") ADDITIVE
DO SuiteBootTrace WITH "[03] PATH configurado"
* --- SET PROCEDURE (linea 68 general) ---
LOCAL laProc(5)
laProc(1) = "funciones"
laProc(2) = "clases"
laProc(3) = "seguridad"
laProc(4) = "FoxyPreviewer"
laProc(5) = "qdfoxJSON"
FOR i = 1 TO ALEN(laProc)
   lcErr = ""
   ON ERROR lcErr = MESSAGE()
   SET PROCEDURE TO (laProc(i)) ADDITIVE
   ON ERROR &lcSavErr
   IF .NOT. EMPTY(lcErr)
      DO SuiteBootTrace WITH "[04-FAIL] SET PROCEDURE TO "+laProc(i), lcErr
      ON ERROR &lcSavErr
      QUIT
   ENDIF
   DO SuiteBootTrace WITH "[04] SET PROCEDURE TO "+laProc(i)+" OK"
ENDFOR
PUBLIC pcidioma, pcpais, pcversionpais
pcidioma = "CA"
pcpais = "ESP"
pcversionpais = "ESP"
DO SuiteBootTrace WITH "[05] PUBLIC pcidioma OK"
* --- SET CLASSLIB bloque 1 (linea 74) ---
laLibs(1) = "pellib.VCX"
laLibs(2) = "msoexp.vcx"
laLibs(3) = "enviadoc.vcx"
laLibs(4) = "agenda.vcx"
laLibs(5) = "tactil.vcx"
laLibs(6) = "seguridad.vcx"
laLibs(7) = "factura.vcx"
laLibs(8) = "planificador.vcx"
laLibs(9) = "_datetime.vcx"
laLibs(10) = "bar.vcx"
laLibs(11) = "screen.vcx"
laLibs(12) = "http.vcx"
laLibs(13) = "CONTA.VCX"
laLibs(14) = "vfpcalendartactil.vcx"
laLibs(15) = "remesas.vcx"
laLibs(16) = "licencias.vcx"
laLibs(17) = "foxcharts.vcx"
laLibs(18) = "gdiplusx.vcx"
laLibs(19) = "graficos.vcx"
laLibs(20) = "plan2009.vcx"
laLibs(21) = "plan2009r.vcx"
laLibs(22) = "vfpcalendar.vcx"
laLibs(23) = "FoxDraw.vcx"
laLibs(24) = "pr_htmledit.vcx"
laLibs(25) = "tiendaonline.vcx"
FOR i = 1 TO ALEN(laLibs)
   lcErr = ""
   ON ERROR lcErr = MESSAGE()
   SET CLASSLIB TO (laLibs(i)) ADDITIVE
   ON ERROR &lcSavErr
   IF .NOT. EMPTY(lcErr)
      DO SuiteBootTrace WITH "[06-FAIL] CLASSLIB "+laLibs(i), lcErr
      QUIT
   ENDIF
   DO SuiteBootTrace WITH "[06] CLASSLIB "+laLibs(i)+" OK"
ENDFOR
SET REPROCESS TO 6
DO SuiteBootTrace WITH "[07] SET REPROCESS TO 6 OK"
FOR i = 1 TO 2
   lcLib = IIF(i=1, "screen_nueva", "tickets_nuevo")
   lcErr = ""
   ON ERROR lcErr = MESSAGE()
   SET CLASSLIB TO (lcLib) ADDITIVE
   ON ERROR &lcSavErr
   IF .NOT. EMPTY(lcErr)
      DO SuiteBootTrace WITH "[08-FAIL] CLASSLIB "+lcLib, lcErr
      QUIT
   ENDIF
   DO SuiteBootTrace WITH "[08] CLASSLIB "+lcLib+" OK"
ENDFOR
* --- unlock load (lineas 79-82) ---
DO SuiteBootTrace WITH "[09] antes SuiteLoadUnlockFromFunciones"
IF TYPE("SuiteLoadUnlockFromFunciones")#"U"
   = SuiteLoadUnlockFromFunciones(lcRoot)
   DO SuiteBootTrace WITH "[10] SuiteLoadUnlockFromFunciones SyncInit="+IIF(TYPE("Suite_SyncInit")="U","NO","SI")
ELSE
   DO SuiteBootTrace WITH "[10-FAIL] SuiteLoadUnlockFromFunciones no definido"
ENDIF
* --- objetos criticos ---
LOCAL lo
lcErr = ""
ON ERROR lcErr = MESSAGE()
IF TYPE("SuiteSafeCreateObject")#"U"
   lo = SuiteSafeCreateObject("usuario", lcRoot+"vcx\seguridad.vcx")
ELSE
   lo = CREATEOBJECT("usuario")
ENDIF
ON ERROR &lcSavErr
IF VARTYPE(lo)#"O"
   DO SuiteBootTrace WITH "[11-FAIL] CREATEOBJECT usuario", lcErr
ELSE
   DO SuiteBootTrace WITH "[11] usuario OK"
ENDIF
lcErr = ""
ON ERROR lcErr = MESSAGE()
IF TYPE("SuiteSafeCreateObject")#"U"
   lo = SuiteSafeCreateObject("licencias", lcRoot+"vcx\licencias.vcx")
ELSE
   lo = CREATEOBJECT("licencias")
ENDIF
ON ERROR &lcSavErr
IF VARTYPE(lo)#"O"
   DO SuiteBootTrace WITH "[12-FAIL] CREATEOBJECT licencias", lcErr
ELSE
   DO SuiteBootTrace WITH "[12] licencias OK"
ENDIF
lcErr = ""
ON ERROR lcErr = MESSAGE()
SET PROCEDURE TO (lcRoot+"PROGS\suite_full_unlock.prg") ADDITIVE
ON ERROR &lcSavErr
IF .NOT. EMPTY(lcErr)
   DO SuiteBootTrace WITH "[13-FAIL] LOAD suite_full_unlock.prg", lcErr
ELSE
   DO SuiteBootTrace WITH "[13] suite_full_unlock.prg SyncInit="+IIF(TYPE("Suite_SyncInit")="U","NO","SI")
ENDIF
IF TYPE("Suite_SyncInit")#"U"
   lcErr = ""
   ON ERROR lcErr = MESSAGE()
   _SCREEN.AddObject("oTestSuiteSyncTimer", "SuiteSyncTimer")
   ON ERROR &lcSavErr
   IF .NOT. EMPTY(lcErr)
      DO SuiteBootTrace WITH "[14-FAIL] AddObject SuiteSyncTimer", lcErr
   ELSE
      DO SuiteBootTrace WITH "[14] SuiteSyncTimer OK"
      _SCREEN.oTestSuiteSyncTimer.Release()
   ENDIF
ENDIF
DO SuiteBootTrace WITH "[99] trace_general_boot FIN OK"
ON ERROR &lcSavErr
QUIT
