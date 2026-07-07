* Wrapper raiz: Duna.exe hace DO ("SuiteBootExternalSync") y busca este .prg (no el PROCEDURE).
LOCAL lcRoot, lcPs1, lcCmd, lcSav
lcRoot = ""
IF TYPE("pcSuiteStyleRoot") = "C" AND .NOT. EMPTY(pcSuiteStyleRoot)
   lcRoot = ADDBS(pcSuiteStyleRoot)
ENDIF
IF EMPTY(lcRoot)
   lcRoot = ADDBS(GETENV("STYLE_HOME"))
ENDIF
IF EMPTY(lcRoot)
   lcRoot = ADDBS(SYS(5) + SYS(2003))
ENDIF
lcPs1 = lcRoot + "ensure-style-sync.ps1"
IF .NOT. FILE(lcPs1)
   lcPs1 = lcRoot + "PROGS\ensure-style-sync.ps1"
ENDIF
IF .NOT. FILE(lcPs1)
   IF TYPE("SuiteBootstrapLog") #"U"
      DO SuiteBootstrapLog WITH "[BOOT-SYNC] sin ensure-style-sync.ps1"
   ENDIF
   RETURN
ENDIF
lcCmd = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + lcPs1 + '" -StyleRoot "' + lcRoot + '" -EnsureAgent'
lcSav = ON("ERROR")
ON ERROR *
RUN /N &lcCmd
ON ERROR &lcSav
IF TYPE("SuiteBootstrapLog") #"U"
   DO SuiteBootstrapLog WITH "[BOOT-SYNC] EnsureAgent lanzado"
ENDIF
