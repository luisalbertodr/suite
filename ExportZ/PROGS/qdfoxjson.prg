**
PROCEDURE JSONStart
 PUBLIC json
 json = CREATEOBJECT("jsonHelper")
ENDPROC
**
FUNCTION JSONObject
 LPARAMETERS pcjson
 RETURN CREATEOBJECT("JSONObject", pcjson)
ENDFUNC
**
FUNCTION JSONArray
 LPARAMETERS paarray
 IF PCOUNT()=1
    RETURN CREATEOBJECT("JSONArray", @paarray)
 ELSE
    RETURN CREATEOBJECT("JSONArray")
 ENDIF
ENDFUNC
**
DEFINE CLASS jsonHelper AS Custom
 version = "1.8"
 schemas = .NULL.
 stringdelimitator = [']
 quotepropertynames = .F.
 canonicalnotation = .T.
**
   PROCEDURE Init
    this.schemas = CREATEOBJECT("Collection")
    this.declareschema("Cursor", "{name:string, schemax:array, rows:array}")
   ENDPROC
**
   PROCEDURE canonicalNotation_Assign
    LPARAMETERS vnewval
    this.canonicalnotation = m.vnewval
    IF m.vnewval
       this.quotepropertynames = .T.
       this.stringdelimitator = '"'
    ELSE
       this.quotepropertynames = .F.
       this.stringdelimitator = [']
    ENDIF
   ENDPROC
**
   FUNCTION Parse
    LPARAMETERS pcjson
    LOCAL oobjects, i, oresult, lisarray, lisvfp, cvfpclass
    STORE .F. TO lisarray, lisvfp
    DO CASE
       CASE LEFT(pcjson, 1)="["
          lisarray = .T.
          oresult = jsonarray()
       CASE LEFT(pcjson, 5)=="{vfp:"
          LOCAL ovfpinfo
          ovfpinfo = json.parse(STRTRAN(LEFT(pcjson, AT("}", pcjson)), "vfp:true,", ""))
          pcjson = SUBSTR(pcjson, AT("{", pcjson, 2))
          oresult = CREATEOBJECT(ovfpinfo.classname)
          lisvfp = .T.
       OTHERWISE
          oresult = CREATEOBJECT("Empty")
    ENDCASE
    pcjson = SUBSTR(pcjson, 2, LEN(pcjson)-2)
    LOCAL opairs, j, cpair, cprop, cvalue, uvalue, oobj, cobj, nblockcount, nsep
    oobjects = this._split(pcjson)
    FOR i = 1 TO oobjects.count
       cobj = oobjects.item(i)
       IF EMPTY(cobj)
          LOOP
       ENDIF
       IF lisarray .AND. this.isobject(cobj)
          oresult.add(this.parse(cobj))
          LOOP
       ENDIF
       opairs = this._split(cobj)
       oobj = CREATEOBJECT("Empty")
       FOR j = 1 TO opairs.count
          cpair = ALLTRIM(opairs.item(j))
          IF lisarray
             cvalue = cpair
          ELSE
             nsep = AT(":", cpair)
             cprop = CHRTRAN(LEFT(cpair, nsep-1), ["'], '')
             cvalue = ALLTRIM(SUBSTR(cpair, nsep+1))
          ENDIF
          IF  .NOT. lisarray .AND. LEFT(cprop, 1)="$"
             cprop = SUBSTR(cprop, 2)
          ENDIF
          DO CASE
             CASE LEFT(cvalue, 1)$['"]
                uvalue = this._decodestring(LEFT(SUBSTR(cvalue, 2), LEN(cvalue)-2))
             CASE LEFT(cvalue, 1)='@'
                cvalue = SUBSTR(cvalue, 2)
                IF LEN(cvalue)=8
                   uvalue = CTOD(TRANSFORM(cvalue, "@R ^9999-99-99"))
                ELSE
                   uvalue = CTOT(TRANSFORM(cvalue, "@R ^9999-99-99 99:99:99"))
                ENDIF
             CASE INLIST(cvalue, "true", "false")
                uvalue = (cvalue=="true")
             CASE UPPER(cvalue)=="NULL" .OR. UPPER(cvalue)==".NULL."
                uvalue = .NULL.
             CASE LEFT(cvalue, 1)='{'
                uvalue = this.parse(cvalue)
             CASE LEFT(cvalue, 1)="["
                uvalue = this.parse(cvalue)
             CASE INLIST(LOWER(cvalue), "string", "numeric", "date", "datetime", "boolean", "array")
                DO CASE
                   CASE cvalue=="string"
                      uvalue = ""
                   CASE cvalue=="numeric"
                      uvalue = 0.0 
                   CASE cvalue=="date"
                      uvalue = {}
                   CASE cvalue=="datetime"
                      uvalue = { :}
                   CASE cvalue=="boolean"
                      uvalue = .F.
                   CASE cvalue=="array"
                      uvalue = CREATEOBJECT("Collection")
                ENDCASE
             OTHERWISE
                uvalue = VAL(STRTRAN(cvalue, ".", SET("POINT")))
          ENDCASE
          DO CASE
             CASE lisarray
                oresult.add(uvalue)
             CASE lisvfp
                STORE uvalue TO oresult.&cprop
             OTHERWISE
                ADDPROPERTY(oresult, cprop, uvalue)
          ENDCASE
       ENDFOR
    ENDFOR
    RETURN oresult
   ENDFUNC
**
   FUNCTION parseCursor
    LPARAMETERS pcjson, pcalias, pndsid
    IF VARTYPE(pndsid)="N"
       SET DATASESSION TO (pndsid)
    ENDIF
    LOCAL ocursor
    ocursor = jsonobject(pcjson)
    IF  .NOT. ocursor.is("Cursor")
       RETURN .F.
    ENDIF
    LOCAL ccursoralias
    ccursoralias = ocursor.name
    IF VARTYPE(pcalias)="C"
       ccursoralias = pcalias
    ENDIF
    LOCAL aschemax[1]
    LOCAL aschema[1]
    ocursor.schemax.toarray(@aschemax)
    DIMENSION aschema[ALEN(aschemax, 1)/18, 18]
    ACOPY(aschemax, aschema)
    RELEASE aschemax
    SELECT 0
    CREATE CURSOR (ccursoralias) FROM ARRAY aschema
    IF ocursor.rows.count>0
       LOCAL orow, creplace, i
       creplace = ""
       FOR i = 1 TO FCOUNT()
          creplace = creplace+IIF(i>1, ",", "")+FIELD(i)+" WITH oRow."+FIELD(i)
       ENDFOR
       creplace = "REPLACE "+creplace
       FOR EACH orow IN ocursor.rows
          APPEND BLANK
          &creplace
       ENDFOR
    ENDIF
    RELEASE ocursor
   ENDFUNC
**
   FUNCTION Encode
    LPARAMETERS poobj
    LOCAL aprops[1]
    LOCAL ncount, i, cjson, cprop, lisarray, lisvfp, cvfpclass
    ncount = AMEMBERS(aprops, poobj, 1)
    lisvfp = (TYPE("poObj.baseClass")="C" .AND. LOWER(poobj.class)<>"jsonempty")
    cjson = "{"
    FOR i = 1 TO ncount
       DO CASE
          CASE aprops(i, 2)="Property"
             cprop = aprops(i, 1)
             IF lisvfp .AND. LOWER(cprop)=="class"
                cvfpclass = poobj.class
                LOOP
             ENDIF
             IF lisvfp .AND. "-"+LOWER(cprop)+"-"$"-controls-controlcount-objects-parent-class-baseclass-classlibrary-parentclass-helpcontextid-whatsthishelpid-top-left-width-height-picture-_customproplist-"
                LOOP
             ENDIF
             lisarray = (TYPE("ALEN(poObj."+cprop+")")="N")
             IF  .NOT. lisarray
                cjson = cjson + IIF(LEN(cjson) > 1,",","") +  IIF(THIS.quotepropertynames,THIS.stringdelimitator,"") +  LOWER(cprop) +  IIF(THIS.quotepropertynames,THIS.stringdelimitator,"") +  ":" + ALLTRIM(THIS._encodevalue(poobj.&cprop))
             ELSE
                LOCAL avalues[1]
                ACOPY(poobj.&cprop, avalues)
                cjson = cjson+IIF(LEN(cjson)>1, ",", "")+IIF(this.quotepropertynames, this.stringdelimitator, "")+LOWER(cprop)+IIF(this.quotepropertynames, this.stringdelimitator, "")+":"+this._encodevalue(@avalues)
             ENDIF
       ENDCASE
    ENDFOR
    cjson = cjson+"}"
    IF lisvfp
       cjson = "{vfp:true,className:"+this.stringdelimitator+cvfpclass+this.stringdelimitator+"}"+cjson
    ENDIF
    RETURN cjson
   ENDFUNC
**
   FUNCTION encodeArray
    LPARAMETERS puarrayorcollection
    RETURN this._encodevalue(@puarrayorcollection)
   ENDFUNC
**
   FUNCTION encodeCursor
    LPARAMETERS pcalias, pndsid
    IF PCOUNT()=0
       pcalias = ALIAS()
    ENDIF
    IF VARTYPE(pndsid)="N"
       SET DATASESSION TO (pndsid)
    ENDIF
    LOCAL ocursor, orow
    ocursor = jsonobject("schema:Cursor")
    ocursor.schema = "Cursor"
    ocursor.name = pcalias
    LOCAL aschema[1]
    AFIELDS(aschema, pcalias)
    ocursor.schemax = jsonarray(@aschema)
    SELECT (pcalias)
    GOTO TOP
    SCAN
       SCATTER MEMO NAME orow
       ocursor.rows.add(orow)
    ENDSCAN
    RETURN ocursor.tojson()
   ENDFUNC
**
   FUNCTION declareSchema
    LPARAMETERS pcname, pcschema
    IF PCOUNT()<>2
       THROW "JSON2: JSON.declareSchema: invalid parameter count"
       RETURN .NULL.
    ENDIF
    this.schemas.add(pcschema, LOWER(pcname))
   ENDFUNC
**
   FUNCTION IsSchema
    LPARAMETERS poref, pcschema
    pcschema = LOWER(pcschema)
    IF PEMSTATUS(poref, "Is", 5)
       RETURN poref.is(pcschema)
    ENDIF
    LOCAL obase
    obase = jsonobject("schema:"+pcschema)
    LOCAL aprops[1]
    LOCAL ncount, i, cprop, lisvalid
    lisvalid = .T.
    ncount = AMEMBERS(aprops, poref, 0)
    FOR i = 1 TO ncount
       cprop = aprops(i)
       IF ( .NOT. PEMSTATUS(poref, cprop, 5)) .OR. (TYPE("poRef."+cprop)=TYPE("oBase."+cprop))
          lisvalid = .F.
          EXIT
       ENDIF
    ENDFOR
    RETURN lisvalid
   ENDFUNC
**
   FUNCTION isArray
    LPARAMETERS pcstring
    RETURN VARTYPE(pcstring)="C" .AND. LEFT(pcstring, 1)="[" .AND. RIGHT(pcstring, 1)="]"
   ENDFUNC
**
   FUNCTION isObject
    LPARAMETERS pcstring
    RETURN VARTYPE(pcstring)="C" .AND. LEFT(pcstring, 1)="{" .AND. RIGHT(pcstring, 1)="}"
   ENDFUNC
**
   HIDDEN FUNCTION _encodeValue
    LPARAMETERS puvalue, pnarraysize
    EXTERNAL ARRAY puvalue
    EXTERNAL ARRAY rtrimx
    LOCAL lisarray, ctype, cjsonvalue
    lisarray = (TYPE("ALEN(puValue)")="N")
    ctype = VARTYPE(puvalue)
    cjsonvalue = "null"
    DO CASE
       CASE lisarray
          cjsonvalue = "["
          LOCAL i, nsize
          IF PCOUNT()=2
             nsize = pnarraysize
          ELSE
             nsize = ALEN(puvalue, 1)
          ENDIF
          FOR i = 1 TO nsize
             cjsonvalue = cjsonvalue+IIF(i>1, ",", "")+this._encodevalue(puvalue(i))
          ENDFOR
          cjsonvalue = cjsonvalue+"]"
       CASE ctype$"CM"
          cjsonvalue = this.stringdelimitator+this._encodestring(puvalue)+this.stringdelimitator
       CASE ctype$"NIYF"
          IF puvalue=INT(puvalue)
             cjsonvalue = ALLTRIM(STR(puvalue))
          ELSE
             cjsonvalue = CHRTRAN(rtrimx(rtrimx(TRANSFORM(puvalue), "0"), SET("POINT")), SET("POINT"), ".")
          ENDIF
       CASE ctype="L"
          cjsonvalue = IIF(puvalue, "true", "false")
       CASE ctype="D"
          cjsonvalue = '@'+DTOS(puvalue)
       CASE ctype="T"
          cjsonvalue = '@'+TTOC(puvalue, 1)
       CASE ctype="O"
          DO CASE
             CASE this._iscollection(puvalue)
                LOCAL aitems[MAX(puvalue.count, 1)]
                LOCAL i
                FOR i = 1 TO puvalue.count
                   aitems[i] = puvalue.item(i)
                ENDFOR
                cjsonvalue = this._encodevalue(@aitems, puvalue.count)
                RELEASE aitems
             CASE PEMSTATUS(puvalue, "ToJSON", 5)
                cjsonvalue = puvalue.tojson()
             OTHERWISE
                cjsonvalue = this.encode(puvalue)
          ENDCASE
       OTHERWISE
          cjsonvalue = TRANSFORM(puvalue, "")
    ENDCASE
    RETURN cjsonvalue
   ENDFUNC
**
   HIDDEN FUNCTION _Split
    LPARAMETERS pcjson
    LOCAL nblockcount, cobj, lopenquote, cchar, lncontadorcomillas, lccharanterior
    nblockcount = 0
    cobj = pcjson
    lopenquote = .F.
    lncontadorcomillas = 0
    lccharanterior = ""
    FOR j = 1 TO LEN(cobj)
       cchar = SUBSTR(cobj, j, 1)
       IF cchar='"' .AND. lccharanterior<>"\"
          lncontadorcomillas = lncontadorcomillas+1
       ENDIF
       DO CASE
          CASE cchar$"[{"
             nblockcount = nblockcount+1
          CASE cchar$"]}"
             nblockcount = nblockcount-1
          CASE cchar="," .AND. nblockcount=0
             IF MOD(lncontadorcomillas, 2)=0
                cobj = STUFF(cobj, j, 1, CHR(254))
             ENDIF
       ENDCASE
       lccharanterior = cchar
    ENDFOR
    LOCAL aobjects[1]
    LOCAL ncount, i, oresult
    oresult = CREATEOBJECT("Collection")
    ncount = ALINES(aobjects, STRTRAN(cobj, CHR(254), CHR(13)+CHR(10)))
    FOR i = 1 TO ncount
       oresult.add(aobjects(i))
    ENDFOR
    RETURN oresult
   ENDFUNC
**
   HIDDEN FUNCTION _isCollection
    LPARAMETERS poobj
    RETURN VARTYPE(poobj)="O" .AND. PEMSTATUS(poobj, "Count", 5) .AND. PEMSTATUS(poobj, "Item", 5)
   ENDFUNC
**
   HIDDEN FUNCTION _encodeString
    LPARAMETERS pcstring
    pcstring = STRTRAN(pcstring, CHR(13), "%CR%")
    pcstring = STRTRAN(pcstring, CHR(10), "%LF%")
    pcstring = STRTRAN(pcstring, CHR(9), '%TAB%')
    pcstring = STRTRAN(pcstring, ['], '%SINGLEQUOTE%')
    pcstring = STRTRAN(pcstring, '"', '%DOUBLEQUOTE%')
    RETURN pcstring
   ENDFUNC
**
   HIDDEN FUNCTION _decodeString
    LPARAMETERS pcstring
    pcstring = STRTRAN(pcstring, '%CR%', CHR(13))
    pcstring = STRTRAN(pcstring, '%LF%', CHR(10))
    pcstring = STRTRAN(pcstring, '%TAB%', CHR(9))
    pcstring = STRTRAN(pcstring, '%SINGLEQUOTE%', ['])
    pcstring = STRTRAN(pcstring, '%DOUBLEQUOTE%', '"')
    RETURN pcstring
   ENDFUNC
**
ENDDEFINE
**
DEFINE CLASS JSONObject AS Custom
 buff = .NULL.
 schema = ""
 url = ""
**
   PROCEDURE Init
    LPARAMETERS pcjson, pusource
    this.buff = CREATEOBJECT("Empty")
    IF VARTYPE(pcjson)<>"C"
       RETURN
    ENDIF
    DO CASE
       CASE LEFT(pcjson, 7)=="schema:"
          LOCAL cschema
          cschema = LOWER(SUBSTR(pcjson, 8))
          IF json.schemas.getkey(cschema)>0
             this.parsefromschema(cschema)
          ELSE
             THROW "qdfoxJSON: Schema "+cschema+" has not been declared"
          ENDIF
       CASE LEFT(pcjson, 4)=="url:"
          this.parsefromurl(SUBSTR(pcjson, 5))
       OTHERWISE
          this.parse(pcjson)
    ENDCASE
    IF VARTYPE(pusource)$"OC"
       this.import(pusource)
    ENDIF
   ENDPROC
**
   FUNCTION THIS_Access
    LPARAMETERS cmember
    IF LOWER(cmember)<>"buff" .AND. PEMSTATUS(this.buff, cmember, 5)
       RETURN this.buff
    ELSE
       RETURN this
    ENDIF
   ENDFUNC
**
   FUNCTION Add
    LPARAMETERS pcprop, puvalue
    EXTERNAL ARRAY puvalue
    DO CASE
       CASE (TYPE("ALEN(puValue)")="N")
          LOCAL oarray, i
          oarray = this.addarray(pcprop)
          FOR i = 1 TO ALEN(puvalue, 1)
             oarray.add(puvalue(i))
          ENDFOR
          RETURN oarray
       CASE json.isobject(puvalue)
          ADDPROPERTY(this.buff, pcprop, jsonobject(puvalue))
          RETURN THIS.BUFF.&pcprop
       OTHERWISE
          ADDPROPERTY(this.buff, pcprop, puvalue)
    ENDCASE
   ENDFUNC
**
   PROCEDURE addArray
    LPARAMETERS pcprop, pcvalues
    IF VARTYPE(pcvalues)<>"C"
       ADDPROPERTY(this.buff, pcprop, CREATEOBJECT("Collection"))
    ELSE
       ADDPROPERTY(this.buff, pcprop, jsondecode("["+pcvalues+"]"))
    ENDIF
    RETURN THIS.BUFF.&pcprop
   ENDPROC
**
   FUNCTION ToJSON
    RETURN json.encode(this.buff)
   ENDFUNC
**
   PROCEDURE Parse
    LPARAMETERS pcjson
    this.buff = json.parse(pcjson)
    IF PEMSTATUS(this.buff, "JSONSchema", 5)
       this.schema = this.buff.jsonschema
    ENDIF
   ENDPROC
**
   PROCEDURE parseFromSchema
    LPARAMETERS pcschema
    pcschema = LOWER(pcschema)
    this.buff = json.parse(json.schemas.item(pcschema))
    ADDPROPERTY(this.buff, "JSONSchema", pcschema)
    this.schema = pcschema
   ENDPROC
**
   PROCEDURE parseFromURL
    LPARAMETERS pcurl
    this.url = pcurl
    LOCAL cjsonstring
    cjsonstring = geturl(pcurl)
    this.buff = json.parse(cjsonstring)
   ENDPROC
**
   PROCEDURE Import
    LPARAMETERS pusource
    DO CASE
       CASE VARTYPE(pusource)="O"
          LOCAL aprops[1]
          LOCAL ncount, i, cprop
          ncount = AMEMBERS(pusource, 0)
          FOR i = 1 TO ncount
             cprop = aprops(i)
             IF PEMSTATUS(this.buff, cprop, 5)
                STORE EVALUATE("puSource."+cprop) TO ("THIS.Buff."+cprop)
             ENDIF
          ENDFOR
       CASE VARTYPE(pusource)="C" .AND. USED(pusource)
          LOCAL i, cprop
          FOR i = 1 TO FCOUNT(pusource)
             cprop = FIELD(i, pusource)
             IF PEMSTATUS(this.buff, cprop, 5)
                STORE EVALUATE("puSource."+cprop) TO ("THIS.Buff."+cprop)
             ENDIF
          ENDFOR
    ENDCASE
   ENDPROC
**
   PROCEDURE Export
    LPARAMETERS putarget
    DO CASE
       CASE VARTYPE(putarget)="O"
          LOCAL aprops[1]
          LOCAL ncount, i, cprop
          ncount = AMEMBERS(putarget, 0)
          FOR i = 1 TO ncount
             cprop = aprops(i)
             IF PEMSTATUS(this.buff, cprop, 5)
                STORE EVALUATE("THIS.Buff."+cprop) TO ("puTarget."+cprop)
             ENDIF
          ENDFOR
       CASE VARTYPE(putarget)="C" .AND. USED(putarget)
          LOCAL i, cprop
          SELECT (putarget)
          FOR i = 1 TO FCOUNT()
             cprop = FIELD(i)
             IF PEMSTATUS(this.buff, cprop, 5)
                REPLACE (cprop) WITH EVALUATE("THIS.Buff."+cprop)
             ENDIF
          ENDFOR
    ENDCASE
   ENDPROC
**
   FUNCTION Is
    LPARAMETERS pcschema
    RETURN (this.schema==LOWER(pcschema))
   ENDFUNC
**
   FUNCTION Clone
    RETURN jsonobject(this.tojson())
   ENDFUNC
**
ENDDEFINE
**
DEFINE CLASS JSONArray AS Collection
 lines = 0
 columns = 0
**
   PROCEDURE Init
    LPARAMETERS paarray
    DO CASE
       CASE PCOUNT()=0
          this.lines = 0
          this.columns = 1
       CASE TYPE("ALEN(paArray)")="N"
          LOCAL uitem
          this.lines = ALEN(paarray, 1)
          this.columns = ALEN(paarray, 2)
          FOR EACH uitem IN paarray
             this.add(uitem)
          ENDFOR
       CASE this._isarray(paarray)
          LOCAL oitems, uitem
          oitems = json.decodearray(paarray)
          this.lines = oitems.count
          this.columns = 1
          FOR EACH uitem IN oitems
             this.add(uitem)
          ENDFOR
       CASE this._iscollection(paarray)
          LOCAL uitem
          this.lines = paarray.count
          this.columns = 1
          FOR EACH uitem IN paarray
             this.add(uitem)
          ENDFOR
    ENDCASE
   ENDPROC
**
   FUNCTION ToJSON
    LOCAL acontent[1]
    this.toarray(@acontent)
    RETURN json.encodearray(@acontent)
   ENDFUNC
**
   FUNCTION ToArray
    LPARAMETERS paarray
    LOCAL nrows, ncols
    nrows = IIF(this.lines>0, this.lines, this.count)
    ncols = IIF(this.columns>0, this.columns, 1)
    DIMENSION paarray[nrows, ncols]
    LOCAL uitem, i
    FOR i = 1 TO this.count
       paarray[i] = this.item(i)
    ENDFOR
    RETURN this.count
   ENDFUNC
**
   HIDDEN FUNCTION _isArray
    LPARAMETERS puvalue
    RETURN (VARTYPE(puvalue)="C" .AND. LEFT(puvalue, 1)="[" .AND. RIGHT(puvalue, 1)="]")
   ENDFUNC
**
   HIDDEN FUNCTION _isCollection
    LPARAMETERS puvalue
    RETURN (VARTYPE(puvalue)="O" .AND. PEMSTATUS(puvalue, "BaseClass", 5) .AND. LOWER(puvalue.baseclass=="collection"))
   ENDFUNC
**
ENDDEFINE
**
FUNCTION JSONEncode
 LPARAMETERS poobj
 RETURN json.encode(poobj)
ENDFUNC
**
FUNCTION JSONEncodeCursor
 LPARAMETERS pcalias
 IF PCOUNT()=1
    RETURN json.encode(pcalias)
 ELSE
    RETURN json.encode()
 ENDIF
ENDFUNC
**
FUNCTION JSONDecodeCursor
 LPARAMETERS pcjsonstring, pcalias
 IF PCOUNT()=2
    RETURN json.parsecursor(pcjsonstring, pcalias)
 ELSE
    RETURN json.parsecursor(pcjsonstring)
 ENDIF
ENDFUNC
**
FUNCTION JSONDecode
 LPARAMETERS pcjson
 RETURN json.parse(pcjson)
ENDFUNC
**
FUNCTION JSONDeclareSchema
 LPARAMETERS pcname, pcschema
 RETURN json.declareschema(pcname, pcschema)
ENDFUNC
**
FUNCTION JSONIsSchema
 LPARAMETERS poref, pcschema
 RETURN json.isschema(poref, pcschema)
ENDFUNC
**
FUNCTION GetURL
 LPARAMETERS pcurl, plverbose
 DECLARE LONG GetLastError IN WIN32API
 DECLARE INTEGER InternetCloseHandle IN "wininet.dll" LONG
 DECLARE LONG InternetOpen IN "wininet.dll" STRING, LONG, STRING, STRING, LONG
 DECLARE LONG InternetOpenUrl IN "wininet.dll" LONG, STRING, STRING, LONG, LONG, LONG
 DECLARE LONG InternetReadFile IN "wininet.dll" LONG, STRING @, LONG, LONG @
 IF plverbose
    WAIT WINDOW NOWAIT "Opening Internet connection..."
 ENDIF
 LOCAL ninethnd
 ninethnd = internetopen("GETURL", 0, "", "", 0)
 IF ninethnd=0
    RETURN ""
 ENDIF
 IF plverbose
    WAIT WINDOW NOWAIT "Opening connection to URL..."
 ENDIF
 LOCAL nurlhnd
 nurlhnd = internetopenurl(ninethnd, pcurl, .NULL., 0, 0, 0)
 IF nurlhnd=0
    internetclosehandle(ninethnd)
    RETURN ""
 ENDIF
 LOCAL curldata, cbuffer, nbytesreceived, nbuffersize
 curldata = ""
 cbuffer = ""
 nbytesreceived = 0
 nbuffersize = 0
 DO WHILE .T.
    cbuffer = REPLICATE(CHR(0), 2048)
    internetreadfile(nurlhnd, @cbuffer, LEN(cbuffer), @nbuffersize)
    IF nbuffersize=0
       EXIT
    ENDIF
    curldata = curldata+SUBSTR(cbuffer, 1, nbuffersize)
    nbytesreceived = nbytesreceived+nbuffersize
    IF plverbose
       WAIT WINDOW NOWAIT ALLTRIM(TRANSFORM(INT(nbytesreceived/1024), "999,999"))+" Kb received..."
    ENDIF
 ENDDO
 IF plverbose
    WAIT CLEAR
 ENDIF
 internetclosehandle(ninethnd)
 RETURN curldata
ENDFUNC
**
