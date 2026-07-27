* Kill switch v1/v2 — control_sincro.dbf (modo: '1'=HTTP, '2'=cola+agente). Campos <=10 chars (dbf-reader).

FUNCTION SuiteSyncRoot
 LOCAL lc
 IF TYPE("pcSuiteStyleRoot")="C" .AND. .NOT. EMPTY(pcSuiteStyleRoot)
    RETURN ADDBS(pcSuiteStyleRoot)
 ENDIF
 RETURN ADDBS(SYS(5)+SYS(2003))
ENDFUNC

PROCEDURE SuiteEnsureControlSincro
 LOCAL lcpath, llWasOpen, lcSav, lcErr
 lcpath = SuiteSyncRoot() + "control_sincro"
 llWasOpen = USED("control_sincro")
 SET SAFETY OFF
 IF FILE(lcpath + ".dbf")
    IF  .NOT. llWasOpen
       lcSav = ON("ERROR")
       lcErr = ""
       ON ERROR lcErr = MESSAGE()
       USE SHARED (lcpath) ALIAS control_sincro IN 0
       ON ERROR &lcSav
    ENDIF
    RETURN
 ENDIF
 lcSav = ON("ERROR")
 lcErr = ""
 ON ERROR lcErr = MESSAGE()
 CREATE TABLE (lcpath) FREE (modo C(1), actualiz T, notas C(80))
 USE
 USE SHARED (lcpath) ALIAS control_sincro IN 0
 ON ERROR &lcSav
 IF  .NOT. USED("control_sincro")
    RETURN
 ENDIF
 SELECT control_sincro
 IF RECCOUNT() = 0
    APPEND BLANK
    REPLACE modo WITH "2", actualiz WITH DATETIME(), notas WITH "v2 cola+agente"
 ENDIF
ENDPROC

FUNCTION SuiteSyncModoActivo
 LOCAL lcmodo, lcalias
 lcalias = SELECT()
 DO SuiteEnsureControlSincro
 IF  .NOT. USED("control_sincro")
    RETURN "2"
 ENDIF
 lcmodo = ALLTRIM(NVL(control_sincro.modo, "2"))
 IF EMPTY(lcmodo)
    lcmodo = "2"
 ENDIF
 IF  .NOT. EMPTY(lcalias)
    SELECT (lcalias)
 ENDIF
 RETURN lcmodo
ENDFUNC

FUNCTION SuiteSyncModoV2Active
 RETURN (SuiteSyncModoActivo() == "2")
ENDFUNC

FUNCTION SuiteSyncModoV1Active
 RETURN (SuiteSyncModoActivo() == "1")
ENDFUNC
