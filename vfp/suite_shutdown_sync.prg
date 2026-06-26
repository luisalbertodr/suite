* Drenaje inbound al cerrar Style (wedb libre tras QUIT).
PROCEDURE SuiteShutdownInboundDrain
 LOCAL lcRoot, lcPs1, lcCmd, lcSav

 lcRoot = IIF(TYPE("pcSuiteStyleRoot")="C" AND .NOT. EMPTY(pcSuiteStyleRoot), ADDBS(pcSuiteStyleRoot), ADDBS(SYS(5)+SYS(2003)))
 lcPs1 = lcRoot + "ensure-style-sync.ps1"
 IF .NOT. FILE(lcPs1)
    lcPs1 = lcRoot + "PROGS\ensure-style-sync.ps1"
 ENDIF
 IF .NOT. FILE(lcPs1)
    RETURN
 ENDIF

 lcCmd = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + lcPs1 + '" -StyleRoot "' + lcRoot + '" -DrainInboundAfterShutdown'
 lcSav = ON("ERROR")
 ON ERROR *
 RUN /N &lcCmd
 ON ERROR &lcSav
ENDPROC
