 LPARAMETERS toobject, tcname, tvclass, tvclasslibrary
 LOCAL lcname, lcclass, lcclasslibrary, oobject, lncount
 LOCAL lnobjectrefindex, lnobjectrefcount, oexistingobject
 IF TYPE("toObject")<>"O" .OR. ISNULL(toobject)
    RETURN .NULL.
 ENDIF
 lcname = IIF(TYPE("tcName")=="C", ALLTRIM(tcname), LOWER(SYS(2015)))
 oexistingobject = .NULL.
 oobject = .NULL.
 lcclasslibrary = ""
 DO CASE
    CASE TYPE("tvClass")=="O"
       oobject = tvclass
       lcclass = LOWER(oobject.class)
       lcclasslibrary = LOWER(oobject.classlibrary)
       IF  .NOT. ISNULL(oexistingobject) .AND. LOWER(oexistingobject.class)==lcclass .AND. LOWER(oexistingobject.classlibrary)==lcclasslibrary
          toobject.vresult = oexistingobject
          RETURN toobject.vresult
       ENDIF
    CASE EMPTY(tvclass)
       oobject = toobject
       lcclass = LOWER(oobject.class)
       lcclasslibrary = LOWER(oobject.classlibrary)
       IF  .NOT. ISNULL(oexistingobject) .AND. LOWER(oexistingobject.class)==lcclass .AND. LOWER(oexistingobject.classlibrary)==lcclasslibrary
          toobject.vresult = oexistingobject
          RETURN toobject.vresult
       ENDIF
    OTHERWISE
       lcclass = LOWER(ALLTRIM(tvclass))
       DO CASE
          CASE TYPE("tvClassLibrary")=="O"
             lcclasslibrary = LOWER(tvclasslibrary.classlibrary)
          CASE TYPE("tvClassLibrary")=="C"
             IF EMPTY(tvclasslibrary)
                lcclasslibrary = LOWER(toobject.classlibrary)
             ELSE
                lcclasslibrary = LOWER(ALLTRIM(tvclasslibrary))
                IF EMPTY(JUSTEXT(lcclasslibrary))
                   lcclasslibrary = LOWER(FORCEEXT(lcclasslibrary, "vcx"))
                ENDIF
                llclasslib = (JUSTEXT(lcclasslibrary)=="vcx")
                IF  .NOT. "\"$lcclasslibrary
                   lcclasslibrary = LOWER(FORCEPATH(lcclasslibrary, JUSTPATH(toobject.classlibrary)))
                   IF  .NOT. FILE(lcclasslibrary) .AND. VERSION(2)<>0
                      lcclasslibrary = LOWER(FORCEPATH(lcclasslibrary, HOME()+"ffc\"))
                      IF  .NOT. FILE(lcclasslibrary)
                         lcclasslibrary = LOWER(FULLPATH(JUSTFNAME(lcclasslibrary)))
                      ENDIF
                   ENDIF
                ENDIF
                IF  .NOT. FILE(lcclasslibrary)
                   toobject.vresult = .NULL.
                   RETURN toobject.vresult
                ENDIF
             ENDIF
          OTHERWISE
             lcclasslibrary = ""
       ENDCASE
       IF  .NOT. ISNULL(oexistingobject) .AND. LOWER(oexistingobject.class)==lcclass .AND. LOWER(oexistingobject.classlibrary)==lcclasslibrary
          toobject.vresult = oexistingobject
          RETURN toobject.vresult
       ENDIF
       oobject = NEWOBJECT(lcclass, lcclasslibrary)
       IF TYPE("oObject")<>"O" .OR. ISNULL(oobject)
          toobject.vresult = .NULL.
          RETURN toobject.vresult
       ENDIF
 ENDCASE
 DO CASE
    CASE EMPTY(lcname)
       toobject.vresult = oobject
       RETURN toobject.vresult
    OTHERWISE
       IF  .NOT. toobject.addproperty(lcname, oobject)
          oobject = .NULL.
       ENDIF
 ENDCASE
 IF ISNULL(oobject)
    toobject.vresult = .NULL.
    RETURN toobject.vresult
 ENDIF
 IF PEMSTATUS(oobject, "oHost", 5)
    oobject.ohost = toobject.ohost
 ELSE
    oobject.addproperty("oHost", toobject.ohost)
 ENDIF
 IF EMPTY(lcclasslibrary)
    lcclasslibrary = LOWER(oobject.classlibrary)
 ENDIF
 lnobjectrefcount = toobject.nobjectrefcount
 lnobjectrefindex = lnobjectrefcount+1
 FOR lncount = 1 TO lnobjectrefcount
    IF toobject.aobjectrefs(lncount, 1)==LOWER(lcname)
       lnobjectrefindex = lncount
       EXIT
    ENDIF
 ENDFOR
 IF lnobjectrefindex>lnobjectrefcount
    DIMENSION toobject.aobjectrefs[lnobjectrefindex, 3]
 ENDIF
 toobject.aobjectrefs[lnobjectrefindex, 1] = LOWER(lcname)
 toobject.aobjectrefs[lnobjectrefindex, 2] = lcclass
 toobject.aobjectrefs[lnobjectrefindex, 3] = lcclasslibrary
 toobject.vresult = oobject
 RETURN toobject.vresult
ENDFUNC
**
