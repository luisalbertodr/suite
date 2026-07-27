* Compila PRGs en C:\Style-Dunasoft\PROGS (VM Style).
LOCAL lcProgs, lcErr, lclog, lcRoot

lcRoot = "C:\Style-Dunasoft\"
lcProgs = lcRoot + "PROGS\"
IF  .NOT. DIRECTORY(lcProgs)
   lcRoot = ADDBS(SYS(5)+SYS(2003))
   IF FILE(lcRoot + "PROGS\general.prg")
      lcProgs = lcRoot + "PROGS\"
   ELSE
      lcProgs = lcRoot
   ENDIF
ENDIF
SET DEFAULT TO (lcProgs)

lclog = lcRoot + "Usuarios\_compile_style.log"
IF  .NOT. DIRECTORY(lcRoot + "Usuarios")
   MD (lcRoot + "Usuarios")
ENDIF
STRTOFILE("start "+TTOC(DATETIME())+" progs="+lcProgs+CHR(13)+CHR(10), lclog, .F.)

IF  .NOT. FILE(lcProgs + "general.prg")
   STRTOFILE("ERROR: falta "+lcProgs+"general.prg"+CHR(13)+CHR(10), lclog, .T.)
   MESSAGEBOX("Copia general.prg a:"+CHR(13)+lcProgs, 16, "Compilar Style")
   RETURN
ENDIF

ON ERROR lcErr = ALLTRIM(STR(ERROR()))+": "+MESSAGE()

lcErr = ""
COMPILE (lcProgs + "general.prg")
STRTOFILE("general "+lcErr+CHR(13)+CHR(10), lclog, .T.)

lcErr = ""
COMPILE (lcProgs + "funciones.prg")
STRTOFILE("funciones "+lcErr+CHR(13)+CHR(10), lclog, .T.)

lcErr = ""
COMPILE (lcProgs + "suite_full_unlock.prg")
STRTOFILE("unlock "+lcErr+CHR(13)+CHR(10), lclog, .T.)

* No usar suite_full_unlock.fxp en VM (falla al cargar); borrar si existe
IF FILE(lcProgs + "suite_full_unlock.fxp")
   ERASE (lcProgs + "suite_full_unlock.fxp")
   STRTOFILE("borrado suite_full_unlock.fxp"+CHR(13)+CHR(10), lclog, .T.)
ENDIF

STRTOFILE("done"+CHR(13)+CHR(10), lclog, .T.)
MESSAGEBOX("Compilado en "+lcProgs+CHR(13)+"Log: "+lclog, 64, "Style")
QUIT
