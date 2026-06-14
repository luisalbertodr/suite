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

FUNCTION SuiteShouldRemoveProjFile
 PARAMETER tcname, tcfull, lcroot
 LOCAL lcname, lcfull, llremove, lccanonfunc, lccanongen, lccanonunlock
 lcname = LOWER(NVL(tcname, ""))
 lcfull = LOWER(NVL(tcfull, ""))
 llremove = .F.
 lccanonfunc = LOWER(SuiteLowerPath(lcroot+"PROGS\funciones.prg"))
 lccanongen = LOWER(SuiteLowerPath(lcroot+"PROGS\general.prg"))
 lccanonunlock = LOWER(SuiteLowerPath(lcroot+"PROGS\suite_full_unlock.prg"))
 IF "suite_reservas_sync"$lcname
    llremove = .T.
 ENDIF
 IF "style-dunasoft"$lcname .OR. "style-dunasoft"$lcfull
    llremove = .T.
 ENDIF
 IF LEFT(lcname, 2)="z:" .OR. LEFT(lcfull, 2)="z:"
    llremove = .T.
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
 ELSE
    CLOSE PROJECT
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
 lcproj = ADDBS(lcroot) + "mscomctl.pjx"
 IF .NOT. FILE(lcproj)
    RETURN .F.
 ENDIF
 RETURN SuiteFileBytes(lcproj) > 100
ENDFUNC

FUNCTION SuitePjxUsable
 PARAMETER lcroot
 LOCAL lcproj
 lcproj = ADDBS(lcroot) + "mscomctl.pjx"
 IF .NOT. FILE(lcproj)
    RETURN .F.
 ENDIF
 RETURN SuiteFileBytes(lcproj) > 50000
ENDFUNC

FUNCTION SuitePjtUsable
 PARAMETER lcroot
 LOCAL lcpjt
 lcpjt = ADDBS(lcroot) + "mscomctl.pjt"
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
 lcpjt = ADDBS(lcroot) + "mscomctl.pjt"
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
 LOCAL loProj, lcwant, lcname
 IF TYPE("_VFP.ActiveProject")#"O"
    RETURN .NULL.
 ENDIF
 loProj = _VFP.ActiveProject
 lcwant = LOWER(FULLPATH(ADDBS(lcroot) + "mscomctl.pjx"))
 lcname = LOWER(FULLPATH(loProj.Name))
 IF lcname = lcwant
    RETURN loProj
 ENDIF
 IF UPPER(JUSTSTEM(loProj.Name)) = "MSCOMCTL"
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
 LOCAL loProj, lcwant, lnI, loP, lcn
 lcwant = LOWER(FULLPATH(ADDBS(lcroot) + "mscomctl.pjx"))
 loProj = .NULL.
 IF TYPE("_VFP.Projects") #"O"
    RETURN .NULL.
 ENDIF
 FOR lnI = 1 TO _VFP.Projects.Count
    loP = _VFP.Projects(lnI)
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
 LOCAL lcproj, lcname, lcsav, loProj, lcerr
 lcname = ADDBS(lcroot) + "mscomctl"
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
 OPEN PROJECT mscomctl
 IF TYPE("_VFP.ActiveProject")="O"
    loProj = _VFP.ActiveProject
 ENDIF
 IF TYPE("loProj")#"O"
    OPEN PROJECT (lcname) EXCLUSIVE
    IF TYPE("_VFP.ActiveProject")="O"
       loProj = _VFP.ActiveProject
    ENDIF
 ENDIF
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
 REMOVE PROCEDURE tcname
 llok = .T.
 ON ERROR &lcsav
 RETURN llok
ENDFUNC

FUNCTION SuitePersistProject
 PARAMETER toProj, tclog
 LOCAL lcsav
 IF TYPE("toProj")#"O"
    RETURN .F.
 ENDIF
 lcsav = ON("ERROR")
 ON ERROR STRTOFILE("persist err: "+MESSAGE()+CHR(13), tclog, .T.)
 toProj.CleanUp()
 toProj.Close(.T.)
 ON ERROR &lcsav
 RETURN .T.
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
 LOCAL lcproj, lcunlock, lcstubs, lcsav, lni, lofile, loproj, lnremoved
 lnremoved = 0
 LOCAL lcname, lcfull, lcconta, lctienda, lcsaldos, lcselcentros
 LOCAL lcfunciones, lcgeneral, lci
 LOCAL ARRAY laadd[4]

 lcproj = lcroot+"mscomctl.pjx"
 lcunlock = lcroot+"PROGS\suite_full_unlock.prg"
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
 loproj = SuiteOpenMscomctlProject(lcroot, tclog)
 ON ERROR &lcsav

 IF TYPE("loProj")#"O"
    STRTOFILE("ERROR: no se pudo abrir mscomctl.pjx (cierra Project Manager)"+CHR(13), tclog, .T.)
    RETURN
 ENDIF

 FOR lni = loProj.Files.Count TO 1 STEP -1
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
 IF SuiteTryRemoveProc("export_build_stubs")
    lnremoved = lnremoved+1
 ENDIF
 lcsav = ON("ERROR")
 ON ERROR *
 REMOVE CLASS suite_full_unlock
 lnremoved = lnremoved+1
 ON ERROR &lcsav

 DO SuiteSafeAddProc WITH lcstubs, "export_build_stubs", tclog
 DO SuiteSafeAddProc WITH lcunlock, "suite_full_unlock", tclog

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

 lcsav = ON("ERROR")
 ON ERROR STRTOFILE("persist err: "+MESSAGE()+CHR(13), tclog, .T.)
 loProj.CleanUp()
 loProj.Close(.T.)
 ON ERROR &lcsav
 STRTOFILE("Reparar proyecto OK removed="+ALLTRIM(STR(lnremoved))+CHR(13), tclog, .T.)
ENDPROC
