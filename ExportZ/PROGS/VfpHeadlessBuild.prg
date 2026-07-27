* Build headless ExportZ/Export via Project.Build(exe, 3, .T., .F.) + vfp9 -C config.
LOCAL lcRoot, lcStem, lcProj, lcExe, lcLog, lcProgs, lcHere, lcSav, lcErr, lnWait, loProj
LOCAL ARRAY laBefore[1], laAfter[1]
LOCAL llHadExe, ldBefore, lcBeforeTime, llOk

lcHere = FULLPATH(SYS(16))
IF EMPTY(lcHere)
   lcHere = FULLPATH("VfpHeadlessBuild.prg")
ENDIF
lcProgs = ADDBS(JUSTPATH(lcHere))
IF RIGHT(LOWER(lcProgs), 6) <> "progs\"
   lcProgs = ADDBS(JUSTPATH(lcProgs)) + "PROGS\"
ENDIF

SET SAFETY OFF
SET EXCLUSIVE ON
SET ESCAPE OFF
SET MULTILOCKS ON
SET DEFAULT TO (lcProgs)
SET PROCEDURE TO (lcProgs+"suite_repair_lib.prg") ADDITIVE
lcRoot = SuiteResolveExportRoot(lcProgs)
lcStem = SuiteResolveProjectStem(lcRoot)
lcProj = ADDBS(lcRoot) + lcStem
lcExe = lcProj + ".exe"
SET DEFAULT TO (lcRoot)
SET PATH TO (lcProgs), (lcRoot+"vcx"), (lcRoot+"scx"), (lcRoot+"MENUS"), (lcRoot+"gestion-dunasoft\gestion\vcx") ADDITIVE

lcLog = lcRoot + "build_" + lcStem + ".log"
STRTOFILE("=== VfpHeadlessBuild "+TTOC(DATETIME())+" root="+lcRoot+" stem="+lcStem+" ==="+CHR(13), lcLog, .F.)

IF .NOT. FILE(lcProj+".pjx")
   STRTOFILE("ERROR: falta "+lcProj+".pjx"+CHR(13), lcLog, .T.)
   QUIT
ENDIF

SET PROCEDURE TO (lcProgs+"export_build_stubs.prg") ADDITIVE
SET PROCEDURE TO (lcProgs+"suite_cola_sync.prg") ADDITIVE
IF FILE(lcProgs+"suite_control_sync.prg")
   SET PROCEDURE TO (lcProgs+"suite_control_sync.prg") ADDITIVE
ENDIF

DO SuiteRepairMscomctlProject WITH lcRoot, lcLog
IF OCCURS("ERROR: no se pudo abrir", FILETOSTR(lcLog)) > 0
   STRTOFILE("ERROR: repair fallo"+CHR(13), lcLog, .T.)
   QUIT
ENDIF

loProj = .NULL.
IF TYPE("_VFP.ActiveProject")="O"
   loProj = _VFP.ActiveProject
ENDIF
IF TYPE("loProj")#"O" .AND. _VFP.Projects.Count > 0
   loProj = _VFP.Projects.Item(1)
ENDIF
IF TYPE("loProj")#"O"
   STRTOFILE("ERROR: sin proyecto abierto"+CHR(13), lcLog, .T.)
   QUIT
ENDIF

llHadExe = (ADIR(laBefore, lcExe) > 0)
ldBefore = {}
lcBeforeTime = ""
IF llHadExe
   ldBefore = laBefore(1, 3)
   lcBeforeTime = laBefore(1, 4)
ENDIF

lcErr = ""
lcSav = ON("ERROR")
ON ERROR lcErr = MESSAGE()
STRTOFILE("Build(exe,3,.T.,.F.) files="+ALLTRIM(STR(loProj.Files.Count))+CHR(13), lcLog, .T.)
loProj.Build(lcExe, 3, .T., .F.)
ON ERROR &lcSav
IF .NOT. EMPTY(lcErr)
   STRTOFILE("Build err: "+lcErr+CHR(13), lcLog, .T.)
ENDIF

* Build puede abrir dialogos; esperar hasta 45 min comprobando exe.
FOR lnWait = 1 TO 2700
   IF ADIR(laAfter, lcExe) > 0
      IF .NOT. llHadExe
         EXIT
      ENDIF
      IF laAfter(1,3) > ldBefore .OR. ;
         (laAfter(1,3) = ldBefore .AND. laAfter(1,4) > lcBeforeTime)
         EXIT
      ENDIF
   ENDIF
   = INKEY(1, "MSH")
ENDFOR

llOk = .F.
IF ADIR(laAfter, lcExe) > 0
   IF .NOT. llHadExe
      llOk = .T.
   ELSE
      llOk = (laAfter(1,3) > ldBefore) .OR. ;
             (laAfter(1,3) = ldBefore .AND. laAfter(1,4) > lcBeforeTime)
   ENDIF
ENDIF
IF llOk
   STRTOFILE("BUILD OK bytes="+ALLTRIM(STR(laAfter(1,2)))+CHR(13), lcLog, .T.)
   COPY FILE (lcExe) TO (lcRoot+"Duna.exe")
   COPY FILE (lcExe) TO (lcRoot+"Duna2.exe")
ELSE
   STRTOFILE("BUILD FAIL: exe no actualizado"+CHR(13), lcLog, .T.)
ENDIF
QUIT
