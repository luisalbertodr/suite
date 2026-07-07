* Crear cola_sincro.dbf vacia (esquema v2) si no existe.
PUBLIC pcSuiteStyleRoot
pcSuiteStyleRoot = SYS(2003) + "\"
SET DEFAULT TO (pcSuiteStyleRoot)
SET SAFETY OFF
SET PROCEDURE TO (pcSuiteStyleRoot + "PROGS\suite_cola_sync.prg") ADDITIVE
DO SuiteEnsureColaSincro
IF USED("cola_sincro")
   SELECT cola_sincro
   ZAP
   USE IN cola_sincro
ENDIF
STRTOFILE("OK cola_sincro " + TTOC(DATETIME()) + CHR(13), pcSuiteStyleRoot + "sync\init_v2_dbf.log", .T.)
QUIT
