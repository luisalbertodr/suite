* Stubs para Build VFP del export ReFox (UDFs no extraidas del exe original).
* Solo compilacion; en runtime el exe original tiene las implementaciones reales.

PUBLIC laarrayclientesok, laarrayarticulosok, laarrayregistrosok, laarraycontactosok
DIMENSION laarrayclientesok(1), laarrayarticulosok(1), laarrayregistrosok(1), laarraycontactosok(1)
STORE .F. TO laarrayclientesok(1), laarrayarticulosok(1), laarrayregistrosok(1), laarraycontactosok(1)

FUNCTION _messagebox_android
 PARAMETER tcmsg, tnicon, tctitle
 RETURN MESSAGEBOX(tcmsg, tnicon, tctitle)
ENDFUNC

FUNCTION damemargen
 PARAMETER pncant, pncoste, pnsubtot
 LOCAL lnmargen
 IF pnsubtot = 0
    RETURN 0
 ENDIF
 lnmargen = (pnsubtot - (pncoste * pncant)) / pnsubtot * 100
 RETURN ROUND(lnmargen, 2)
ENDFUNC

* --- Stubs enlace build v2 (sin suite_full_unlock.prg en el proyecto) ---
PROCEDURE SuiteEnsureGlobals
 IF TYPE("pcidioma")#"C"
    PUBLIC pcidioma, pcpais, pcversionpais
    pcidioma = "CA"
    pcpais = "ESP"
    pcversionpais = "ESP"
 ENDIF
ENDPROC

PROCEDURE SuiteShutdown
ENDPROC

PROCEDURE SuiteApplyFullUnlock
 DO SuiteEnsureGlobals
ENDPROC

FUNCTION SuiteSyncEnsureLoaded
 RETURN (TYPE("Suite_SyncInit")#"U")
ENDFUNC

PROCEDURE SuiteEnsureSyncGlobals
ENDPROC

FUNCTION SuiteCreateHttp
 RETURN .NULL.
ENDFUNC

PROCEDURE Suite_SyncStopTimer
ENDPROC

FUNCTION SuiteStyleRoot
 RETURN ADDBS(IIF(TYPE("pcSuiteStyleRoot")="C" .AND. .NOT. EMPTY(pcSuiteStyleRoot), pcSuiteStyleRoot, SYS(5)+SYS(2003)))
ENDFUNC

PROCEDURE Suite_SyncPushDelete
ENDPROC

PROCEDURE Suite_SyncAfterIncidencia
ENDPROC

FUNCTION enviaremailpresupuesto
 PARAMETER tcnumpre, tcemail, tcmsgretorno
 RETURN .T.
ENDFUNC

FUNCTION calsaldo
 PARAMETER pntipo, pnmes
 RETURN 0
ENDFUNC
