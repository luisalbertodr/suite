* Backfill outbound v2: encola todas las citas activas de plan2009 en cola_sincro.
* Uso (una vez):
*   SET DEFAULT TO C:\Duna\Style-Suite-Test
*   DO PROGS\suite_bulk_enqueue.prg
*
* Requiere suite_cola_sync embebido en Duna.exe o SET PROCEDURE TO suite_cola_sync.prg.

LOCAL lcRoot, lcSav, lcErr, lnCount, lnSkip, ldMin, lcMinDate
LOCAL llSkipFacturado, llOnlyFuture

lcRoot = ""
IF TYPE("pcSuiteStyleRoot") = "C" .AND. .NOT. EMPTY(pcSuiteStyleRoot)
   lcRoot = ADDBS(pcSuiteStyleRoot)
ENDIF
IF EMPTY(lcRoot)
   lcRoot = ADDBS(SYS(5) + SYS(2003))
ENDIF

SET DEFAULT TO (lcRoot)
SET SAFETY OFF
SET ESCAPE OFF

* Parametros opcionales via entorno:
*   SUITE_BULK_FROM_DATE=2026-01-01  (solo citas >= fecha)
*   SUITE_BULK_SKIP_FACTURADO=1      (omitir facturado=.T., default 1)
lcMinDate = ALLTRIM(GETENV("SUITE_BULK_FROM_DATE"))
ldMin = {}
IF  .NOT. EMPTY(lcMinDate) .AND. LEN(lcMinDate) >= 10
   ldMin = DATE(VAL(LEFT(lcMinDate, 4)), VAL(SUBSTR(lcMinDate, 6, 2)), VAL(SUBSTR(lcMinDate, 9, 2)))
ENDIF
llSkipFacturado = (UPPER(ALLTRIM(GETENV("SUITE_BULK_SKIP_FACTURADO"))) # "0")

lcSav = ON("ERROR")
lcErr = ""
ON ERROR lcErr = MESSAGE()

IF TYPE("SuiteEnqueuePlan2009") = "U"
   IF FILE(lcRoot + "PROGS\suite_cola_sync.prg")
      SET PROCEDURE TO (lcRoot + "PROGS\suite_cola_sync.prg") ADDITIVE
   ENDIF
ENDIF
IF FILE(lcRoot + "PROGS\suite_control_sync.prg")
   SET PROCEDURE TO (lcRoot + "PROGS\suite_control_sync.prg") ADDITIVE
ENDIF
IF TYPE("SuiteEnsureControlSincro") # "U"
   DO SuiteEnsureControlSincro
ENDIF
IF TYPE("SuiteEnqueuePlan2009") = "U"
   ON ERROR &lcSav
   MESSAGEBOX("SuiteEnqueuePlan2009 no disponible. Arranca Style v2 o compila general.prg.", 16, "Bulk enqueue")
   RETURN
ENDIF

IF  .NOT. USED("plan2009")
   IF FILE(lcRoot + "dbf\plan2009.dbf")
      LOCAL lcDbfRoot, lcSavDbc
      lcDbfRoot = lcRoot + "dbf\"
      IF FILE(lcDbfRoot + "wedb.dbc")
         lcSavDbc = ON("ERROR")
         ON ERROR *
         TRY
            IF  .NOT. DBUSED()
               OPEN DATABASE (lcDbfRoot + "wedb") SHARED
            ENDIF
         CATCH
         ENDTRY
         ON ERROR &lcSavDbc
      ENDIF
      USE SHARED (lcRoot + "dbf\plan2009") ALIAS plan2009 IN 0
   ELSE
      ON ERROR &lcSav
      MESSAGEBOX("No existe dbf\plan2009.dbf en " + lcRoot, 16, "Bulk enqueue")
      RETURN
   ENDIF
ENDIF

lnCount = 0
lnSkip = 0
SELECT plan2009
SCAN FOR .NOT. DELETED()
   IF llSkipFacturado .AND. TYPE("plan2009.facturado") = "L" .AND. plan2009.facturado
      lnSkip = lnSkip + 1
      LOOP
   ENDIF
   IF  .NOT. EMPTY(ldMin) .AND. TYPE("plan2009.fecha") = "D" .AND. plan2009.fecha < ldMin
      lnSkip = lnSkip + 1
      LOOP
   ENDIF
   IF TYPE("plan2009.idplan") # "N" .AND. TYPE("plan2009.idplan") # "I"
      LOOP
   ENDIF
   IF NVL(plan2009.idplan, 0) <= 0
      LOOP
   ENDIF
   IF plan2009.idplan = 999999992
      lnSkip = lnSkip + 1
      LOOP
   ENDIF
   = SuiteEnqueuePlan2009(plan2009.idplan, "UPD")
   lnCount = lnCount + 1
ENDSCAN

ON ERROR &lcSav
lcLog = lcRoot + "Usuarios\_suite_bulk_enqueue.log"
STRTOFILE(TTOC(DATETIME()) + " encoladas=" + ALLTRIM(STR(lnCount)) + " omitidas=" + ALLTRIM(STR(lnSkip)) + CHR(13), lcLog, .T.)
IF TYPE("GETENV") = "U" .OR. EMPTY(GETENV("SUITE_VFP_HEADLESS"))
   MESSAGEBOX("Bulk enqueue OK" + CHR(13) + "Encoladas: " + ALLTRIM(STR(lnCount)) + CHR(13) + "Omitidas: " + ALLTRIM(STR(lnSkip)), 64, "Suite bulk enqueue")
ENDIF
