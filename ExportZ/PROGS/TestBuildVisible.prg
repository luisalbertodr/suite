* Prueba build visible: repair + loProj.Build (sin BUILD PROJECT).
LOCAL lcRoot, lcLog, lcStem, lcProgs, lcHere, lcSav, llOk, lnWait
LOCAL ARRAY laBefore[1], laAfter[1]
LOCAL llHadExe, ldBefore, lcBeforeTime

lcHere = FULLPATH(SYS(16))
IF EMPTY(lcHere)
   lcHere = FULLPATH("TestBuildVisible.prg")
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
SET DEFAULT TO (lcRoot)
lcLog = lcRoot + "test_build_visible.log"
STRTOFILE("=== TestBuildVisible "+TTOC(DATETIME())+" root="+lcRoot+" stem="+lcStem+" ==="+CHR(13), lcLog, .F.)

DO SuiteRepairMscomctlProject WITH lcRoot, lcLog
IF TYPE("_VFP.ActiveProject")#"O"
   STRTOFILE("FAIL: sin ActiveProject tras repair"+CHR(13), lcLog, .T.)
   QUIT
ENDIF
STRTOFILE("ActiveProject files="+ALLTRIM(STR(_VFP.ActiveProject.Files.Count))+CHR(13), lcLog, .T.)

llHadExe = (ADIR(laBefore, lcRoot+lcStem+".exe") > 0)
ldBefore = {}
lcBeforeTime = ""
IF llHadExe
   ldBefore = laBefore(1, 3)
   lcBeforeTime = laBefore(1, 4)
ENDIF

_SCREEN.Visible = .T.
lcSav = ON("ERROR")
ON ERROR STRTOFILE("Build err: "+MESSAGE()+CHR(13), lcLog, .T.)
STRTOFILE("loProj.Build iniciado..."+CHR(13), lcLog, .T.)
_VFP.ActiveProject.Build(ADDBS(lcRoot), .T.)
ON ERROR &lcSav
STRTOFILE("loProj.Build retorno"+CHR(13), lcLog, .T.)

llOk = .F.
IF ADIR(laAfter, lcRoot+lcStem+".exe") > 0
   IF .NOT. llHadExe
      llOk = .T.
   ELSE
      llOk = (laAfter(1,3) > ldBefore) .OR. ;
             (laAfter(1,3) = ldBefore .AND. laAfter(1,4) > lcBeforeTime)
   ENDIF
   STRTOFILE("exe bytes="+ALLTRIM(STR(laAfter(1,2)))+" ok="+IIF(llOk,"SI","NO")+CHR(13), lcLog, .T.)
ELSE
   STRTOFILE("FAIL: sin exe"+CHR(13), lcLog, .T.)
ENDIF
IF llOk
   COPY FILE (lcRoot+lcStem+".exe") TO (lcRoot+"Duna.exe")
ENDIF
QUIT
