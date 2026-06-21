* Regenera mscomctlOk.pjx en ExportZ desde repair_project_files.txt (LFN).
* VFP9: SET DEFAULT TO C:\Duna\ExportZ
*        DO PROGS\RepairExportzFromLfn.prg
LOCAL lcRoot, lcBackup, lcList, lcLog, lcStem, lcSav, loProj, lnI, lnLines, lcText, lnAdded, llSkipList, lcMsg, lnTotal
LOCAL lcLine
LOCAL ARRAY laList[1]

lcHere = FULLPATH(SYS(16))
IF EMPTY(lcHere)
   lcHere = FULLPATH("RepairExportzFromLfn.prg")
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

lcBackup = lcRoot + "backup_pjx\"
lcList = lcRoot + "PROGS\repair_project_files.txt"
lcLog = lcRoot + "build_"+lcStem+".log"
lnAdded = 0
llSkipList = .F.

IF .NOT. DIRECTORY(lcBackup)
   MD (lcBackup)
ENDIF

DO SuiteActivateVfp

loProj = SuiteGetActiveMscomctlProject(lcRoot)
IF TYPE("loProj")#"O"
   loProj = SuiteFindMscomctlProject(lcRoot)
ENDIF
IF TYPE("loProj")#"O"
   loProj = SuiteOpenMscomctlProject(lcRoot, lcLog)
ENDIF

IF TYPE("loProj")="O"
   lcSav = ON("ERROR")
   ON ERROR llSkipList = .F.
   llSkipList = (loProj.Files.Count > 500)
   ON ERROR &lcSav
ENDIF

IF TYPE("loProj")#"O" .OR. .NOT. llSkipList
   lcMsg = "Abre o crea el proyecto en VFP:"+CHR(13)+CHR(13)
   lcMsg = lcMsg+"1. File > New > Project > "+lcStem+CHR(13)
   lcMsg = lcMsg+"   Carpeta: "+lcRoot+CHR(13)
   lcMsg = lcMsg+"2. Guardar y dejar Project Manager abierto"+CHR(13)
   lcMsg = lcMsg+"3. Vuelve a ejecutar: DO PROGS\RepairExportzFromLfn.prg"
   IF TYPE("loProj")#"O"
      DO SuiteNotifyUser WITH lcMsg, 48, "Repair ExportZ", lcLog
      RETURN
   ENDIF
   WAIT WINDOW "Crea proyecto "+lcStem+" en "+lcRoot TIMEOUT 5
   loProj = SuiteGetActiveMscomctlProject(lcRoot)
   IF TYPE("loProj")#"O"
      loProj = SuiteOpenMscomctlProject(lcRoot, lcLog)
   ENDIF
   IF TYPE("loProj")#"O"
      lcSav = ON("ERROR")
      ON ERROR llSkipList = .F.
      llSkipList = (loProj.Files.Count > 500)
      ON ERROR &lcSav
   ENDIF
ENDIF

IF TYPE("loProj")#"O"
   DO SuiteNotifyUser WITH lcMsg, 16, "Repair ExportZ", lcLog
   RETURN
ENDIF

STRTOFILE("=== RepairExportzFromLfn "+TTOC(DATETIME())+" ==="+CHR(13), lcLog, .F.)
STRTOFILE("stem="+lcStem+" root="+lcRoot+CHR(13), lcLog, .T.)

IF .NOT. FILE(lcList)
   DO SuiteNotifyUser WITH "Falta "+lcList+CHR(13)+"Ejecuta fix-exportz-pjt.ps1 primero.", 16, "Repair ExportZ", lcLog
   RETURN
ENDIF

IF llSkipList
   lnAdded = loProj.Files.Count
   STRTOFILE("lista omitida, proyecto ya tiene "+ALLTRIM(STR(lnAdded))+" archivos"+CHR(13), lcLog, .T.)
ELSE
   lcText = FILETOSTR(FULLPATH(lcList))
   lnLines = ALINES(laList, lcText)
   WAIT WINDOW "Anadiendo archivos al proyecto..."+CHR(13)+"Puede tardar varios minutos." TIMEOUT 3
   FOR lnI = 1 TO lnLines
      lcLine = ALLTRIM(STRTRAN(STRTRAN(laList(lnI), CHR(13), ""), CHR(10), ""))
      IF EMPTY(lcLine) .OR. LEFT(lcLine, 1)="#"
         LOOP
      ENDIF
      lcLine = STRTRAN(lcLine, "/", "\")
      IF .NOT. FILE(lcRoot+lcLine)
         LOOP
      ENDIF
      IF SuiteProjHasFile(loProj, lcRoot+lcLine)
         LOOP
      ENDIF
      lcSav = ON("ERROR")
      ON ERROR STRTOFILE("add fail: "+lcLine+" "+MESSAGE()+CHR(13), lcLog, .T.)
      loProj.Files.Add(FULLPATH(lcRoot+lcLine))
      lnAdded = lnAdded+1
      ON ERROR &lcSav
   ENDFOR
   STRTOFILE("added="+ALLTRIM(STR(lnAdded))+CHR(13), lcLog, .T.)
ENDIF

DO SuiteRepairMscomctlProject WITH lcRoot, lcLog

lnTotal = 0
IF TYPE("loProj")="O" .OR. TYPE("_VFP.ActiveProject")="O"
   IF TYPE("_VFP.ActiveProject")="O"
      loProj = _VFP.ActiveProject
   ENDIF
   lcSav = ON("ERROR")
   ON ERROR *
   lnTotal = loProj.Files.Count
   ON ERROR &lcSav
ENDIF

STRTOFILE("total files="+ALLTRIM(STR(lnTotal))+CHR(13), lcLog, .T.)
STRTOFILE("RepairExportzFromLfn OK"+CHR(13), lcLog, .T.)

lcMsg = "Proyecto "+lcStem+" listo ("+ALLTRIM(STR(lnTotal))+" archivos)."+CHR(13)+CHR(13)
lcMsg = lcMsg+"File > Save en Project Manager"+CHR(13)
lcMsg = lcMsg+"Luego: martillo Build o refox-replace-exportz.ps1"
DO SuiteNotifyUser WITH lcMsg, 64, "Repair ExportZ", lcLog
