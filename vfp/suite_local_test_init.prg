* Inicializacion sync v2 en Style-Suite-Test (ejecutar una vez en VFP9).
*   DO C:\Duna\Style-Suite-Test\PROGS\suite_local_test_init.prg

LOCAL lcRoot, lcErr, lcSav, lcmsg
lcRoot = "C:\Duna\Style-Suite-Test\"
IF .NOT. DIRECTORY(JUSTPATH(lcRoot))
   MESSAGEBOX("No existe la carpeta:"+CHR(13)+lcRoot, 48, "Suite local test")
   RETURN
ENDIF
IF TYPE("pcSuiteStyleRoot")#"C"
   PUBLIC pcSuiteStyleRoot
ENDIF
pcSuiteStyleRoot = lcRoot
SET DEFAULT TO (lcRoot)
SET SAFETY OFF
SET ESCAPE OFF

lcSav = ON("ERROR")
lcErr = ""
ON ERROR lcErr = MESSAGE()

IF FILE(lcRoot + "PROGS\suite_control_sync.prg")
   SET PROCEDURE TO (lcRoot + "PROGS\suite_control_sync.prg") ADDITIVE
ENDIF
IF TYPE("SuiteEnsureControlSincro") #"U"
   DO SuiteEnsureControlSincro
ENDIF
IF FILE(lcRoot + "PROGS\suite_migrar_cola_sincro.prg") .AND. FILE(lcRoot + "cola_sincro.dbf")
   SET PROCEDURE TO (lcRoot + "PROGS\suite_migrar_cola_sincro.prg") ADDITIVE
   DO SuiteMigrarColaSincro
ENDIF

ON ERROR &lcSav

lcmsg = "Raiz: " + lcRoot + CHR(13)
IF TYPE("SuiteSyncModoActivo") #"U"
   lcmsg = lcmsg + "modo_activo: " + SuiteSyncModoActivo() + CHR(13)
ENDIF
lcmsg = lcmsg + CHR(13) + "Cierra VFP y arranca IniciarStyle.bat"
IF .NOT. EMPTY(lcErr)
   lcmsg = lcmsg + CHR(13) + CHR(13) + "AVISO: " + lcErr
ENDIF
IF TYPE("GETENV")="U" .OR. EMPTY(GETENV("SUITE_VFP_HEADLESS"))
   MESSAGEBOX(lcmsg, 64, "Suite local test init")
ELSE
   STRTOFILE(lcmsg + CHR(13), lcRoot + "Usuarios\_suite_local_init.log", .T.)
ENDIF
