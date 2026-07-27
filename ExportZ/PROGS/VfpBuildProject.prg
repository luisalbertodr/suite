* BUILD proyecto VFP (.exe) + copiar Duna.exe
* ExportZ: mscomctlOk.pjx en raiz (NO en PROGS\).
*   SET DEFAULT TO C:\Duna\ExportZ
*   DO PROGS\VfpBuildProject.prg
LOCAL lcRoot, lcProgs, lcLog, lcErr, lcSav, loProj, lcMsg, llBuilt, lcStem, lcExe, lcHere, lcProj, lnErrBytes, lcOldDef, lnWait
LOCAL ARRAY laErr[1], laExeBefore[1]
LOCAL llHadExe, ldExeDateBefore, lcExeTimeBefore

PUBLIC gcSuiteBuildLog

lcHere = FULLPATH(SYS(16))
IF EMPTY(lcHere)
   lcHere = FULLPATH("VfpBuildProject.prg")
ENDIF
lcProgs = ADDBS(JUSTPATH(lcHere))
IF RIGHT(LOWER(lcProgs), 6) <> "progs\"
   lcProgs = ADDBS(JUSTPATH(lcProgs)) + "PROGS\"
ENDIF

DO (lcProgs + "VfpLoadRepairLib.prg")
lcRoot = VfpExportRootFromProgs(lcProgs)
lcStem = VfpBootstrapProjectStem(lcRoot)
IF VfpLoadRepairLib(lcProgs) .AND. TYPE("SuiteResolveExportRoot")#"U"
   lcRoot = SuiteResolveExportRoot(lcProgs)
   lcStem = SuiteResolveProjectStem(lcRoot)
ENDIF
IF TYPE("SuiteResolveExportRoot")="U" .AND. FILE(lcProgs+"suite_repair_lib.prg")
   SET PROCEDURE TO (lcProgs+"suite_repair_lib.prg") ADDITIVE
   IF TYPE("SuiteResolveExportRoot")#"U"
      lcRoot = SuiteResolveExportRoot(lcProgs)
      lcStem = SuiteResolveProjectStem(lcRoot)
   ENDIF
ENDIF

loProj = .NULL.
llBuilt = .F.

SET SAFETY OFF
SET EXCLUSIVE ON
SET ESCAPE OFF
SET MULTILOCKS ON
SET DEFAULT TO (lcRoot)
SET PATH TO (lcProgs), (lcRoot+"vcx"), (lcRoot+"scx"), (lcRoot+"MENUS"), (lcRoot+"gestion-dunasoft\gestion\vcx") ADDITIVE

lcLog = lcRoot + "build_" + lcStem + ".log"
gcSuiteBuildLog = lcLog
lcErr = lcRoot + lcStem + ".ERR"
lcExe = lcRoot + lcStem + ".exe"
lcProj = ADDBS(lcRoot) + lcStem
llHadExe = (ADIR(laExeBefore, lcExe) > 0)
ldExeDateBefore = {}
lcExeTimeBefore = ""
IF llHadExe
   ldExeDateBefore = laExeBefore(1, 3)
   lcExeTimeBefore = laExeBefore(1, 4)
ENDIF

IF FILE(lcLog)
   ERASE (lcLog)
ENDIF
IF FILE(lcErr)
   ERASE (lcErr)
ENDIF
* VFP prefiere FXP sobre PRG: limpiar compilados obsoletos.
IF FILE(lcProgs + "suite_full_unlock.fxp")
   ERASE (lcProgs + "suite_full_unlock.fxp")
ENDIF
IF FILE(lcProgs + "suite_full_unlock.FXP")
   ERASE (lcProgs + "suite_full_unlock.FXP")
ENDIF
IF FILE(lcProgs + "suite_cola_sync.fxp")
   ERASE (lcProgs + "suite_cola_sync.fxp")
ENDIF
IF FILE(lcProgs + "suite_cola_sync.FXP")
   ERASE (lcProgs + "suite_cola_sync.FXP")
ENDIF

STRTOFILE("=== VfpBuildProject "+TTOC(DATETIME())+" root="+lcRoot+" stem="+lcStem+" ==="+CHR(13), lcLog, .F.)

IF .NOT. FILE(lcRoot + lcStem + ".pjx")
   STRTOFILE("ERROR: falta "+lcStem+".pjx en "+lcRoot+CHR(13), lcLog, .T.)
   DO VfpBuildExit WITH .T., "No existe "+lcStem+".pjx en "+lcRoot
   RETURN
ENDIF

lcSav = ON("ERROR")
ON ERROR STRTOFILE("ERROR: "+MESSAGE()+" proc="+PROGRAM()+CHR(13), gcSuiteBuildLog, .T.)

SET PROCEDURE TO (lcProgs+"export_build_stubs.prg") ADDITIVE
SET PROCEDURE TO (lcProgs+"suite_cola_sync.prg") ADDITIVE
IF FILE(lcProgs+"suite_control_sync.prg")
   SET PROCEDURE TO (lcProgs+"suite_control_sync.prg") ADDITIVE
ENDIF

IF TYPE("SuitePrepareExportFiles")#"U"
   DO SuitePrepareExportFiles WITH lcRoot, lcLog
ENDIF

IF TYPE("SuiteRepairMscomctlProject")#"U"
   STRTOFILE("reparar pjx (quitar refs corruptas)..."+CHR(13), lcLog, .T.)
   DO SuiteRepairMscomctlProject WITH lcRoot, lcLog
ENDIF

IF TYPE("SuiteActivateVfp")#"U"
   DO SuiteActivateVfp
ENDIF

loProj = .NULL.
IF TYPE("SuiteOpenMscomctlProject")#"U"
   loProj = SuiteOpenMscomctlProject(lcRoot, lcLog)
ENDIF
IF TYPE("loProj")#"O" .AND. TYPE("SuiteGetActiveMscomctlProject")#"U"
   loProj = SuiteGetActiveMscomctlProject(lcRoot)
ENDIF
IF TYPE("loProj")#"O" .AND. TYPE("SuiteFindMscomctlProject")#"U"
   loProj = SuiteFindMscomctlProject(lcRoot)
ENDIF

IF VfpShouldQuitAfterBuild()
   _SCREEN.Visible = .F.
ENDIF

IF TYPE("loProj")#"O" .AND. TYPE("_VFP.ActiveProject")="O"
   loProj = _VFP.ActiveProject
ENDIF

* En VFP9 IDE: solo loProj.Build (BUILD PROJECT desde PRG corrompe el .PJT).
lcSav = ON("ERROR")
ON ERROR STRTOFILE("build err: "+MESSAGE()+CHR(13), gcSuiteBuildLog, .T.)

IF TYPE("loProj")="O"
   STRTOFILE("build loProj.Build exe="+lcExe+" files="+ALLTRIM(STR(loProj.Files.Count))+CHR(13), lcLog, .T.)
   loProj.Build(lcExe, 3, .T., .F.)
   llBuilt = VfpBuildExeUpdated(lcExe, ldExeDateBefore, lcExeTimeBefore, llHadExe)
   IF llBuilt
      STRTOFILE("build loProj.Build OK exe actualizado"+CHR(13), lcLog, .T.)
   ELSE
      STRTOFILE("build loProj.Build sin exe nuevo"+CHR(13), lcLog, .T.)
   ENDIF
ENDIF

ON ERROR &lcSav

IF .NOT. llBuilt
   lcMsg = "No se genero un "+lcStem+".exe nuevo."+CHR(13)+CHR(13)
   IF llHadExe
      lcMsg = lcMsg+"El exe existente no se actualizo (fecha anterior al build)."+CHR(13)+CHR(13)
   ENDIF
   lcMsg = lcMsg+"Build MANUAL en Project Manager:"+CHR(13)
   lcMsg = lcMsg+"1. File > Open Project > "+lcRoot+lcStem+CHR(13)
   lcMsg = lcMsg+"2. Boton Build (martillo) > Win32 executable"+CHR(13)
   lcMsg = lcMsg+"3. Directorio: "+lcRoot+CHR(13)
   lcMsg = lcMsg+"4. Luego: .\scripts\build-style-exportz.ps1 -AfterBuild"
   STRTOFILE("ERROR: "+STRTRAN(lcMsg, CHR(13), " | ")+CHR(13), lcLog, .T.)
   DO VfpBuildExit WITH .T., lcMsg
   RETURN
ENDIF

DO CopyBuildExeToDuna IN (lcProgs+"VfpBuildProject.prg") WITH lcRoot, lcStem, lcLog

IF FILE(lcErr)
   lnErrBytes = 0
   IF TYPE("SuiteFileBytes")#"U"
      lnErrBytes = SuiteFileBytes(lcErr)
   ELSE
      IF ADIR(laErr, lcErr) > 0
         lnErrBytes = laErr(1, 2)
      ENDIF
   ENDIF
   STRTOFILE(lcStem+".ERR bytes="+ALLTRIM(STR(lnErrBytes))+CHR(13), lcLog, .T.)
ENDIF
lcMsg = "Build terminado ("+lcStem+")."
IF FILE(lcRoot+"Duna.exe")
   lcMsg = lcMsg+CHR(13)+"Duna.exe actualizado."
ELSE
   lcMsg = lcMsg+CHR(13)+"AVISO: revisa copia Duna.exe"
ENDIF
DO VfpBuildExit WITH .F., lcMsg
RETURN

PROCEDURE CopyBuildExeToDuna
 PARAMETER tcRoot, tcStem, tcLogIn
 LOCAL lcsav, lcexesrc, laF[1], lnBytes, lcStamp, lcTarget, lnI, lcLog
 LOCAL ARRAY laTargets[2]
 lcLog = tcLogIn
 lcexesrc = tcRoot + tcStem + ".exe"
 IF .NOT. FILE(lcexesrc)
    STRTOFILE("COPY: falta "+lcexesrc+CHR(13), lcLog, .T.)
    RETURN
 ENDIF
 lcsav = ON("ERROR")
 ON ERROR STRTOFILE("COPY Duna error: "+MESSAGE()+CHR(13), lcLog, .T.)
 IF FILE(tcRoot+"Duna.exe")
    ERASE (tcRoot+"Duna.exe")
 ENDIF
 COPY FILE (lcexesrc) TO (tcRoot+"Duna.exe")
 COPY FILE (lcexesrc) TO (tcRoot+"Duna2.exe")
 ON ERROR &lcsav
 laTargets[1] = tcRoot+"Duna.exe"
 laTargets[2] = tcRoot+"Duna2.exe"
 FOR lnI = 1 TO 2
    lcTarget = laTargets[lnI]
    lnBytes = 0
    lcStamp = ""
    IF ADIR(laF, lcTarget) > 0
       lnBytes = laF(1, 2)
       lcStamp = DTOC(laF(1,3))+" "+laF(1,4)
    ENDIF
    STRTOFILE(JUSTFNAME(lcTarget)+" OK "+lcStamp+" bytes="+ALLTRIM(STR(lnBytes))+CHR(13), lcLog, .T.)
 ENDFOR
ENDPROC

FUNCTION VfpBuildExeUpdated
 PARAMETER tcExe, tdBeforeDate, tcBeforeTime, tlHadBefore
 LOCAL ARRAY laAfter[1]
 IF .NOT. FILE(tcExe)
    RETURN .F.
 ENDIF
 IF ADIR(laAfter, tcExe) < 1
    RETURN .F.
 ENDIF
 IF .NOT. tlHadBefore
    RETURN .T.
 ENDIF
 IF laAfter(1, 3) > tdBeforeDate
    RETURN .T.
 ENDIF
 IF laAfter(1, 3) = tdBeforeDate .AND. laAfter(1, 4) > tcBeforeTime
    RETURN .T.
 ENDIF
 RETURN .F.
ENDFUNC
