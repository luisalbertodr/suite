* BUILD mscomctl.exe + copiar Duna.exe
* IMPORTANTE: deja abierto Project Manager con mscomctl ANTES de ejecutar.
*   SET DEFAULT TO C:\Duna\Export
*   DO PROGS\VfpBuildProject.prg
LOCAL lcRoot, lcProgs, lcLog, lcErr, lcSav, loProj, lcMsg, llBuilt

lcRoot = "C:\Duna\Export\"
lcProgs = lcRoot + "PROGS\"
lcLog = lcRoot + "build_mscomctl.log"
lcErr = lcRoot + "mscomctl.ERR"
loProj = .NULL.
llBuilt = .F.

SET SAFETY OFF
SET EXCLUSIVE ON
SET ESCAPE OFF
SET MULTILOCKS ON
SET DEFAULT TO (lcRoot)
SET PATH TO (lcProgs), (lcRoot+"vcx"), (lcRoot+"scx"), (lcRoot+"MENUS"), (lcRoot+"gestion-dunasoft\gestion\vcx") ADDITIVE

STRTOFILE("=== VfpBuildProject "+TTOC(DATETIME())+" ==="+CHR(13), lcLog, .T.)

IF .NOT. FILE(lcRoot+"mscomctl.pjx")
   MESSAGEBOX("No existe mscomctl.pjx. Ejecuta DO PROGS\RepairMscomctlFromLfn.prg", 16, "Build Duna")
   RETURN
ENDIF

lcSav = ON("ERROR")
ON ERROR STRTOFILE("ERROR: "+MESSAGE()+" proc="+PROGRAM()+CHR(13), lcLog, .T.)

SET PROCEDURE TO (lcProgs+"suite_repair_lib.prg") ADDITIVE
SET PROCEDURE TO (lcProgs+"export_build_stubs.prg") ADDITIVE
SET PROCEDURE TO (lcProgs+"suite_full_unlock.prg") ADDITIVE

DO SuiteActivateVfp

loProj = SuiteGetActiveMscomctlProject(lcRoot)
IF TYPE("loProj")#"O"
   loProj = SuiteFindMscomctlProject(lcRoot)
ENDIF

IF TYPE("loProj")#"O"
   STRTOFILE("build via loProj.Build ap=O files="+ALLTRIM(STR(loProj.Files.Count))+CHR(13), lcLog, .T.)
   lcSav = ON("ERROR")
   ON ERROR STRTOFILE("build err: "+MESSAGE()+CHR(13), lcLog, .T.)
   loProj.Build(ADDBS(lcRoot), .T.)
   ON ERROR &lcSav
   llBuilt = FILE(lcRoot+"mscomctl.exe")
ENDIF

IF .NOT. llBuilt
   STRTOFILE("build fallback BUILD PROJECT cmd"+CHR(13), lcLog, .T.)
   lcSav = ON("ERROR")
   ON ERROR STRTOFILE("build cmd err: "+MESSAGE()+CHR(13), lcLog, .T.)
   BUILD PROJECT mscomctl REBUILD
   ON ERROR &lcSav
   llBuilt = FILE(lcRoot+"mscomctl.exe")
ENDIF

ON ERROR &lcSav

IF .NOT. llBuilt
   lcMsg = "No se genero mscomctl.exe desde script."+CHR(13)+CHR(13)
   lcMsg = lcMsg+"Build MANUAL en Project Manager:"+CHR(13)
   lcMsg = lcMsg+"1. File > Open Project > mscomctl (si no esta abierto)"+CHR(13)
   lcMsg = lcMsg+"2. Boton Build (martillo) > Win32 executable"+CHR(13)
   lcMsg = lcMsg+"3. Directorio: C:\Duna\Export\"+CHR(13)
   lcMsg = lcMsg+"4. Luego PowerShell: copy-duna-exe.ps1"
   MESSAGEBOX(lcMsg, 48, "Build Duna")
   RETURN
ENDIF

DO CopyMscomctlToDuna IN (lcProgs+"VfpBuildProject.prg") WITH lcRoot, lcLog

IF FILE(lcErr)
   STRTOFILE("mscomctl.ERR bytes="+ALLTRIM(STR(SuiteFileBytes(lcErr)))+CHR(13), lcLog, .T.)
ENDIF
lcMsg = "Build terminado."
IF FILE(lcRoot+"Duna.exe")
   lcMsg = lcMsg+CHR(13)+"Duna.exe actualizado."
ELSE
   lcMsg = lcMsg+CHR(13)+"AVISO: revisa copia Duna.exe"
ENDIF
MESSAGEBOX(lcMsg, 64, "Build Duna")
RETURN

PROCEDURE CopyMscomctlToDuna
 PARAMETER lcRoot, tclog
 LOCAL lcsav
 IF .NOT. FILE(lcRoot+"mscomctl.exe")
    STRTOFILE("COPY: falta mscomctl.exe"+CHR(13), tclog, .T.)
    RETURN
 ENDIF
 lcsav = ON("ERROR")
 ON ERROR STRTOFILE("COPY Duna error: "+MESSAGE()+CHR(13), tclog, .T.)
 IF FILE(lcRoot+"Duna.exe")
    ERASE (lcRoot+"Duna.exe")
 ENDIF
 COPY FILE (lcRoot+"mscomctl.exe") TO (lcRoot+"Duna.exe")
 COPY FILE (lcRoot+"mscomctl.exe") TO (lcRoot+"Duna2.exe")
 ON ERROR &lcsav
 STRTOFILE("Duna.exe OK "+TTOC(FDATETIME(lcRoot+"Duna.exe"))+" bytes="+ALLTRIM(STR(SuiteFileBytes(lcRoot+"Duna.exe")))+CHR(13), tclog, .T.)
 STRTOFILE("Duna2.exe OK "+TTOC(FDATETIME(lcRoot+"Duna2.exe"))+" bytes="+ALLTRIM(STR(SuiteFileBytes(lcRoot+"Duna2.exe")))+CHR(13), tclog, .T.)
ENDPROC
