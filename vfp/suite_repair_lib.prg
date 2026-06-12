* Utilidades seguras para reparar mscomctl.pjx (rutas Z: rotas, FULLPATH invalido).

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
 IF EMPTY(tcfile) .OR. TYPE("toProj") <> "O"
    RETURN .F.
 ENDIF
 lcwant = UPPER(SuiteLowerPath(tcfile))
 FOR lnj = 1 TO toproj.Files.Count
    lcpj = UPPER(SuiteLowerPath(toproj.Files(lnj).Name))
    IF lcpj == lcwant
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
 lccanonfunc = LOWER(SuiteLowerPath(lcroot + "PROGS\funciones.prg"))
 lccanongen = LOWER(SuiteLowerPath(lcroot + "PROGS\general.prg"))
 lccanonunlock = LOWER(SuiteLowerPath(lcroot + "PROGS\suite_full_unlock.prg"))
 IF "suite_reservas_sync"$lcname
    llremove = .T.
 ENDIF
 IF "style-dunasoft"$lcname .OR. "style-dunasoft"$lcfull
    llremove = .T.
 ENDIF
 IF LEFT(lcname, 2) = "z:" .OR. LEFT(lcfull, 2) = "z:"
    llremove = .T.
 ENDIF
 IF "suite_full_unlock"$lcname
    IF JUSTEXT(lcname) <> "prg"
       llremove = .T.
    ELSE
       IF lcfull <> lccanonunlock
          llremove = .T.
       ENDIF
    ENDIF
 ENDIF
 IF JUSTFNAME(lcname) = "funciones.prg" .AND. lcfull <> lccanonfunc
    llremove = .T.
 ENDIF
 IF JUSTFNAME(lcname) = "general.prg" .AND. lcfull <> lccanongen
    llremove = .T.
 ENDIF
 RETURN llremove
ENDFUNC

PROCEDURE SuiteCloseProject
 IF TYPE("_VFP.ActiveProject") = "O"
    CLOSE PROJECT
 ENDIF
ENDPROC

PROCEDURE SuiteRemoveProjFile
 PARAMETER toproj, tcname, tclog
 LOCAL lcsaverr
 IF EMPTY(NVL(tcname, "")) .OR. TYPE("toProj") <> "O"
    RETURN
 ENDIF
 IF  .NOT. EMPTY(tclog)
    STRTOFILE("REMOVE: " + tcname + CHR(13), tclog, .T.)
 ENDIF
 lcsaverr = ON("ERROR")
 ON ERROR
 TRY
    toproj.Files.Remove(tcname)
 CATCH
    TRY
       REMOVE FILE (tcname)
    CATCH
    ENDTRY
 ENDTRY
 ON ERROR &lcsaverr
ENDPROC

PROCEDURE SuitePrepareExportFiles
 PARAMETER lcroot
 LOCAL lcconta, lctienda, lcsaldos, lcselcentros
 lcconta = lcroot + "gestion-dunasoft\gestion\vcx\conta.vcx"
 lctienda = lcroot + "gestion-dunasoft\gestion\vcx\tiendaonline.vcx"
 lcsaldos = lcroot + "scx\saldos.scx"
 lcselcentros = lcroot + "scx\seleccioncentros.scx"
 IF FILE(lcconta)
    COPY FILE (lcconta) TO (lcroot + "vcx\conta.vcx")
    IF FILE(lcroot + "gestion-dunasoft\gestion\vcx\conta.vct")
       COPY FILE (lcroot + "gestion-dunasoft\gestion\vcx\conta.vct") TO (lcroot + "vcx\conta.vct")
    ENDIF
 ENDIF
 IF FILE(lctienda)
    COPY FILE (lctienda) TO (lcroot + "vcx\tiendaonline.vcx")
    IF FILE(lcroot + "gestion-dunasoft\gestion\vcx\tiendaonline.vct")
       COPY FILE (lcroot + "gestion-dunasoft\gestion\vcx\tiendaonline.vct") TO (lcroot + "vcx\tiendaonline.vct")
    ENDIF
 ENDIF
 IF  .NOT. FILE(lcsaldos) .AND. FILE(lcroot + "scx\saldos_tactil.scx")
    COPY FILE (lcroot + "scx\saldos_tactil.scx") TO (lcsaldos)
    COPY FILE (lcroot + "scx\saldos_tactil.sct") TO (lcroot + "scx\saldos.sct")
 ENDIF
 IF  .NOT. FILE(lcselcentros) .AND. FILE(lcroot + "scx\saldos_tactil.scx")
    COPY FILE (lcroot + "scx\saldos_tactil.scx") TO (lcselcentros)
    COPY FILE (lcroot + "scx\saldos_tactil.sct") TO (lcroot + "scx\seleccioncentros.sct")
 ENDIF
ENDPROC

PROCEDURE SuiteRepairMscomctlProject
 PARAMETER lcroot, tclog, lnremoved
 LOCAL lcproj, lcunlock, lcstubs, lcsaverr, lni, lofile, loproj
 LOCAL lcname, lcfull, lcconta, lctienda, lcsaldos, lcselcentros
 LOCAL lcfunciones, lcgeneral, lci
 LOCAL ARRAY laadd[4]

 lcproj = lcroot + "mscomctl.pjx"
 lcunlock = lcroot + "PROGS\suite_full_unlock.prg"
 lcstubs = lcroot + "PROGS\export_build_stubs.prg"
 lcconta = lcroot + "gestion-dunasoft\gestion\vcx\conta.vcx"
 lctienda = lcroot + "gestion-dunasoft\gestion\vcx\tiendaonline.vcx"
 lcsaldos = lcroot + "scx\saldos.scx"
 lcselcentros = lcroot + "scx\seleccioncentros.scx"
 lcfunciones = lcroot + "PROGS\funciones.prg"
 lcgeneral = lcroot + "PROGS\general.prg"

 DO SuitePrepareExportFiles WITH lcroot

 lcsaverr = ON("ERROR")
 ON ERROR STRTOFILE("ERROR: " + MESSAGE() + CHR(13), tclog, .T.)
 DO SuiteCloseProject
 OPEN PROJECT (lcroot + "mscomctl") EXCLUSIVE
 ON ERROR &lcsaverr

 loproj = _VFP.ActiveProject
 IF TYPE("loProj") <> "O"
    STRTOFILE("ERROR: no se pudo abrir mscomctl.pjx" + CHR(13), tclog, .T.)
    RETURN
 ENDIF

 FOR lni = loProj.Files.Count TO 1 STEP -1
    loFile = loProj.Files(lni)
    IF TYPE("loFile") <> "O"
       LOOP
    ENDIF
    lcname = NVL(loFile.Name, "")
    lcfull = SuiteLowerPath(lcname)
    IF SuiteShouldRemoveProjFile(lcname, lcfull, lcroot)
       DO SuiteRemoveProjFile WITH loProj, lcname, tclog
       lnremoved = lnremoved + 1
    ENDIF
 ENDFOR

 TRY
    REMOVE PROCEDURE suite_reservas_sync
    lnremoved = lnremoved + 1
 CATCH
 ENDTRY
 TRY
    REMOVE CLASS suite_full_unlock
    lnremoved = lnremoved + 1
 CATCH
 ENDTRY
 TRY
    REMOVE PROCEDURE suite_full_unlock
 CATCH
 ENDTRY
 TRY
    REMOVE PROCEDURE export_build_stubs
 CATCH
 ENDTRY

 IF FILE(lcstubs)
    ADD PROCEDURE (lcstubs) NAME export_build_stubs
 ENDIF
 IF FILE(lcunlock)
    ADD PROCEDURE (lcunlock) NAME suite_full_unlock
 ENDIF

 laadd[1] = lcconta
 laadd[2] = lctienda
 laadd[3] = lcsaldos
 laadd[4] = lcselcentros
 FOR lni = 1 TO ALEN(laadd)
    IF FILE(laadd[lni]) .AND.  .NOT. SuiteProjHasFile(loProj, laadd[lni])
       loProj.Files.Add(laadd[lni])
       IF  .NOT. EMPTY(tclog)
          STRTOFILE("ADD: " + laadd[lni] + CHR(13), tclog, .T.)
       ENDIF
    ENDIF
 ENDFOR

 FOR lni = 1 TO 2
    lci = IIF(lni = 1, lcfunciones, lcgeneral)
    IF FILE(lci) .AND.  .NOT. SuiteProjHasFile(loProj, lci)
       loProj.Files.Add(lci)
       IF  .NOT. EMPTY(tclog)
          STRTOFILE("ADD: " + lci + CHR(13), tclog, .T.)
       ENDIF
    ENDIF
 ENDFOR

 CLEAN UP PROJECT
 SAVE PROJECT
 DO SuiteCloseProject
ENDPROC
