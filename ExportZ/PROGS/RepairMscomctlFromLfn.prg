* Regenera mscomctl.pjx desde repair_project_files.txt (interactivo en VFP IDE).
* VFP9: SET DEFAULT TO C:\Duna\Export  /  DO PROGS\RepairMscomctlFromLfn.prg
LOCAL lcRoot, lcBackup, lcList, lcLine, lcSav, loProj, lcLog, lnI, lnLines, lcText, lnAdded, llSkipList, lcMsg, lnTotal
LOCAL ARRAY laList[1]
lcRoot = "C:\Duna\Export\"
lcBackup = lcRoot + "backup_pjx\"
lcList = lcRoot + "PROGS\repair_project_files.txt"
lcLog = lcRoot + "build_mscomctl.log"
lnAdded = 0
llSkipList = .F.

SET SAFETY OFF
SET DEFAULT TO (lcRoot)
lcSav = ON("ERROR")
ON ERROR *
RELEASE PROCEDURE (lcRoot + "PROGS\suite_repair_lib.prg")
ON ERROR &lcSav
SET PROCEDURE TO (lcRoot + "PROGS\suite_repair_lib.prg") ADDITIVE

IF .NOT. DIRECTORY(lcBackup)
   MD (lcBackup)
ENDIF

DO SuiteActivateVfp
DO SuiteRemoveBrokenProject WITH lcRoot, lcBackup, lcLog

loProj = SuiteGetActiveMscomctlProject(lcRoot)
IF TYPE("loProj") #"O"
   loProj = SuiteFindMscomctlProject(lcRoot)
ENDIF
IF TYPE("loProj") #"O" .AND. SuiteProjectReady(lcRoot)
   loProj = SuiteOpenMscomctlProject(lcRoot, lcLog)
ENDIF
IF TYPE("loProj") ="O" .AND. loProj.Files.Count > 1500
   llSkipList = .T.
ENDIF

IF TYPE("loProj") #"O" .AND. .NOT. SuiteProjectReady(lcRoot)
   IF .NOT. SuiteCreateMscomctlProject(lcRoot, lcLog, 15)
      lcMsg = "No hay mscomctl.pjx en C:\Duna\Export."+CHR(13)+CHR(13)
      lcMsg = lcMsg+"En VFP: File > New > Project > mscomctl"+CHR(13)
      lcMsg = lcMsg+"Luego vuelve a ejecutar DO PROGS\RepairMscomctlFromLfn.prg"
      DO SuiteNotifyUser WITH lcMsg, 16, "Reparar", lcLog
      RETURN
   ENDIF
   loProj = SuiteGetActiveMscomctlProject(lcRoot)
   IF TYPE("loProj") #"O"
      loProj = SuiteOpenMscomctlProject(lcRoot, lcLog)
   ENDIF
ENDIF

IF TYPE("loProj") #"O"
   lcMsg = "No se pudo abrir mscomctl."+CHR(13)+CHR(13)
   lcMsg = lcMsg+"Deja abierto Project Manager mscomctl o revisa build_mscomctl.log"
   DO SuiteNotifyUser WITH lcMsg, 16, "Reparar", lcLog
   RETURN
ENDIF

STRTOFILE("=== RepairMscomctlFromLfn "+TTOC(DATETIME())+" ==="+CHR(13), lcLog, .T.)
STRTOFILE("project files="+ALLTRIM(STR(loProj.Files.Count))+CHR(13), lcLog, .T.)

IF llSkipList
   lnAdded = loProj.Files.Count
   STRTOFILE("lista lfn omitida (proyecto ya completo)"+CHR(13), lcLog, .T.)
ENDIF

IF .NOT. llSkipList
   IF .NOT. FILE(lcList)
      DO SuiteNotifyUser WITH "Falta "+lcList+CHR(13)+"Ejecuta REPARAR-PJT.bat.", 16, "Reparar", lcLog
      RETURN
   ENDIF
   lcMsg = "Anadiendo archivos (~1615). Puede tardar varios minutos."
   WAIT WINDOW lcMsg TIMEOUT 3
   lcText = FILETOSTR(FULLPATH(lcList))
   IF EMPTY(lcText)
      STRTOFILE("FILETOSTR vacio: "+lcList+CHR(13), lcLog, .T.)
      DO SuiteNotifyUser WITH "No se puede leer "+lcList+CHR(13)+"Ejecuta REPARAR-PJT.bat.", 16, "Reparar", lcLog
      RETURN
   ENDIF
   lnLines = ALINES(laList, lcText)
   FOR lnI = 1 TO lnLines
      lcLine = ALLTRIM(laList[lnI])
      lcLine = STRTRAN(lcLine, CHR(13), "")
      lcLine = ALLTRIM(STRTRAN(lcLine, CHR(10), ""))
      IF EMPTY(lcLine) .OR. LEFT(lcLine, 1) = "#"
         LOOP
      ENDIF
      lcLine = STRTRAN(lcLine, "/", "\")
      IF .NOT. FILE(lcRoot + lcLine)
         STRTOFILE("missing: "+lcLine+CHR(13), lcLog, .T.)
         LOOP
      ENDIF
      IF SuiteProjHasFile(loProj, lcRoot + lcLine)
         LOOP
      ENDIF
      lcSav = ON("ERROR")
      ON ERROR STRTOFILE("add fail: "+lcLine+" "+MESSAGE()+CHR(13), lcLog, .T.)
      loProj.Files.Add(FULLPATH(lcRoot + lcLine))
      lnAdded = lnAdded + 1
      ON ERROR &lcSav
   ENDFOR
ENDIF

STRTOFILE("added="+ALLTRIM(STR(lnAdded))+" total="+ALLTRIM(STR(loProj.Files.Count))+CHR(13), lcLog, .T.)

lnTotal = loProj.Files.Count
= SuitePersistProject(loProj, lcLog)

DO SuiteRepairMscomctlProject WITH lcRoot, lcLog

DO SuiteCloseProject
STRTOFILE("RepairMscomctlFromLfn OK "+TTOC(DATETIME())+CHR(13), lcLog, .T.)
lcMsg = "Proyecto listo: "+ALLTRIM(STR(lnTotal))+" archivos en mscomctl."
IF lnAdded > 0
   lcMsg = lcMsg+CHR(13)+"(anadidos ahora: "+ALLTRIM(STR(lnAdded))+")"
ENDIF
lcMsg = lcMsg+CHR(13)+CHR(13)+"Siguiente: DO PROGS\VfpBuildProject.prg"
DO SuiteNotifyUser WITH lcMsg, 64, "Reparar", lcLog
