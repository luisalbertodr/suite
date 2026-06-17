* Trazas de arranque Style — append a Usuarios\style_boot_trace.log
PROCEDURE SuiteBootTrace
 PARAMETER tcMsg, tnErr
 LOCAL lcf, lcline, lcRoot
 lcRoot = ""
 IF TYPE("pcSuiteStyleRoot")="C" AND .NOT. EMPTY(pcSuiteStyleRoot)
    lcRoot = ADDBS(pcSuiteStyleRoot)
 ENDIF
 IF EMPTY(lcRoot)
    lcRoot = ADDBS(SYS(5)+SYS(2003))
 ENDIF
 IF .NOT. DIRECTORY(lcRoot+"Usuarios")
    MD (lcRoot+"Usuarios")
 ENDIF
 lcf = lcRoot+"Usuarios\style_boot_trace.log"
 lcline = TTOC(DATETIME())+" "+ALLTRIM(tcMsg)
 IF TYPE("tnErr")="N" AND tnErr#0
    lcline = lcline+" err="+ALLTRIM(STR(tnErr))
 ENDIF
 IF TYPE("tnErr")="C" AND .NOT. EMPTY(tnErr)
    lcline = lcline+" "+tnErr
 ENDIF
 lcline = lcline+" | cwd="+SYS(5)+SYS(2003)+" | prog="+PROGRAM()+" ln="+ALLTRIM(STR(LINENO()))
 STRTOFILE(lcline+CHR(13)+CHR(10), lcf, .T.)
ENDPROC
**
FUNCTION SuiteBootTraceErr
 PARAMETER tcStep
 LOCAL lcMsg, ln
 ln = ERROR()
 lcMsg = MESSAGE()
 DO SuiteBootTrace WITH "[FAIL] "+tcStep, ALLTRIM(STR(ln))+": "+lcMsg
 RETURN .F.
ENDFUNC
