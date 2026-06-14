* Build completo mscomctl desde linea de comandos VFP9.
DO BuildMscomctlCore IN (_PROGRAM) WITH .T.
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
    MESSAGEBOX("No se encuentra " + lcProj + ".pjx", 16, "Build mscomctl")
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

 IF TYPE("_VFP.ActiveProject") = "O"
    CLOSE PROJECT
 ENDIF
 OPEN PROJECT (lcProj) EXCLUSIVE
 BUILD PROJECT (lcProj) REBUILD
 IF TYPE("_VFP.ActiveProject") = "O"
    CLOSE PROJECT
 ENDIF

 ON ERROR &lcSavErr

 IF FILE(lcErr)
    lnSize = FILE(lcErr)
    STRTOFILE("Build fin. ERR bytes=" + ALLTRIM(STR(lnSize)) + CHR(13), lcLog, .T.)
 ELSE
    STRTOFILE("Build fin. Sin ERR" + CHR(13), lcLog, .T.)
 ENDIF

 IF tlShowMsg
    IF FILE(lcErr) .AND. lnSize > 0
       MESSAGEBOX("Build terminado con avisos." + CHR(13) + CHR(13) + ;
          "Revisa " + lcErr + CHR(13) + CHR(13) + ;
          "Si solo quedan REPORTPREVIEW/SYSTEM, el exe ya es usable.", 48, "Build mscomctl")
    ELSE
       MESSAGEBOX("Build completado sin errores.", 64, "Build mscomctl")
    ENDIF
 ENDIF
ENDPROC

PROCEDURE BuildErrHandler
 LOCAL lcLog
 lcLog = "C:\Duna\Export\build_mscomctl.log"
 STRTOFILE("ERROR: " + MESSAGE() + CHR(13), lcLog, .T.)
 MESSAGEBOX("Error en build:" + CHR(13) + MESSAGE(), 16, "Build mscomctl")
 RETURN
ENDPROC
