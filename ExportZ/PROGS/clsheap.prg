**
DEFINE CLASS heap AS custom
 PROTECTED inhandle, innumallocsactive, iaallocs[1, 3]
 inhandle = .NULL.
 innumallocsactive = 0
 iaallocs = .NULL.
 name = "heap"
**
   FUNCTION Alloc
    LPARAMETERS nsize
    DECLARE INTEGER HeapAlloc IN WIN32API AS HAlloc INTEGER, INTEGER, INTEGER
    DECLARE INTEGER HeapSize IN WIN32API AS HSize INTEGER, INTEGER, INTEGER
    LOCAL nptr
    WITH this
       nptr = halloc(.inhandle, 0, @nsize)
       IF nptr<>0
          .innumallocsactive = .innumallocsactive+1
          DIMENSION .iaallocs[.innumallocsactive, 3]
          .iaallocs[.innumallocsactive, 1] = nptr
          .iaallocs[.innumallocsactive, 2] = hsize(.inhandle, 0, nptr)
          .iaallocs[.innumallocsactive, 3] = .T.
       ELSE
          nptr = .NULL.
       ENDIF
    ENDWITH
    RETURN nptr
   ENDFUNC
**
   FUNCTION AllocBLOB
    LPARAMETERS cbstringtocopy
    LOCAL nallocptr
    WITH this
       nallocptr = .alloc(LEN(cbstringtocopy))
       IF  .NOT. ISNULL(nallocptr)
          .copyto(nallocptr, cbstringtocopy)
       ENDIF
    ENDWITH
    RETURN nallocptr
   ENDFUNC
**
   FUNCTION AllocString
    LPARAMETERS cstring
    RETURN this.allocblob(cstring+CHR(0))
   ENDFUNC
**
   FUNCTION AllocInitAs
    LPARAMETERS nsizeofbuffer, nbytevalue
    IF TYPE('nByteValue')<>'N' .OR.  .NOT. BETWEEN(nbytevalue, 0, 255)
       nbytevalue = 0
    ENDIF
    RETURN this.allocblob(REPLICATE(CHR(nbytevalue), nsizeofbuffer))
   ENDFUNC
**
   FUNCTION DeAlloc
    LPARAMETERS nptr
    DECLARE INTEGER HeapFree IN WIN32API AS HFree INTEGER, INTEGER, INTEGER
    LOCAL nctr
    nctr = .NULL.
    WITH this
       nctr = .findallocid(nptr)
       IF  .NOT. ISNULL(nctr)
          = hfree(.inhandle, 0, nptr)
          .iaallocs[nctr, 3] = .F.
       ENDIF
    ENDWITH
    RETURN  .NOT. ISNULL(nctr)
   ENDFUNC
**
   FUNCTION CopyTo
    LPARAMETERS nptr, csource
    DECLARE RtlMoveMemory IN WIN32API AS RtlCopy INTEGER, STRING @, INTEGER
    LOCAL nctr
    nctr = .NULL.
    IF TYPE('nPtr')='N' .AND. TYPE('cSource')$'CM' .AND.  .NOT. (ISNULL(nptr) .OR. ISNULL(csource))
       WITH this
          nctr = .findallocid(nptr)
          IF  .NOT. ISNULL(nctr)
             = rtlcopy((.iaallocs(nctr, 1)), csource, MIN(LEN(csource), .iaallocs(nctr, 2)))
          ENDIF
       ENDWITH
    ENDIF
    RETURN  .NOT. ISNULL(nctr)
   ENDFUNC
**
   FUNCTION CopyFrom
    LPARAMETERS nptr
    DECLARE RtlMoveMemory IN WIN32API AS RtlCopy STRING @, INTEGER, INTEGER
    LOCAL nctr, ubuffer
    ubuffer = .NULL.
    nctr = .NULL.
    IF TYPE('nPtr')='N' .AND.  .NOT. ISNULL(nptr)
       WITH this
          nctr = .findallocid(nptr)
          IF  .NOT. ISNULL(nctr)
             ubuffer = REPLICATE(CHR(0), .iaallocs(nctr, 2))
             = rtlcopy(@ubuffer, (.iaallocs(nctr, 1)), (.iaallocs(nctr, 2)))
          ENDIF
       ENDWITH
    ENDIF
    RETURN ubuffer
   ENDFUNC
**
   PROTECTED FUNCTION FindAllocID
    LPARAMETERS nptr
    LOCAL nctr
    WITH this
       FOR nctr = 1 TO .innumallocsactive
          IF .iaallocs(nctr, 1)=nptr .AND. .iaallocs(nctr, 3)
             EXIT
          ENDIF
       ENDFOR
       RETURN IIF(nctr<=.innumallocsactive, nctr, .NULL.)
    ENDWITH
   ENDFUNC
**
   FUNCTION SizeOfBlock
    LPARAMETERS nptr
    LOCAL nctr, nsizeofblock
    nsizeofblock = .NULL.
    WITH this
       nctr = .findallocid(nptr)
       RETURN IIF(ISNULL(nctr), .NULL., .iaallocs(nctr, 2))
    ENDWITH
   ENDFUNC
**
   PROCEDURE Destroy
    DECLARE HeapDestroy IN WIN32API AS HDestroy INTEGER
    LOCAL nctr
    WITH this
       FOR nctr = 1 TO .innumallocsactive
          IF .iaallocs(nctr, 3)
             .dealloc(.iaallocs(nctr, 1))
          ENDIF
       ENDFOR
       hdestroy(.inhandle)
    ENDWITH
    DODEFAULT()
   ENDPROC
**
   FUNCTION Init
    DECLARE INTEGER HeapCreate IN WIN32API AS HCreate INTEGER, INTEGER, INTEGER
    WITH this
       .inhandle = hcreate(0, 008192, 0)
       DIMENSION .iaallocs[1, 3]
       .iaallocs[1, 1] = 0
       .iaallocs[1, 2] = 0
       .iaallocs[1, 3] = .F.
       .innumallocsactive = 0
    ENDWITH
    RETURN (this.inhandle<>0)
   ENDFUNC
**
ENDDEFINE
**
FUNCTION SetMem
 LPARAMETERS nptr, csource
 DECLARE RtlMoveMemory IN WIN32API AS RtlCopy INTEGER, STRING @, INTEGER
 rtlcopy(nptr, csource, LEN(csource))
 RETURN .T.
ENDFUNC
**
FUNCTION GetMem
 LPARAMETERS nptr, nlen
 DECLARE RtlMoveMemory IN WIN32API AS RtlCopy STRING @, INTEGER, INTEGER
 LOCAL ubuffer
 ubuffer = REPLICATE(CHR(0), nlen)
 = rtlcopy(@ubuffer, nptr, nlen)
 RETURN ubuffer
ENDFUNC
**
FUNCTION GetMemString
 LPARAMETERS nptr, nsize
 DECLARE INTEGER lstrcpyn IN WIN32API AS StrCpyN STRING @, INTEGER, INTEGER
 LOCAL ubuffer
 IF TYPE('nSize')<>'N' .OR. ISNULL(nsize)
    nsize = 512
 ENDIF
 ubuffer = REPLICATE(CHR(0), nsize)
 IF strcpyn(@ubuffer, nptr, nsize-1)<>0
    ubuffer = LEFT(ubuffer, MAX(0, AT(CHR(0), ubuffer)-1))
 ELSE
    ubuffer = .NULL.
 ENDIF
 RETURN ubuffer
ENDFUNC
**
FUNCTION SHORTToNum
 LPARAMETERS tcint
 LOCAL b0, b1, nretval
 b0 = ASC(tcint)
 b1 = ASC(SUBSTR(tcint, 2, 1))
 IF b1<128
    nretval = b1*256+b0
 ELSE
    b1 = 255-b1
    b0 = 256-b0
    nretval = -((b1*256)+b0)
 ENDIF
 RETURN nretval
ENDFUNC
**
FUNCTION NumToSHORT
 LPARAMETERS tnnum
 LOCAL b0, b1, x
 IF tnnum>=0
    x = INT(tnnum)
    b1 = INT(x/256)
    b0 = MOD(x, 256)
 ELSE
    x = INT(-tnnum)
    b1 = 255-INT(x/256)
    b0 = 256-MOD(x, 256)
    IF b0=256
       b0 = 0
       b1 = b1+1
    ENDIF
 ENDIF
 RETURN CHR(b0)+CHR(b1)
ENDFUNC
**
FUNCTION DWORDToNum
 LPARAMETERS tcdword
 LOCAL b0, b1, b2, b3
 b0 = ASC(tcdword)
 b1 = ASC(SUBSTR(tcdword, 2, 1))
 b2 = ASC(SUBSTR(tcdword, 3, 1))
 b3 = ASC(SUBSTR(tcdword, 4, 1))
 RETURN (((b3*256+b2)*256+b1)*256+b0)
ENDFUNC
**
FUNCTION NumToDWORD
 LPARAMETERS tnnum
 RETURN numtolong(tnnum)
ENDFUNC
**
FUNCTION WORDToNum
 LPARAMETERS tcword
 RETURN (256*ASC(SUBSTR(tcword, 2, 1)))+ASC(tcword)
ENDFUNC
**
FUNCTION NumToWORD
 LPARAMETERS tnnum
 LOCAL x
 x = INT(tnnum)
 RETURN CHR(MOD(x, 256))+CHR(INT(x/256))
ENDFUNC
**
FUNCTION NumToLong
 LPARAMETERS tnnum
 DECLARE RtlMoveMemory IN WIN32API AS RtlCopyLong STRING @, INTEGER @, INTEGER
 LOCAL cstring
 cstring = SPACE(4)
 = rtlcopylong(@cstring, BITOR(tnnum, 0), 4)
 RETURN cstring
ENDFUNC
**
FUNCTION LongToNum
 LPARAMETERS tclong
 DECLARE RtlMoveMemory IN WIN32API AS RtlCopyLong INTEGER @, STRING @, INTEGER
 LOCAL nnum
 nnum = 0
 = rtlcopylong(@nnum, tclong, 4)
 RETURN nnum
ENDFUNC
**
FUNCTION AllocNetAPIBuffer
 LPARAMETERS nsize
 IF TYPE('nSize')<>'N' .OR. nsize<=0
    RETURN .NULL.
 ENDIF
 IF  .NOT. 'NT'$OS()
    RETURN .NULL.
 ENDIF
 DECLARE INTEGER NetApiBufferAllocate IN NETAPI32.DLL INTEGER, INTEGER
 LOCAL nbufferpointer
 nbufferpointer = 0
 IF netapibufferallocate(INT(nsize), @nbufferpointer)<>0
    nbufferpointer = .NULL.
 ENDIF
 RETURN nbufferpointer
ENDFUNC
**
FUNCTION DeAllocNetAPIBuffer
 LPARAMETERS nptr
 IF TYPE('nPtr')<>'N'
    RETURN .F.
 ENDIF
 IF  .NOT. 'NT'$OS()
    RETURN .F.
 ENDIF
 DECLARE INTEGER NetApiBufferFree IN NETAPI32.DLL INTEGER
 RETURN (netapibufferfree(INT(nptr))=0)
ENDFUNC
**
FUNCTION CopyDoubleToString
 LPARAMETERS ndoubletocopy
 DECLARE RtlMoveMemory IN WIN32API AS RtlCopyDbl STRING @, DOUBLE @, INTEGER
 LOCAL cstring
 cstring = SPACE(8)
 = rtlcopydbl(@cstring, ndoubletocopy, 8)
 RETURN cstring
ENDFUNC
**
FUNCTION DoubleToNum
 LPARAMETERS cdoubleinstring
 DECLARE RtlMoveMemory IN WIN32API AS RtlCopyDbl DOUBLE @, STRING @, INTEGER
 LOCAL nnum
 nnum = 0.000000000000000000 
 = rtlcopydbl(@nnum, cdoubleinstring, 8)
 RETURN nnum
ENDFUNC
**
