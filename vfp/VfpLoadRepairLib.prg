* Funciones bootstrap + carga suite_repair_lib.fxp (sin SET PROCEDURE TO .prg).
* Uso:
*   DO PROGS\VfpLoadRepairLib.prg
*   = VfpLoadRepairLib(lcProgs)

FUNCTION VfpExportRootFromProgs
 PARAMETER tcProgs
 LOCAL lc
 lc = ADDBS(NVL(tcProgs, ""))
 IF RIGHT(LOWER(lc), 6) = "progs\"
    RETURN ADDBS(LEFT(lc, LEN(lc)-6))
 ENDIF
 RETURN VfpBootstrapExportRoot(tcProgs)
ENDFUNC

FUNCTION VfpBootstrapExportRoot
 PARAMETER tcProgs
 LOCAL lcroot, lcparent, lnI
 lcroot = ADDBS(NVL(tcProgs, ""))
 IF RIGHT(LOWER(lcroot), 6) = "progs\"
    lcroot = ADDBS(LEFT(lcroot, LEN(lcroot)-6))
 ENDIF
 IF EMPTY(lcroot)
    lcroot = ADDBS(SYS(5)+SYS(2003))
 ENDIF
 FOR lnI = 1 TO 6
    IF FILE(lcroot + "mscomctlok.pjx") OR FILE(lcroot + "mscomctlOk.pjx") OR ;
       FILE(lcroot + "mscomctl.pjx") OR FILE(lcroot + "suite_project.cfg")
       RETURN lcroot
    ENDIF
    lcparent = ADDBS(JUSTPATH(LEFT(lcroot, LEN(lcroot)-1)))
    IF EMPTY(lcparent) OR LOWER(lcparent) = LOWER(lcroot)
       EXIT
    ENDIF
    lcroot = lcparent
 ENDFOR
 RETURN lcroot
ENDFUNC

FUNCTION VfpBootstrapProjectStem
 PARAMETER lcroot
 LOCAL lcstem, lccfg, lnN, lnI
 LOCAL ARRAY laPjx[1]
 lcroot = ADDBS(NVL(lcroot, ""))
 lccfg = lcroot + "suite_project.cfg"
 IF FILE(lccfg)
    lcstem = ALLTRIM(STRTRAN(FILETOSTR(lccfg), CHR(13)+CHR(10), ""))
    IF .NOT. EMPTY(lcstem)
       RETURN JUSTSTEM(lcstem)
    ENDIF
 ENDIF
 lnN = ADIR(laPjx, lcroot + "mscomctl*.pjx")
 FOR lnI = 1 TO lnN
    IF .NOT. EMPTY(laPjx(lnI, 1))
       RETURN JUSTSTEM(laPjx(lnI, 1))
    ENDIF
 ENDFOR
 RETURN "mscomctlOk"
ENDFUNC

FUNCTION VfpLoadRepairLib
 PARAMETER tcProgs
 LOCAL lcSav, lcPrg, lcFxp, lcErr, llOk
 IF EMPTY(tcProgs)
    RETURN .F.
 ENDIF
 tcProgs = ADDBS(tcProgs)
 lcPrg = tcProgs + "suite_repair_lib.prg"
 lcFxp = tcProgs + "suite_repair_lib.fxp"
 IF .NOT. FILE(lcPrg)
    RETURN .F.
 ENDIF
 lcSav = ON("ERROR")
 ON ERROR *
 IF FILE(lcFxp)
    ERASE (lcFxp)
 ENDIF
 IF FILE(tcProgs + "suite_repair_lib.FXP")
    ERASE (tcProgs + "suite_repair_lib.FXP")
 ENDIF
 ON ERROR &lcSav
 lcErr = ""
 ON ERROR lcErr = MESSAGE()
 COMPILE (lcPrg)
 ON ERROR &lcSav
 IF .NOT. EMPTY(lcErr)
    RETURN .F.
 ENDIF
 IF FILE(tcProgs + "suite_repair_lib.ERR")
    RETURN .F.
 ENDIF
 IF .NOT. FILE(lcFxp) .AND. .NOT. FILE(tcProgs + "suite_repair_lib.FXP")
    RETURN .F.
 ENDIF
 llOk = .F.
 ON ERROR llOk = .F.
 IF FILE(lcFxp)
    SET PROCEDURE TO (lcFxp) ADDITIVE
    llOk = (TYPE("SuiteResolveExportRoot")#"U")
 ENDIF
 IF .NOT. llOk .AND. FILE(tcProgs + "suite_repair_lib.FXP")
    SET PROCEDURE TO (tcProgs + "suite_repair_lib.FXP") ADDITIVE
    llOk = (TYPE("SuiteResolveExportRoot")#"U")
 ENDIF
 IF .NOT. llOk .AND. FILE(lcPrg)
    SET PROCEDURE TO (lcPrg) ADDITIVE
    llOk = (TYPE("SuiteResolveExportRoot")#"U")
 ENDIF
 ON ERROR &lcSav
 RETURN llOk
ENDFUNC

FUNCTION VfpShouldQuitAfterBuild
 RETURN (UPPER(ALLTRIM(GETENV("SUITE_VFP_HEADLESS"))) == "1")
ENDFUNC

PROCEDURE VfpBuildExit
 PARAMETER tlError, tcMsg
 IF VfpShouldQuitAfterBuild()
    QUIT
 ENDIF
 IF tlError
    MESSAGEBOX(tcMsg, 16, "Build ExportZ")
 ELSE
    MESSAGEBOX(tcMsg, 64, "Build ExportZ")
 ENDIF
 RETURN
ENDPROC
