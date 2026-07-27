 LPARAMETERS lopreviewcontainer
 SET TALK OFF
 SET CONSOLE OFF
 LOCAL lopreviewcontainer AS FORM, lolistener AS REPORTLISTENER, loexhandler AS EXTENSIONHANDLER OF SYS(16)
 lopreviewcontainer = .NULL.
 DO "ReportPreview.App" WITH lopreviewcontainer
 TRY
    lolistener = NEWOBJECT('FXListener', "Listener.vcx", "ReportOutput.App")
 CATCH
    lolistener = CREATEOBJECT("ReportListener")
 ENDTRY
 lolistener.listenertype = 1
 lolistener.previewcontainer = lopreviewcontainer
 loexhandler = NEWOBJECT('ExtensionHandler')
 RELEASE gohelper
 PUBLIC gohelper
 gohelper = CREATEOBJECT("PreviewHelper")
 gohelper.lextended = .F.
 lopreviewcontainer.setextensionhandler(loexhandler)
 RELEASE lopreviewcontainer, lolistener, loexhandler
 RETURN
ENDPROC
**
DEFINE CLASS PreviewHelper AS Custom
 cprintername = SET("Printer", 3)
 lsavetofile = .T.
 lsendtoemail = .F.
 lprintvisible = .T.
 lshowcopies = .T.
 lshowminiatures = .T.
 lprinterpref = .T.
 lsaveasimage = .T.
 lsaveashtml = .T.
 lsaveasrtf = .T.
 lsaveasxls = .T.
 lsaveaspdf = .T.
 lquietmode = .T.
 cdestfile = ""
 lprinted = .F.
 lsaved = .F.
 lemailed = .F.
 npagetotal = 0
 ncopies = 1
 ctitle = ""
 olistener = .NULL.
 cdefaultlistener = "FXLISTENER"
 ncanvascount = 1
 nzoomlevel = 5
 lextended = .T.
 nwindowstate = 0
 ndocktype = .F.
 cformicon = "wwrite.ico"
 luselistener = .T.
 lemailauto = .T.
 cemailtype = "PDF"
 cemailprg = ""
 ccodepage = "CP1252"
 lpdfasimage = .F.
 nmaxminiaturedisplay = 64
 pdfnpagemode = 0
 clanguage = "ESPANIOL"
 _clausenrangefrom = 1
 _clausenrangeto = -1
 _clausenprintrangefrom = 0
 _clausenprintrangeto = 0
 _clauselsummary = .F.
 _clausecheading = ""
 _cfrxname = ""
 _cfrxfullname = ""
 _oreports = ""
 _oclauses = ""
 _oaliases = ""
 _onames = ""
 _oproofsheet = ""
 _coriginalprinter = SET("Printer", 3)
 _lsendtoprinter = .F.
 _lnowait = .F.
 _oldreportoutput = ""
 _oexhandler = ""
 _ocaller = ""
 _oparentform = ""
 _de_name = ""
 _oreport = ""
 _lsendingemail = .F.
 _cdefaultfolder = SYS(5)+SYS(2003)
 _lisdotmatrix = .F.
 _olang = ""
**
   PROCEDURE Init
    IF this.lextended=.T.
       RELEASE gohelper
       PUBLIC gohelper
       gohelper = this
       LOCAL lcclasspath, lcpdffile, lctestpath
       lcclasspath = IIF(EMPTY(this.classlibrary), "", ADDBS(JUSTPATH(this.classlibrary)))
       lcpdffile = "libhpdf.dll"
       IF FILE(lcpdffile) .AND. EMPTY(SYS(2000, lcpdffile))
          lctestpath = lcclasspath+lcpdffile
          IF pr_pathfileexists(lctestpath+CHR(0))=0
             STRTOFILE(FILETOSTR(lcpdffile), lcclasspath+lcpdffile)
          ENDIF
       ENDIF
    ENDIF
   ENDPROC
**
   PROCEDURE cLanguage_Assign
    LPARAMETERS tclanguage
    this._setlanguage(tclanguage)
   ENDPROC
**
   PROCEDURE _SetLanguage
    LPARAMETERS tclanguage
    this.clanguage = tclanguage
    LOCAL lcdbffile, lnselect
    lnselect = SELECT()
    lcdbffile = "FoxyPreviewer_Locs.dbf"
    USE SHARED (lcdbffile) AGAIN IN 0
    SELECT (lcdbffile)
    LOCATE FOR UPPER(language)=UPPER(this.clanguage)
    IF EOF()
       MESSAGEBOX("Could not locate the selected language - "+tclanguage+"Make sure that the desired language is available in FoxyPreviewer_Locs.dbf", 16, "FoxyPreviewer error")
       GOTO TOP
    ENDIF
    SCATTER NAME olang
    this._olang = olang
    USE IN (lcdbffile)
    SELECT (lnselect)
   ENDPROC
**
   PROCEDURE Destroy
    LOCAL loparent AS CUSTOM
    loparent = this._ocaller
    IF VARTYPE(loparent)="O"
       loparent.lsaved = this.lsaved
       loparent.lprinted = this.lprinted
       loparent.cdestfile = this.cdestfile
    ENDIF
    this._oreport = .NULL.
    RELEASE gohelper
   ENDPROC
**
   PROCEDURE CloseProof
    IF VARTYPE(this._oproofsheet)="O"
       this._oproofsheet.release()
    ENDIF
   ENDPROC
**
   PROCEDURE AddReport
    LPARAMETERS tcreport, tcclauses, tcalias, tcname
    IF EMPTY(tcname)
       tcname = tcreport
    ENDIF
    IF VARTYPE(this._oreports)<>"O"
       this._oreports = CREATEOBJECT("Collection")
       this._oclauses = CREATEOBJECT("Collection")
       this._oaliases = CREATEOBJECT("Collection")
       this._onames = CREATEOBJECT("Collection")
    ENDIF
    this._oreports.add(tcreport)
    this._oclauses.add(EVL(tcclauses, ""))
    this._oaliases.add(EVL(tcalias, ""))
    this._onames.add(EVL(tcname, ""))
   ENDPROC
**
   PROCEDURE CallReport
    LPARAMETERS tolistener AS REPORTLISTENER, tlkeephandle
    LOCAL lcreport, lcclauses, lcalias, lctype, lolistener AS REPORTLISTENER
    IF VARTYPE(tolistener)="O"
       lolistener = tolistener
    ELSE
       lolistener = this.olistener
    ENDIF
    IF UPPER(ALLTRIM(SET("Printer", 3)))<>UPPER(this.cprintername)
       this.setprinter(this.cprintername)
    ENDIF
    IF LOWER(JUSTEXT(this._oreports(1)))="lbx"
       lcreport = this._oreports(1)
       lcclauses = this._oclauses(1)
       lcalias = this._oaliases(1)
       IF  .NOT. EMPTY(lcalias)
          SELECT (lcalias)
       ENDIF
       LABEL FORM (lcreport) OBJECT lolistener &lcclauses.
    ELSE
       LOCAL lcuser, n, lncount
       lncount = this._oreports.count
       FOR n = 1 TO lncount
          lctype = LOWER(JUSTEXT(this._oreports(n)))
          DO CASE
             CASE lncount=1 .OR. lncount=n
                lcuser = ""
             OTHERWISE
                lcuser = "NOPAGEEJECT"
          ENDCASE
          lcreport = this._oreports(n)
          lcclauses = this._oclauses(n)
          lcalias = this._oaliases(n)
          IF  .NOT. EMPTY(lcalias)
             SELECT (lcalias)
          ENDIF
          IF tlkeephandle
             IF n=lncount
                lolistener.waitfornextreport = .F.
             ELSE
                lolistener.waitfornextreport = .T.
             ENDIF
          ENDIF
          IF  .NOT. FILE(FORCEEXT(lcreport, "FRX"))
             MESSAGEBOX("Could not locate the Report source file: "+lcreport, 16, "FoxyPreviewer error")
          ENDIF
          IF (( .NOT. this.luselistener) .AND. this._lsendtoprinter) .OR. (gohelper._lisdotmatrix)
             SET REPORTBEHAVIOR 80
             lcclauses = cleanclauses(lcclauses)
             IF lctype="lbx"
                LABEL FORM (lcreport) &lcclauses. &lcuser. TO PRINTER NOCONSOLE 
             ELSE
                REPORT FORM (lcreport) &lcclauses. &lcuser. TO PRINTER NOCONSOLE 
             ENDIF
          ELSE
             IF lctype="lbx"
                LABEL FORM (lcreport) OBJECT lolistener &lcclauses. &lcuser. 
             ELSE
                REPORT FORM (lcreport) OBJECT lolistener &lcclauses. &lcuser. 
             ENDIF
          ENDIF
       ENDFOR
    ENDIF
   ENDPROC
**
   PROCEDURE RestorePrinter
    WITH this
       IF UPPER(._coriginalprinter)<>UPPER(SET("Printer", 3))
          .setprinter(._coriginalprinter)
       ENDIF
    ENDWITH
   ENDPROC
**
   FUNCTION RunReport
    LPARAMETERS toparent
    IF VARTYPE(this._olang)<>"O"
       this._setlanguage(this.clanguage)
    ENDIF
    IF APRINTERS(gaprinters)=0
       MESSAGEBOX(ALLTRIM(this._olang.errnoprinter), 16, ALLTRIM(this._olang.error))
       RETURN .F.
    ENDIF
    WITH this
       .lprinted = .F.
       ._ocaller = toparent
       IF VARTYPE(.olistener)<>"O"
          TRY
             .olistener = CREATEOBJECT(.cdefaultlistener)
          CATCH
             .olistener = CREATEOBJECT("ReportListener")
          ENDTRY
       ENDIF
       IF EMPTY(this.cdestfile)
          DO "ReportOutput.App" WITH 3, .olistener
          .olistener.listenertype = 1
          LOCAL lopreviewcontainer
          lopreviewcontainer = .NULL.
          DO "ReportPreview.App" WITH lopreviewcontainer
          LOCAL loexhandler AS EXTENSIONHANDLER OF SYS(16)
          loexhandler = NEWOBJECT('ExtensionHandler')
          lopreviewcontainer.setextensionhandler(loexhandler)
          gohelper._oexhandler = loexhandler
          lopreviewcontainer.zoomlevel = gohelper.nzoomlevel
          lopreviewcontainer.canvascount = gohelper.ncanvascount
          .olistener.previewcontainer = lopreviewcontainer
          .callreport()
       ENDIF
       IF  .NOT. gohelper._lnowait
          this.dooutput()
       ENDIF
       TRY
          .olistener.previewcontainer = .NULL.
       CATCH
       ENDTRY
    ENDWITH
   ENDFUNC
**
   PROCEDURE DoOutput
    LPARAMETERS tlemail
    WITH this
       LOCAL lcfileformat
       lcfileformat = ""
       IF  .NOT. EMPTY(.cdestfile) .AND.  .NOT. .lsaved
          .lsavetofile = .T.
          lcfileformat = LOWER(JUSTEXT(.cdestfile))
          TRY
             ERASE (.cdestfile)
          CATCH
          ENDTRY
       ENDIF
    ENDWITH
    DO CASE
       CASE this.lsaved
       CASE lcfileformat="pdf"
          LOCAL lntype
          lntype = IIF(gohelper.lpdfasimage, 2, 1)
          IF lntype=1
             LOCAL lolistener AS "PdfListener" OF "PR_Pdfx.vcx"
             lolistener = NEWOBJECT('PdfListener', 'PR_PDFx.vcx')
             lolistener.ccodepage = gohelper.ccodepage
          ELSE
             LOCAL lolistener AS "PDFasImageListener" OF "PR_Pdfx.vcx"
             lolistener = NEWOBJECT('PDFasImageListener', 'PR_PDFx.vcx')
          ENDIF
          lolistener.ctargetfilename = ALLTRIM(this.cdestfile)
          lolistener.quietmode = gohelper.lquietmode
          lolistener.lcanprint = .T.
          lolistener.lcanedit = .T.
          lolistener.lcancopy = .T.
          lolistener.lcanaddnotes = .T.
          lolistener.lencryptdocument = .F.
          lolistener.cmasterpassword = ""
          lolistener.cuserpassword = ""
          lolistener.lopenviewer = .F.
          lolistener.npagemode = gohelper.pdfnpagemode
          DEFINE WINDOW window_html FROM 04, 05 TO 27, 75
          ACTIVATE WINDOW NOSHOW window_html
          this.callreport(lolistener, .T.)
          lolistener = .NULL.
          RELEASE WINDOW window_html
          IF  .NOT. FILE(this.cdestfile)
             MESSAGEBOX(ALLTRIM(gohelper._olang.err_creati), 016, ALLTRIM(gohelper._olang.error))
          ELSE
             this.lsaved = .T.
          ENDIF
       CASE INLIST(lcfileformat, "htm", "html")
          DEFINE WINDOW window_html FROM 04, 05 TO 27, 75
          ACTIVATE WINDOW NOSHOW window_html
          LOCAL lolistener2 AS "HTMLListener" OF HOME()+"FFC/_ReportListener.vcx"
          lolistener2 = NEWOBJECT("HTMLListener", "_ReportListener.vcx")
          lolistener2.targetfilename = this.cdestfile
          lolistener2.quietmode = gohelper.lquietmode
          this.callreport(lolistener2)
          lolistener2 = .NULL.
          RELEASE WINDOW window_html
          IF  .NOT. FILE(this.cdestfile)
             MESSAGEBOX(ALLTRIM(gohelper._olang.err_creati), 016, TRIM(gohelper._olang.error))
          ELSE
             this.lsaved = .T.
          ENDIF
       CASE INLIST(lcfileformat, "rtf", "doc")
          lortflistener = NEWOBJECT("RTFreportlistener", "PR_RTFListener")
          lortflistener.targetfilename = this.cdestfile
          this.callreport(lortflistener, .T.)
          lortflistener = .NULL.
          IF  .NOT. FILE(this.cdestfile)
             MESSAGEBOX(TRIM(gohelper._olang.err_creati), 016, TRIM(gohelper._olang.error))
          ELSE
             this.lsaved = .T.
          ENDIF
       CASE INLIST(lcfileformat, "xls")
          LOCAL loreportlistener AS "ExcelListener" OF HOME()+"FFC/_ReportListener.vcx"
          loreportlistener = NEWOBJECT("ExcelListener", "pr_ExcelListener.vcx")
          loreportlistener.listenertype = 3
          loreportlistener.loutputtocursor = .T.
          loreportlistener.cworkbookfile = this.cdestfile
          loreportlistener.cworksheetname = "Sheet"
          this.callreport(loreportlistener, .F.)
          loreportlistener = .NULL.
          IF  .NOT. FILE(this.cdestfile)
             MESSAGEBOX(TRIM(gohelper._olang.err_creati), 016, TRIM(gohelper._olang.error))
          ELSE
             this.lsaved = .T.
          ENDIF
       CASE this._lsendtoprinter
          TRY
             LOCAL lolistener AS REPORTLISTENER
             TRY
                lolistener = CREATEOBJECT(this.cdefaultlistener)
             CATCH
                lolistener = CREATEOBJECT("ReportListener")
             ENDTRY
             lolistener.listenertype = 0
             FOR n = 1 TO this.ncopies
                this.callreport(lolistener)
             ENDFOR
             this.lprinted = .T.
             this.restoreprinter()
          CATCH TO loexception
          ENDTRY
       OTHERWISE
    ENDCASE
    IF gohelper._lsendingemail=.T.
       IF  .NOT. FILE(this.cdestfile)
          MESSAGEBOX(TRIM(gohelper._olang.err_creati), 016, TRIM(gohelper._olang.error))
       ELSE
          IF EMPTY(this.cemailprg)
             = sendmailex(this.cdestfile, "", this.ctitle, this.ctitle)
          ELSE
             DO (this.cemailprg) WITH (this.cdestfile)
          ENDIF
          gohelper.lemailed = .T.
          IF gohelper.lemailauto
             TRY
                DELETE FILE (this.cdestfile)
             CATCH
             ENDTRY
             gohelper.lsaved = .F.
          ENDIF
       ENDIF
    ENDIF
    SET DEFAULT TO (gohelper._cdefaultfolder)
    this.reportreleased()
   ENDPROC
**
   PROCEDURE ReportReleased
    LPARAMETERS toext
    UNBINDEVENTS(this)
    DOEVENTS
    IF VARTYPE(toext)="O"
       toext = .NULL.
    ENDIF
    IF UPPER(this._coriginalprinter)<>UPPER(this.cprintername)
       this.setprinter(this._coriginalprinter)
    ENDIF
    this.closeproof()
    IF (SET("Default")+SYS(2003))<>gohelper._cdefaultfolder
       SET DEFAULT TO (gohelper._cdefaultfolder)
    ENDIF
    RELEASE gohelper
   ENDPROC
**
   PROCEDURE ClearCache
    LOCAL lcfile
    lcfile = _ReportPreview
    TRY
       _oreportoutput["1"].previewcontainer = .NULL.
    CATCH
    ENDTRY
    _ReportPreview = lcfile
    SET REPORTBEHAVIOR 90
   ENDPROC
**
   FUNCTION SetPrinter
    LPARAMETERS tcprintername
    LOCAL lcprinter, llreturn
    llreturn = .T.
    lcprinter = tcprintername
    TRY
       SET PRINTER TO NAME '&lcPrinter'
    CATCH
       llreturn = .F.
    ENDTRY
    RETURN llreturn
   ENDFUNC
**
ENDDEFINE
**
DEFINE CLASS ExtensionHandler AS CUSTOM
 previewform = .NULL.
**
   PROCEDURE STB_Handler
    LPARAMETERS lenabled
    WITH this.previewform.toolbar
       .refresh()
       .caption = this.previewform.formcaption
    ENDWITH
   ENDPROC
**
   PROCEDURE AddBarsToMenu
    LPARAMETERS cpopup, inextbar
    DEFINE BAR 1 OF (m.cpopup) PROMPT TRIM(gohelper._olang.menutop) PICTURE "pr_top.bmp"
    DEFINE BAR 2 OF (m.cpopup) PROMPT TRIM(gohelper._olang.menuprev) PICTURE "pr_previous.bmp"
    DEFINE BAR 3 OF (m.cpopup) PROMPT TRIM(gohelper._olang.menunext) PICTURE "pr_next.bmp"
    DEFINE BAR 4 OF (m.cpopup) PROMPT TRIM(gohelper._olang.menulast) PICTURE "pr_bottom.bmp"
    DEFINE BAR 5 OF (m.cpopup) PROMPT TRIM(gohelper._olang.menugoto) PICTURE "pr_gotopage.bmp"
    DEFINE BAR 8 OF (m.cpopup) PROMPT TRIM(gohelper._olang.menushowpa)
    DEFINE BAR 10 OF (m.cpopup) PROMPT TRIM(gohelper._olang.menutoolb)
    DEFINE BAR 13 OF (m.cpopup) PROMPT TRIM(gohelper._olang.menuclose) PICTURE "pr_close.bmp"
    IF  .NOT. EMPTY(TRIM(gohelper._olang.cbozoomtti))
       DEFINE BAR 7 OF (m.cpopup) PROMPT TRIM(gohelper._olang.cbozoomtti)
    ENDIF
    ON SELECTION BAR 5 OF (m.cpopup) oref.extensionhandler.actiongotopage()
    ON SELECTION BAR 13 OF (m.cpopup) oref.extensionhandler.actionclose()
    ON SELECTION BAR 10 OF (m.cpopup) oref.extensionhandler.actiontoolbarvisibility()
    IF gohelper.lprintvisible
       DEFINE BAR 15 OF (m.cpopup) PROMPT TRIM(gohelper._olang.menuprint) PICTURE "pr_Print.bmp"
       ON SELECTION BAR 15 OF (m.cpopup) oref.extensionhandler.actionprintex()
       IF gohelper.lprinterpref
          LOCAL lcimgprintpref
          lcimgprintpref = "pr_PrintPref.bmp"
          DEFINE BAR 16 OF (m.cpopup) PROMPT TRIM(gohelper._olang.printingpr) PICTURE lcimgprintpref
          ON SELECTION BAR 16 OF (m.cpopup) oref.extensionhandler.docustomprint()
       ENDIF
       IF gohelper.lsavetofile
          DEFINE BAR 17 OF (m.cpopup) PROMPT TRIM(gohelper._olang.savereport) PICTURE "pr_Save.bmp"
          LOCAL lcsavemenu
          lcsavemenu = SYS(2015)
          DEFINE POPUP (m.lcsavemenu) RELATIVE SHORTCUT
          IF  .NOT. gohelper.lextended
             ON SELECTION BAR 17 OF (m.cpopup) oref.extensionhandler.dosavetype(1)
          ELSE
             ON BAR 17 OF (m.cpopup) ACTIVATE POPUP &lcsavemenu.
             IF gohelper.lsaveasimage
                DEFINE BAR 1 OF (lcsavemenu) PROMPT TRIM(gohelper._olang.saveasimag) PICTURE "pr_Img.bmp"
                ON SELECTION BAR 1 OF (lcsavemenu) oref.extensionhandler.dosavetype(1)
             ENDIF
             IF gohelper.lextended
                IF gohelper.lsaveaspdf
                   DEFINE BAR 2 OF (lcsavemenu) PROMPT TRIM(gohelper._olang.saveaspdf) PICTURE "pr_Pdf.bmp"
                   ON SELECTION BAR 2 OF (lcsavemenu) oref.extensionhandler.dosavetype(2)
                ENDIF
                IF gohelper.lsaveashtml
                   DEFINE BAR 3 OF (lcsavemenu) PROMPT TRIM(gohelper._olang.saveashtml) PICTURE "pr_Html.bmp"
                   ON SELECTION BAR 3 OF (lcsavemenu) oref.extensionhandler.dosavetype(3)
                ENDIF
                IF gohelper.lsaveasrtf
                   DEFINE BAR 4 OF (lcsavemenu) PROMPT TRIM(gohelper._olang.saveasrtf) PICTURE "pr_Word.bmp"
                   ON SELECTION BAR 4 OF (lcsavemenu) oref.extensionhandler.dosavetype(4)
                ENDIF
                IF gohelper.lsaveasxls
                   DEFINE BAR 5 OF (lcsavemenu) PROMPT TRIM(gohelper._olang.saveasxls) PICTURE "pr_Excel.bmp"
                   ON SELECTION BAR 5 OF (lcsavemenu) oref.extensionhandler.dosavetype(5)
                ENDIF
             ENDIF
          ENDIF
       ENDIF
    ENDIF
    IF gohelper.lshowminiatures
       DEFINE BAR 18 OF (m.cpopup) PROMPT '\-'
       DEFINE BAR 19 OF (m.cpopup) PROMPT TRIM(gohelper._olang.menuproof) PICTURE "pr_Locate.bmp"
       ON SELECTION BAR 19 OF (m.cpopup) oref.extensionhandler.doproof()
    ENDIF
    IF UPPER(TRIM(gohelper._olang.language))<>"ENGLISH"
       PRIVATE lczoom2, lcpages2
       lczoom2 = SYS(2015)
       lcpages2 = SYS(2015)
       ON BAR 7 OF (m.cpopup) ACTIVATE POPUP &lczoom2
       ON BAR 8 OF (m.cpopup) ACTIVATE POPUP &lcpages2
       DEFINE POPUP (m.lczoom2) RELATIVE SHORTCUT
       LOCAL lcitem, i
       FOR i = 1 TO ALEN(oref.zoomlevels, 1)
          lcitem = LOWER(oref.zoomlevels(i, 1))
          IF lcitem="whole page"
             oref.zoomlevels(i, 1) = TRIM(gohelper._olang.cbozoomwho)
          ENDIF
          IF lcitem="fit to width"
             oref.zoomlevels(i, 1) = TRIM(gohelper._olang.cbozoompgw)
          ENDIF
       ENDFOR
       FOR i = 1 TO ALEN(oref.zoomlevels, 1)
          DEFINE BAR m.i OF (m.lczoom2) PROMPT oref.zoomlevels(m.i, 1)
          ON SELECTION BAR m.i OF (m.lczoom2) oref.actionsetzoom( BAR() )
       ENDFOR
       SET MARK OF BAR (oref.zoomlevel) OF (m.lczoom2) TO .T.
       DEFINE POPUP (m.lcpages2) RELATIVE SHORTCUT
       DEFINE BAR 1 OF (m.lcpages2) PROMPT TRIM(gohelper._olang.onepgmenu)
       LOCAL ipagesallowed
       ipagesallowed = oref.zoomlevels(oref.zoomlevel, 3)
       IF m.ipagesallowed>1
          DEFINE BAR 2 OF (m.lcpages2) PROMPT TRIM(gohelper._olang.twopgmenu)
       ELSE
          DEFINE BAR 2 OF (m.lcpages2) PROMPT "\"+TRIM(gohelper._olang.twopgmenu)
       ENDIF
       IF m.ipagesallowed>2
          DEFINE BAR 3 OF (m.lcpages2) PROMPT TRIM(gohelper._olang.fourpgmenu)
       ELSE
          DEFINE BAR 3 OF (m.lcpages2) PROMPT "\"+TRIM(gohelper._olang.fourpgmenu)
       ENDIF
       ON SELECTION BAR 1 OF (m.lcpages2) oref.actionsetcanvascount(1)		
       ON SELECTION BAR 2 OF (m.lcpages2) oref.actionsetcanvascount(2)
       ON SELECTION BAR 3 OF (m.lcpages2) oref.actionsetcanvascount(4)
       DO CASE
          CASE oref.canvascount=1
             SET MARK OF BAR 1 OF (m.lcpages2) TO .T.
          CASE oref.canvascount=2
             SET MARK OF BAR 2 OF (m.lcpages2) TO .T.
          CASE oref.canvascount=4
             SET MARK OF BAR 3 OF (m.lcpages2) TO .T.
       ENDCASE
    ENDIF
   ENDPROC
**
   PROCEDURE CheckHelperClass
    IF VARTYPE(gohelper)<>"O"
       PUBLIC gohelper
       gohelper = CREATEOBJECT("PreviewHelper")
       gohelper.lextended = .F.
    ENDIF
    IF VARTYPE(gohelper._olang)<>"O"
       gohelper._setlanguage(gohelper.clanguage)
    ENDIF
   ENDPROC
**
   PROCEDURE ActionToolbarVisibility
    IF ISNULL(this.previewform.toolbar)
       this.previewform.toolbarisvisible = .F.
       this.previewform.createtoolbar()
       this.updatetoolbar()
    ENDIF
    IF this.previewform.toolbarisvisible
       this.previewform.toolbar.hide()
       this.previewform.toolbarisvisible = .F.
    ELSE
       this.previewform.showtoolbar(.T.)
       this.previewform.toolbarisvisible = .T.
    ENDIF
   ENDPROC
**
   PROCEDURE ActionGoToPage
    LOCAL loform, ipageno
    loform = CREATEOBJECT("CustomFrxGotoPageForm")
    loform.oparentform = this.previewform
    IF VARTYPE(this.previewform.toolbar)="O"
       this.previewform.showtoolbar(.F.)
       loform.show(1)
       this.previewform.showtoolbar(.T.)
    ELSE
       loform.show(1)
    ENDIF
    ipageno = loform.pageno
    RELEASE m.loform
    ACTIVATE WINDOW (this.previewform.name)
    IF m.ipageno<>this.previewform.currentpage
       this.previewform.setcurrentpage(m.ipageno)
    ENDIF
   ENDPROC
**
   PROCEDURE DoCustomPrint
    IF UPPER(gohelper._coriginalprinter)<>UPPER(gohelper.cprintername)
       gohelper.setprinter(gohelper.cprintername)
    ENDIF
    gohelper.closeproof()
    this.previewform.oreport.commandclauses.prompt = .T.
    LOCAL lolistener AS REPORTLISTENER
    lolistener = this.previewform.oreport
    = BINDEVENT(lolistener, "OutputPage", this, "DialogPrinting")
    this.previewform.oreport.onpreviewclose(.T.)
    IF  .NOT. gohelper.lextended
       gohelper.clearcache()
    ENDIF
    this.restoreparent()
   ENDPROC
**
   PROCEDURE DialogPrinting
    LPARAMETERS npageno, edevice, ndevicetype, par1, par2, par3, par4
    UNBINDEVENTS(this)
    gohelper.lprinted = .T.
   ENDPROC
**
   PROCEDURE ActionClose
    this.previewform.oreport.onpreviewclose(.F.)
    this.previewform.oreport = .NULL.
    this.previewform = .NULL.
    gohelper.clearcache()
    this.restoreparent()
   ENDPROC
**
   PROCEDURE RestoreParent
    UNBINDEVENTS(this)
    TRY
       IF VARTYPE(gohelper._oparentform)="O"
          LOCAL loform AS FORM
          loform = gohelper._oparentform
          loform.controlbox = loform.controlbox
          loform.titlebar = loform.titlebar
          loform.closable = .T.
          loform.draw()
          loform.paint()
       ENDIF
    CATCH
    ENDTRY
   ENDPROC
**
   PROCEDURE ActionPrint
    this.previewform.oreport.onpreviewclose(.T.)
   ENDPROC
**
   PROCEDURE ActionPrintEx
    gohelper.closeproof()
    gohelper._lisdotmatrix = isdotmatrix(gohelper.cprintername)
    IF (ALLTRIM(UPPER(gohelper.cprintername))=ALLTRIM(UPPER(gohelper._coriginalprinter))) .AND. (gohelper.luselistener) .AND. (gohelper._lisdotmatrix=.F.)
       this.previewform.visible = .F.
       gohelper.lprinted = .T.
       gohelper.ncopies = gohelper.ncopies-1
       gohelper._lsendtoprinter = .T.
       this.previewform.oreport.onpreviewclose(.T.)
       IF  .NOT. gohelper.lextended
          gohelper.clearcache()
       ENDIF
    ELSE
       gohelper._lsendtoprinter = gohelper.setprinter(gohelper.cprintername)
       this.previewform.oreport.onpreviewclose(.F.)
    ENDIF
    IF gohelper._lnowait
       gohelper.dooutput()
    ENDIF
   ENDPROC
**
   PROCEDURE Show
    LPARAMETERS istyle
    SET TALK OFF
    SET CONSOLE OFF
    this.checkhelperclass()
    WITH this.previewform
       LOCAL llnowait, lltopform
       TRY
          lltopform = this.previewform.topform
       CATCH
       ENDTRY
       this.previewform.icon = gohelper.cformicon
       BINDEVENT(this.previewform, "SynchPageNo", this, "SynchPageNo", 1)
       BINDEVENT(this.previewform.toolbar, "Refresh", this, "RefreshToolbar", 1)
       IF lltopform .OR. this.previewform.showwindow>0
          LOCAL lcparenttitle, lccaption, loform AS FORM
          lcparenttitle = getparentwindow()
          FOR EACH loform IN _SCREEN.forms FOXOBJECT
             lccaption = loform.caption
             IF lccaption=lcparenttitle
                TRY
                   IF loform.closable=.T.
                      loform.closable = .F.
                      BINDEVENT(this.previewform, "QueryUnload", this, "RestoreParent")
                      BINDEVENT(this.previewform, "Destroy", this, "RestoreParent")
                      gohelper._oparentform = loform
                   ENDIF
                CATCH
                ENDTRY
                EXIT
             ENDIF
          ENDFOR
       ENDIF
       llnowait = lltopform .OR. this.previewform.oreport.commandclauses.nowait
       gohelper._lnowait = llnowait
       IF VARTYPE(gohelper.ndocktype)="N"
          this.previewform.toolbar.dock(gohelper.ndocktype)
       ENDIF
       this.previewform.windowstate = gohelper.nwindowstate
       LOCAL lolistener
       lolistener = this.previewform.oreport
       gohelper.npagetotal = .pagetotal
       gohelper._cfrxname = .frxfilename
       gohelper._clausenrangefrom = lolistener.commandclauses.rangefrom
       gohelper._clausenrangeto = lolistener.commandclauses.rangeto
       gohelper._clauselsummary = lolistener.commandclauses.summary
       gohelper._clausecheading = lolistener.commandclauses.heading
    ENDWITH
    this.updatetoolbar()
    DODEFAULT(istyle)
   ENDPROC
**
   PROCEDURE SynchPageNo
    LOCAL icurrentpage, cmessage
    WITH this.previewform
       icurrentpage = .currentpage+.startoffset
       IF EMPTY(.oreport.commandclauses.window)
          IF .canvascount>1
             LOCAL lastpage
             lastpage = MIN(m.icurrentpage+.canvascount-1, .pagetotal)
             cmessage = TRIM(gohelper._olang.minilabel)+" "
             .caption = .formcaption+" - "+STRTRAN(STRTRAN(cmessage, "%FP%", TRANSFORM(m.icurrentpage)), "%LP%", TRANSFORM(m.lastpage))
          ELSE
             .caption = .formcaption+" - "+TRIM(gohelper._olang.pagecaptio)+" "+TRANSFORM(m.icurrentpage)+" - "+TRANSFORM(.pagetotal)
          ENDIF
       ENDIF
    ENDWITH
   ENDPROC
**
   PROCEDURE RefreshToolbar
    WITH this.previewform.toolbar
       FOR EACH ocontrol IN .controls
          .setall("AutoSize", .T., "cmd")
          .setall("AutoSize", .F., "cmd")
          .setall("Height", 22)
       ENDFOR
    ENDWITH
   ENDPROC
**
   PROCEDURE UpdateToolBar
    WITH this.previewform
       .allowprintfrompreview = .F.
       LOCAL lcreportname, lctitle
       IF  .NOT. gohelper.lextended
          BINDEVENT(this, "Destroy", gohelper, "ReportReleased")
          lcreportname = gohelper._cfrxname
          this.previewform.caption = lcreportname
       ELSE
          lcreportname = JUSTSTEM(gohelper._onames(1))
          lctitle = IIF(EMPTY(gohelper.ctitle), lcreportname, gohelper.ctitle)
          this.previewform.caption = lctitle
          this.previewform.formcaption = lctitle
       ENDIF
       this.synchpageno()
       WITH .toolbar AS TOOLBAR
          WITH .cntnext
             .width = 0044
             .height = 22
             .cmdforward.width = 22
             .cmdforward.height = 22
             .cmdforward.picture = "pr_next.bmp"
             .cmdforward.tooltiptext = TRIM(gohelper._olang.menunext)
             .cmdbottom.width = 22
             .cmdbottom.height = 22
             .cmdbottom.left = 22
             .cmdbottom.picture = "pr_bottom.bmp"
             .cmdbottom.tooltiptext = TRIM(gohelper._olang.menulast)
          ENDWITH
          WITH .cntprev
             .width = 0044
             .height = 22
             .cmdtop.width = 22
             .cmdtop.height = 22
             .cmdtop.picture = "pr_top.bmp"
             .cmdtop.tooltiptext = TRIM(gohelper._olang.menutop)
             .cmdback.width = 22
             .cmdback.height = 22
             .cmdback.left = 22
             .cmdback.picture = "pr_previous.bmp"
             .cmdback.tooltiptext = TRIM(gohelper._olang.menuprev)
             LOCAL locmdgoto AS COMMANDBUTTON
             IF UPPER(TRIM(gohelper._olang.language))<>"ENGLISH"
                this.previewform.toolbar.cmdgotopage.visible = .F.
                .addobject("cmdGoto1", "cmdGotoEx")
                locmdgoto = .cmdgoto1
                locmdgoto.left = .width
                .width = .width+22
             ELSE
                locmdgoto = this.previewform.toolbar.cmdgotopage
             ENDIF
             locmdgoto.width = 22
             locmdgoto.height = 22
             locmdgoto.picture = "pr_gotopage.bmp"
             locmdgoto.tooltiptext = TRIM(gohelper._olang.menugoto)
          ENDWITH
          IF gohelper.lshowminiatures
             .addobject("cmdProof1", "cmdProof")
             .cmdproof1.tooltiptext = TRIM(gohelper._olang.miniatures)
          ENDIF
          LOCAL locombo AS COMBOBOX
          locombo = .cbozoom
          IF UPPER(TRIM(gohelper._olang.language))<>"ENGLISH"
             IF  .NOT. EMPTY(TRIM(gohelper._olang.cbozoomtti))
                .cbozoom.tooltiptext = TRIM(gohelper._olang.cbozoomtti)
             ELSE
                .cbozoom.tooltiptext = "Zoom"
             ENDIF
             LOCAL n, lcitem
             FOR n = 1 TO locombo.listcount
                lcitem = LOWER(locombo.listitem(n))
                IF lcitem="whole page"
                   locombo.listitem(n) = TRIM(gohelper._olang.cbozoomwho)
                ENDIF
                IF lcitem="fit to width"
                   locombo.listitem(n) = TRIM(gohelper._olang.cbozoompgw)
                ENDIF
             ENDFOR
             locombo.width = locombo.width+10
             WITH .opgpagecount
                .opt1.tooltiptext = TRIM(gohelper._olang.onepgttip)
                .opt2.tooltiptext = TRIM(gohelper._olang.twopgttip)
                .opt3.tooltiptext = TRIM(gohelper._olang.fourpgttip)
             ENDWITH
          ENDIF
          WITH .opgpagecount AS OPTIONGROUP
             .opt1.height = 22
             .opt2.height = 22
             .opt3.height = 22
             .opt1.width = 22
             .opt2.width = 22
             .opt3.width = 22
             .opt2.left = 22
             .opt3.left = 0044
             .opt1.picture = "pr_1page.bmp"
             .opt2.picture = "pr_2page.bmp"
             .opt3.picture = "pr_4page.bmp"
             .height = 22
             .width = 0066
          ENDWITH
          .refresh()
          IF gohelper.lprintvisible
             .addobject("cmbPrinters1", "cmbPrinters")
             .cmbprinters1.height = locombo.height
             .cmbprinters1.fontsize = locombo.fontsize
             .cmbprinters1.tooltiptext = TRIM(gohelper._olang.availablep)
             IF gohelper.lshowcopies .AND. gohelper.lextended
                .addobject("cntCopies1", "cntCopies")
             ENDIF
             IF gohelper.lsavetofile
                .addobject("cmdSave1", "cmdSave")
                .cmdsave1.tooltiptext = TRIM(gohelper._olang.savereport)
                .addobject("cmbSave1", "cmbSave")
                LOCAL lncmbindex
                lncmbindex = 0
                WITH .cmbsave1
                   IF gohelper.lsaveasimage
                      lncmbindex = lncmbindex+1
                      .additem(TRIM(gohelper._olang.saveasimag))
                      .picture[lncmbindex] = "pr_Img.bmp"
                      .list[.newindex, 2] = '1'
                   ENDIF
                   IF gohelper.lextended
                      IF gohelper.lsaveaspdf
                         lncmbindex = lncmbindex+1
                         .additem(TRIM(gohelper._olang.saveaspdf))
                         .picture[lncmbindex] = "pr_Pdf.bmp"
                         .list[.newindex, 2] = '2'
                      ENDIF
                      IF gohelper.lsaveashtml
                         lncmbindex = lncmbindex+1
                         .additem(TRIM(gohelper._olang.saveashtml))
                         .list[.newindex, 2] = '3'
                         .picture[lncmbindex] = "pr_HTML.bmp"
                      ENDIF
                      IF gohelper.lsaveasrtf
                         lncmbindex = lncmbindex+1
                         .additem(TRIM(gohelper._olang.saveasrtf))
                         .list[.newindex, 2] = '4'
                         .picture[lncmbindex] = "pr_Word.bmp"
                      ENDIF
                      IF gohelper.lsaveasxls
                         lncmbindex = lncmbindex+1
                         .additem(TRIM(gohelper._olang.saveasxls))
                         .list[.newindex, 2] = '5'
                         .picture[lncmbindex] = "pr_Excel.bmp"
                      ENDIF
                   ENDIF
                ENDWITH
             ENDIF
             IF gohelper.lsendtoemail .AND. gohelper.lextended
                .addobject("cmdEmail1", "cmdEmail")
                .cmdemail1.tooltiptext = TRIM(gohelper._olang.sendtoemai)
             ENDIF
             IF gohelper.lprinterpref
                .addobject("cmdPrinterProps1", "cmdPrinterProps")
                .cmdprinterprops1.tooltiptext = TRIM(gohelper._olang.printingpr)
             ENDIF
             .addobject("cmdPrint1", "cmdPrintEx")
             .cmdprint1.tooltiptext = TRIM(gohelper._olang.printrepor)
          ENDIF
          .cmdclose.visible = .F.
          .addobject("cmdExit1", "cmdExit")
          .cmdexit1.tooltiptext = TRIM(gohelper._olang.closerepor)
          IF 22>28
             IF gohelper.lsavetofile
                .cmbsave1.fontsize = 12
             ENDIF
             .cmbprinters1.fontsize = 12
             .cbozoom.fontsize = 12
             .cbozoom.width = 115
          ENDIF
          IF gohelper.lshowcopies .AND. gohelper.lextended
             .cntcopies1.spncopies1.fontsize = .cbozoom.fontsize
             .cntcopies1.lblcopies1.fontsize = .cbozoom.fontsize
             .cntcopies1.adjustcontrols()
          ENDIF
       ENDWITH
    ENDWITH
   ENDPROC
**
   PROCEDURE ParentClosed
    UNBINDEVENTS(this)
    this.actionclose()
    gohelper.reportreleased(this)
   ENDPROC
**
   PROCEDURE DoProof
    gohelper._oproofsheet = CREATEOBJECT("ProofSheet")
    gohelper._oproofsheet.setreport(this.previewform.oreport)
    gohelper._oproofsheet.caption = TRIM(gohelper._olang.globalprev)
    gohelper._oproofsheet.nmaxminiatureitem = gohelper.nmaxminiaturedisplay
    IF VARTYPE(gohelper._oparentform)="O"
       ACTIVATE WINDOW (gohelper._oparentform.name)
       ACTIVATE WINDOW (this.previewform.name)
    ENDIF
    gohelper._oproofsheet.setproofcaption()
    gohelper._oproofsheet.show(1)
    TRY
       this.previewform.setcurrentpage(gohelper._oproofsheet.currentpage)
       gohelper._oproofsheet = ""
    CATCH
    ENDTRY
   ENDPROC
**
   PROCEDURE DoSave
    LPARAMETERS tnindex
    this.dosavetype(tnindex)
    IF gohelper._lnowait .AND.  .NOT. EMPTY(gohelper.cdestfile)
       gohelper.dooutput()
    ENDIF
   ENDPROC
**
   PROCEDURE DoSaveType
    LPARAMETERS tntype
    LOCAL lcfile
    lcfile = ""
    DO CASE
       CASE tntype=1
          lcfile = PUTFILE(TRIM(gohelper._olang.saveasimag)+"...", "", "Png;Bmp;Jpg;Gif;Tif;Emf")
          IF  .NOT. EMPTY(lcfile)
             LOCAL lolistener
             lolistener = this.previewform.oreport
             gohelper.lsaved = report2pic(lolistener, lcfile, JUSTEXT(lcfile))
             lolistener = .NULL.
          ENDIF
       CASE tntype=2
          lcfile = PUTFILE(TRIM(gohelper._olang.saveaspdf)+"...", "", "Pdf")
       CASE tntype=3
          lcfile = PUTFILE(TRIM(gohelper._olang.saveashtml)+"...", "", "Htm;Html")
       CASE tntype=4
          lcfile = PUTFILE(TRIM(gohelper._olang.saveasrtf)+"...", "", "Rtf;Doc")
       CASE tntype=5
          lcfile = PUTFILE(TRIM(gohelper._olang.saveasxls)+"...", "", "Xls")
       OTHERWISE
    ENDCASE
    IF  .NOT. EMPTY(lcfile)
       gohelper.cdestfile = lcfile
       this.actionclose()
    ENDIF
   ENDPROC
**
   PROCEDURE DoSendEmail
    gohelper.closeproof()
    LOCAL lcfile, lcfolder
    IF gohelper.lemailauto
       lcfolder = ADDBS(GETENV("TEMP"))
       lcfile = lcfolder+FORCEEXT(JUSTFNAME(gohelper._cfrxname), gohelper.cemailtype)
    ELSE
       lcfile = PUTFILE("Save file as ...", "", "Pdf;Rtf;Htm;Xls")
    ENDIF
    IF EMPTY(lcfile)
       RETURN
    ENDIF
    gohelper.cdestfile = lcfile
    gohelper._lsendingemail = .T.
    this.actionclose()
    IF gohelper._lnowait .AND.  .NOT. EMPTY(gohelper.cdestfile)
       gohelper.dooutput()
    ENDIF
   ENDPROC
**
   FUNCTION HandledKeyPress
    LPARAMETERS nkeycode, nshiftaltctrl
    RETURN .F.
   ENDFUNC
**
   PROCEDURE PAINT
**
** ReFox - este procedimiento es vacío **
**
   ENDPROC
**
   FUNCTION RELEASE
    RETURN .T.
   ENDFUNC
**
   PROCEDURE destroy
**
** ReFox - este procedimiento es vacío **
**
   ENDPROC
**
ENDDEFINE
**
DEFINE CLASS cmdReport AS CommandButton
 caption = ""
 width = 024
 height = 22
 specialeffect = 2
ENDDEFINE
**
DEFINE CLASS cntCopies AS Container
 backstyle = 0
 borderwidth = 0
 height = 23
 width = 30
 visible = .T.
 ADD OBJECT spncopies1 AS spncopies
 ADD OBJECT lblcopies1 AS lblcopies
**
   PROCEDURE Init
**
** ReFox - este procedimiento es vacío **
**
   ENDPROC
**
   PROCEDURE AdjustControls
    WITH this
       LOCAL lccopiescaption
       lccopiescaption = ALLTRIM(gohelper._olang.copies)
       .lblcopies1.caption = lccopiescaption
       .lblcopies1.autosize = .T.
       .lblcopies1.top = (22-.lblcopies1.height)/2
       .lblcopies1.tooltiptext = lccopiescaption
       .spncopies1.tooltiptext = lccopiescaption
       .tooltiptext = lccopiescaption
       LOCAL lntxtwidth
       lntxtwidth = TXTWIDTH(lccopiescaption, .lblcopies1.fontname, .lblcopies1.fontsize)*FONTMETRIC(6, .lblcopies1.fontname, .lblcopies1.fontsize)
       .lblcopies1.left = 2
       .spncopies1.left = lntxtwidth+4
       .spncopies1.width = .spncopies1.width+IIF(.spncopies1.fontsize>10, 4, 0)
       .width = lntxtwidth+2+.spncopies1.width+2
    ENDWITH
   ENDPROC
**
ENDDEFINE
**
DEFINE CLASS spnCopies AS Spinner
 width = 42
 height = 22
 specialeffect = 2
 increment = 1
 spinnerhighvalue = 99
 spinnerlowvalue = 1
 keyboardhighvalue = 99
 keyboardlowvalue = 1
 visible = .T.
**
   PROCEDURE Init
    this.value = gohelper.ncopies
   ENDPROC
**
   PROCEDURE InteractiveChange
    gohelper.ncopies = this.value
   ENDPROC
**
ENDDEFINE
**
DEFINE CLASS lblCopies AS Label
 autosize = .T.
 backstyle = 0
 top = 2
 visible = .T.
ENDDEFINE
**
DEFINE CLASS cmdSave AS cmdReport
 picture = "pr_Save.bmp"
 visible = .T.
**
   PROCEDURE Click
    IF  .NOT. gohelper.lextended
       this.parent.previewform.extensionhandler.dosave(1)
    ELSE
       this.parent.cmbsave1.value = ""
       this.parent.cmbsave1.setfocus()
       KEYBOARD "{ALT+DNARROW}"
    ENDIF
   ENDPROC
**
ENDDEFINE
**
DEFINE CLASS cmbSave AS ComboBox
 height = 1
 width = 1
 visible = .T.
 nindex = 0
**
   PROCEDURE DropDown
    this.value = ""
    this.nindex = 0
   ENDPROC
**
   PROCEDURE Valid
    IF  .NOT. EMPTY(this.value)
       LOCAL lnindex
       lnindex = VAL(this.list(this.listindex, 2))
       this.nindex = lnindex
       this.value = ""
       this.parent.previewform.extensionhandler.dosave(lnindex)
    ENDIF
   ENDPROC
**
ENDDEFINE
**
DEFINE CLASS cmdPrinterProps AS cmdReport
 picture = "pr_PrintPref.bmp"
 visible = .T.
**
   PROCEDURE Click
    this.parent.previewform.extensionhandler.docustomprint()
   ENDPROC
**
ENDDEFINE
**
DEFINE CLASS cmdEmail AS cmdReport
 picture = "pr_Mail.bmp"
 visible = .T.
**
   PROCEDURE Click
    this.parent.previewform.extensionhandler.dosendemail()
   ENDPROC
**
ENDDEFINE
**
DEFINE CLASS cmdExit AS cmdReport
 picture = "pr_close.bmp"
 visible = .T.
**
   PROCEDURE Click
    this.parent.previewform.visible = .F.
    gohelper.lprinted = .F.
    gohelper.closeproof()
    this.parent.previewform.extensionhandler.actionclose()
   ENDPROC
**
   PROCEDURE MouseEnter
    LPARAMETERS nbutton, nshift, nxcoord, nycoord
    this.picture = "pr_close2.bmp"
   ENDPROC
**
   PROCEDURE MouseLeave
    LPARAMETERS nbutton, nshift, nxcoord, nycoord
    this.picture = "pr_close.bmp"
   ENDPROC
**
   PROCEDURE Init
**
** ReFox - este procedimiento es vacío **
**
   ENDPROC
**
ENDDEFINE
**
DEFINE CLASS cmdPrintEx AS cmdReport
 picture = "pr_Print.bmp"
 visible = .T.
**
   PROCEDURE Init
    this.tooltiptext = pr_printrepor
   ENDPROC
**
   PROCEDURE RightClick
**
** ReFox - este procedimiento es vacío **
**
   ENDPROC
**
   PROCEDURE Click
    this.parent.previewform.extensionhandler.actionprintex()
   ENDPROC
**
   PROCEDURE Init
**
** ReFox - este procedimiento es vacío **
**
   ENDPROC
**
ENDDEFINE
**
DEFINE CLASS cmdGotoEx AS cmdReport
 picture = "pr_gotopage.bmp"
 visible = .T.
**
   PROCEDURE Init
**
** ReFox - este procedimiento es vacío **
**
   ENDPROC
**
   PROCEDURE Click
    this.parent.parent.previewform.extensionhandler.actiongotopage()
   ENDPROC
**
ENDDEFINE
**
DEFINE CLASS cmbPrinters AS Combobox
 width = 200
 columncount = 2
 columnlines = .F.
 rowsourcetype = 0
 columnwidths = "220,140"
 style = 2
 visible = .T.
 _coriginalprinter = ""
**
   PROCEDURE Init
    LOCAL laprinters(1)
    = APRINTERS(laprinters)
    LOCAL lcdefprintern, lccurrprinter, n
    lcdefprinter = SET("Printer", 3)
    WITH this AS COMBOBOX
       FOR n = 1 TO ALEN(laprinters) STEP 2
          lccurrprinter = laprinters(n)
          IF UPPER(ALLTRIM(lcdefprinter))=UPPER(ALLTRIM(lccurrprinter))
             lcdefprinter = lccurrprinter
             .additem(lccurrprinter)
             .list(.newindex, 2) = laprinters(n+1)
             EXIT
          ENDIF
       ENDFOR
       FOR n = 1 TO ALEN(laprinters) STEP 2
          lccurrprinter = laprinters(n)
          IF  .NOT. (UPPER(ALLTRIM(lcdefprinter))=UPPER(ALLTRIM(lccurrprinter)))
             .additem(lccurrprinter)
             .list(.newindex, 2) = laprinters(n+1)
          ENDIF
       ENDFOR
       .listindex = 1
       ._coriginalprinter = lcdefprinter
       LOCAL lcitem
       FOR n = 1 TO .listcount
          lcitem = .list(n, 1)
          IF LEFT(lcitem, 1)="\"
             .list(n, 1) = "\\"+lcitem
          ENDIF
          lcitem = .list(n, 2)
          IF LEFT(lcitem, 1)="\"
             .list(n, 2) = "\\"+lcitem
          ENDIF
       ENDFOR
    ENDWITH
    IF gohelper.lextended=.F.
       BINDEVENT(this, "Enabled", this, "DisableCombo", 1)
    ENDIF
   ENDPROC
**
   PROCEDURE DisableCombo
    this.enabled = .F.
   ENDPROC
**
   PROCEDURE Valid
    LOCAL lcvalue, lcorigprinter
    lcvalue = this.value
    lcorigprinter = gohelper._coriginalprinter
    IF LEFT(lcvalue, 1)="\" .AND. SUBSTR(lcvalue, 2, 1)<>"\"
       lcvalue = "\"+lcvalue
    ENDIF
    IF ALLTRIM(UPPER(lcvalue))<>ALLTRIM(UPPER(lcorigprinter))
       gohelper.cprintername = lcvalue
    ENDIF
   ENDPROC
**
ENDDEFINE
**
DEFINE CLASS cmdProof AS CmdReport
 picture = "pr_Locate.bmp"
 tooltiptext = TRIM(gohelper._olang.miniatures)
 visible = .T.
**
   PROCEDURE Click
    this.parent.previewform.extensionhandler.doproof()
   ENDPROC
**
ENDDEFINE
**
DEFINE CLASS CustomFrxGotoPageForm AS frmReport
 height = 92
 width = 345
 showwindow = 1
 docreate = .T.
 autocenter = .T.
 borderstyle = 2
 closable = .F.
 maxbutton = .F.
 minbutton = .F.
 alwaysontop = .T.
 allowoutput = .F.
 pageno = 0
 pagetotal = 0
 oparentform = (.NULL.)
 name = "frxgotopageform"
 ADD OBJECT shp1 AS shape WITH top = 15, left = 12, height = 66, width = 224, backstyle = 0, zorderset = 0, style = 3, name = "Shp1"
 ADD OBJECT spnpageno AS spinner WITH height = 21, inputmask = "9999", left = 64, top = 36, width = 126, zorderset = 1, name = "spnPageno"
 ADD OBJECT lblcaption AS label WITH left = 20, top = 8, zorderset = 2, style = 3, name = "lblCaption", autosize = .T.
 ADD OBJECT cmdok AS cmdreport WITH top = 15, left = 248, width = 84, height = 25, default = .T., zorderset = 3, name = "cmdOK", specialeffect = 0
 ADD OBJECT cmdcancel AS cmdreport WITH top = 47, left = 248, width = 84, height = 25, cancel = .T., zorderset = 4, name = "cmdCancel", specialeffect = 0
**
   PROCEDURE Show
    LPARAMETERS nstyle
    this.pageno = this.oparentform.currentpage
    this.pagetotal = this.oparentform.pagetotal
    this.caption = TRIM(gohelper._olang.reporttitl)
    this.lblcaption.caption = TRIM(gohelper._olang.gotopg_cap)+" (1-"+TRANSFORM(this.pagetotal)+")"
    IF this.oparentform.showwindow=2
       this.autocenter = .F.
       this.left = this.oparentform.viewportleft+INT(this.oparentform.width/2-this.width/2)
       this.top = this.oparentform.viewporttop+INT(this.oparentform.height/2-this.height/2)
    ELSE
       this.autocenter = .T.
    ENDIF
    this.spnpageno.spinnerlowvalue = 1
    this.spnpageno.spinnerhighvalue = this.pagetotal
    this.spnpageno.keyboardlowvalue = 1
    this.spnpageno.keyboardhighvalue = this.pagetotal
    this.spnpageno.value = this.pageno
    DODEFAULT(m.nstyle)
   ENDPROC
**
   PROCEDURE Init
    this.cmdok.caption = TRIM(gohelper._olang.gotopg_ok)
    this.cmdcancel.caption = TRIM(gohelper._olang.cancel)
   ENDPROC
**
   PROCEDURE spnpageno.LostFocus
    IF this.value<this.spinnerlowvalue
       this.value = 1
    ENDIF
    IF this.value>this.spinnerhighvalue
       this.value = this.spinnerhighvalue
    ENDIF
    DODEFAULT()
   ENDPROC
**
   PROCEDURE cmdok.Click
    this.parent.pageno = this.parent.spnpageno.value
    this.parent.hide()
   ENDPROC
**
   PROCEDURE cmdcancel.Click
    this.parent.hide()
   ENDPROC
**
ENDDEFINE
**
DEFINE CLASS frmReport AS Form
 icon = "wwrite.ico"
 showtips = .T.
ENDDEFINE
**
DEFINE CLASS proofshape AS shape
 height = 110
 width = 85
 pageno = 0
 name = "proofshape"
**
   PROCEDURE MouseLeave
    LPARAMETERS nbutton, nshift, nxcoord, nycoord
    this.mousepointer = 0
   ENDPROC
**
   PROCEDURE MouseEnter
    LPARAMETERS nbutton, nshift, nxcoord, nycoord
    this.mousepointer = 15
    this.parent.ncurrshape = this.pageno
   ENDPROC
**
   PROCEDURE Click
    thisform.currentpage = this.pageno
    thisform.hide()
    ACTIVATE SCREEN
   ENDPROC
**
ENDDEFINE
**
DEFINE CLASS PageSetBtn AS commandbutton
 height = 22
 width = 22
 caption = ""
 ctype = "NEXT"
**
   PROCEDURE Click
    DO CASE
       CASE this.ctype=="FIRST"
          this.parent.npageset = 1
       CASE this.ctype=="PREV"
          this.parent.npageset = this.parent.npageset-1
       CASE this.ctype=="NEXT"
          this.parent.npageset = this.parent.npageset+1
       CASE this.ctype=="LAST"
          this.parent.npageset = CEILING(this.parent.npages/this.parent.nmaxminiatureitem)
    ENDCASE
    this.parent.refreshpagebtn()
   ENDPROC
**
   PROCEDURE REFRESH
    DO CASE
       CASE this.ctype=="FIRST"
          this.enabled =  .NOT. (this.parent.npageset==1)
       CASE this.ctype=="PREV"
          this.enabled =  .NOT. (this.parent.npageset==1)
       CASE this.ctype=="NEXT"
          this.enabled =  .NOT. (this.parent.npageset==CEILING(this.parent.npages/this.parent.nmaxminiatureitem))
       CASE this.ctype=="LAST"
          this.enabled =  .NOT. (this.parent.npageset==CEILING(this.parent.npages/this.parent.nmaxminiatureitem))
    ENDCASE
   ENDPROC
**
ENDDEFINE
**
DEFINE CLASS proofsheet AS frmReport
 height = 274
 width = 622
 scrollbars = 3
 docreate = .T.
 autocenter = .T.
 showwindow = 1
 desktop = .T.
 currentpage = 0
 reportlistener = .NULL.
 lstarted = .F.
 npages = 1
 lpainted = .F.
 ncurrshape = 0
 name = "proofsheet"
 npageset = 1
 lshowdone = .F.
 notherthenproofobj = 0
 nmaxminiatureitem = 64
 oldescfunction = ""
**
   PROCEDURE INIT
    this.addobject("PageSetFirst", "PageSetBtn")
    this.notherthenproofobj = this.notherthenproofobj+1
    WITH this.pagesetfirst
       .top = 3
       .left = 10
       .caption = ""
       .picture = "pr_top.bmp"
       .tooltiptext = TRIM(gohelper._olang.minifirstt)
       .ctype = "FIRST"
       .visible = .F.
    ENDWITH
    this.addobject("PageSetPrev", "PageSetBtn")
    this.notherthenproofobj = this.notherthenproofobj+1
    WITH this.pagesetprev
       .top = 3
       .left = this.pagesetfirst.left+this.pagesetfirst.width+2
       .caption = ""
       .picture = "pr_previous.bmp"
       .tooltiptext = TRIM(gohelper._olang.miniprevti)
       .ctype = "PREV"
       .visible = .F.
    ENDWITH
    this.addobject("PageSetNext", "PageSetBtn")
    this.notherthenproofobj = this.notherthenproofobj+1
    WITH this.pagesetnext
       .top = 3
       .left = this.pagesetprev.left+this.pagesetprev.width+2
       .caption = ""
       .picture = "pr_next.bmp"
       .tooltiptext = TRIM(gohelper._olang.mininextti)
       .ctype = "NEXT"
       .visible = .F.
    ENDWITH
    this.addobject("PageSetLast", "PageSetBtn")
    this.notherthenproofobj = this.notherthenproofobj+1
    WITH this.pagesetlast
       .top = 3
       .left = this.pagesetnext.left+this.pagesetnext.width+2
       .caption = ""
       .picture = "pr_bottom.bmp"
       .tooltiptext = TRIM(gohelper._olang.minilastti)
       .ctype = "LAST"
       .visible = .F.
    ENDWITH
    this.addobject("PageSetCaption", "Label")
    this.notherthenproofobj = this.notherthenproofobj+1
    WITH this.pagesetcaption
       .left = this.pagesetlast.left+this.pagesetlast.width+10
       .autosize = .T.
       .caption = ""
       .fontname = "Arial"
       .fontsize = 10
       .fontbold = .T.
       .top = this.pagesetnext.top+((this.pagesetnext.height-.height)/2)
       .visible = .F.
    ENDWITH
    this.oldescfunction = ON("KEY", "ESCAPE")
    ON KEY LABEL ESCAPE _VFP.ACTIVEFORM.RELEASE()
   ENDPROC
**
   PROCEDURE RefreshPageBtn
    this.pagesetnext.refresh()
    this.pagesetprev.refresh()
   ENDPROC
**
   PROCEDURE setreport
    LPARAMETERS oreport
    this.reportlistener = m.oreport
    this.npages = m.oreport.outputpagecount
   ENDPROC
**
   PROCEDURE Resize
    this.show()
   ENDPROC
**
   PROCEDURE Activate
    this.lshowdone = .F.
   ENDPROC
**
   PROCEDURE QueryUnload
    this.hide()
    ACTIVATE SCREEN
   ENDPROC
**
   PROCEDURE nPageSet_assign
    LPARAMETERS vnewvalue
    DO CASE
       CASE (this.npageset==CEILING(this.npages/this.nmaxminiatureitem)) .AND. (vnewvalue<>CEILING(this.npages/this.nmaxminiatureitem))
          FOR i = this.notherthenproofobj+1 TO this.objects.count
             IF  .NOT. this.objects(i).visible
                this.objects[i].visible = .T.
             ENDIF
          ENDFOR
       CASE (this.npageset<>CEILING(this.npages/this.nmaxminiatureitem)) .AND. (vnewvalue==CEILING(this.npages/this.nmaxminiatureitem))
          FOR i = this.notherthenproofobj+1 TO this.objects.count
             IF i>this.npages-((CEILING(this.npages/this.nmaxminiatureitem)-1)*this.nmaxminiatureitem)+this.notherthenproofobj
                this.objects[i].visible = .F.
             ENDIF
          ENDFOR
    ENDCASE
    this.npageset = vnewvalue
    this.setproofcaption()
    this.show()
   ENDPROC
**
   PROCEDURE SetProofCaption
    LOCAL cmessage, nfirstpage, nlastpage
    nfirstpage = ((this.npageset-1)*this.nmaxminiatureitem)+1
    nlastpage = MIN(this.npageset*this.nmaxminiatureitem, this.npages)
    cmessage = TRIM(gohelper._olang.minilabel)
    this.pagesetcaption.caption = STRTRAN(STRTRAN(cmessage, "%FP%", TRANSFORM(nfirstpage)), "%LP%", TRANSFORM(nlastpage))
   ENDPROC
**
   PROCEDURE ReportListener_Assign
    LPARAMETERS onewvalue
    this.reportlistener = onewvalue
    this.doresizeproofsheet()
   ENDPROC
**
   PROCEDURE nMaxMiniatureItem_Assign
    LPARAMETERS nnewitem
    this.nmaxminiatureitem = nnewitem
    this.doresizeproofsheet()
   ENDPROC
**
   PROCEDURE DoResizeProofSheet
    IF  .NOT. ISNULL(this.reportlistener)
       nproofwidth = this.reportlistener.getpagewidth()/96
       nproofheight = this.reportlistener.getpageheight()/96
       nmaxscreenwtoconsidere = (_SCREEN.width/5)*4
       nmaxscreenhtoconsidere = (_SCREEN.height/5)*4
       ndiv = nproofwidth+10
       nnbcol = INT((nmaxscreenwtoconsidere-10)/ndiv)
       IF nnbcol>=this.npages
          nnbcol = this.npages
       ENDIF
       this.width = 10+(nnbcol*(nproofwidth+10))
       nnbrow = CEILING(MIN(this.nmaxminiatureitem, this.npages)/nnbcol)
       IF CEILING(this.npages/this.nmaxminiatureitem)>1
          nbaseheight = 032
       ELSE
          nbaseheight = 10
       ENDIF
       this.height = MIN(nmaxscreenhtoconsidere, nbaseheight+(nnbrow*(nproofheight+10)))
       IF this.height<nbaseheight+(nnbrow*(nproofheight+10))
          this.width = this.width+20
       ENDIF
       this.autocenter = .T.
    ENDIF
   ENDPROC
**
   PROCEDURE Paint
    IF ( .NOT. ISNULL(this.reportlistener))
       IF  .NOT. this.lshowdone
          FOR i = ((this.npageset-1)*this.nmaxminiatureitem)+1 TO this.npageset*this.nmaxminiatureitem
             IF TYPE("THIS.Objects[i - ((This.nPageSet - 1) * This.nMaxMiniatureItem) + This.nOtherThenProofObj]")=="O"
                IF i>this.npages
                   EXIT
                ELSE
                   this.objects[i-((this.npageset-1)*this.nmaxminiatureitem)+this.notherthenproofobj].tooltiptext = TRIM(gohelper._olang.pagecaptio)+" "+TRANSFORM(i)
                   this.reportlistener.outputpage(m.i, this.objects(i-((this.npageset-1)*this.nmaxminiatureitem)+this.notherthenproofobj), 2)
                ENDIF
             ELSE
                EXIT
             ENDIF
          ENDFOR
          this.lshowdone = .T.
       ENDIF
    ENDIF
   ENDPROC
**
   PROCEDURE Show
    LPARAMETERS nstyle
    IF CEILING(this.npages/this.nmaxminiatureitem)>1
       IF  .NOT. this.lstarted
          this.pagesetfirst.visible = .T.
          this.pagesetprev.visible = .T.
          this.pagesetnext.visible = .T.
          this.pagesetlast.visible = .T.
          this.pagesetcaption.visible = .T.
       ENDIF
       irowoffset = 0030+IIF(22>24, 0002, 0)
    ELSE
       irowoffset = 10
    ENDIF
    icoloffset = 10
    nproofwidth = this.reportlistener.getpagewidth()/96
    nproofheight = this.reportlistener.getpageheight()/96
    icolcount = INT((thisform.width-icoloffset)/(nproofwidth+10))
    ncurcol = 1
    this.lshowdone = .F.
    FOR i = ((this.npageset-1)*this.nmaxminiatureitem)+1 TO MIN(this.npageset*this.nmaxminiatureitem, this.npages)
       nobjectid = i-((this.npageset-1)*this.nmaxminiatureitem)+this.notherthenproofobj
       IF  .NOT. this.lstarted
          this.addobject(SYS(2015), "ProofShape")
          this.objects[nobjectid].visible = .T.
          this.objects[nobjectid].width = nproofwidth
          this.objects[nobjectid].height = nproofheight
       ENDIF
       TRY
          this.objects[nobjectid].top = irowoffset
          this.objects[nobjectid].left = 10+((ncurcol-1)*(nproofwidth+10))
          this.objects[nobjectid].pageno = m.i
          ncurcol = ncurcol+1
          IF ncurcol>icolcount
             ncurcol = 1
             irowoffset = irowoffset+10+this.objects(nobjectid).height
          ENDIF
       CATCH
       ENDTRY
    ENDFOR
    this.lstarted = .T.
    DODEFAULT(nstyle)
   ENDPROC
**
   PROCEDURE Destroy
    LOCAL cescfunction
    this.reportlistener = .NULL.
    escfunction = this.oldescfunction
    ON KEY LABEL ESCAPE &escfunction
   ENDPROC
**
ENDDEFINE
**
FUNCTION PR_ScreenToClient
 LPARAMETERS hwnd, cpoint
 DECLARE INTEGER ScreenToClient IN user32 AS PR_ScreenToClient INTEGER, STRING @
 RETURN pr_screentoclient(m.hwnd, @m.cpoint)
ENDFUNC
**
FUNCTION PR_GetCursorPos
 LPARAMETERS cpoint
 DECLARE INTEGER GetCursorPos IN user32 AS PR_GetCursorPos STRING @
 RETURN pr_getcursorpos(@m.cpoint)
ENDFUNC
**
FUNCTION PR_PathFileExists
 LPARAMETERS pszpath
 DECLARE INTEGER PathFileExists IN shlwapi AS PR_PathFileExists STRING
 RETURN pr_pathfileexists(@m.pszpath)
ENDFUNC
**
FUNCTION PR_GetFocus
 DECLARE INTEGER GetFocus IN user32 AS PR_GetFocus
 RETURN pr_getfocus()
ENDFUNC
**
FUNCTION PR_GetWindowText
 LPARAMETERS hwnd, lpstring, cch
 DECLARE INTEGER GetWindowText IN user32 AS PR_GetWindowText INTEGER, STRING @, INTEGER
 RETURN pr_getwindowtext(hwnd, @lpstring, cch)
ENDFUNC
**
FUNCTION PR_GetActiveWindow
 DECLARE INTEGER GetActiveWindow IN user32 AS PR_GetActiveWindow
 RETURN pr_getactivewindow()
ENDFUNC
**
FUNCTION PR_MAPISendDocuments
 LPARAMETERS uluiparam, lpszdelimchar, lpszfullpaths, lpszfilenames, ulreserved
 DECLARE INTEGER MAPISendDocuments IN mapi32 AS PR_MAPISendDocuments INTEGER, STRING, STRING, STRING, INTEGER
 RETURN pr_mapisenddocuments(uluiparam, lpszdelimchar, lpszfullpaths, lpszfilenames, ulreserved)
ENDFUNC
**
FUNCTION CleanClauses
 LPARAMETERS tcclauses
 LOCAL lcclauses
 lcclauses = STRTRAN(tcclauses, "NOCONSOLE", "")
 lcclauses = STRTRAN(lcclauses, "noconsole", "")
 lcclauses = STRTRAN(lcclauses, "PREVIEW", "")
 lcclauses = STRTRAN(lcclauses, "preview", "")
 RETURN lcclauses
ENDFUNC
**
FUNCTION IsDotMatrix
 LPARAMETERS tcprinter
 LOCAL lnbins, lcbuff
 lcbuff = SPACE(512)
 lnbins = pr_devicecapabilities(tcprinter, .NULL., 6, @lcbuff, .NULL.)
 RETURN (CHR(8)+CHR(0))$LEFT(lcbuff, lnbins*2)
ENDFUNC
**
FUNCTION PR_DeviceCapabilities
 LPARAMETERS sprinter, sport, ncapability, sreturn, pdevmode
 DECLARE LONG DeviceCapabilities IN WinSpool.drv AS PR_DeviceCapabilities STRING @, STRING @, INTEGER, STRING @, STRING @
 RETURN pr_devicecapabilities(sprinter, sport, ncapability, @sreturn, pdevmode)
ENDFUNC
**
FUNCTION GetParentWindow
 LOCAL hwindow
 hwindow = pr_getfocus()
 RETURN getwintext(hwindow)
ENDFUNC
**
FUNCTION GetWinText
 LPARAMETERS hwindow
 LOCAL lnbufsize, lcbuffer
 lnbufsize = 1024
 lcbuffer = REPLICATE(CHR(0), lnbufsize)
 lnbufsize = pr_getwindowtext(hwindow, @lcbuffer, lnbufsize)
 RETURN IIF(lnbufsize=0, "", LEFT(lcbuffer, lnbufsize))
ENDFUNC
**
PROCEDURE SendMailEx
 LPARAMETERS tcattachment, tcrecipient, tcsubject, tctext
 LOCAL lcattachment, lcrecipient, lcsubject, lctext
 lcattachment = EVL(tcattachment, "")
 lcrecipient = EVL(tcrecipient, "")
 lcsubject = EVL(tcsubject, "")
 lctext = EVL(tctext, "")
 DO declmapi
 LOCAL hsession
 hsession = getnewsession()
 IF hsession=0
    RETURN
 ENDIF
 LOCAL lorcpemail, losndbuf, lcrcpbuf, losubject, lonotetext, lorcpbuf, lcmapimessage, lnresult
 LOCAL lcattachment
 lcattachment = tcattachment
 LOCAL loattach, loattpath, loattname
 LOCAL lcattstruct
 loattpath = CREATEOBJECT("PChar", lcattachment)
 loattname = CREATEOBJECT("PChar", JUSTFNAME(lcattachment))
 lcattstruct = num2dword(0)+num2dword(0)+num2dword(0)+num2dword(loattpath.getaddr())+num2dword(loattname.getaddr())+num2dword(0)
 loattach = CREATEOBJECT("PChar", lcattstruct)
 losubject = CREATEOBJECT("PChar", lcsubject)
 lonotetext = CREATEOBJECT("PChar", lctext)
 IF  .NOT. EMPTY(lcrecipient)
    lorcpemail = CREATEOBJECT("PChar", lcrecipient)
    lcrcpbuf = num2dword(0)+num2dword(1)+num2dword(lorcpemail.getaddr())+REPLICATE(CHR(0), 12)
    lorcpbuf = CREATEOBJECT("PChar", lcrcpbuf)
 ENDIF
 losndbuf = CREATEOBJECT("PChar", REPLICATE(CHR(0), 24))
 lcmapimessage = num2dword(0)+num2dword(losubject.getaddr())+num2dword(lonotetext.getaddr())+num2dword(0)+num2dword(0)+num2dword(0)+num2dword(0)+num2dword(losndbuf.getaddr())+num2dword(IIF(EMPTY(lcrecipient), 0, 1))+num2dword(IIF(EMPTY(lcrecipient), 0, lorcpbuf.getaddr()))+num2dword(IIF(EMPTY(lcattachment), 0, 1))+num2dword(IIF(EMPTY(lcattachment), 0, loattach.getaddr()))
 lnresult = mapisendmail(hsession, 0, @lcmapimessage, 8, 0)
 IF lnresult<>0
 ELSE
 ENDIF
 = mapilogoff(hsession, 0, 0, 0)
ENDPROC
**
FUNCTION getNewSession
 LOCAL lnresult, lnsession, lcstoredpath
 lcstoredpath = SYS(5)+SYS(2003)
 lnsession = 0
 lnresult = mapilogon(0, "", "", 066, 0, @lnsession)
 SET DEFAULT TO (lcstoredpath)
 RETURN IIF(lnresult=0, lnsession, 0)
ENDFUNC
**
FUNCTION num2dword
 LPARAMETERS lnvalue
 RETURN BINTOC(lnvalue, "4RS")
ENDFUNC
**
DEFINE CLASS PChar AS Custom
 PROTECTED hmem
**
   PROCEDURE Init
    LPARAMETERS lcstring
    this.hmem = 0
    IF  .NOT. EMPTY(lcstring)
       this.setvalue(lcstring)
    ENDIF
   ENDPROC
**
   PROCEDURE Destroy
    this.releasestring
   ENDPROC
**
   FUNCTION getAddr
    RETURN this.hmem
   ENDFUNC
**
   FUNCTION getValue
    LOCAL lnsize, lcbuffer
    lnsize = this.getallocsize()
    lcbuffer = SPACE(lnsize)
    IF this.hmem<>0
       DECLARE RtlMoveMemory IN kernel32 AS Heap2Str STRING @, INTEGER, INTEGER
       = heap2str(@lcbuffer, this.hmem, lnsize)
    ENDIF
    RETURN lcbuffer
   ENDFUNC
**
   FUNCTION getAllocSize
    DECLARE INTEGER GlobalSize IN kernel32 INTEGER
    RETURN IIF(this.hmem=0, 0, globalsize(this.hmem))
   ENDFUNC
**
   PROCEDURE setValue
    LPARAMETERS lcstring
    this.releasestring
    DECLARE INTEGER GlobalAlloc IN kernel32 INTEGER, INTEGER
    DECLARE RtlMoveMemory IN kernel32 AS Str2Heap INTEGER, STRING @, INTEGER
    LOCAL lnsize
    lcstring = lcstring+CHR(0)
    lnsize = LEN(lcstring)
    this.hmem = globalalloc(0, lnsize)
    IF this.hmem<>0
       = str2heap(this.hmem, @lcstring, lnsize)
    ENDIF
   ENDPROC
**
   PROCEDURE ReleaseString
    IF this.hmem<>0
       DECLARE INTEGER GlobalFree IN kernel32 INTEGER
       = globalfree(this.hmem)
       this.hmem = 0
    ENDIF
   ENDPROC
**
ENDDEFINE
**
PROCEDURE DeclMapi
 DECLARE INTEGER MAPILogon IN mapi32 INTEGER, STRING, STRING, INTEGER, INTEGER, INTEGER @
 DECLARE INTEGER MAPILogoff IN mapi32 INTEGER, INTEGER, INTEGER, INTEGER
 DECLARE INTEGER MAPISendMail IN mapi32 INTEGER, INTEGER, STRING @, INTEGER, INTEGER
 RETURN
ENDPROC
**
FUNCTION Report2Pic
 LPARAMETERS tolistener, tcdestfile, tcfileformat
 IF VARTYPE(tolistener)<>"O"
    ERROR "Report Listener could not be accessed"
    RETURN .F.
 ENDIF
 IF VARTYPE(tcfileformat)="L"
    tcfileformat = JUSTEXT(tcdestfile)
 ENDIF
 tcfileformat = LOWER(tcfileformat)
 LOCAL lnpagecount, lnfiletype, lndevicetype
 lnpagecount = gohelper.npagetotal
 DO CASE
    CASE tcfileformat="emf"
       lnfiletype = 100
    CASE tcfileformat="tiff" .OR. tcfileformat="tif"
       lnfiletype = 101
       LOCAL lnpageno
       FOR lnpageno = 1 TO lnpagecount
          IF (lnpageno==1)
             lndevicetype = 101
          ELSE
             lndevicetype = (0201)
          ENDIF
          tolistener.outputpage(lnpageno, tcdestfile, lndevicetype)
       ENDFOR
       RETURN
    CASE tcfileformat="jpeg" .OR. tcfileformat="jpg"
       lnfiletype = 102
    CASE tcfileformat="gif"
       lnfiletype = 103
    CASE tcfileformat="png"
       lnfiletype = 104
    CASE tcfileformat="bmp" .OR. tcfileformat="bitmap"
       lnfiletype = 105
 ENDCASE
 ERASE (tcdestfile)
 LOCAL lcpathfile, lcdestfile, lcindex, llsuccess
 llsuccess = .T.
 lcpathfile = ADDBS(JUSTPATH(tcdestfile))+JUSTSTEM(tcdestfile)
 FOR lnpageno = 1 TO lnpagecount
    IF lnpagecount=1
       lcindex = ""
    ELSE
       lcindex = TRANSFORM(lnpageno)
    ENDIF
    lcdestfile = FORCEEXT((lcpathfile+lcindex), tcfileformat)
    tolistener.outputpage(lnpageno, lcdestfile, lnfiletype)
    IF  .NOT. FILE(lcdestfile)
       llsuccess = .F.
    ENDIF
 ENDFOR
 RETURN llsuccess
ENDFUNC
**
