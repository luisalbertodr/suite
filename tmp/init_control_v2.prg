* Asegurar control_sincro.modo = 2
PUBLIC pcSuiteStyleRoot
pcSuiteStyleRoot = SYS(2003) + "\"
SET DEFAULT TO (pcSuiteStyleRoot)
SET SAFETY OFF
SET PROCEDURE TO (pcSuiteStyleRoot + "PROGS\suite_control_sync.prg") ADDITIVE
DO SuiteEnsureControlSincro
IF USED("control_sincro")
   SELECT control_sincro
   REPLACE modo WITH "2", actualiz WITH DATETIME(), notas WITH "v2 cola+agente Suite"
   USE IN control_sincro
ENDIF
STRTOFILE("OK control_sincro modo=2 " + TTOC(DATETIME()) + CHR(13), pcSuiteStyleRoot + "sync\init_v2_dbf.log", .T.)
QUIT
