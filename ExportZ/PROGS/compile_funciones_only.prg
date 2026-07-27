* Compila solo funciones.prg -> funciones.fxp (loader sync con .prg).
* Uso: vfp9.exe -C "DO PROGS\compile_funciones_only WITH 'C:\Duna\Style-Suite-Test\'"
LOCAL lcRoot, lcProgs, lclog, lcErr, lcSav

IF PCOUNT() < 1 OR EMPTY(m.tcStyleRoot)
   lcRoot = ADDBS(SYS(5)+SYS(2003))
ELSE
   lcRoot = ADDBS(m.tcStyleRoot)
ENDIF
lcProgs = lcRoot + "PROGS\"
SET SAFETY OFF
SET DEFAULT TO (lcRoot)
lclog = lcRoot + "Usuarios\_compile_funciones.log"
STRTOFILE("=== compile_funciones "+TTOC(DATETIME())+CHR(13), lclog, .F.)

IF  .NOT. FILE(lcProgs + "funciones.prg")
   STRTOFILE("ERROR: falta funciones.prg"+CHR(13), lclog, .T.)
   QUIT
ENDIF
IF FILE(lcProgs + "funciones.ERR")
   ERASE (lcProgs + "funciones.ERR")
ENDIF

lcSav = ON("ERROR")
lcErr = ""
ON ERROR lcErr = ALLTRIM(STR(ERROR()))+": "+MESSAGE()
COMPILE (lcProgs + "funciones.prg")
ON ERROR &lcSav

IF FILE(lcProgs + "funciones.ERR")
   lcErr = lcErr + CHR(13) + FILETOSTR(lcProgs + "funciones.ERR")
ENDIF
IF FILE(lcProgs + "funciones.fxp") OR FILE(lcProgs + "funciones.FXP")
   STRTOFILE("OK funciones.fxp"+CHR(13), lclog, .T.)
ELSE
   STRTOFILE("FAIL "+lcErr+CHR(13), lclog, .T.)
ENDIF
QUIT
