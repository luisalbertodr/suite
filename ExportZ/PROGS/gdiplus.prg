**
DEFINE CLASS gdiplusbase AS Custom
 errorcode = 0
ENDDEFINE
**
DEFINE CLASS graphics AS gdiplusbase
 smoothingmode = 0
 graphics = 0
 hdc = 0
**
   FUNCTION SmoothingMode_ACCESS
    LOCAL nsmoothingmode
    nsmoothingmode = 0
    IF gdipgetsmoothingmode(this.graphics, @nsmoothingmode)=0
       this.smoothingmode = nsmoothingmode
    ENDIF
    RETURN this.smoothingmode
   ENDFUNC
**
   PROCEDURE SmoothingMode_ASSIGN
    LPARAMETERS vvalue
    IF VARTYPE(vvalue)="N" .AND. gdipsetsmoothingmode(this.graphics, vvalue)=0
       this.smoothingmode = vvalue
    ENDIF
   ENDPROC
**
   PROCEDURE Init
    LPARAMETERS p1, p2
    IF PCOUNT()>0
       this.creategraphics(p1, p2)
    ENDIF
   ENDPROC
**
   PROCEDURE Destroy
    this.releasegraphics
    DODEFAULT()
   ENDPROC
**
   PROCEDURE ReleaseGraphics
    IF this.graphics=0
       RETURN
    ENDIF
    this.releasedc
    = gdipdeletegraphics(this.graphics)
    this.graphics = 0
   ENDPROC
**
   FUNCTION CreateGraphics
    LPARAMETERS p1, p2
    this.releasegraphics
    LOCAL graphics, nobjtype
    STORE 0 TO graphics
    nobjtype = getobjecttype(m.p1)
    DO CASE
       CASE nobjtype=0 .AND. iswindow(m.p1)<>0
          this.errorcode = gdipcreatefromhwnd(m.p1, @graphics)
       CASE nobjtype=3 .AND. PCOUNT()=1
          this.errorcode = gdipcreatefromhdc(m.p1, @graphics)
       CASE nobjtype=3 .AND. PCOUNT()=2
          this.errorcode = gdipcreatefromhdc2(m.p1, m.p2, @graphics)
       OTHERWISE
          this.errorcode = -1
          RETURN .F.
    ENDCASE
    this.graphics = m.graphics
    RETURN (this.errorcode=0)
   ENDFUNC
**
   FUNCTION GetDC
    this.releasedc
    LOCAL hdc
    hdc = 0
    IF this.graphics<>0
       = gdipgetdc(this.graphics, @hdc)
    ENDIF
    this.hdc = m.hdc
    RETURN m.hdc
   ENDFUNC
**
   PROCEDURE ReleaseDC
    IF this.hdc<>0
       = gdipreleasedc(this.graphics, this.hdc)
       this.hdc = 0
    ENDIF
   ENDPROC
**
   PROCEDURE DrawImage
    LPARAMETERS oimage, nx, ny, nwidth, nheight
    IF VARTYPE(nwidth)<>"N"
       nwidth = oimage.imgwidth
    ENDIF
    IF VARTYPE(nheight)<>"N"
       nheight = oimage.imgheight
    ENDIF
    this.errorcode = gdipdrawimagerecti(this.graphics, oimage.himage, m.nx, m.ny, m.nwidth, m.nheight)
   ENDPROC
**
   FUNCTION DrawText
    LPARAMETERS cstr, ofont, p1, p2, p3, p4
    LOCAL rectf
    IF VARTYPE(m.p1)="O"
       rectf = p1.tostring()
    ELSE
       WITH CREATEOBJECT("rectf", m.p1, m.p2, m.p3, m.p4)
          rectf = .tostring()
       ENDWITH
    ENDIF
    = gdipsettextrenderinghint(this.graphics, 0)
    this.errorcode = gdipdrawstring(this.graphics, towidechar(m.cstr), -1, ofont.fnt, @rectf, 0, ofont.brush)
    RETURN (this.errorcode=0)
   ENDFUNC
**
   FUNCTION MeasureString
    LPARAMETERS cstr, ofont
    LOCAL fmt AS GDISTRINGFORMAT, orect, crectsrc, crectdst, ncharsfitted, nlinesfitted
    fmt = CREATEOBJECT("gdistringformat", 0)
    orect = CREATEOBJECT("rectf", 0, 0, 0, 0)
    STORE orect.tostring() TO crectsrc, crectdst
    STORE 0 TO ncharsfitted, nlinesfitted
    this.errorcode = gdipmeasurestring(this.graphics, STRCONV(m.cstr+CHR(0), 5), LEN(m.cstr), ofont.fnt, crectsrc, fmt.fmt, @crectdst, @ncharsfitted, @nlinesfitted)
    orect.fromstring(m.crectdst)
    RETURN m.orect
   ENDFUNC
**
   PROCEDURE FillRectangle
    LPARAMETERS p1, p2, p3, p4, p5
    LOCAL brush
    IF VARTYPE(m.p1)="O"
       brush = p1.brush
    ELSE
       LOCAL obrush
       obrush = CREATEOBJECT("gdisolidbrush", m.p1)
       brush = obrush.brush
    ENDIF
    IF VARTYPE(p2)="O"
       = gdipfillrectangle(this.graphics, m.brush, p2.rleft, p2.rtop, p2.rwidth, p2.rheight)
    ELSE
       = gdipfillrectangle(this.graphics, m.brush, m.p2, m.p3, m.p4, m.p5)
    ENDIF
   ENDPROC
**
   PROCEDURE FillEllipse
    LPARAMETERS p1, p2, p3, p4, p5
    LOCAL brush
    IF VARTYPE(m.p1)="O"
       brush = p1.brush
    ELSE
       LOCAL obrush
       obrush = CREATEOBJECT("gdisolidbrush", m.p1)
       brush = obrush.brush
    ENDIF
    IF VARTYPE(p2)="O"
       = gdipfillellipse(this.graphics, m.brush, p2.rleft, p2.rtop, p2.rwidth, p2.rheight)
    ELSE
       = gdipfillellipse(this.graphics, m.brush, m.p2, m.p3, m.p4, m.p5)
    ENDIF
   ENDPROC
**
   PROCEDURE DrawRectangle
    LPARAMETERS p1, p2, p3, p4, p5
    LOCAL nhandle
    IF VARTYPE(m.p1)="O"
       nhandle = p1.hpen
    ELSE
       LOCAL openobj
       openobj = CREATEOBJECT("gdipen", m.p1, 1)
       nhandle = openobj.hpen
    ENDIF
    IF VARTYPE(p2)="O"
       = gdipdrawrectangle(this.graphics, m.nhandle, p2.rleft, p2.rtop, p2.rwidth, p2.rheight)
    ELSE
       = gdipdrawrectangle(this.graphics, m.nhandle, m.p2, m.p3, m.p4, m.p5)
    ENDIF
   ENDPROC
**
   PROCEDURE DrawEllipse
    LPARAMETERS p1, p2, p3, p4, p5
    LOCAL nhandle
    IF VARTYPE(m.p1)="O"
       nhandle = p1.hpen
    ELSE
       LOCAL openobj
       openobj = CREATEOBJECT("gdipen", m.p1, 1)
       nhandle = openobj.hpen
    ENDIF
    IF VARTYPE(p2)="O"
       = gdipdrawellipse(this.graphics, m.nhandle, p2.rleft, p2.rtop, p2.rwidth, p2.rheight)
    ELSE
       = gdipdrawellipse(this.graphics, m.nhandle, m.p2, m.p3, m.p4, m.p5)
    ENDIF
   ENDPROC
**
   PROCEDURE DrawLine
    LPARAMETERS p1, p2, p3, p4, p5
    LOCAL nhandle
    IF VARTYPE(m.p1)="O"
       nhandle = p1.hpen
    ELSE
       LOCAL openobj
       openobj = CREATEOBJECT("gdipen", m.p1, 1)
       nhandle = openobj.hpen
    ENDIF
    IF VARTYPE(p2)="O"
       = gdipdrawline(this.graphics, m.nhandle, p2.rleft, p2.rtop, p2.rwidth, p2.rheight)
    ELSE
       = gdipdrawline(this.graphics, m.nhandle, m.p2, m.p3, m.p4, m.p5)
    ENDIF
   ENDPROC
**
   PROCEDURE SetTransform
    LPARAMETERS vmatrix
    DO CASE
       CASE VARTYPE(m.vmatrix)="O"
          this.errorcode = gdipsetworldtransform(this.graphics, vmatrix.hmatrix)
       CASE VARTYPE(m.vmatrix)="N"
          this.errorcode = gdipsetworldtransform(this.graphics, m.vmatrix)
    ENDCASE
   ENDPROC
**
   PROCEDURE ResetTransform
    this.errorcode = gdipresetworldtransform(this.graphics)
   ENDPROC
**
ENDDEFINE
**
DEFINE CLASS gdidbrush AS gdiplusbase
 brush = 0
**
   PROCEDURE Destroy
    this.releasebrush
   ENDPROC
**
   PROTECTED PROCEDURE ReleaseBrush
    IF this.brush<>0
       = gdipdeletebrush(this.brush)
       this.brush = 0
    ENDIF
   ENDPROC
**
ENDDEFINE
**
DEFINE CLASS gdisolidbrush AS gdidbrush
**
   PROCEDURE Init
    LPARAMETERS argbcolor
    IF VARTYPE(m.argbcolor)<>"N"
       argbcolor = 0
    ENDIF
    this.setbrushcolor(argbcolor)
   ENDPROC
**
   FUNCTION SetBrushColor
    LPARAMETERS argbcolor
    this.releasebrush
    LOCAL brush
    brush = 0
    this.errorcode = gdipcreatesolidfill(m.argbcolor, @brush)
    this.brush = m.brush
    RETURN (this.errorcode=0)
   ENDFUNC
**
ENDDEFINE
**
DEFINE CLASS gdiimage AS gdiplusbase
 himage = 0
 hbitmap = 0
 filename = ""
 imgtype = 0
 imgwidth = 0
 imgheight = 0
 imgflags = 0
 guid = ""
 graphics = 0
**
   PROCEDURE Init
    LPARAMETERS p1, p2, p3, p4, p5, p6
    DO CASE
       CASE PCOUNT()=1 .AND. VARTYPE(p1)="C"
          this.createfromfile(p1)
       CASE PCOUNT()=1 .AND. VARTYPE(p1)="N"
          this.createfromhandle(p1)
       CASE PCOUNT()=1 .AND. VARTYPE(p1)="O"
          this.clonefromgdibitmap1(p1)
       CASE PCOUNT()>1 .AND. VARTYPE(p1)="O"
          this.clonefromgdibitmap2(p1, p2, p3, p4, p5, p6)
    ENDCASE
   ENDPROC
**
   PROCEDURE Destroy
    this.releaseimage
    DODEFAULT()
   ENDPROC
**
   PROCEDURE ReleaseImage
    IF VARTYPE(this.graphics)="O"
       this.graphics = 0
    ENDIF
    IF this.himage<>0
       = gdipdisposeimage(this.himage)
       this.himage = 0
    ENDIF
    IF this.hbitmap<>0
       IF getobjecttype(this.hbitmap)=7
          = deleteobject(this.hbitmap)
       ENDIF
       this.hbitmap = 0
    ENDIF
    this.filename = ""
    this.imgtype = 0
    this.imgwidth = 0
    this.imgheight = 0
    this.imgflags = 0
    this.guid = ""
    this.errorcode = 0
   ENDPROC
**
   FUNCTION CreateFromFile
    LPARAMETERS cfile
    this.releaseimage
    this.filename = m.cfile
    LOCAL img, imgtype, imgwidth, imgheight, imgflags, guid
    STORE 0 TO img, imgtype, imgwidth, imgheight, imgflags
    TRY
       this.errorcode = gdiploadimagefromfile(towidechar(cfile), @img)
    CATCH
       this.errorcode = -1
    ENDTRY
    this.himage = m.img
    this.getimageparameters
    RETURN (this.himage<>0)
   ENDFUNC
**
   FUNCTION CreateFromHandle
    LPARAMETERS img
    this.releaseimage
    this.himage = m.img
    this.getimageparameters
    IF this.imgtype<>0
       RETURN .T.
    ELSE
       this.releaseimage
       RETURN .F.
    ENDIF
   ENDFUNC
**
   FUNCTION CloneFromGdiBitmap1
    LPARAMETERS src
    LOCAL srchbitmap, dsthimage, dst
    srchbitmap = src.gethbitmap()
    IF srchbitmap<>0
       dsthimage = 0
       this.errorcode = gdipcreatebitmapfromhbitmap(m.srchbitmap, 0, @dsthimage)
       IF this.errorcode=0
          RETURN this.createfromhandle(dsthimage)
       ENDIF
    ENDIF
    RETURN .F.
   ENDFUNC
**
   FUNCTION CloneFromGdiBitmap2
    LPARAMETERS src, dstfmt, x0, y0, dstwidth, dstheight
    LOCAL dsthimage
    dsthimage = 0
    this.errorcode = gdipclonebitmaparea(m.x0, m.y0, m.dstwidth, m.dstheight, dstfmt, src.himage, @dsthimage)
    IF this.errorcode=0
       RETURN this.createfromhandle(dsthimage)
    ENDIF
    RETURN .F.
   ENDFUNC
**
   PROTECTED PROCEDURE GetImageParameters
    LOCAL imgtype, imgwidth, imgheight, imgflags, guid, graphics
    STORE 0 TO imgtype, imgwidth, imgheight, imgflags, graphics
    guid = REPLICATE(CHR(0), 16)
    IF this.himage<>0
       = gdipgetimagetype(this.himage, @m.imgtype)
       = gdipgetimagewidth(this.himage, @m.imgwidth)
       = gdipgetimageheight(this.himage, @m.imgheight)
       = gdipgetimageflags(this.himage, @m.imgflags)
       = gdipgetimagerawformat(this.himage, @m.guid)
    ENDIF
    this.imgtype = m.imgtype
    this.imgwidth = m.imgwidth
    this.imgheight = m.imgheight
    this.imgflags = m.imgflags
    this.guid = m.guid
    IF VARTYPE(this.graphics)="N"
       this.errorcode = gdipgetimagegraphicscontext(this.himage, @graphics)
       IF this.errorcode=0
          this.graphics = CREATEOBJECT("graphics")
          this.graphics.graphics = m.graphics
       ENDIF
    ENDIF
   ENDPROC
**
   FUNCTION GetHBITMAP
    LOCAL hbitmap
    hbitmap = 0
    IF this.hbitmap=0
       this.errorcode = gdipcreatehbitmapfrombitmap(this.himage, @hbitmap, 0)
       IF this.errorcode=0
          this.hbitmap = m.hbitmap
       ENDIF
    ENDIF
    RETURN this.hbitmap
   ENDFUNC
**
   FUNCTION CreateHICON
    LOCAL hicon
    hicon = 0
    this.errorcode = gdipcreatehiconfrombitmap(this.himage, @hicon)
    RETURN m.hicon
   ENDFUNC
**
   FUNCTION SaveToFile
    LPARAMETERS ctargetfile
    LOCAL ctype, cencoder
    ctype = UPPER(ALLTRIM(SUBSTR(ctargetfile, RAT(".", ctargetfile)+1)))
    DO CASE
       CASE ctype=="BMP"
          cencoder = stringtoclsid("{557cf400-1a04-11d3-9a73-0000f81ef32e}")
       CASE ctype=="JPG" .OR. ctype=="JPEG"
          cencoder = stringtoclsid("{557CF401-1A04-11D3-9A73-0000F81EF32E}")
       CASE ctype=="GIF"
          cencoder = stringtoclsid("{557cf402-1a04-11d3-9a73-0000f81ef32e}")
       CASE ctype=="TIF" .OR. ctype=="TIFF"
          cencoder = stringtoclsid("{557cf405-1a04-11d3-9a73-0000f81ef32e}")
       CASE ctype=="PNG"
          cencoder = stringtoclsid("{557cf406-1a04-11d3-9a73-0000f81ef32e}")
       OTHERWISE
          this.errorcode = -1
          RETURN .F.
    ENDCASE
    this.errorcode = gdipsaveimagetofile(this.himage, towidechar(m.ctargetfile), m.cencoder, 0)
    RETURN (this.errorcode=0)
   ENDFUNC
**
ENDDEFINE
**
DEFINE CLASS gdibitmap AS gdiimage
**
   PROCEDURE Init
    LPARAMETERS p1, p2
    IF PCOUNT()=2 .AND. VARTYPE(p1)="N" .AND. VARTYPE(p2)="N"
       this.createbitmap(p1, p2)
    ENDIF
   ENDPROC
**
   FUNCTION CreateBitmap
    LPARAMETERS nwidth, nheight
    RETURN this.createfromhwnd(nwidth, nheight, getdesktopwindow())
   ENDFUNC
**
   FUNCTION CreateFromHWND
    LPARAMETERS nwidth, nheight, hwindow
    LOCAL gr, lresult
    gr = CREATEOBJECT("graphics", m.hwindow)
    lresult = this.createfromgraphics(nwidth, nheight, gr.graphics)
    RETURN m.lresult
   ENDFUNC
**
   FUNCTION CreateFromGraphics
    LPARAMETERS nwidth, nheight, graphics
    LOCAL img
    img = 0
    this.errorcode = gdipcreatebitmapfromgraphics(m.nwidth, m.nheight, m.graphics, @img)
    IF this.errorcode=0
       RETURN this.createfromhandle(m.img)
    ELSE
       RETURN .F.
    ENDIF
   ENDFUNC
**
   FUNCTION CreateFromHBITMAP
    LPARAMETERS hbitmap
    LOCAL img
    img = 0
    this.errorcode = gdipcreatebitmapfromhbitmap(m.hbitmap, 0, @m.img)
    IF this.errorcode=0
       RETURN this.createfromhandle(m.img)
    ELSE
       RETURN .F.
    ENDIF
   ENDFUNC
**
   FUNCTION CreateFromHICON
    LPARAMETERS hicon
    LOCAL img
    img = 0
    this.errorcode = gdipcreatebitmapfromhicon(m.hicon, @m.img)
    IF this.errorcode=0
       RETURN this.createfromhandle(m.img)
    ELSE
       RETURN .F.
    ENDIF
   ENDFUNC
**
   FUNCTION CreateFromBITMAPINFO
    LPARAMETERS hbitmapinfo, hbitmapdata
    IF VARTYPE(hbitmapdata)<>"N" .OR. hbitmapdata=0
       hbitmapdata = hbitmapinfo+40
    ENDIF
    LOCAL img
    img = 0
    this.errorcode = gdipcreatebitmapfromgdidib(hbitmapinfo, hbitmapdata, @img)
    IF this.errorcode=0
       RETURN this.createfromhandle(m.img)
    ELSE
       RETURN .F.
    ENDIF
   ENDFUNC
**
ENDDEFINE
**
DEFINE CLASS gdifontcollection AS gdiplusbase
 fontfamilies = 0
**
   PROCEDURE Init
    this.getfontfamilies
   ENDPROC
**
   FUNCTION GetFontFamily
    LPARAMETERS vfamilyname
    LOCAL ofamily, ex AS EXCEPTION
    TRY
       ofamily = this.fontfamilies.item(vfamilyname)
    CATCH TO ex
       IF VARTYPE(vfamilyname)="C"
          ofamily = this.getfamilybyname(vfamilyname)
       ELSE
          ofamily = CREATEOBJECT("gdifontfamily")
       ENDIF
    ENDTRY
    RETURN m.ofamily
   ENDFUNC
**
   PROTECTED FUNCTION GetFamilyByName
    LPARAMETERS cfamilyname
    cfamilyname = LOWER(ALLTRIM(m.cfamilyname))
    LOCAL ofamily AS GDIFONTFAMILY
    FOR EACH ofamily IN this.fontfamilies
       IF LOWER(ofamily.familyname)=m.cfamilyname
          RETURN ofamily
       ENDIF
    ENDFOR
    ofamily = CREATEOBJECT("gdifontfamily")
    RETURN m.ofamily
   ENDFUNC
**
   PROTECTED PROCEDURE GetFontFamilies
    this.fontfamilies = CREATEOBJECT("Collection")
    LOCAL fonts, familycount, cbuffer, hfontfamily, nindex
    STORE 0 TO fonts, familycount
    = gdipnewinstalledfontcollection(@fonts)
    = gdipgetfontcollectionfamilycount(fonts, @familycount)
    cbuffer = REPLICATE(CHR(0), m.familycount*4)
    = gdipgetfontcollectionfamilylist(fonts, familycount, @cbuffer, @familycount)
    FOR nindex = 0 TO familycount-1
       LOCAL ofontfamily
       hfontfamily = buf2dword(SUBSTR(cbuffer, nindex*4+1, 4))
       ofontfamily = CREATEOBJECT("gdifontfamily", m.hfontfamily)
       this.fontfamilies.add(ofontfamily, ofontfamily.familyname)
    ENDFOR
   ENDPROC
**
ENDDEFINE
**
DEFINE CLASS gdifontfamily AS gdiplusbase
 hfontfamily = 0
 familyname = ""
 hasregular = .F.
 hasbold = .F.
 hasitalic = .F.
 hasbolditalic = .F.
 hasunderline = .F.
 hasstrikeout = .F.
**
   PROCEDURE Init
    LPARAMETERS hfontfamily
    IF VARTYPE(m.hfontfamily)="N"
       this.hfontfamily = m.hfontfamily
       this.getfamilydata
    ENDIF
   ENDPROC
**
   PROTECTED PROCEDURE GetFamilyData
    LOCAL familyname, langid
    langid = VAL(SYS(3004))
    familyname = REPLICATE(CHR(0), 00066)
    = gdipgetfamilyname(this.hfontfamily, @m.familyname, m.langid)
    this.familyname = STRCONV(m.familyname, 6)
    this.hasregular = this.isstyleavailable(0)
    this.hasbold = this.isstyleavailable(1)
    this.hasitalic = this.isstyleavailable(2)
    this.hasbolditalic = this.isstyleavailable(3)
    this.hasunderline = this.isstyleavailable(4)
    this.hasstrikeout = this.isstyleavailable(8)
   ENDPROC
**
   PROTECTED FUNCTION IsStyleAvailable
    LPARAMETERS nstyle
    LOCAL navailable
    navailable = 0
    = gdipisstyleavailable(this.hfontfamily, nstyle, @navailable)
    RETURN (navailable<>0)
   ENDFUNC
**
ENDDEFINE
**
DEFINE CLASS gdifont AS gdiplusbase
 PROTECTED fontfamilycreated
 hfontfamily = 0
 fnt = 0
 brush = 0
**
   PROCEDURE Init
    LPARAMETERS vfamily, fntsize, fntstyle, argbcolor
    DO CASE
       CASE PCOUNT()=0
          this.initfont("Arial", 10, 0, argb(0, 0, 0))
       CASE PCOUNT()=1
          this.initfont(vfamily, 10, 0, argb(0, 0, 0))
       CASE PCOUNT()=2
          this.initfont(vfamily, fntsize, 0, argb(0, 0, 0))
       CASE PCOUNT()=3
          this.initfont(vfamily, fntsize, fntstyle, argb(0, 0, 0))
       CASE PCOUNT()=4
          this.initfont(vfamily, fntsize, fntstyle, argbcolor)
    ENDCASE
   ENDPROC
**
   PROTECTED FUNCTION InitFont
    LPARAMETERS vfamily, fntsize, fntstyle, argbcolor
    this.clearfont
    DO CASE
       CASE VARTYPE(m.vfamily)="O"
          this.hfontfamily = vfamily.hfontfamily
       CASE VARTYPE(m.vfamily)="N"
          this.hfontfamily = m.vfamily
       CASE VARTYPE(m.vfamily)="C"
          LOCAL hfontfamily
          hfontfamily = 0
          this.errorcode = gdipcreatefontfamilyfromname(towidechar(m.vfamily), 0, @m.hfontfamily)
          this.hfontfamily = m.hfontfamily
          this.fontfamilycreated = .T.
       OTHERWISE
          RETURN .F.
    ENDCASE
    LOCAL brush, fnt
    STORE 0 TO brush, fnt
    = gdipcreatesolidfill(m.argbcolor, @brush)
    this.errorcode = gdipcreatefont(this.hfontfamily, m.fntsize, m.fntstyle, 3, @m.fnt)
    this.fnt = m.fnt
    this.brush = m.brush
    RETURN (this.errorcode=0)
   ENDFUNC
**
   PROCEDURE Destroy
    this.clearfont
   ENDPROC
**
   PROCEDURE ClearFont
    IF this.brush<>0
       = gdipdeletebrush(this.brush)
       this.brush = 0
    ENDIF
    IF this.fnt<>0
       = gdipdeletefont(this.fnt)
       this.fnt = 0
    ENDIF
    IF this.hfontfamily<>0 .AND. this.fontfamilycreated
       = gdipdeletefontfamily(this.hfontfamily)
       this.hfontfamily = 0
    ENDIF
    this.fontfamilycreated = .F.
   ENDPROC
**
ENDDEFINE
**
DEFINE CLASS gdipen AS gdiplusbase
 hpen = 0
**
   PROCEDURE Init
    LPARAMETERS nargbcolor, npenwidth
    LOCAL hpen
    hpen = 0
    this.errorcode = gdipcreatepen1(nargbcolor, npenwidth, 0, @hpen)
    this.hpen = m.hpen
   ENDPROC
**
   PROCEDURE Destroy
    IF this.hpen<>0
       = gdipdeletepen(this.hpen)
       this.hpen = 0
    ENDIF
   ENDPROC
**
ENDDEFINE
**
DEFINE CLASS gdimatrix AS gdiplusbase
 hmatrix = 0
 m11 = 0
 m12 = 0
 m21 = 0
 m22 = 0
 dx = 0
 dy = 0
**
   PROCEDURE Init
    LPARAMETERS m11, m12, m21, m22, dx, dy
    LOCAL hmatrix
    hmatrix = 0
    IF VARTYPE(m.m11)="N" .AND. VARTYPE(m.m12)="N" .AND. VARTYPE(m.m21)="N" .AND. VARTYPE(m.m22)="N"
       IF VARTYPE(m.dx)<>"N"
          dx = 0
       ENDIF
       IF VARTYPE(m.dy)<>"N"
          dy = 0
       ENDIF
       this.errorcode = gdipcreatematrix2(m11, m12, m21, m22, dx, dy, @m.hmatrix)
    ELSE
       this.errorcode = gdipcreatematrix(@m.hmatrix)
    ENDIF
    this.hmatrix = m.hmatrix
    this.getelements
   ENDPROC
**
   PROCEDURE Destroy
    IF this.hmatrix<>0
       = gdipdeletematrix(this.hmatrix)
       this.hmatrix = 0
    ENDIF
   ENDPROC
**
   PROCEDURE SetElements
    LPARAMETERS m11, m12, m21, m22, dx, dy
    IF VARTYPE(m.dx)<>"N"
       dx = 0
    ENDIF
    IF VARTYPE(m.dy)<>"N"
       dy = 0
    ENDIF
    this.errorcode = gdipsetmatrixelements(this.hmatrix, m.m11, m.m12, m.m21, m.m22, m.dx, m.dy)
   ENDPROC
**
   PROCEDURE GetElements
    LOCAL ccoords
    ccoords = REPLICATE(CHR(0), 24)
    this.errorcode = gdipgetmatrixelements(this.hmatrix, @m.ccoords)
    IF this.errorcode=0
       this.m11 = float2int(buf2dword(SUBSTR(m.ccoords, 1, 4)))
       this.m12 = float2int(buf2dword(SUBSTR(m.ccoords, 5, 4)))
       this.m21 = float2int(buf2dword(SUBSTR(m.ccoords, 9, 4)))
       this.m22 = float2int(buf2dword(SUBSTR(m.ccoords, 13, 4)))
       this.dx = float2int(buf2dword(SUBSTR(m.ccoords, 17, 4)))
       this.dy = float2int(buf2dword(SUBSTR(m.ccoords, 21, 4)))
    ENDIF
   ENDPROC
**
   PROCEDURE Translate
    LPARAMETERS noffsetx, noffsety, norder
    IF VARTYPE(m.norder)<>"N"
       norder = 0
    ENDIF
    this.errorcode = gdiptranslatematrix(this.hmatrix, m.noffsetx, m.noffsety, m.norder)
   ENDPROC
**
   PROCEDURE Scale
    LPARAMETERS nscalex, nscaley, norder
    IF VARTYPE(m.norder)<>"N"
       norder = 0
    ENDIF
    this.errorcode = gdipscalematrix(this.hmatrix, m.nscalex, m.nscaley, m.norder)
   ENDPROC
**
   PROCEDURE Shear
    LPARAMETERS nshearx, nsheary, norder
    IF VARTYPE(m.norder)<>"N"
       norder = 0
    ENDIF
    this.errorcode = gdipshearmatrix(this.hmatrix, m.nshearx, m.nsheary, m.norder)
   ENDPROC
**
   PROCEDURE Rotate
    LPARAMETERS nangle, norder
    IF VARTYPE(m.norder)<>"N"
       norder = 0
    ENDIF
    this.errorcode = gdiprotatematrix(this.hmatrix, m.nangle, m.norder)
   ENDPROC
**
   PROCEDURE Invert
    this.errorcode = gdipinvertmatrix(this.hmatrix)
   ENDPROC
**
ENDDEFINE
**
DEFINE CLASS gdistringformat AS gdiplusbase
 fmt = 0
**
   PROCEDURE Init
    LPARAMETERS nattributes
    LOCAL nfmt
    nfmt = 0
    this.errorcode = gdipcreatestringformat(nattributes, 0, @nfmt)
    this.fmt = m.nfmt
   ENDPROC
**
   PROCEDURE Destroy
    IF this.fmt<>0
       = gdipdeletestringformat(this.fmt)
       this.fmt = 0
    ENDIF
   ENDPROC
**
ENDDEFINE
**
DEFINE CLASS gdiplusinit AS Custom
 PROTECTED htoken
 errorcode = 0
 initialized = .F.
**
   PROCEDURE Init
    this.declare
    this.initialized = this.initgdiplus()
   ENDPROC
**
   PROCEDURE Destroy
    this.releasegdiplus
   ENDPROC
**
   PROTECTED FUNCTION InitGDIplus
    LOCAL htoken, cinput
    htoken = 0
    cinput = PADR(CHR(1), 16, CHR(0))
    TRY
       this.errorcode = gdiplusstartup(@htoken, @cinput, 0)
    CATCH
       this.errorcode = -1
    ENDTRY
    this.htoken = htoken
    RETURN (this.errorcode=0)
   ENDFUNC
**
   PROTECTED PROCEDURE ReleaseGDIplus
    IF this.htoken<>0
       = gdiplusshutdown(this.htoken)
       this.htoken = 0
    ENDIF
   ENDPROC
**
   PROCEDURE decl
    this.declare
   ENDPROC
**
   PROCEDURE declare
    DECLARE INTEGER IsWindow IN user32 INTEGER
    DECLARE INTEGER GetDesktopWindow IN user32
    DECLARE INTEGER GetObjectType IN gdi32 INTEGER
    DECLARE INTEGER DeleteObject IN gdi32 INTEGER
    DECLARE INTEGER GdipDeleteFont IN gdiplus INTEGER
    DECLARE INTEGER GdipDeleteFontFamily IN gdiplus INTEGER
    DECLARE INTEGER GdiplusShutdown IN gdiplus INTEGER
    DECLARE INTEGER GdipDeleteGraphics IN gdiplus INTEGER
    DECLARE INTEGER GdipDeletePen IN gdiplus INTEGER
    DECLARE INTEGER GdipDeleteBrush IN gdiplus INTEGER
    DECLARE INTEGER CLSIDFromString IN ole32 STRING, STRING @
    DECLARE INTEGER GdipCreateMatrix IN gdiplus INTEGER @
    DECLARE INTEGER GdipDeleteMatrix IN gdiplus INTEGER
    DECLARE INTEGER GdipDeleteStringFormat IN gdiplus INTEGER
    DECLARE INTEGER GdipInvertMatrix IN gdiplus INTEGER
    DECLARE INTEGER GdipSetSmoothingMode IN gdiplus INTEGER, INTEGER
    DECLARE INTEGER GdipGetSmoothingMode IN gdiplus INTEGER, INTEGER @
    DECLARE INTEGER GdipCreateMatrix2 IN gdiplus SINGLE, SINGLE, SINGLE, SINGLE, SINGLE, SINGLE, INTEGER @
    DECLARE INTEGER GdipMeasureString IN gdiplus INTEGER, STRING, INTEGER, INTEGER, STRING, INTEGER, STRING @, INTEGER @, INTEGER @
    DECLARE INTEGER GdipCreateStringFormat IN gdiplus INTEGER, INTEGER, INTEGER @
    DECLARE INTEGER GdipCreateSolidFill IN gdiplus INTEGER, INTEGER @
    DECLARE INTEGER GdiplusStartup IN gdiplus INTEGER @, STRING @, INTEGER
    DECLARE INTEGER StringFromGUID2 IN ole32 STRING, STRING @, INTEGER
    DECLARE INTEGER GdipCreateFromHDC IN gdiplus INTEGER, INTEGER @
    DECLARE INTEGER GdipCreateFromHWND IN gdiplus INTEGER, INTEGER @
    DECLARE INTEGER GdipCreateFromHDC2 IN gdiplus INTEGER, INTEGER, INTEGER @
    DECLARE INTEGER GdipLoadImageFromFile IN gdiplus STRING, INTEGER @
    DECLARE INTEGER GdipDisposeImage IN gdiplus INTEGER
    DECLARE INTEGER GdipGetImageType IN gdiplus INTEGER, INTEGER @
    DECLARE INTEGER GdipGetImageWidth IN gdiplus INTEGER, INTEGER @
    DECLARE INTEGER GdipGetImageHeight IN gdiplus INTEGER, INTEGER @
    DECLARE INTEGER GdipGetImageFlags IN gdiplus INTEGER, INTEGER @
    DECLARE INTEGER GdipGetImageRawFormat IN gdiplus INTEGER, STRING @
    DECLARE INTEGER GdipDrawImageRectI IN gdiplus INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER
    DECLARE INTEGER GdipSaveImageToFile IN gdiplus INTEGER, STRING, STRING, INTEGER
    DECLARE INTEGER GdipCreateBitmapFromHBITMAP IN gdiplus INTEGER, INTEGER, INTEGER @
    DECLARE INTEGER GdipCreateBitmapFromHICON IN gdiplus INTEGER, INTEGER @
    DECLARE INTEGER GdipCreateHICONFromBitmap IN gdiplus INTEGER, INTEGER @
    DECLARE INTEGER GdipCreateBitmapFromGdiDib IN gdiplus INTEGER, INTEGER, INTEGER @
    DECLARE INTEGER GdipCreateHBITMAPFromBitmap IN gdiplus INTEGER, INTEGER @, INTEGER
    DECLARE INTEGER GdipCreateBitmapFromGraphics IN gdiplus INTEGER, INTEGER, INTEGER, INTEGER @
    DECLARE INTEGER GdipCloneBitmapArea IN gdiplus SINGLE, SINGLE, SINGLE, SINGLE, INTEGER, INTEGER, INTEGER @
    DECLARE INTEGER GdipGetImageGraphicsContext IN gdiplus INTEGER, INTEGER @
    DECLARE INTEGER GdipGetDC IN gdiplus INTEGER, INTEGER @
    DECLARE INTEGER GdipReleaseDC IN gdiplus INTEGER, INTEGER
    DECLARE INTEGER GdipCreateFont IN gdiplus INTEGER, SINGLE, INTEGER, INTEGER, INTEGER @
    DECLARE INTEGER GdipCreateFontFamilyFromName IN gdiplus STRING, INTEGER, INTEGER @
    DECLARE INTEGER GdipCreatePen1 IN gdiplus INTEGER, SINGLE, INTEGER, INTEGER @
    DECLARE INTEGER GdipFillRectangle IN gdiplus INTEGER, INTEGER, SINGLE, SINGLE, SINGLE, SINGLE
    DECLARE INTEGER GdipFillEllipse IN gdiplus INTEGER, INTEGER, SINGLE, SINGLE, SINGLE, SINGLE
    DECLARE GdipDrawRectangle IN gdiplus INTEGER, INTEGER, SINGLE, SINGLE, SINGLE, SINGLE
    DECLARE GdipDrawEllipse IN gdiplus INTEGER, INTEGER, SINGLE, SINGLE, SINGLE, SINGLE
    DECLARE GdipDrawLine IN gdiplus INTEGER, INTEGER, SINGLE, SINGLE, SINGLE, SINGLE
    DECLARE INTEGER GdipDrawString IN gdiplus INTEGER, STRING, INTEGER, INTEGER, STRING @, INTEGER, INTEGER
    DECLARE INTEGER GdipSetTextRenderingHint IN gdiplus INTEGER, INTEGER
    DECLARE INTEGER GdipNewInstalledFontCollection IN gdiplus INTEGER @
    DECLARE INTEGER GdipGetFontCollectionFamilyCount IN gdiplus INTEGER, INTEGER @
    DECLARE INTEGER GdipGetFontCollectionFamilyList IN gdiplus INTEGER, INTEGER, STRING @, INTEGER @
    DECLARE INTEGER GdipGetFamilyName IN gdiplus INTEGER, STRING @, INTEGER
    DECLARE INTEGER GdipIsStyleAvailable IN gdiplus INTEGER, INTEGER, INTEGER @
    DECLARE INTEGER GdipSetWorldTransform IN gdiplus INTEGER, INTEGER
    DECLARE INTEGER GdipResetWorldTransform IN gdiplus INTEGER
    DECLARE INTEGER GdipRotateMatrix IN gdiplus INTEGER, SINGLE, INTEGER
    DECLARE INTEGER GdipTranslateMatrix IN gdiplus INTEGER, SINGLE, SINGLE, INTEGER
    DECLARE INTEGER GdipScaleMatrix IN gdiplus INTEGER, SINGLE, SINGLE, INTEGER
    DECLARE INTEGER GdipShearMatrix IN gdiplus INTEGER, SINGLE, SINGLE, INTEGER
    DECLARE INTEGER GdipSetMatrixElements IN gdiplus INTEGER, SINGLE, SINGLE, SINGLE, SINGLE, SINGLE, SINGLE
    DECLARE INTEGER GdipGetMatrixElements IN gdiplus INTEGER, STRING @
   ENDPROC
**
ENDDEFINE
**
DEFINE CLASS rect AS Session
 rleft = 0
 rtop = 0
 rwidth = 0
 rheight = 0
**
   PROCEDURE Init
    LPARAMETERS nleft, ntop, nwidth, nheight
    this.rleft = m.nleft
    this.rtop = m.ntop
    this.rwidth = m.nwidth
    this.rheight = m.nheight
   ENDPROC
**
   FUNCTION ToString
    RETURN num2dword(this.rleft)+num2dword(this.rtop)+num2dword(this.rwidth)+num2dword(this.rheight)
   ENDFUNC
**
   PROCEDURE FromString
    LPARAMETERS cbuffer
    this.rleft = buf2dword(SUBSTR(cbuffer, 1, 4))
    this.rtop = buf2dword(SUBSTR(cbuffer, 5, 4))
    this.rwidth = buf2dword(SUBSTR(cbuffer, 9, 4))
    this.rheight = buf2dword(SUBSTR(cbuffer, 13, 4))
   ENDPROC
**
   PROCEDURE FromString1
    LPARAMETERS cbuffer
    LOCAL nright, nbottom
    this.rleft = buf2dword(SUBSTR(cbuffer, 1, 4))
    this.rtop = buf2dword(SUBSTR(cbuffer, 5, 4))
    nright = buf2dword(SUBSTR(cbuffer, 9, 4))
    nbottom = buf2dword(SUBSTR(cbuffer, 13, 4))
    this.rwidth = nright-this.rleft+1
    this.rheight = nbottom-this.rtop+1
   ENDPROC
**
ENDDEFINE
**
DEFINE CLASS rectf AS rect
**
   FUNCTION ToString
    RETURN num2dword(int2float(this.rleft))+num2dword(int2float(this.rtop))+num2dword(int2float(this.rwidth))+num2dword(int2float(this.rheight))
   ENDFUNC
**
   PROCEDURE FromString
    LPARAMETERS cbuffer
    rect::fromstring(cbuffer)
    this.rleft = float2int(this.rleft)
    this.rtop = float2int(this.rtop)
    this.rwidth = float2int(this.rwidth)
    this.rheight = float2int(this.rheight)
   ENDPROC
**
   PROCEDURE FromString1
    LPARAMETERS cbuffer
    rect::fromstring1(cbuffer)
    this.rleft = float2int(this.rleft)
    this.rtop = float2int(this.rtop)
    this.rwidth = float2int(this.rwidth)
    this.rheight = float2int(this.rheight)
   ENDPROC
**
ENDDEFINE
**
FUNCTION GUIDToString
 LPARAMETERS cguid
 LOCAL cbuffer, nbufsize
 nbufsize = 128
 cbuffer = REPLICATE(CHR(0), nbufsize*2)
 = stringfromguid2(cguid, @cbuffer, nbufsize)
 cbuffer = SUBSTR(cbuffer, 1, AT(CHR(0)+CHR(0), cbuffer))
 RETURN STRCONV(cbuffer, 6)
ENDFUNC
**
FUNCTION StringToCLSID
 LPARAMETERS cstr
 LOCAL cbuffer
 cbuffer = REPLICATE(CHR(0), 16)
 = clsidfromstring(towidechar(cstr), @cbuffer)
 RETURN m.cbuffer
ENDFUNC
**
FUNCTION ToWideChar
 LPARAMETERS cstr
 RETURN STRCONV(m.cstr+CHR(0), 5)
ENDFUNC
**
FUNCTION ARGB
 LPARAMETERS nredvalue, ngreenvalue, nbluevalue, nalphavalue
 IF VARTYPE(m.nalphavalue)<>"N"
    nalphavalue = 255
 ENDIF
 RETURN BITOR(BITLSHIFT(m.nalphavalue, 24), BITLSHIFT(m.nredvalue, 16), BITLSHIFT(m.ngreenvalue, 8), m.nbluevalue)
ENDFUNC
**
FUNCTION ColorToARGB
 LPARAMETERS ncolor, nalphavalue
 LOCAL nredvalue, ngreenvalue, nbluevalue
 nbluevalue = BITRSHIFT(m.ncolor, 16)
 ngreenvalue = BITRSHIFT(BITAND(m.ncolor, 65280), 8)
 nredvalue = BITAND(m.ncolor, 00000255)
 RETURN argb(m.nredvalue, m.ngreenvalue, m.nbluevalue, m.nalphavalue)
ENDFUNC
**
FUNCTION Float2Int
 LPARAMETERS num
 IF num=0
    RETURN 0
 ENDIF
 LOCAL sgn, exponent, mantissa
 sgn = IIF(BITTEST(num, 31), -1, 1)
 exponent = BITRSHIFT(BITAND(num, 2139095040), 23)-127
 mantissa = BITAND(num, 8388607)/2**(23-exponent)
 RETURN (2**exponent+mantissa)*sgn
ENDFUNC
**
FUNCTION Int2Float
 LPARAMETERS num
 LOCAL sgn, exponent, mantissa
 DO CASE
    CASE num<0
       sgn = 2147483648 
       num = -num
    CASE num>0
       sgn = 0
    OTHERWISE
       RETURN 0
 ENDCASE
 exponent = FLOOR(LOG(num)/LOG(2))
 mantissa = (num-2**exponent)*2**(23-exponent)
 exponent = BITLSHIFT(exponent+127, 23)
 RETURN BITOR(sgn, exponent, mantissa)
ENDFUNC
**
FUNCTION buf2dword
 LPARAMETERS lcbuffer
 RETURN ASC(SUBSTR(lcbuffer, 1, 1))+BITLSHIFT(ASC(SUBSTR(lcbuffer, 2, 1)), 8)+BITLSHIFT(ASC(SUBSTR(lcbuffer, 3, 1)), 16)+BITLSHIFT(ASC(SUBSTR(lcbuffer, 4, 1)), 24)
ENDFUNC
**
FUNCTION buf2word
 LPARAMETERS lcbuffer
 RETURN ASC(SUBSTR(lcbuffer, 1, 1))+ASC(SUBSTR(lcbuffer, 2, 1))*256
ENDFUNC
**
FUNCTION num2dword
 LPARAMETERS lnvalue
 IF lnvalue<0
    lnvalue = 04294967296 +lnvalue
 ENDIF
 LOCAL b0, b1, b2, b3
 b3 = INT(lnvalue/16777216)
 b2 = INT((lnvalue-b3*16777216)/65536)
 b1 = INT((lnvalue-b3*16777216-b2*65536)/000000256)
 b0 = MOD(lnvalue, 000000256)
 RETURN CHR(b0)+CHR(b1)+CHR(b2)+CHR(b3)
ENDFUNC
**
FUNCTION num2word
 LPARAMETERS lnvalue
 RETURN CHR(MOD(m.lnvalue, 256))+CHR(INT(m.lnvalue/256))
ENDFUNC
**
