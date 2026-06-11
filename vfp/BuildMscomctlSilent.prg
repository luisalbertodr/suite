* Build completo sin MESSAGEBOX.
DO BuildMscomctlCore IN (_PROGRAM) WITH .F.
QUIT

PROCEDURE BuildMscomctlCore
 PARAMETER tlShowMsg
 LOCAL lcRoot, lcProj, lcErr, lcLog, lcSavErr, lnSize

 lcRoot = "C:\Duna\Export\"
 lcProj = lcRoot + "mscomctl"
 lcErr = lcRoot + "mscomctl.ERR"
 lcLog = lcRoot + "build_mscomctl.log"
 lnSize = 0

 IF  .NOT. FILE(lcProj + ".pjx")
    STRTOFILE("ERROR: falta pjx" + CHR(13), lcLog, .T.)
    RETURN
 ENDIF

 lcSavErr = ON("ERROR")
 ON ERROR DO BuildErrHandler IN (_PROGRAM)

 SET DEFAULT TO (lcRoot)
 SET PATH TO ;
    (lcRoot + "PROGS"), ;
    (lcRoot + "vcx"), ;
    (lcRoot + "scx"), ;
    (lcRoot + "MENUS"), ;
    (lcRoot + "gestion-dunasoft\gestion\vcx") ;
    ADDITIVE
 SET PROCEDURE TO export_build_stubs ADDITIVE

 STRTOFILE("Build iniciado: " + TTOC(DATETIME()) + CHR(13), lcLog, .T.)

 CLOSE PROJECT ALL
 OPEN PROJECT (lcProj) EXCLUSIVE
 BUILD PROJECT (lcProj) REBUILD
 CLOSE PROJECT ALL

 ON ERROR &lcSavErr

 IF FILE(lcErr)
    lnSize = FILE(lcErr)
    STRTOFILE("Build fin. ERR bytes=" + ALLTRIM(STR(lnSize)) + CHR(13), lcLog, .T.)
 ELSE
    STRTOFILE("Build fin. Sin ERR" + CHR(13), lcLog, .T.)
 ENDIF

 IF tlShowMsg
    IF FILE(lcErr) .AND. lnSize > 0
       MESSAGEBOX("Build terminado con avisos. Revisa mscomctl.ERR", 48, "Build mscomctl")
    ELSE
       MESSAGEBOX("Build completado.", 64, "Build mscomctl")
    ENDIF
 ENDIF
ENDPROC

PROCEDURE BuildErrHandler
 STRTOFILE("ERROR: " + MESSAGE() + CHR(13), "C:\Duna\Export\build_mscomctl.log", .T.)
 RETURN
ENDPROC
