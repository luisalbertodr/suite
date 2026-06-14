* Build completo sin MESSAGEBOX.

LOCAL lcRoot, lcProj, lcErr, lcLog, lcSavErr, lnSize



lcRoot = "C:\Duna\Export\"

lcProj = lcRoot + "mscomctl"

lcErr = lcRoot + "mscomctl.ERR"

lcLog = lcRoot + "build_mscomctl.log"

lnSize = 0



SET SAFETY OFF

SET EXCLUSIVE ON

SET ESCAPE OFF

_SCREEN.Visible = .F.



IF  .NOT. FILE(lcProj + ".pjx")

   STRTOFILE("ERROR: falta pjx" + CHR(13), lcLog, .T.)

   QUIT

ENDIF



lcSavErr = ON("ERROR")

ON ERROR STRTOFILE("ERROR: " + MESSAGE() + CHR(13), lcLog, .T.)



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

   lnSize = FILESIZE(lcErr)

   STRTOFILE("Build fin. ERR bytes=" + ALLTRIM(STR(lnSize)) + CHR(13), lcLog, .T.)

ELSE

   STRTOFILE("Build fin. Sin ERR" + CHR(13), lcLog, .T.)

ENDIF

QUIT

