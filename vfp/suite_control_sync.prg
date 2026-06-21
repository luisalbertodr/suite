* Kill switch v1/v2 — control_sincro.dbf (modo_activo: '1'=HTTP, '2'=cola+agente).

FUNCTION SuiteSyncRoot
 LOCAL lc
 IF TYPE("pcSuiteStyleRoot")="C" .AND. .NOT. EMPTY(pcSuiteStyleRoot)
    RETURN ADDBS(pcSuiteStyleRoot)
 ENDIF
 RETURN ADDBS(SYS(5)+SYS(2003))
ENDFUNC

PROCEDURE SuiteEnsureControlSincro
 LOCAL lcpath, llWasOpen
 lcpath = SuiteSyncRoot() + "control_sincro"
 llWasOpen = USED("control_sincro")
 IF FILE(lcpath + ".dbf")
    IF  .NOT. llWasOpen
       USE SHARED (lcpath) ALIAS control_sincro IN 0
    ENDIF
    RETURN
 ENDIF
 CREATE TABLE (lcpath) FREE (modo_activo C(1), actualizado T, notas C(80))
 USE SHARED (lcpath) ALIAS control_sincro IN 0
 SELECT control_sincro
 APPEND BLANK
 REPLACE modo_activo WITH "2", actualizado WITH DATETIME(), notas WITH "v2 cola+agente"
ENDPROC

FUNCTION SuiteSyncModoActivo
 LOCAL lcmodo, lcalias
 lcalias = SELECT()
 DO SuiteEnsureControlSincro
 SELECT control_sincro
 lcmodo = ALLTRIM(NVL(control_sincro.modo_activo, "2"))
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
