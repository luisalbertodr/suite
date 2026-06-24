* Excluir suite_cola_sync / suite_control_sync / export_build_stubs del build (van #INCLUDE en general).
* VFP9: PM mscomctlOk abierto -> DO PROGS\ExcludeSuiteV2FromProject.prg -> File > Save
LOCAL lcHere, lcProgs, lcRoot, lcLog, lcStem
lcHere = FULLPATH(SYS(16))
IF EMPTY(lcHere)
   lcHere = FULLPATH("ExcludeSuiteV2FromProject.prg")
ENDIF
lcProgs = ADDBS(JUSTPATH(lcHere))
IF RIGHT(LOWER(lcProgs), 6) <> "progs\"
   lcProgs = ADDBS(JUSTPATH(lcProgs)) + "PROGS\"
ENDIF
SET PROCEDURE TO (lcProgs+"suite_repair_lib.prg") ADDITIVE
lcRoot = SuiteResolveExportRoot(lcProgs)
lcStem = SuiteResolveProjectStem(lcRoot)
lcLog = lcRoot + "build_"+lcStem+".log"
IF TYPE("_VFP.ActiveProject")#"O"
   MESSAGEBOX("Abre mscomctlOk en Project Manager y vuelve a ejecutar.", 48, "Exclude v2")
   RETURN
ENDIF
IF UPPER(JUSTSTEM(_VFP.ActiveProject.Name)) <> UPPER(lcStem)
   MESSAGEBOX("Proyecto activo no es "+lcStem+CHR(13)+_VFP.ActiveProject.Name, 48, "Exclude v2")
   RETURN
ENDIF
STRTOFILE("=== ExcludeSuiteV2FromProject "+TTOC(DATETIME())+CHR(13), lcLog, .T.)
DO SuiteExcludeProjV2Suites WITH _VFP.ActiveProject, lcLog
MESSAGEBOX("PRGs v2 sueltos marcados Exclude."+CHR(13)+CHR(13)+"File > Save en Project Manager"+CHR(13)+CHR(13)+"Log: "+lcLog, 64, "Exclude v2")
