* Arranque v2 (config.fpw STARTUP): agente Node + watcher inbound antes del bootstrap embebido.
LOCAL lcRoot, lcCola, lcCtrl, lcBoot, lcAlert, lcSavErr, lcErr

lcRoot = ADDBS(SYS(5) + SYS(2003))

* Entorno test / sin modulo conta: persistir flags en EMPRESA.config antes del bootstrap embebido.
IF .NOT. FILE(lcRoot + "conta.exe") .AND. FILE(lcRoot + "empresa.dbf")
   LOCAL llEmpWasOpen, lcSavErr, lcErr
   llEmpWasOpen = USED("empresa")
   lcSavErr = ON("ERROR")
   lcErr = ""
   ON ERROR lcErr = MESSAGE()
   IF .NOT. llEmpWasOpen
      USE (lcRoot + "empresa.dbf") IN 0 ALIAS empresa SHARED
   ENDIF
   SELECT empresa
   IF .NOT. EMPTY(empresa.config)
      RESTORE FROM MEMO config ADDITIVE
   ENDIF
   cfgcontabilidaddunasoft = .F.
   cfgcontabilidad = .F.
   IF .NOT. FILE(lcRoot + "..\UTILIDADES\UTILIDADES.EXE") ;
      .AND. .NOT. FILE(lcRoot + "UTILIDADES\UTILIDADES.EXE")
      cfgvercopia = .F.
   ENDIF
   SAVE TO MEMO config ALL LIKE cfg*
   IF .NOT. llEmpWasOpen .AND. USED("empresa")
      USE IN empresa
   ENDIF
   ON ERROR &lcSavErr
ENDIF

* PROGS\funciones.prg tiene el hook Reservas_Incidencia -> SuiteEnqueuePlan2009 (v2).
* Debe cargarse antes del bootstrap embebido; si no, el exe antiguo no encola en cola_sincro.
IF FILE(lcRoot + "PROGS\funciones.prg")
   SET PROCEDURE TO (lcRoot + "PROGS\funciones.prg") ADDITIVE
ENDIF

lcLicense = lcRoot + "PROGS\suite_apply_license_unlock.prg"
IF FILE(lcLicense)
   SET PROCEDURE TO (lcLicense) ADDITIVE
ENDIF

IF TYPE("SuiteBootstrapLog")="U" AND FILE(lcRoot + "PROGS\general.prg")
   SET PROCEDURE TO (lcRoot + "PROGS\general.prg") ADDITIVE
ENDIF

* Agente Node (RUN /N) siempre al abrir Duna.exe con STARTUP.
lcBoot = lcRoot + "PROGS\suite_boot_sync.prg"
IF FILE(lcBoot)
   SET PROCEDURE TO (lcBoot) ADDITIVE
   IF TYPE("SuiteBootExternalSync") #"U"
      DO SuiteBootExternalSync
   ENDIF
ENDIF

lcAlert = lcRoot + "PROGS\suite_sync_pending_alert.prg"
IF FILE(lcAlert)
   SET PROCEDURE TO (lcAlert) ADDITIVE
   IF TYPE("plSuiteSyncEnabled")="L" AND plSuiteSyncEnabled
      IF TYPE("SuiteSyncPendingWatcherStart") #"U"
         DO SuiteSyncPendingWatcherStart
      ENDIF
   ENDIF
ENDIF

IF TYPE("SuiteEnqueuePlan2009")#"U"
   RETURN
ENDIF

lcCola = lcRoot + "PROGS\suite_cola_sync.prg"
lcCtrl = lcRoot + "PROGS\suite_control_sync.prg"
lcSavErr = ON("ERROR")
lcErr = ""

IF FILE(lcCtrl)
   ON ERROR lcErr = MESSAGE()
   SET PROCEDURE TO (lcCtrl) ADDITIVE
   ON ERROR &lcSavErr
   IF TYPE("SuiteEnsureControlSincro") #"U"
      DO SuiteEnsureControlSincro
   ENDIF
ENDIF

IF FILE(lcCola)
   lcErr = ""
   ON ERROR lcErr = MESSAGE()
   SET PROCEDURE TO (lcCola) ADDITIVE
   ON ERROR &lcSavErr
   IF TYPE("SuiteEnqueuePlan2009")#"U"
      IF TYPE("SuiteBootstrapLog")#"U"
         DO SuiteBootstrapLog WITH "[BOOT-06] suite_cola_sync desde STARTUP (v2 PROGS)"
      ENDIF
   ELSE
      IF TYPE("SuiteBootstrapLog")#"U"
         DO SuiteBootstrapLog WITH "[BOOT-06E] STARTUP v2 sin SuiteEnqueuePlan2009 "+lcErr
      ENDIF
   ENDIF
ENDIF
