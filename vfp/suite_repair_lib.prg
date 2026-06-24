* Reparar mscomctl.pjx para build VFP9 headless (sin TRY/CATCH, sin prompts COPY).

FUNCTION SuiteLowerPath
 PARAMETER tcfile
 LOCAL lc
 lc = LOWER(ALLTRIM(NVL(tcfile, "")))
 IF EMPTY(lc)
    RETURN ""
 ENDIF
 IF FILE(tcfile)
    RETURN LOWER(FULLPATH(tcfile))
 ENDIF
 RETURN lc
ENDFUNC

FUNCTION SuiteParentPath
 PARAMETER tcPath
 LOCAL lc
 lc = ALLTRIM(NVL(tcPath, ""))
 DO WHILE RIGHT(lc, 1) = "\"
    lc = LEFT(lc, LEN(lc)-1)
 ENDDO
 IF EMPTY(lc)
    RETURN ADDBS(SYS(5)+SYS(2003))
 ENDIF
 RETURN ADDBS(JUSTPATH(lc))
ENDFUNC

FUNCTION SuiteResolveExportRoot
 PARAMETER lcstart
 LOCAL lcroot, lcparent, lnI
 lcroot = ADDBS(NVL(lcstart, ""))
 IF EMPTY(lcroot)
    lcroot = ADDBS(SYS(5)+SYS(2003))
 ENDIF
 IF RIGHT(LOWER(lcroot), 6) = "progs\"
    lcroot = SuiteParentPath(lcroot)
 ENDIF
 FOR lnI = 1 TO 6
    IF FILE(lcroot+"mscomctlok.pjx") OR FILE(lcroot+"mscomctlOk.pjx") OR ;
       FILE(lcroot+"mscomctl.pjx") OR FILE(lcroot+"suite_project.cfg")
       RETURN lcroot
    ENDIF
    lcparent = SuiteParentPath(lcroot)
    IF EMPTY(lcparent) OR LOWER(ADDBS(lcparent)) = LOWER(ADDBS(lcroot))
       EXIT
    ENDIF
    lcroot = ADDBS(lcparent)
 ENDFOR
 IF RIGHT(LOWER(lcroot), 6) = "progs\"
    lcroot = SuiteParentPath(lcroot)
 ENDIF
 RETURN lcroot
ENDFUNC

FUNCTION SuiteResolveProjectStem
 PARAMETER lcroot
 LOCAL lcstem, lccfg, lnN, lnI, lcfile
 LOCAL ARRAY laPjx[1]
 lcroot = ADDBS(NVL(lcroot, ""))
 lccfg = lcroot + "suite_project.cfg"
 IF FILE(lccfg)
    lcstem = ALLTRIM(STRTRAN(FILETOSTR(lccfg), CHR(13)+CHR(10), ""))
    IF .NOT. EMPTY(lcstem)
       RETURN JUSTSTEM(lcstem)
    ENDIF
 ENDIF
 lnN = ADIR(laPjx, lcroot + "mscomctl*.pjx")
 FOR lnI = 1 TO lnN
    lcfile = laPjx(lnI, 1)
    IF .NOT. EMPTY(lcfile)
       RETURN JUSTSTEM(lcfile)
    ENDIF
 ENDFOR
 RETURN "mscomctl"
ENDFUNC

FUNCTION SuiteProjectFile
 PARAMETER lcroot, tcext
 RETURN ADDBS(lcroot) + SuiteResolveProjectStem(lcroot) + "." + tcext
ENDFUNC

FUNCTION SuiteProjHasFile
 PARAMETER toproj, tcfile
 LOCAL lnj, lcwant, lcpj
 IF EMPTY(tcfile) .OR. TYPE("toProj")#"O"
    RETURN .F.
 ENDIF
 lcwant = UPPER(SuiteLowerPath(tcfile))
 FOR lnj = 1 TO toproj.Files.Count
    lcpj = UPPER(SuiteLowerPath(toproj.Files(lnj).Name))
    IF lcpj==lcwant
       RETURN .T.
    ENDIF
 ENDFOR
 RETURN .F.
ENDFUNC

FUNCTION SuiteIsCorruptProjRef
 PARAMETER tcname, tcfull
 LOCAL lcraw, lcbase, lni, lnasc
 lcraw = CHRTRAN(NVL(tcname, ""), CHR(0)+CHR(26), "")
 IF EMPTY(lcraw)
    lcraw = CHRTRAN(NVL(tcfull, ""), CHR(0)+CHR(26), "")
 ENDIF
 lcraw = ALLTRIM(lcraw)
 IF EMPTY(lcraw)
    RETURN .T.
 ENDIF
 IF RIGHT(lcraw, 1) = "\"
    RETURN .T.
 ENDIF
 lcbase = ALLTRIM(JUSTFNAME(lcraw))
 IF EMPTY(lcbase)
    RETURN .T.
 ENDIF
 IF "visual foxpro projects\"$LOWER(lcraw)
    RETURN .T.
 ENDIF
 FOR lni = 1 TO LEN(lcbase)
    lnasc = ASC(SUBSTR(lcbase, lni, 1))
    IF lnasc < 32
       RETURN .T.
    ENDIF
 ENDFOR
 RETURN .F.
ENDFUNC

FUNCTION SuiteShouldRemoveProjFile
 PARAMETER tcname, tcfull, lcroot
 LOCAL lcname, lcfull, llremove, lccanonfunc, lccanongen, lccanonunlock
 IF SuiteIsCorruptProjRef(tcname, tcfull)
    RETURN .T.
 ENDIF
 lcname = LOWER(NVL(tcname, ""))
 lcfull = LOWER(NVL(tcfull, ""))
 llremove = .F.
 lccanonfunc = LOWER(SuiteLowerPath(lcroot+"PROGS\funciones.prg"))
 lccanongen = LOWER(SuiteLowerPath(lcroot+"PROGS\general.prg"))
 lccanonunlock = LOWER(SuiteLowerPath(lcroot+"PROGS\suite_full_unlock.prg"))
 IF "suite_reservas_sync"$lcname
    llremove = .T.
 ENDIF
 IF LEFT(lcname, 2)="z:" .OR. LEFT(lcfull, 2)="z:"
    llremove = .T.
 ENDIF
 IF LEFT(lcname, 2)="y:" .OR. LEFT(lcfull, 2)="y:"
    llremove = .T.
 ENDIF
 IF "style-dunasoft"$lcname .OR. "style-dunasoft"$lcfull
    llremove = .T.
 ENDIF
 IF "c:\users\"$lcname .OR. "c:\users\"$lcfull
    llremove = .T.
 ENDIF
 IF .NOT. EMPTY(lcfull) .AND. FILE(lcfull)
    * ruta absoluta existente bajo ExportZ: conservar
 ELSE
    IF .NOT. EMPTY(lcfull) .AND. (LEFT(lcfull, 2)="c:" .OR. LEFT(lcfull, 2)="d:")
       IF .NOT. (LOWER(LEFT(lcfull, LEN(ADDBS(lcroot))))==LOWER(ADDBS(lcroot)))
          llremove = .T.
       ENDIF
    ENDIF
 ENDIF
 IF "suite_full_unlock"$lcname
    IF JUSTEXT(lcname)<>"prg"
       llremove = .T.
    ELSE
       IF lcfull<>lccanonunlock
          llremove = .T.
       ENDIF
    ENDIF
 ENDIF
 IF JUSTFNAME(lcname)="funciones.prg" .AND. lcfull<>lccanonfunc
    llremove = .T.
 ENDIF
 IF JUSTFNAME(lcname)="general.prg" .AND. lcfull<>lccanongen
    llremove = .T.
 ENDIF
 RETURN llremove
ENDFUNC

PROCEDURE SuiteCloseProject
 LOCAL lcsav
 lcsav = ON("ERROR")
 ON ERROR *
 IF TYPE("_VFP.ActiveProject")="O"
    _VFP.ActiveProject.Close()
 ENDIF
 ON ERROR &lcsav
ENDPROC

FUNCTION SuiteFileBytes
 PARAMETER tcfile
 LOCAL ARRAY laFiles[1]
 IF EMPTY(NVL(tcfile, "")) .OR. .NOT. FILE(tcfile)
    RETURN 0
 ENDIF
 IF ADIR(laFiles, tcfile) > 0
    RETURN laFiles(1, 2)
 ENDIF
 RETURN 0
ENDFUNC

FUNCTION SuitePjxExists
 PARAMETER lcroot
 LOCAL lcproj
 lcproj = SuiteProjectFile(lcroot, "pjx")
 IF .NOT. FILE(lcproj)
    RETURN .F.
 ENDIF
 RETURN SuiteFileBytes(lcproj) > 100
ENDFUNC

FUNCTION SuitePjxUsable
 PARAMETER lcroot
 LOCAL lcproj
 lcproj = SuiteProjectFile(lcroot, "pjx")
 IF .NOT. FILE(lcproj)
    RETURN .F.
 ENDIF
 RETURN SuiteFileBytes(lcproj) > 50000
ENDFUNC

FUNCTION SuitePjtUsable
 PARAMETER lcroot
 LOCAL lcpjt
 lcpjt = SuiteProjectFile(lcroot, "pjt")
 IF .NOT. FILE(lcpjt)
    RETURN .F.
 ENDIF
 RETURN SuiteFileBytes(lcpjt) > 50000
ENDFUNC

FUNCTION SuiteProjectPairUsable
 PARAMETER lcroot
 RETURN SuitePjxUsable(lcroot) .AND. SuitePjtUsable(lcroot)
ENDFUNC

FUNCTION SuitePjtExists
 PARAMETER lcroot
 LOCAL lcpjt
 lcpjt = SuiteProjectFile(lcroot, "pjt")
 IF .NOT. FILE(lcpjt)
    RETURN .F.
 ENDIF
 RETURN SuiteFileBytes(lcpjt) > 100
ENDFUNC

FUNCTION SuiteProjectReady
 PARAMETER lcroot
 RETURN SuitePjxExists(lcroot)
ENDFUNC

PROCEDURE SuiteRemoveBrokenProject
 PARAMETER lcroot, lcbackup, tclog
 LOCAL lcproj, lcpjt, lcsav
 lcproj = lcroot + "mscomctl.pjx"
 lcpjt = lcroot + "mscomctl.pjt"
 lcsav = ON("ERROR")
 ON ERROR *
 IF FILE(lcproj) .AND. SuiteFileBytes(lcproj) < 100
    IF .NOT. EMPTY(tclog)
       STRTOFILE("erase pjx vacio bytes="+ALLTRIM(STR(SuiteFileBytes(lcproj)))+CHR(13), tclog, .T.)
    ENDIF
    IF .NOT. FILE(lcbackup + "mscomctl-before-repair.pjx")
       COPY FILE (lcproj) TO (lcbackup + "mscomctl-before-repair.pjx")
    ENDIF
    ERASE (lcproj)
 ENDIF
 IF FILE(lcpjt) .AND. .NOT. FILE(lcproj)
    IF .NOT. FILE(lcbackup + "mscomctl-bad.pjt")
       COPY FILE (lcpjt) TO (lcbackup + "mscomctl-bad.pjt")
    ENDIF
    ERASE (lcpjt)
 ENDIF
 IF FILE(lcpjt) .AND. FILE(lcproj) .AND. SuiteFileBytes(lcpjt) < 100
    IF .NOT. FILE(lcbackup + "mscomctl-bad.pjt")
       COPY FILE (lcpjt) TO (lcbackup + "mscomctl-bad.pjt")
    ENDIF
    ERASE (lcpjt)
 ENDIF
 ON ERROR &lcsav
ENDPROC

FUNCTION SuiteRestorePjtBackup
 PARAMETER lcroot, lcbackup, tclog
 LOCAL lcdest, lcsrc, lcsav
 lcdest = lcroot + "mscomctl.pjt"
 IF SuitePjtUsable(lcroot)
    RETURN .T.
 ENDIF
 lcsrc = ""
 IF FILE(lcbackup + "mscomctl-20260613.pjt")
    lcsrc = lcbackup + "mscomctl-20260613.pjt"
 ELSE
    IF FILE(lcbackup + "mscomctl-corrupt-20260613.pjt")
       lcsrc = lcbackup + "mscomctl-corrupt-20260613.pjt"
    ENDIF
 ENDIF
 IF EMPTY(lcsrc)
    RETURN .F.
 ENDIF
 lcsav = ON("ERROR")
 ON ERROR *
 IF FILE(lcdest)
    ERASE (lcdest)
 ENDIF
 COPY FILE (lcsrc) TO (lcdest)
 ON ERROR &lcsav
 IF .NOT. EMPTY(tclog)
    STRTOFILE("restore pjt backup bytes="+ALLTRIM(STR(SuiteFileBytes(lcdest)))+CHR(13), tclog, .T.)
 ENDIF
 RETURN SuitePjtUsable(lcroot)
ENDFUNC

FUNCTION SuiteRestorePjxBackup
 PARAMETER lcroot, lcbackup, tclog
 LOCAL lcgood, lcdest
 lcgood = lcbackup + "mscomctl-20260613.pjx"
 lcdest = lcroot + "mscomctl.pjx"
 IF SuitePjxUsable(lcroot)
    RETURN .T.
 ENDIF
 IF .NOT. FILE(lcgood)
    RETURN .F.
 ENDIF
 IF FILE(lcdest)
    ERASE (lcdest)
 ENDIF
 COPY FILE (lcgood) TO (lcdest)
 IF .NOT. EMPTY(tclog)
    STRTOFILE("restore pjx backup bytes="+ALLTRIM(STR(SuiteFileBytes(lcdest)))+CHR(13), tclog, .T.)
 ENDIF
 RETURN SuitePjxUsable(lcroot)
ENDFUNC

FUNCTION SuiteRestoreProjectPair
 PARAMETER lcroot, lcbackup, tclog
 LOCAL llok
 llok = SuiteRestorePjxBackup(lcroot, lcbackup, tclog)
 llok = SuiteRestorePjtBackup(lcroot, lcbackup, tclog) .AND. llok
 RETURN SuiteProjectPairUsable(lcroot)
ENDFUNC

PROCEDURE SuiteActivateVfp
 _SCREEN.Visible = .T.
 ACTIVATE SCREEN
ENDPROC

PROCEDURE SuiteNotifyUser
 PARAMETER tcmsg, tnicon, tctitle, tclog
 IF UPPER(ALLTRIM(GETENV("SUITE_VFP_HEADLESS"))) == "1"
    IF .NOT. EMPTY(tclog)
       STRTOFILE(ALLTRIM(tctitle)+": "+tcmsg+CHR(13), tclog, .T.)
    ENDIF
    RETURN
 ENDIF
 DO SuiteActivateVfp
 IF .NOT. EMPTY(tclog)
    STRTOFILE(ALLTRIM(tctitle)+": "+tcmsg+CHR(13), tclog, .T.)
 ENDIF
 MESSAGEBOX(tcmsg, tnicon, tctitle)
ENDPROC

FUNCTION SuiteWaitForPjx
 PARAMETER lcroot, tclog, tnseconds
 LOCAL lnI
 FOR lnI = 1 TO tnseconds
    IF SuitePjxExists(lcroot)
       RETURN .T.
    ENDIF
    WAIT WINDOW NOWAIT "Confirma CREATE PROJECT en VFP (quedan "+ALLTRIM(STR(tnseconds-lnI))+" s)"
    DO SuiteActivateVfp
    = INKEY(1, "H")
 ENDFOR
 RETURN SuitePjxExists(lcroot)
ENDFUNC

FUNCTION SuiteGetActiveMscomctlProject
 PARAMETER lcroot
 LOCAL loProj, lcwant, lcname, lcstem, lcprojdir
 IF TYPE("_VFP.ActiveProject")#"O"
    RETURN .NULL.
 ENDIF
 loProj = _VFP.ActiveProject
 lcstem = SuiteResolveProjectStem(lcroot)
 lcroot = ADDBS(lcroot)
 lcwant = LOWER(FULLPATH(lcroot + lcstem + ".pjx"))
 lcname = LOWER(FULLPATH(loProj.Name))
 IF lcname = lcwant
    RETURN loProj
 ENDIF
 IF UPPER(JUSTSTEM(loProj.Name)) = UPPER(lcstem)
    RETURN loProj
 ENDIF
 * PM abierto en ExportZ (p. ej. proyecto recien creado con otro nombre temporal).
 lcprojdir = LOWER(FULLPATH(JUSTPATH(loProj.Name)))
 IF lcprojdir = LOWER(FULLPATH(lcroot))
    RETURN loProj
 ENDIF
 RETURN .NULL.
ENDFUNC

FUNCTION SuiteCreateMscomctlProject
 PARAMETER lcroot, tclog, tnseconds
 LOCAL lcproj, lcpjt, lcmsg, lcsav
 IF SuitePjxExists(lcroot)
    IF .NOT. EMPTY(tclog)
       STRTOFILE("create skip: pjx ya existe bytes="+ALLTRIM(STR(SuiteFileBytes(lcroot+"mscomctl.pjx")))+CHR(13), tclog, .T.)
    ENDIF
    RETURN .T.
 ENDIF
 DO SuiteActivateVfp
 IF .NOT. EMPTY(tclog)
    STRTOFILE("manual create project (File > New > Project)"+CHR(13), tclog, .T.)
 ENDIF
 lcmsg = "CREAR PROYECTO MANUALMENTE EN VFP"+CHR(13)+CHR(13)
 lcmsg = lcmsg+"1. Menu File > New > Project"+CHR(13)
 lcmsg = lcmsg+"2. Nombre: mscomctl"+CHR(13)
 lcmsg = lcmsg+"3. Carpeta: C:\Duna\Export"+CHR(13)
 lcmsg = lcmsg+"4. Guardar (Save)"+CHR(13)+CHR(13)
 lcmsg = lcmsg+"Pulsa una tecla cuando veas mscomctl.pjx creado."
 WAIT WINDOW lcmsg
 DO SuiteActivateVfp
 IF SuitePjxExists(lcroot)
    IF .NOT. EMPTY(tclog)
       STRTOFILE("manual create ok bytes="+ALLTRIM(STR(SuiteFileBytes(lcroot+"mscomctl.pjx")))+CHR(13), tclog, .T.)
    ENDIF
    RETURN .T.
 ENDIF
 lcsav = ON("ERROR")
 ON ERROR STRTOFILE("create auto err: "+MESSAGE()+CHR(13), tclog, .T.)
 CREATE PROJECT mscomctl NOWAIT
 ON ERROR &lcsav
 IF .NOT. SuiteWaitForPjx(lcroot, tclog, 15)
    RETURN .F.
 ENDIF
 IF .NOT. EMPTY(tclog)
    STRTOFILE("create ok bytes="+ALLTRIM(STR(SuiteFileBytes(lcroot+"mscomctl.pjx")))+CHR(13), tclog, .T.)
 ENDIF
 RETURN .T.
ENDFUNC

FUNCTION SuiteFindMscomctlProject
 PARAMETER lcroot
 LOCAL loProj, lcwant, lnI, loP, lcn, lcstem, lcsav
 lcstem = SuiteResolveProjectStem(lcroot)
 lcwant = LOWER(FULLPATH(ADDBS(lcroot) + lcstem + ".pjx"))
 loProj = .NULL.
 IF TYPE("_VFP.Projects") #"O"
    RETURN .NULL.
 ENDIF
 FOR lnI = 1 TO _VFP.Projects.Count
    loP = .NULL.
    lcsav = ON("ERROR")
    ON ERROR *
    IF TYPE("_VFP.Projects.Item")="U"
       loP = _VFP.Projects(lnI)
    ELSE
       loP = _VFP.Projects.Item(lnI)
    ENDIF
    ON ERROR &lcsav
    IF TYPE("loP")="O"
       lcn = LOWER(FULLPATH(loP.Name))
       IF lcn = lcwant
          loProj = loP
          EXIT
       ENDIF
    ENDIF
 ENDFOR
 RETURN loProj
ENDFUNC

FUNCTION SuiteOpenMscomctlProject
 PARAMETER lcroot, tclog
 LOCAL lcproj, lcname, lcsav, loProj, lcerr, lcstem, lcOldDef
 lcstem = SuiteResolveProjectStem(lcroot)
 lcroot = ADDBS(lcroot)
 lcname = lcroot + lcstem
 lcproj = lcname + ".pjx"
 IF .NOT. FILE(lcproj)
    RETURN .NULL.
 ENDIF
 loProj = SuiteFindMscomctlProject(lcroot)
 IF TYPE("loProj")="O"
    RETURN loProj
 ENDIF
 DO SuiteCloseProject
 loProj = .NULL.
 lcerr = ""
 lcsav = ON("ERROR")
 ON ERROR lcerr = MESSAGE()
 * OPEN PROJECT devuelve Syntax error en VFP9 batch; MODIFY PROJECT abre el PM.
 lcOldDef = SET("DEFAULT")
 SET DEFAULT TO (lcroot)
 MODIFY PROJECT (lcstem) NOWAIT
 LOCAL lnWait
 FOR lnWait = 1 TO 30
    IF TYPE("_VFP.ActiveProject")="O"
       loProj = SuiteGetActiveMscomctlProject(lcroot)
       IF TYPE("loProj")="O"
          EXIT
       ENDIF
    ENDIF
    loProj = SuiteFindMscomctlProject(lcroot)
    IF TYPE("loProj")="O"
       EXIT
    ENDIF
    = INKEY(0.2, "H")
 ENDFOR
 SET DEFAULT TO (lcOldDef)
 IF TYPE("loProj")#"O"
    loProj = SuiteFindMscomctlProject(lcroot)
 ENDIF
 ON ERROR &lcsav
 IF TYPE("loProj")#"O" .AND. .NOT. EMPTY(tclog)
    STRTOFILE("open fail: "+ALLTRIM(lcerr)+CHR(13), tclog, .T.)
 ENDIF
 IF TYPE("loProj")="O"
    RETURN loProj
 ENDIF
 RETURN .NULL.
ENDFUNC

PROCEDURE SuiteSafeCopyFile
 PARAMETER tcsrc, tcdst, tclog
 LOCAL lcsav
 IF  .NOT. FILE(tcsrc)
    RETURN
 ENDIF
 lcsav = ON("ERROR")
 ON ERROR STRTOFILE("COPY FAIL "+tcsrc+" -> "+tcdst+" "+MESSAGE()+CHR(13), tclog, .T.)
 IF FILE(tcdst)
    ERASE (tcdst)
 ENDIF
 COPY FILE (tcsrc) TO (tcdst)
 ON ERROR &lcsav
 IF  .NOT. EMPTY(tclog)
    STRTOFILE("COPY OK "+tcdst+CHR(13), tclog, .T.)
 ENDIF
ENDPROC

PROCEDURE SuiteRemoveProjFile
 PARAMETER toproj, tcname, tclog
 LOCAL lcsav
 IF EMPTY(NVL(tcname, "")) .OR. TYPE("toProj")#"O"
    RETURN
 ENDIF
 IF  .NOT. EMPTY(tclog)
    STRTOFILE("REMOVE: "+tcname+CHR(13), tclog, .T.)
 ENDIF
 lcsav = ON("ERROR")
 ON ERROR *
 toproj.Files.Remove(tcname)
 ON ERROR &lcsav
ENDPROC

PROCEDURE SuiteExcludeProjV2Suites
 PARAMETER toproj, tclog
 LOCAL lni, loFile, lcStem, lnN
 IF TYPE("toProj")#"O"
    RETURN
 ENDIF
 lnN = 0
 FOR lni = 1 TO toProj.Files.Count
    loFile = toProj.Files(lni)
    IF TYPE("loFile")#"O"
       LOOP
    ENDIF
    lcStem = LOWER(JUSTSTEM(loFile.Name))
    IF lcStem=="suite_cola_sync" .OR. lcStem=="suite_control_sync" .OR. lcStem=="export_build_stubs"
       loFile.Exclude = .T.
       lnN = lnN+1
       IF  .NOT. EMPTY(tclog)
          STRTOFILE("EXCLUDE: "+loFile.Name+CHR(13), tclog, .T.)
       ENDIF
    ENDIF
 ENDFOR
 IF  .NOT. EMPTY(tclog)
    STRTOFILE("EXCLUDE v2 count="+ALLTRIM(STR(lnN))+CHR(13), tclog, .T.)
 ENDIF
ENDPROC

PROCEDURE SuitePrepareExportFiles
 PARAMETER lcroot, tclog
 LOCAL lcconta, lctienda, lcsaldos, lcselcentros
 lcconta = lcroot+"gestion-dunasoft\gestion\vcx\conta.vcx"
 lctienda = lcroot+"gestion-dunasoft\gestion\vcx\tiendaonline.vcx"
 lcsaldos = lcroot+"scx\saldos.scx"
 lcselcentros = lcroot+"scx\seleccioncentros.scx"
 IF FILE(lcconta)
    DO SuiteSafeCopyFile WITH lcconta, lcroot+"vcx\conta.vcx", tclog
    IF FILE(lcroot+"gestion-dunasoft\gestion\vcx\conta.vct")
       DO SuiteSafeCopyFile WITH lcroot+"gestion-dunasoft\gestion\vcx\conta.vct", lcroot+"vcx\conta.vct", tclog
    ENDIF
 ENDIF
 IF FILE(lctienda)
    DO SuiteSafeCopyFile WITH lctienda, lcroot+"vcx\tiendaonline.vcx", tclog
    IF FILE(lcroot+"gestion-dunasoft\gestion\vcx\tiendaonline.vct")
       DO SuiteSafeCopyFile WITH lcroot+"gestion-dunasoft\gestion\vcx\tiendaonline.vct", lcroot+"vcx\tiendaonline.vct", tclog
    ENDIF
 ENDIF
 IF  .NOT. FILE(lcsaldos) .AND. FILE(lcroot+"scx\saldos_tactil.scx")
    DO SuiteSafeCopyFile WITH lcroot+"scx\saldos_tactil.scx", lcsaldos, tclog
    DO SuiteSafeCopyFile WITH lcroot+"scx\saldos_tactil.sct", lcroot+"scx\saldos.sct", tclog
 ENDIF
 IF  .NOT. FILE(lcselcentros) .AND. FILE(lcroot+"scx\saldos_tactil.scx")
    DO SuiteSafeCopyFile WITH lcroot+"scx\saldos_tactil.scx", lcselcentros, tclog
    DO SuiteSafeCopyFile WITH lcroot+"scx\saldos_tactil.sct", lcroot+"scx\seleccioncentros.sct", tclog
 ENDIF
ENDPROC

FUNCTION SuiteTryRemoveProc
 PARAMETER tcname
 LOCAL lcsav, llok
 llok = .F.
 IF EMPTY(NVL(tcname, ""))
    RETURN .F.
 ENDIF
 lcsav = ON("ERROR")
 ON ERROR llok = .F.
 REMOVE PROCEDURE &tcname
 llok = .T.
 ON ERROR &lcsav
 RETURN llok
ENDFUNC

FUNCTION SuitePersistProject
 PARAMETER toProj, tclog
 LOCAL lcsav, loP, llok
 llok = .F.
 loP = .NULL.
 IF TYPE("_VFP.ActiveProject")="O"
    loP = _VFP.ActiveProject
 ELSEIF TYPE("toProj")="O"
    loP = toProj
 ENDIF
 IF TYPE("loP")#"O"
    IF .NOT. EMPTY(tclog)
       STRTOFILE("persist skip: sin ActiveProject"+CHR(13), tclog, .T.)
    ENDIF
    RETURN .F.
 ENDIF
 lcsav = ON("ERROR")
 ON ERROR STRTOFILE("persist err: "+MESSAGE()+CHR(13), tclog, .T.)
 * No usar CleanUp: en VFP9 provoca OLE 0x80020011 en algunos builds.
 loP.Close(.T.)
 llok = .T.
 ON ERROR &lcsav
 IF llok .AND. .NOT. EMPTY(tclog)
    STRTOFILE("persist OK"+CHR(13), tclog, .T.)
 ENDIF
 RETURN llok
ENDFUNC

PROCEDURE SuiteSafeAddProc
 PARAMETER tcfile, tcname, tclog
 LOCAL lcsav
 IF  .NOT. FILE(tcfile)
    RETURN
 ENDIF
 lcsav = ON("ERROR")
 ON ERROR STRTOFILE("SET PROC FAIL "+tcname+" "+MESSAGE()+CHR(13), tclog, .T.)
 SET PROCEDURE TO (tcfile) ADDITIVE
 STRTOFILE("SET PROC "+tcname+CHR(13), tclog, .T.)
 ON ERROR &lcsav
ENDPROC

PROCEDURE SuiteRepairMscomctlProject
 PARAMETER lcroot, tclog
 LOCAL lcproj, lcstubs, lccola, lccontrol, lcsav, lni, lofile, loproj, lnremoved
 lnremoved = 0
 LOCAL lcname, lcfull, lcconta, lctienda, lcsaldos, lcselcentros
 LOCAL lcfunciones, lcgeneral, lci
 LOCAL ARRAY laadd[4]

 lcproj = SuiteProjectFile(lcroot, "pjx")
 lccola = lcroot+"PROGS\suite_cola_sync.prg"
 lccontrol = lcroot+"PROGS\suite_control_sync.prg"
 lcstubs = lcroot+"PROGS\export_build_stubs.prg"
 lcconta = lcroot+"gestion-dunasoft\gestion\vcx\conta.vcx"
 lctienda = lcroot+"gestion-dunasoft\gestion\vcx\tiendaonline.vcx"
 lcsaldos = lcroot+"scx\saldos.scx"
 lcselcentros = lcroot+"scx\seleccioncentros.scx"
 lcfunciones = lcroot+"PROGS\funciones.prg"
 lcgeneral = lcroot+"PROGS\general.prg"

 DO SuitePrepareExportFiles WITH lcroot, tclog

 lcsav = ON("ERROR")
 ON ERROR STRTOFILE("ERROR open: "+MESSAGE()+CHR(13), tclog, .T.)
 IF TYPE("_VFP.ActiveProject")="O" .AND. UPPER(JUSTSTEM(_VFP.ActiveProject.Name))==UPPER(SuiteResolveProjectStem(lcroot))
    loProj = _VFP.ActiveProject
    STRTOFILE("repair: ActiveProject PM abierto"+CHR(13), tclog, .T.)
 ELSE
    loProj = SuiteOpenMscomctlProject(lcroot, tclog)
 ENDIF
 ON ERROR &lcsav

 IF TYPE("loProj")#"O"
    STRTOFILE("ERROR: no se pudo abrir "+SuiteResolveProjectStem(lcroot)+".pjx (cierra Project Manager)"+CHR(13), tclog, .T.)
    RETURN
 ENDIF

 LOCAL lnFileCount, lcCountErr
 lnFileCount = 0
 lcCountErr = ""
 lcSav = ON("ERROR")
 ON ERROR lcCountErr = MESSAGE()
 lnFileCount = loProj.Files.Count
 ON ERROR &lcSav
 IF .NOT. EMPTY(lcCountErr)
    STRTOFILE("ERROR pjt memo: "+lcCountErr+CHR(13), tclog, .T.)
    STRTOFILE("Usa: DO PROGS\RepairExportzFromLfn.prg (proyecto nuevo o Ignore All al abrir)"+CHR(13), tclog, .T.)
    RETURN
 ENDIF

 FOR lni = lnFileCount TO 1 STEP -1
    loFile = loProj.Files(lni)
    IF TYPE("loFile")#"O"
       LOOP
    ENDIF
    lcname = NVL(loFile.Name, "")
    lcfull = SuiteLowerPath(lcname)
    IF SuiteShouldRemoveProjFile(lcname, lcfull, lcroot)
       DO SuiteRemoveProjFile WITH loProj, lcname, tclog
       lnremoved = lnremoved+1
    ENDIF
 ENDFOR

 IF SuiteTryRemoveProc("suite_reservas_sync")
    lnremoved = lnremoved+1
 ENDIF
 IF SuiteTryRemoveProc("suite_full_unlock")
    lnremoved = lnremoved+1
 ENDIF
 IF SuiteTryRemoveProc("suite_cola_sync")
    lnremoved = lnremoved+1
 ENDIF
 IF SuiteTryRemoveProc("suite_control_sync")
    lnremoved = lnremoved+1
 ENDIF
 IF SuiteTryRemoveProc("export_build_stubs")
    lnremoved = lnremoved+1
 ENDIF
 lcsav = ON("ERROR")
 ON ERROR *
 REMOVE CLASS suite_full_unlock
 lnremoved = lnremoved+1
 ON ERROR &lcsav

 * v2: suite_cola_sync y control van #INCLUDE en general.prg (excluir del build suelto).
 DO SuiteExcludeProjV2Suites WITH loProj, tclog

 laadd[1] = lcconta
 laadd[2] = lctienda
 laadd[3] = lcsaldos
 laadd[4] = lcselcentros
 FOR lni = 1 TO ALEN(laadd)
    IF FILE(laadd[lni]) .AND.  .NOT. SuiteProjHasFile(loProj, laadd[lni])
       loProj.Files.Add(laadd[lni])
       STRTOFILE("ADD: "+laadd[lni]+CHR(13), tclog, .T.)
    ENDIF
 ENDFOR

 FOR lni = 1 TO 2
    lci = IIF(lni=1, lcfunciones, lcgeneral)
    IF FILE(lci) .AND.  .NOT. SuiteProjHasFile(loProj, lci)
       loProj.Files.Add(lci)
       STRTOFILE("ADD: "+lci+CHR(13), tclog, .T.)
    ENDIF
 ENDFOR

 * funciones.prg ya incluye v2 via #INCLUDE; no anadir PRGs sueltos al proyecto.
 STRTOFILE("suite v2 #INCLUDE inline al inicio de general.prg"+CHR(13), tclog, .T.)

 LOCAL lcstem, lcolddef, lcPersistErr
 lcstem = SuiteResolveProjectStem(lcroot)
 lcPersistErr = ""
 * Los cambios en Files quedan en el PM abierto; BUILD en verify guarda al compilar.
 STRTOFILE("persist: omitido BUILD PROJECT (guardar al compilar exe)"+CHR(13), tclog, .T.)
 * No llamar Close(): provoca OLE 0x80020011; BUILD PROJECT ya guardo .pjx/.pjt.
 STRTOFILE("Reparar proyecto OK removed="+ALLTRIM(STR(lnremoved))+CHR(13), tclog, .T.)
 STRTOFILE("NOTA: si el PM sigue abierto, File > Save y cierra el proyecto"+CHR(13), tclog, .T.)
ENDPROC
