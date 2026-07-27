 PARAMETER pcfilename, pcreport
 IF VARTYPE(pcfilename)<>"C" .OR. VARTYPE(pcreport)<>"C" .OR. EMPTY(pcfilename) .OR. EMPTY(pcreport)
    = _messagebox(traducir(pcidioma, "No se han pasado parametros a Print2PDF"), 48, traducir(pcidioma, "Error"))
    RETURN .F.
 ENDIF
 LOCAL lopdf
 lopdf = .NULL.
 lopdf = CREATEOBJECT("Print2PDF")
 IF ISNULL(lopdf)
    = _messagebox(traducir(pcidioma, "No se pudo crear la clase PDF!"), 48, traducir(pcidioma, "Error"))
    RETURN .F.
 ENDIF
 WITH lopdf
    .coutputfile = pcfilename
    .creport = pcreport
    llresult = .main()
 ENDWITH
 IF  .NOT. llresult .OR. lopdf.lerror
    = _messagebox(traducir(pcidioma, "Este error ocurrio creado el archivo PDF:")+CHR(13)+ALLTRIM(lopdf.cerror), 48, traducir(pcidioma, "Error Message"))
 ENDIF
 lopdf = .NULL.
 RELEASE lopdf
 RETURN .T.
ENDFUNC
**
DEFINE CLASS Print2PDF AS relation
 creport = SPACE(0)
 coutputfile = SPACE(0)
 cstartfolder = ""
 ctemppath = SPACE(0)
 cextrarptclauses = SPACE(0)
 lreadini = .T.
 cinifile = "ImpresionPDF.ini"
 lfoundprinter = .F.
 lfoundgs = .F.
 cpsprinter = SPACE(0)
 cpscolorprinter = SPACE(0)
 lusecolor = .T.
 cprintresolution = SPACE(0)
 cpsfile = SPACE(0)
 lerasepsfile = .T.
 cpdffile = SPACE(0)
 cgsfolder = SPACE(0)
 lerror = .F.
 cerror = ""
 corigsafety = SPACE(0)
 corigprinter = SPACE(0)
 iinstallcount = 1
 DIMENSION ainstall[1, 7]
 ainstall[1, 1] = SPACE(0)
 ainstall[1, 2] = .T.
 ainstall[1, 3] = SPACE(0)
 ainstall[1, 4] = SPACE(0)
 ainstall[1, 5] = SPACE(0)
 ainstall[1, 6] = SPACE(0)
 ainstall[1, 7] = SPACE(0)
**
   FUNCTION init
    LPARAMETERS pcfilename, pcreport, plrunnow
    WITH this
       .corigsafety = SET("safety")
       .corigprinter = SET("Printer", 3)
       .lerror = .F.
       .cerror = ""
       IF TYPE("pcFileName")="C" .AND.  .NOT. EMPTY(pcfilename)
          .coutputfile = ALLTRIM(pcfilename)
       ENDIF
       IF TYPE("pcReport")="C" .AND.  .NOT. EMPTY(pcreport)
          .creport = ALLTRIM(pcreport)
       ENDIF
       IF TYPE("plDesarrollo")<>"L"
          .cstartfolder = SYS(5)+SYS(2003)
       ELSE
          .cstartfolder = ""
       ENDIF
    ENDWITH
    SET SAFETY OFF
    IF TYPE("plRunNow")="L" .AND. plrunnow=.T.
       RETURN this.main()
    ENDIF
   ENDFUNC
**
   PROCEDURE CleanUp
    LOCAL lcorigprinter, lcorigsafety
    WITH this
       lcorigsafety = .corigsafety
       lcorigprinter = .corigprinter
    ENDWITH
    IF  .NOT. EMPTY(lcorigsafety)
       SET SAFETY &lcorigsafety
    ENDIF
    IF  .NOT. EMPTY(lcorigprinter)
       SET PRINTER TO
       SET PRINTER TO NAME "&lcOrigPrinter"
    ENDIF
    RETURN
   ENDPROC
**
   FUNCTION ResetError
    WITH this
       .lerror = .F.
       .ierror = 0
       .cerror = ""
    ENDWITH
    RETURN .T.
   ENDFUNC
**
   FUNCTION main
    LPARAMETERS pcfilename, pcreport
    LOCAL x
    STORE 0 TO x
    WITH this
       IF TYPE("pcFileName")="C" .AND.  .NOT. EMPTY(pcfilename)
          .coutputfile = ALLTRIM(pcfilename)
       ENDIF
       IF TYPE("pcReport")="C" .AND.  .NOT. EMPTY(pcreport)
          .creport = ALLTRIM(pcreport)
       ENDIF
       IF EMPTY(.creport) .OR. EMPTY(.coutputfile)
          .lerror = .T.
          .cerror(".cReport and/or .cOutputFile empty", 48, "Error")
          RETURN .F.
       ENDIF
       IF  .NOT. .lerror
          = .readini()
       ENDIF
       IF  .NOT. .lerror
          = .setprinter()
       ENDIF
       IF  .NOT. .lerror
          = .makeps()
       ENDIF
       IF  .NOT. .lerror
          = .gsfind()
       ENDIF
       IF  .NOT. .lerror
          = .makepdf()
       ENDIF
       IF  .NOT. .lerror
          = .instpdfreader()
       ENDIF
       .cleanup()
    ENDWITH
    RETURN  .NOT. this.lerror
   ENDFUNC
**
   FUNCTION ReadINI
    LOCAL lctmp
    STORE "" TO lctmp
    IF this.lreadini=.T.
       DECLARE INTEGER GetPrivateProfileString IN WIN32API STRING, STRING, STRING, STRING @, INTEGER, STRING
       WITH this
          IF EMPTY(.cpsprinter)
             .cpsprinter = .readinisetting("PostScript", "cPSPrinter")
          ENDIF
          IF EMPTY(.cpscolorprinter)
             .cpscolorprinter = .readinisetting("PostScript", "cPSColorPrinter")
          ENDIF
          IF EMPTY(.cpsfile)
             .cpsfile = .readinisetting("PostScript", "cPSFile")
          ENDIF
          IF EMPTY(.ctemppath)
             .ctemppath = .readinisetting("PostScript", "cTempPath")
          ENDIF
          IF EMPTY(.cpdffile)
             .cpdffile = .readinisetting("GhostScript", "cPDFFile")
          ENDIF
          IF EMPTY(.cgsfolder)
             .cgsfolder = .readinisetting("GhostScript", "cGSFolder")
          ENDIF
          IF EMPTY(.cprintresolution)
             .cprintresolution = .readinisetting("PostScript", "cPrintResolution")
          ENDIF
          lctmp = .readinisetting("Install", "iInstallCount")
          IF  .NOT. EMPTY(lctmp)
             .iinstallcount = VAL(lctmp)
             IF .iinstallcount>1
                DIMENSION .ainstall[.iinstallcount, 7]
             ENDIF
             FOR x = 1 TO .iinstallcount
                .ainstall[x, 1] = UPPER(.readinisetting("Install", "cInstID"+TRANSFORM(x)))
                lctmp = UPPER(.readinisetting("Install", "lAllowInst"+TRANSFORM(x)))
                .ainstall[x, 2] = IIF("T"$lctmp .OR. "Y"$lctmp, .T., .F.)
                .ainstall[x, 3] = .readinisetting("Install", "cInstProduct"+TRANSFORM(x))
                .ainstall[x, 4] = .readinisetting("Install", "cInstUserDescr"+TRANSFORM(x))
                .ainstall[x, 5] = .readinisetting("Install", "cInstFolder"+TRANSFORM(x))
                .ainstall[x, 6] = .readinisetting("Install", "cInstExe"+TRANSFORM(x))
                .ainstall[x, 7] = .readinisetting("Install", "cInstInstr"+TRANSFORM(x))
             ENDFOR
          ENDIF
       ENDWITH
    ENDIF
    IF EMPTY(.cpsprinter)
       .cpsprinter = "GENERIC POSTSCRIPT PRINTER"
    ENDIF
    IF EMPTY(.cpscolorprinter)
       .cpscolorprinter = "GENERIC COLOR POSTSCRIPT"
    ENDIF
    IF EMPTY(.ctemppath)
       .ctemppath = SYS(2023)+IIF(RIGHT(SYS(2023), 1)="\", "", "\")
    ENDIF
    IF EMPTY(.cprintresolution)
       .cprintresolution = "800x600"
    ENDIF
    RETURN .T.
   ENDFUNC
**
   FUNCTION ReadIniSetting
    LPARAMETERS pcsection, pcsetting
    LOCAL lcretvalue, lnnumret, lcfile
    IF TYPE("plDesarrollo")<>"L"
       lcfile = SYS(5)+SYS(2003)+"\"+ALLTRIM(this.cinifile)
    ELSE
       lcfile = ALLTRIM(this.cinifile)
    ENDIF
    lcretvalue = SPACE(8196)
    lnnumret = getprivateprofilestring(pcsection, pcsetting, "[MISSING]", @lcretvalue, 8196, lcfile)
    lcretvalue = ALLTRIM(SUBSTR(lcretvalue, 1, lnnumret))
    IF lcretvalue=="[MISSING]"
       lcretvalue = ""
    ENDIF
    RETURN lcretvalue
   ENDFUNC
**
   FUNCTION SetPrinter
    LOCAL x, lcprinter
    x = 0
    lcprinter = ""
    WITH this
       IF EMPTY(.cpsprinter)
          .cpsprinter = "GENERIC POSTSCRIPT PRINTER"
       ENDIF
       IF EMPTY(.cpscolorprinter)
          .cpsprinter = "GENERIC COLOR POSTSCRIPT"
       ENDIF
       .lfoundprinter = .F.
       IF APRINTERS(laprinters)>0
          FOR x = 1 TO ALEN(laprinters)
             IF ALLTRIM(UPPER(laprinters(x)))==.cpscolorprinter
                lcprinter = .cpscolorprinter
                .lfoundprinter = .T.
             ENDIF
             IF ALLTRIM(UPPER(laprinters(x)))==.cpsprinter
                lcprinter = .cpsprinter
                .lfoundprinter = .T.
             ENDIF
          ENDFOR
          IF  .NOT. .lfoundprinter
             .cerror = lcprinter+" is not installed!!"
             .lerror = .T.
          ENDIF
       ELSE
          .cerror = "NO printer drivers are installed!!"
          .lerror = .T.
       ENDIF
       IF .lfoundprinter
          lceval = "SET PRINTER TO NAME '"+lcprinter+"'"
          &lceval
          IF ALLTRIM(UPPER(SET("PRINTER", 3)))==ALLTRIM(UPPER(lcprinter))
          ELSE
             .cerror = "Could not set printer to: "+ALLTRIM(lcprinter)
             .lerror = .T.
             .lfoundprinter = .F.
          ENDIF
       ENDIF
       IF  .NOT. .lfoundprinter
          IF this.install("POSTSCRIPT")
             RETURN this.setprinter()
          ENDIF
       ENDIF
    ENDWITH
    RETURN .lfoundprinter
   ENDFUNC
**
   FUNCTION MakePS
    LOCAL lcreport, lcextra, lcpsfile
    LOCAL lctag, lctag2, lcexpr, xlinea, xtexto, lcoldalias
    SET SAFETY OFF
    WITH this
       IF  .NOT. .lfoundprinter
          IF  .NOT. .setprinter()
             RETURN .F.
          ENDIF
       ENDIF
       lcreport = .creport
       lcextra = .cextrarptclauses
       IF EMPTY(lcreport)
          .cerror = "No se especifico el informe a convertir."
          .lerror = .T.
          RETURN .F.
       ENDIF
       lcoldalias = ALIAS()
       USE (lcreport) ALIAS informe IN 0
       SELECT informe
       LOCATE FOR objtype=1 .AND. objcode=53
       xlinea = ATCLINE("ORIENTATION", expr)
       xtexto = MLINE(expr, xlinea)
       lctag = informe.tag
       lctag2 = informe.tag2
       lcexpr = informe.expr
       REPLACE tag WITH "", tag2 WITH "", expr WITH ""
       REPLACE expr WITH xtexto
       USE IN informe
       SELECT (lcoldalias)
       IF EMPTY(.cpsfile)
          .cpsfile = .ctemppath+SYS(2015)+".ps"
       ENDIF
       lcpsfile = .cpsfile
       ERASE (lcpsfile)
       REPORT FORM (lcreport) &lcextra NOCONSOLE TO FILE &lcpsfile
       USE (lcreport) ALIAS informe IN 0
       SELECT informe
       LOCATE FOR objtype=1 .AND. objcode=53
       REPLACE tag WITH lctag
       REPLACE tag2 WITH lctag2
       REPLACE expr WITH lcexpr
       USE IN informe
       SELECT (lcoldalias)
       IF  .NOT. FILE(lcpsfile)
          .cerror = "Could create PDF file"
          .lerror = .T.
          RETURN .F.
       ENDIF
    ENDWITH
    RETURN .T.
   ENDFUNC
**
   FUNCTION GSFind
    LOCAL x, lcpath
    STORE "" TO lcpath
    STORE 0 TO x
    WITH this
       .lfoundgs = .F.
       IF FILE("gsdll32.dll")
          .lfoundgs = .T.
          RETURN .T.
       ENDIF
       IF  .NOT. EMPTY(.cgsfolder)
          lctmp = .cgsfolder+"gsdll32.dll"
          IF  .NOT. FILE(lctmp)
             .cgsfolder = ""
          ENDIF
       ENDIF
       IF EMPTY(.cgsfolder)
          IF  .NOT. DIRECTORY("C:\gs")
             RETURN .F.
          ENDIF
          ligs = ADIR(lagsfolders, "C:\gs\*.*", "D")
          IF ligs<1
             RETURN .F.
          ENDIF
          FOR x = 1 TO ALEN(lagsfolders, 1)
             lctmp = ALLTRIM(UPPER(lagsfolders(x, 1)))
             IF "GS"=LEFT(lctmp, 2) .AND. "D"$lagsfolders(x, 5)
                .cgsfolder = lctmp
                EXIT
             ENDIF
          ENDFOR
          IF EMPTY(.cgsfolder)
             RETURN .F.
          ENDIF
          .cgsfolder = "c:\gs\"+ALLTRIM(.cgsfolder)+"\bin\"
       ENDIF
       IF  .NOT. EMPTY(.cgsfolder)
          lctmp = .cgsfolder+"gsdll32.dll"
          IF  .NOT. FILE(lctmp)
             .cgsfolder = ""
          ENDIF
       ENDIF
       IF EMPTY(.cgsfolder)
          RETURN .F.
       ELSE
          .lfoundgs = .T.
       ENDIF
    ENDWITH
    lcpath = ALLTRIM(SET("Path"))
    SET PATH TO lcpath+";"+.cgsfolder
    RETURN .T.
   ENDFUNC
**
   FUNCTION MakePDF
    LOCAL lcpdffile, lcoutputfile, lcpsfile
    SET SAFETY OFF
    WITH this
       IF  .NOT. .lfoundgs
          IF  .NOT. .gsfind()
             IF .install("GHOSTSCRIPT")
                IF  .NOT. .gsfind()
                   .cerror = "No se pudo instalar Ghostscript!"
                   .lerror = .T.
                   RETURN .F.
                ENDIF
             ENDIF
          ENDIF
       ENDIF
       lcoutputfile = .coutputfile
       lcpsfile = .cpsfile
       IF EMPTY(.cpdffile)
          .cpdffile = JUSTSTEM(lcpsfile)+".pdf"
       ENDIF
       lcpdffile = .cpdffile
       ERASE (lcpdffile)
       IF  .NOT. .gsconvertfile(lcpsfile, lcpdffile)
          .cerror = "No se pudo crear: "+lcpdffile
          .lerror = .T.
       ENDIF
       IF  .NOT. FILE(lcpdffile)
          .cerror = "No se pudo crear: "+lcpdffile
          .lerror = .T.
       ENDIF
       IF .lerasepsfile
          ERASE (lcpsfile)
       ENDIF
       ERASE (lcoutputfile)
       RENAME (lcpdffile) TO (lcoutputfile)
       IF  .NOT. FILE(lcoutputfile)
          .cerror = "No se pudo renombrar el fichero "+lcoutputfile
          .lerror = .T.
       ENDIF
    ENDWITH
    RETURN  .NOT. this.lerror
   ENDFUNC
**
   FUNCTION GSConvertFile
    LPARAMETERS tcfilein, tcfileout
    LOCAL lngsinstancehandle, lncallerhandle, loheap, lnelementcount, lcptrargs, lncounter, lnreturn
    DIMENSION laargs[11]
    STORE 0 TO lngsinstancehandle, lncallerhandle, lnelementcount, lncounter, lnreturn
    STORE .NULL. TO loheap
    STORE "" TO lcptrargs
    SET SAFETY OFF
    SET PROCEDURE TO clsheap ADDITIVE
    loheap = CREATEOBJECT('Heap')
    CLEAR DLLS  "gsapi_new_instance", "gsapi_delete_instance", "gsapi_init_with_args", "gsapi_exit"
    DECLARE LONG gsapi_new_instance IN gsdll32.dll LONG @, LONG
    DECLARE LONG gsapi_delete_instance IN gsdll32.dll LONG
    DECLARE LONG gsapi_init_with_args IN gsdll32.dll LONG, LONG, LONG
    DECLARE LONG gsapi_exit IN gsdll32.dll LONG
    laargs[1] = "dummy"
    laargs[2] = "-dNOPAUSE"
    laargs[3] = "-dBATCH"
    laargs[4] = "-dSAFER"
    laargs[5] = "-r"+this.cprintresolution
    laargs[6] = "-sDEVICE=pdfwrite"
    laargs[7] = "-sOutputFile="+tcfileout
    laargs[8] = "-c"
    laargs[9] = ".setpdfwrite"
    laargs[10] = "-f"
    laargs[11] = tcfilein
    lnreturn = gsapi_new_instance(@lngsinstancehandle, @lncallerhandle)
    IF (lnreturn<0)
       loheap = .NULL.
       RELEASE loheap
       this.lerror = .T.
       this.cerror = "No se encuentra Ghostscript."
       RETURN .F.
    ENDIF
    lnelementcount = ALEN(laargs)
    lcptrargs = ""
    FOR lncounter = 1 TO lnelementcount
       lcptrargs = lcptrargs+numtolong(loheap.allocstring(laargs(lncounter)))
    ENDFOR
    lnptr = loheap.allocblob(lcptrargs)
    lnreturn = gsapi_init_with_args(lngsinstancehandle, lnelementcount, lnptr)
    IF (lnreturn<0)
       loheap = .NULL.
       RELEASE loheap
       this.lerror = .T.
       this.cerror = "No se pudo iniciar Ghostscript."
       RETURN .F.
    ENDIF
    lnreturn = gsapi_exit(lngsinstancehandle)
    IF (lnreturn<0)
       loheap = .NULL.
       RELEASE loheap
       this.lerror = .T.
       this.cerror = "No se pudo salir de Ghostscript."
       RETURN .F.
    ENDIF
    = gsapi_delete_instance(lngsinstancehandle)
    loheap = .NULL.
    RELEASE loheap
    IF  .NOT. FILE(tcfileout)
       this.lerror = .T.
       this.cerror = "Ghostscript no pudo crear el documento PDF."
       RETURN .F.
    ENDIF
    RETURN .T.
   ENDFUNC
**
   FUNCTION InstPDFReader
    IF  .NOT. FILE(.coutputfile)
       RETURN .F.
    ENDIF
    lcexe = .assocexe(.coutputfile)
    IF EMPTY(lcexe)
       RETURN .install("PDFREADER")
    ELSE
       RETURN .T.
    ENDIF
   ENDFUNC
**
   FUNCTION AssocExe
    LPARAMETERS pcfile
    LOCAL lcexefile
    STORE "" TO lcexefile
    DECLARE INTEGER FindExecutable IN shell32 STRING, STRING, STRING @
    lcexefile = SPACE(250)
    IF findexecutable(pcfile, "", @lcexefile)>32
       lcexefile = LEFT(lcexefile, AT(CHR(0), lcexefile)-1)
    ELSE
       lcexefile = ""
    ENDIF
    RETURN lcexefile
   ENDFUNC
**
   FUNCTION Install
    LPARAMETERS pcid
    LOCAL llfound, x, lceval, lcproduct, lcdesc, lctmp, lcfolder, lcinstexe, lcinstruct, lldynapath
    STORE "" TO lceval, lcproduct, lcabbr, lcdesc, lctmp, lcfolder, lcinstexe, lcinstruct
    STORE .F. TO llfound, lldynapath
    WITH this
       pcid = ALLTRIM(UPPER(pcid))
       FOR x = 1 TO ALEN(.ainstall, 1)
          IF ALLTRIM(UPPER(.ainstall(x, 1)))==pcid
             llfound = .T.
             EXIT
          ENDIF
       ENDFOR
       IF  .NOT. llfound
          .lerror = .T.
          .cerror = "No hay parametros de instalacion para: "+pcid
          RETURN .F.
       ENDIF
       lldoinst = .ainstall(x, 2)
       lcproduct = .ainstall(x, 3)
       lcdesc = .ainstall(x, 4)
       lcfolder = .ainstall(x, 5)
       lcinstexe = .ainstall(x, 6)
       IF  .NOT. EMPTY(.ainstall(x, 7))
          lcinstruct = ALLTRIM(.ainstall(x, 7))
          IF "+"$lcinstruct
             lcinstruct = &lcinstruct
          ENDIF
       ELSE
          lcinstruct = "Por favor acepte los 'Valores por Defecto'"+CHR(13)+"durante la instalacion."
       ENDIF
       IF "+"$lcfolder
          lldynapath = .T.
       ELSE
          lldynapath = .F.
       ENDIF
       IF lldoinst=.T.
          IF  .NOT. EMPTY(lcfolder) .AND.  .NOT. EMPTY(lcinstexe)
             IF lldynapath
                lcfolder = ALLTRIM(lcfolder)
                lceval = &lcfolder
                lceval = lceval+ALLTRIM(lcinstexe)
             ELSE
                IF RIGHT(lcfolder, 1)<>"\"
                   lcfolder = lcfolder+"\"
                ENDIF
                lceval = ALLTRIM(lcfolder)+ALLTRIM(lcinstexe)
             ENDIF
             IF  .NOT. lldynapath .AND.  .NOT. FILE(lceval)
                .cerror = "No se encontro el instalador para "+lcproduct+" in:"+CHR(13)+ALLTRIM(lceval)
                .lerror = .T.
             ELSE
                IF 7=_messagebox(lcproduct+" "+traducir(pcidioma, "necesita ser instalado en tu PC.")+CHR(13)+lcdesc+CHR(13)+traducir(pcidioma, "¿Desea instalarlo ahora?"), 36, traducir(pcidioma, "Atención"))
                   .lerror = .T.
                   .cerror = "Cancelacion de la instalacion de "+lcproduct
                   RETURN .F.
                ENDIF
                = _messagebox(lcinstruct, 64, traducir(pcidioma, "Instrucciones"))
                .ainstall[x, 2] = .F.
                lceval = "run /n "+lceval
                &lceval
                = _messagebox(traducir(pcidioma, "Cuando la instalacion haya finalizado")+CHR(13)+traducir(pcidioma, "COMPLETAMENTE, Pulse OK..."), 64, traducir(pcidioma, "Esperando por la instalacion..."))
                IF 7=_messagebox(traducir(pcidioma, "¿La instalacion ha sido correcta?")+CHR(13)+CHR(13)+traducir(pcidioma, "Si no han habido errores durante la instalacion ")+CHR(13)+traducir(pcidioma, "y todo a ido bien, pulse 'Si'..."), 36, traducir(pcidioma, "¿Ha ido todo bien?"))
                   .lerror = .T.
                   .cerror = "Han habido errores durante la instalacion de "+lcproduct
                   RETURN .F.
                ELSE
                   .lerror = .F.
                   .cerror = ""
                   RETURN .T.
                ENDIF
             ENDIF
          ENDIF
       ENDIF
    ENDWITH
    RETURN .F.
   ENDFUNC
**
ENDDEFINE
**
