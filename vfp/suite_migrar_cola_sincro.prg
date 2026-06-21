* Migracion ALTER de cola_sincro.dbf (snapshot + version). No borra datos.
* Uso: DO PROGS\suite_migrar_cola_sincro.prg

FUNCTION SuiteColaFieldExists
 PARAMETER tcAlias, tcField
 IF  .NOT. USED(tcAlias)
    RETURN .F.
 ENDIF
 RETURN (FIELD(tcField, tcAlias) > 0)
ENDFUNC

FUNCTION SuiteColaRoot
 LOCAL lcb
 lcb = ""
 IF TYPE("pcSuiteStyleRoot")="C" .AND. .NOT. EMPTY(pcSuiteStyleRoot)
    lcb = ADDBS(pcSuiteStyleRoot)
 ENDIF
 IF EMPTY(lcb)
    lcb = ADDBS(SYS(5)+SYS(2003))
 ENDIF
 RETURN lcb
ENDFUNC

PROCEDURE SuiteMigrarColaSincro
 LOCAL lcpath, lcalias, llWasOpen
 lcalias = SELECT()
 lcpath = SuiteColaRoot() + "cola_sincro"
 IF  .NOT. FILE(lcpath + ".dbf")
    RETURN
 ENDIF
 llWasOpen = USED("cola_sincro")
 IF  .NOT. llWasOpen
    USE SHARED (lcpath) ALIAS cola_sincro IN 0
 ENDIF
 SELECT cola_sincro
 IF  .NOT. SuiteColaFieldExists("cola_sincro", "codemp")
    ALTER TABLE cola_sincro ADD COLUMN codemp C(15)
 ENDIF
 IF  .NOT. SuiteColaFieldExists("cola_sincro", "codcli")
    ALTER TABLE cola_sincro ADD COLUMN codcli C(15)
 ENDIF
 IF  .NOT. SuiteColaFieldExists("cola_sincro", "fecha")
    ALTER TABLE cola_sincro ADD COLUMN fecha D
 ENDIF
 IF  .NOT. SuiteColaFieldExists("cola_sincro", "horini")
    ALTER TABLE cola_sincro ADD COLUMN horini C(5)
 ENDIF
 IF  .NOT. SuiteColaFieldExists("cola_sincro", "horfin")
    ALTER TABLE cola_sincro ADD COLUMN horfin C(5)
 ENDIF
 IF  .NOT. SuiteColaFieldExists("cola_sincro", "texto")
    ALTER TABLE cola_sincro ADD COLUMN texto C(250)
 ENDIF
 IF  .NOT. SuiteColaFieldExists("cola_sincro", "codrec")
    ALTER TABLE cola_sincro ADD COLUMN codrec C(15)
 ENDIF
 IF  .NOT. SuiteColaFieldExists("cola_sincro", "nomcli")
    ALTER TABLE cola_sincro ADD COLUMN nomcli C(80)
 ENDIF
 IF  .NOT. SuiteColaFieldExists("cola_sincro", "tel1cli")
    ALTER TABLE cola_sincro ADD COLUMN tel1cli C(20)
 ENDIF
 IF  .NOT. SuiteColaFieldExists("cola_sincro", "facturado")
    ALTER TABLE cola_sincro ADD COLUMN facturado L
 ENDIF
 IF  .NOT. SuiteColaFieldExists("cola_sincro", "servicios")
    ALTER TABLE cola_sincro ADD COLUMN servicios M
 ENDIF
 IF  .NOT. SuiteColaFieldExists("cola_sincro", "colfon")
    ALTER TABLE cola_sincro ADD COLUMN colfon N(10, 0)
 ENDIF
 IF  .NOT. SuiteColaFieldExists("cola_sincro", "collet")
    ALTER TABLE cola_sincro ADD COLUMN collet N(10, 0)
 ENDIF
 IF  .NOT. SuiteColaFieldExists("cola_sincro", "style_modified_at")
    ALTER TABLE cola_sincro ADD COLUMN style_modified_at C(20)
 ENDIF
 IF  .NOT. SuiteColaFieldExists("cola_sincro", "version")
    ALTER TABLE cola_sincro ADD COLUMN version N(15, 0)
 ENDIF
 IF  .NOT. EMPTY(lcalias)
    SELECT (lcalias)
 ENDIF
ENDPROC

DO SuiteMigrarColaSincro
MESSAGEBOX("cola_sincro migrada (ALTER snapshot + version).", 64, "Suite migrar cola")
