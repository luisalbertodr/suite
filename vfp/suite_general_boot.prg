* OBSOLETO: contenido inlined al inicio de general.prg (VFP PM no enlaza #INCLUDE de este archivo).
* Mantener solo como referencia; editar general.prg directamente.

#INCLUDE suite_control_sync.prg
#INCLUDE suite_cola_sync.prg

PROCEDURE SuiteEnsureGlobals
 IF TYPE("pcidioma")#"C"
    PUBLIC pcidioma, pcpais, pcversionpais
    pcidioma = "CA"
    pcpais = "ESP"
    pcversionpais = "ESP"
 ENDIF
ENDPROC

PROCEDURE SuiteApplyFullUnlock
 DO SuiteEnsureGlobals
ENDPROC

FUNCTION SuiteSyncEnsureLoaded
 RETURN (TYPE("Suite_SyncInit")#"U")
ENDFUNC

PROCEDURE SuiteEnsureSyncGlobals
ENDPROC

**
PROCEDURE SuiteBootstrapLog
 PARAMETER tcmsg
 LOCAL lcf, lcb, lcline
 lcb = IIF(TYPE("pcSuiteStyleRoot")="C" .AND. .NOT. EMPTY(pcSuiteStyleRoot), ADDBS(pcSuiteStyleRoot), ADDBS(SYS(5)+SYS(2003)))
 IF  .NOT. DIRECTORY(lcb+"Usuarios")
    MD (lcb+"Usuarios")
 ENDIF
 lcf = lcb+"Usuarios\_suite_sync.log"
 lcline = TTOC(DATETIME())+" "+ALLTRIM(tcmsg)+CHR(13)+CHR(10)
 STRTOFILE(lcline, lcf, .T.)
ENDPROC
**
FUNCTION SuiteLoadColaSyncRuntime
 PARAMETER tcStyleRoot
 LOCAL lcPrg
 IF TYPE("SuiteEnqueuePlan2009")#"U" AND TYPE("Suite_SyncInit")#"U"
    RETURN .T.
 ENDIF
 IF TYPE("SuiteEnqueuePlan2009")#"U" OR TYPE("Suite_SyncInit")#"U"
    IF TYPE("SuiteBootstrapLog")#"U"
       DO SuiteBootstrapLog WITH "[BOOT-04] suite_cola_sync embebido en general OK"
    ENDIF
    RETURN .T.
 ENDIF
 IF TYPE("tcStyleRoot")="C" .AND. .NOT. EMPTY(tcStyleRoot)
    tcStyleRoot = ADDBS(tcStyleRoot)
 ELSE
    tcStyleRoot = ADDBS(SYS(5)+SYS(2003))
 ENDIF
 lcPrg = tcStyleRoot+"PROGS\suite_cola_sync.prg"
 IF TYPE("SuiteBootstrapLog")#"U"
    DO SuiteBootstrapLog WITH "[BOOT-06E] sync v2 no en general - COMPILE PROGS\general.prg y BUILD EXE RECOMPILE"+ ;
       IIF(FILE(lcPrg), "", " (falta "+lcPrg+")")
 ENDIF
 RETURN .F.
ENDFUNC
**
PROCEDURE SuiteLoadUnlockProgram
 PARAMETER tcStyleRoot
 LOCAL lcSavErr, llEmbProc, lcerr
 IF TYPE("SuiteApplyFullUnlock")#"U" AND TYPE("Suite_SyncInit")#"U"
    DO SuiteBootstrapLog WITH "[BOOT-03] unlock ya cargado (Suite_SyncInit OK)"
    RETURN
 ENDIF
 IF TYPE("SuiteEnsureGlobals")#"U"
    DO SuiteEnsureGlobals
 ELSE
    IF TYPE("pcidioma")#"C"
       PUBLIC pcidioma, pcpais, pcversionpais
       pcidioma = "CA"
       pcpais = "ESP"
       pcversionpais = "ESP"
    ENDIF
 ENDIF
 * v2: cola local antes del canal HTTP legacy (suite_full_unlock).
 IF TYPE("SuiteEnqueuePlan2009")="U"
    IF SuiteLoadColaSyncRuntime(tcStyleRoot)
       RETURN
    ENDIF
 ENDIF
 * v1 legacy: solo si existe suite_full_unlock.prg en disco (no en proyecto v2).
 LOCAL lcPrg, llPrg
 lcPrg = tcStyleRoot+"PROGS\suite_full_unlock.prg"
 IF  .NOT. FILE(lcPrg)
    lcPrg = tcStyleRoot+"suite_full_unlock.prg"
 ENDIF
 IF FILE(lcPrg)
    lcSavErr = ON("ERROR")
    lcerr = ""
    ON ERROR lcerr = MESSAGE()
    SET PROCEDURE TO (lcPrg) ADDITIVE
    llPrg = (TYPE("Suite_SyncInit")#"U")
    ON ERROR &lcSavErr
    IF llPrg
       DO SuiteBootstrapLog WITH "[BOOT-06] OK desde "+lcPrg
       RETURN
    ENDIF
    IF  .NOT. EMPTY(lcerr)
       DO SuiteBootstrapLog WITH "[BOOT-06E] "+lcPrg+" "+lcerr
    ENDIF
 ENDIF
 DO SuiteBootstrapLog WITH "[BOOT-07] FALLO: falta PROGS\suite_cola_sync.prg (v2) o suite_full_unlock (v1)"
ENDPROC
**
PROCEDURE SuiteStartSyncIfReady
 LOCAL lcRoot, lccfg
 lcRoot = IIF(TYPE("pcSuiteStyleRoot")="C" .AND. .NOT. EMPTY(pcSuiteStyleRoot), ADDBS(pcSuiteStyleRoot), ADDBS(SYS(5)+SYS(2003)))
 DO SuiteBootstrapLog WITH "[BOOT-01] SuiteStartSyncIfReady root="+lcRoot+" cwd="+SYS(5)+SYS(2003)
 = SuiteLoadColaSyncRuntime(lcRoot)
 IF TYPE("SuiteApplyFullUnlock")#"U"
    DO SuiteApplyFullUnlock
    DO SuiteBootstrapLog WITH "[BOOT-02] SuiteApplyFullUnlock ejecutado"
 ELSE
    DO SuiteBootstrapLog WITH "[BOOT-02] SuiteApplyFullUnlock NO disponible"
 ENDIF
 IF TYPE("Suite_SyncInit")="U"
    IF TYPE("SuiteLoadUnlockFromFunciones")#"U"
       = SuiteLoadUnlockFromFunciones(lcRoot)
    ENDIF
    IF TYPE("Suite_SyncInit")="U"
       DO SuiteLoadUnlockProgram WITH lcRoot
    ENDIF
 ENDIF
 IF TYPE("SuiteSyncEnsureLoaded")#"U"
    = SuiteSyncEnsureLoaded()
 ENDIF
 IF TYPE("Suite_SyncInit")="U"
    DO SuiteBootstrapLog WITH "[BOOT-07] FALLO: sync no cargada - falta suite_cola_sync en exe o PROGS\"
    RETURN
 ENDIF
 lccfg = lcRoot+"SuiteSync.cfg"
 IF  .NOT. FILE(lccfg)
    lccfg = ADDBS(SYS(5)+SYS(2003))+"SuiteSync.cfg"
 ENDIF
 IF  .NOT. FILE(lccfg)
    DO SuiteBootstrapLog WITH "[INIT-02] FALLO: no existe SuiteSync.cfg en "+lcRoot+" ni cwd"
    RETURN
 ENDIF
 IF TYPE("plSuiteSyncEnabled")="L" AND plSuiteSyncEnabled
    DO SuiteBootstrapLog WITH "[BOOT-08] sync ya activa (plSuiteSyncEnabled=.T.)"
    RETURN
 ENDIF
 DO SuiteBootstrapLog WITH "[BOOT-09] llamando Suite_SyncInit cfg="+lccfg
 IF TYPE("Suite_SyncInit")#"U"
    DO Suite_SyncInit
 ENDIF
ENDPROC
**
FUNCTION SuiteUnlockLibPath
 PARAMETER tcStyleRoot
 LOCAL lcPrg
 * Embebido en exe: no pasar nombre suelto a NEWOBJECT (provoca error 1732)
 IF TYPE("SuiteApplyFullUnlock")#"U"
    RETURN ""
 ENDIF
 IF TYPE("Suite_SyncInit")="U" AND TYPE("SuiteApplyFullUnlock")="U"
    RETURN ""
 ENDIF
 lcPrg = tcStyleRoot+"PROGS\suite_full_unlock.prg"
 IF FILE(lcPrg)
    RETURN lcPrg
 ENDIF
 lcPrg = tcStyleRoot+"suite_full_unlock.prg"
 IF FILE(lcPrg)
    RETURN lcPrg
 ENDIF
 RETURN ""
ENDFUNC
**
FUNCTION SuiteSafeCreateObject
 * CREATEOBJECT sin dialogo VFP nativo (ON ERROR vacio dispara "Error del programa").
 PARAMETER tcClass, tcClassLib
 LOCAL lo, lcSav, llFail
 lo = .NULL.
 llFail = .F.
 lcSav = ON("ERROR")
 ON ERROR llFail = .T.
 IF TYPE("tcClassLib")="C" AND .NOT. EMPTY(tcClassLib) AND FILE(tcClassLib)
    SET CLASSLIB TO (tcClassLib) ADDITIVE
 ENDIF
 lo = CREATEOBJECT(tcClass)
 ON ERROR &lcSav
 IF llFail OR VARTYPE(lo)#"O"
    IF TYPE("SuiteBootstrapLog")#"U"
       DO SuiteBootstrapLog WITH "[BOOT-CLS] "+tcClass+" err="+ALLTRIM(STR(ERROR()))+" "+MESSAGE()
    ENDIF
    lo = .NULL.
 ENDIF
 RETURN lo
ENDFUNC
**
FUNCTION SuiteIsStyleRoot
 PARAMETER tcRoot
 IF EMPTY(tcRoot)
    RETURN .F.
 ENDIF
 tcRoot = ADDBS(tcRoot)
 RETURN FILE(tcRoot+"EMPRESA.DBF") OR FILE(tcRoot+"duna.exe") OR FILE(tcRoot+"Duna.exe") OR FILE(tcRoot+"mscomctl.exe") OR FILE(tcRoot+"style.exe") OR FILE(tcRoot+"SuiteSync.cfg") OR FILE(tcRoot+"dbf\wedb.dbc")
ENDFUNC
**
FUNCTION SuiteResolveStyleRoot
 LOCAL lcRoot
 lcRoot = ""
 IF  .NOT. EMPTY(SYS(16))
    lcRoot = ADDBS(JUSTPATH(FULLPATH(SYS(16))))
 ENDIF
 IF  .NOT. SuiteIsStyleRoot(lcRoot)
    IF  .NOT. EMPTY(GETENV("STYLE_HOME")) AND DIRECTORY(GETENV("STYLE_HOME"))
       lcRoot = ADDBS(GETENV("STYLE_HOME"))
    ENDIF
 ENDIF
 IF  .NOT. SuiteIsStyleRoot(lcRoot)
    lcRoot = ADDBS(SYS(5)+SYS(2003))
 ENDIF
 IF  .NOT. SuiteIsStyleRoot(lcRoot)
    IF DIRECTORY("C:\Style-Dunasoft\")
       lcRoot = "C:\Style-Dunasoft\"
    ENDIF
 ENDIF
 IF  .NOT. SuiteIsStyleRoot(lcRoot)
    IF DIRECTORY("Z:\Style-Dunasoft\")
       lcRoot = "Z:\Style-Dunasoft\"
    ENDIF
 ENDIF
 IF EMPTY(lcRoot)
    lcRoot = ADDBS(SYS(5)+SYS(2003))
 ENDIF
 RETURN lcRoot
ENDFUNC
**
FUNCTION SuiteIsDatabaseOpen
 * DBC() en IF directo puede dar error 9 (tipos) segun estado del contenedor.
 LOCAL lcSav, lcName
 lcName = ""
 lcSav = ON("ERROR")
 ON ERROR lcName = ""
 lcName = DBC()
 ON ERROR &lcSav
 RETURN (TYPE("lcName")="C" .AND. .NOT. EMPTY(lcName))
ENDFUNC
**
PROCEDURE SuiteApplyStyleEnvironment
 PARAMETER tcStyleRoot
 LOCAL lcDbfRoot, lcSavDbc
 PUBLIC pcSuiteStyleRoot
 pcSuiteStyleRoot = ADDBS(tcStyleRoot)
 lcDbfRoot = pcSuiteStyleRoot+"dbf\"
 * Abrir wedb desde dbf\ (como al elegir dbf\wedb en el dialogo). NO enlazar wedb.dbc en raiz:
 * si wedb se abre desde raiz, VFP busca USUARIOS.DBF en raiz y falla (error 2005).
 = SuiteRemoveRootWedbLinks(pcSuiteStyleRoot, lcDbfRoot)
 SET DEFAULT TO (pcSuiteStyleRoot)
 CD (pcSuiteStyleRoot)
 IF DIRECTORY(lcDbfRoot)
    SET PATH TO (lcDbfRoot) ADDITIVE
 ENDIF
 IF DIRECTORY(lcDbfRoot) AND FILE(lcDbfRoot+"wedb.dbc")
    lcSavDbc = ON("ERROR")
    ON ERROR *
    IF  .NOT. SuiteIsDatabaseOpen()
       OPEN DATABASE (lcDbfRoot+"wedb") SHARED
    ENDIF
    ON ERROR &lcSavDbc
 ENDIF
 IF  .NOT. DIRECTORY(pcSuiteStyleRoot+"Usuarios")
    MD (pcSuiteStyleRoot+"Usuarios")
 ENDIF
ENDPROC
**
FUNCTION SuiteRemoveRootWedbLinks
 * Quita wedb.* en raiz si dbf\wedb existe (enlace duro previo rompe rutas de tablas).
 PARAMETER tcRoot, tcDbfRoot
 LOCAL lcSav, lnI, lcName, lcRootFile
 IF EMPTY(tcRoot) OR  .NOT. FILE(ADDBS(tcDbfRoot)+"wedb.dbc")
    RETURN .F.
 ENDIF
 tcRoot = ADDBS(tcRoot)
 lcSav = ON("ERROR")
 ON ERROR *
 FOR lnI = 1 TO 3
    lcName = IIF(lnI=1, "wedb.dbc", IIF(lnI=2, "WEDB.DCT", "WEDB.DCX"))
    lcRootFile = tcRoot+lcName
    IF FILE(lcRootFile)
       DELETE FILE (lcRootFile)
    ENDIF
 ENDFOR
 ON ERROR &lcSav
 RETURN .T.
ENDFUNC
**
FUNCTION SuiteEnsureDatabaseOpen
 LOCAL lcDbfRoot, lcSavDbc
 IF TYPE("pcSuiteStyleRoot")#"C" OR EMPTY(pcSuiteStyleRoot)
    RETURN .F.
 ENDIF
 lcDbfRoot = ADDBS(pcSuiteStyleRoot)+"dbf\"
 IF  .NOT. FILE(lcDbfRoot+"wedb.dbc")
    RETURN .F.
 ENDIF
 IF SuiteIsDatabaseOpen()
    RETURN .T.
 ENDIF
 lcSavDbc = ON("ERROR")
 ON ERROR *
 OPEN DATABASE (lcDbfRoot+"wedb") SHARED
 ON ERROR &lcSavDbc
 RETURN SuiteIsDatabaseOpen()
ENDFUNC
