* Verifica repair + build ExportZ.
LOCAL lcRoot, lcLog, lcStem, lcProj, lcProgs, lcHere, lcSav, llOk, lnFiles, llHadExe, lcBuildErr
LOCAL ldExeDateBefore, lcExeTimeBefore, lcOldDef, lnWait
LOCAL ARRAY laExeBefore[1], laAfter[1]

lcHere = FULLPATH(SYS(16))
IF EMPTY(lcHere)
   lcHere = FULLPATH("VerifyExportzBuild.prg")
ENDIF
lcProgs = ADDBS(JUSTPATH(lcHere))
IF RIGHT(LOWER(lcProgs), 6) <> "progs\"
   lcProgs = ADDBS(JUSTPATH(lcProgs)) + "PROGS\"
ENDIF

SET SAFETY OFF
SET DEFAULT TO (lcProgs)
SET PROCEDURE TO (lcProgs+"suite_repair_lib.prg") ADDITIVE
lcRoot = SuiteResolveExportRoot(lcProgs)
lcStem = SuiteResolveProjectStem(lcRoot)
lcProj = ADDBS(lcRoot) + lcStem
SET DEFAULT TO (lcRoot)
lcLog = lcRoot + "verify_build.log"
STRTOFILE("=== VerifyExportzBuild "+TTOC(DATETIME())+" stem="+lcStem+" ==="+CHR(13), lcLog, .F.)

IF .NOT. FILE(lcRoot+lcStem+".pjx") .OR. .NOT. FILE(lcRoot+lcStem+".pjt")
   STRTOFILE("ERROR: falta "+lcStem+".pjx/.pjt"+CHR(13), lcLog, .T.)
   QUIT
ENDIF

DO SuiteRepairMscomctlProject WITH lcRoot, lcLog
IF OCCURS("ERROR: no se pudo abrir", FILETOSTR(lcLog)) > 0
   STRTOFILE("VERIFY FAIL: repair"+CHR(13), lcLog, .T.)
   QUIT
ENDIF

lnFiles = 0
IF TYPE("_VFP.ActiveProject")="O"
   lnFiles = _VFP.ActiveProject.Files.Count
ENDIF
STRTOFILE("project files="+ALLTRIM(STR(lnFiles))+CHR(13), lcLog, .T.)
IF lnFiles < 500
   STRTOFILE("VERIFY FAIL: pocos archivos"+CHR(13), lcLog, .T.)
   QUIT
ENDIF
IF TYPE("_VFP.ActiveProject")#"O" .OR. .NOT. SuiteProjHasFile(_VFP.ActiveProject, lcRoot+"PROGS\suite_cola_sync.prg")
   STRTOFILE("VERIFY FAIL: falta suite_cola_sync"+CHR(13), lcLog, .T.)
   QUIT
ENDIF

llHadExe = (ADIR(laExeBefore, lcRoot+lcStem+".exe") > 0)
ldExeDateBefore = {}
lcExeTimeBefore = ""
IF llHadExe
   ldExeDateBefore = laExeBefore(1, 3)
   lcExeTimeBefore = laExeBefore(1, 4)
ENDIF

_SCREEN.Visible = .F.
lcBuildErr = ""
lcSav = ON("ERROR")
ON ERROR lcBuildErr = MESSAGE()
IF TYPE("_VFP.ActiveProject")="O"
   STRTOFILE("build BUILD PROJECT REBUILD..."+CHR(13), lcLog, .T.)
   lcOldDef = SET("DEFAULT")
   SET DEFAULT TO (lcRoot)
   BUILD PROJECT (lcProj) REBUILD
   SET DEFAULT TO (lcOldDef)
ENDIF
ON ERROR &lcSav
IF .NOT. EMPTY(lcBuildErr)
   STRTOFILE("BUILD PROJECT err: "+lcBuildErr+CHR(13), lcLog, .T.)
   lcBuildErr = ""
ENDIF
IF TYPE("_VFP.ActiveProject")="O" .AND. .NOT. FILE(lcRoot+lcStem+".exe")
   lcSav = ON("ERROR")
   ON ERROR lcBuildErr = MESSAGE()
   STRTOFILE("build fallback loProj.Build..."+CHR(13), lcLog, .T.)
   _VFP.ActiveProject.Build(ADDBS(lcRoot), .T.)
   ON ERROR &lcSav
   IF .NOT. EMPTY(lcBuildErr)
      STRTOFILE("loProj.Build err: "+lcBuildErr+CHR(13), lcLog, .T.)
   ENDIF
ENDIF

llOk = .F.
IF ADIR(laAfter, lcRoot+lcStem+".exe") > 0
   IF .NOT. llHadExe
      llOk = .T.
   ELSE
      llOk = (laAfter(1,3) > ldExeDateBefore) .OR. ;
             (laAfter(1,3) = ldExeDateBefore .AND. laAfter(1,4) > lcExeTimeBefore)
   ENDIF
ENDIF
IF llOk
   STRTOFILE("VERIFY OK exe bytes="+ALLTRIM(STR(laAfter(1,2)))+CHR(13), lcLog, .T.)
   COPY FILE (lcRoot+lcStem+".exe") TO (lcRoot+"Duna.exe")
   COPY FILE (lcRoot+lcStem+".exe") TO (lcRoot+"Duna2.exe")
ELSE
   STRTOFILE("VERIFY FAIL: exe no actualizado"+CHR(13), lcLog, .T.)
ENDIF
QUIT
