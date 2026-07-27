 PARAMETER tcpantalla, tcparametros
 SET STATUS BAR OFF
 SET TALK OFF
 SET ECHO OFF
 SET SAFETY OFF
 SET HEADING OFF
 SET EXCLUSIVE OFF
 SET CONSOLE OFF
 SET DATE TO italian
 SET CENTURY ON
 SET POINT TO "."
 SET SEPARATOR TO ","
 SET CURRENCY RIGHT
 SET HOURS TO 24
 SET DELETED ON
 SET PROCEDURE TO c_funciones ADDITIVE
 IF TYPE("pcIdioma")="U"
    PUBLIC pcidioma
    pcidioma = "CT"
 ENDIF
 IF PCOUNT()<1
    _messagebox(traducir(pcidioma, "Debe abrir la Contabilidad desde su aplicación."), 64, traducir(pcidioma, "Atencion"))
    RETURN .F.
 ENDIF
 IF PCOUNT()=1
    tcparametros = ""
 ELSE
    tcparametros = "with "+tcparametros
 ENDIF
 lcdirbase = ADDBS(SYS(5)+SYS(2003))
 IF TYPE("plDesarrollo")="L" .AND. pldesarrollo
    c_actualizar("y:\Fuentes\Conta\dbf\", "y:\Fuentes\Conta\temp\", "GeneraConta", SYS(5)+SYS(2003)+"\frx\", "y:\Fuentes\Conta\contafrx\", "y:\Fuentes\Conta\Conta.exe")
 ELSE
    c_actualizar(SYS(5)+SYS(2003)+"\dbf\", SYS(5)+SYS(2003)+"\temp\", "GeneraConta", SYS(5)+SYS(2003)+"\frx\", SYS(5)+SYS(2003)+"\contafrx\", "Conta.exe")
 ENDIF
 SET DEFAULT TO &lcdirbase 
 IF  .NOT. USED("C_CONTA")
    USE SHARED C_CONTA AGAIN IN 0
 ENDIF
 SELECT c_conta
 SET ORDER TO IDEMP
 IF  .NOT. SEEK(PADR("EMP1", 8)+STR(cfgyear))
    INSERT INTO C_CONTA (idemp, nomemp, ejeemp) VALUES ("EMP1", "Empresa de Pruebas", cfgyear)
 ENDIF
 DO CASE
    CASE UPPER(ALLTRIM(tcpantalla))=="CUENTAS"
       DO FORM c_cuentas &tcparametros
    CASE UPPER(ALLTRIM(tcpantalla))=="DIARIO"
       DO FORM c_diario &tcparametros
    CASE UPPER(ALLTRIM(tcpantalla))=="ASIPRE"
       DO FORM c_asipre &tcparametros
    CASE UPPER(ALLTRIM(tcpantalla))=="MANDIA"
       DO FORM c_mandia &tcparametros
    CASE UPPER(ALLTRIM(tcpantalla))=="NUMREG"
       DO FORM c_numreg &tcparametros
    CASE UPPER(ALLTRIM(tcpantalla))=="RENUM"
       DO FORM c_renumeracion &tcparametros
    CASE UPPER(ALLTRIM(tcpantalla))=="TRASCLIPRO"
       DO FORM c_traspaso_clipro &tcparametros
    CASE UPPER(ALLTRIM(tcpantalla))=="IVA300"
       DO FORM c_impiva300 &tcparametros
    CASE UPPER(ALLTRIM(tcpantalla))=="IVADET"
       DO FORM c_impivadet &tcparametros
    CASE UPPER(ALLTRIM(tcpantalla))=="IVA347"
       DO FORM c_mod347 &tcparametros
    CASE UPPER(ALLTRIM(tcpantalla))=="IMPDIA"
       DO FORM c_impdia &tcparametros
    CASE UPPER(ALLTRIM(tcpantalla))=="IMPCUE"
       DO FORM c_impcue &tcparametros
    CASE UPPER(ALLTRIM(tcpantalla))=="IMPMAY"
       DO FORM c_impmay &tcparametros
    CASE UPPER(ALLTRIM(tcpantalla))=="IMPSUMSAL"
       DO FORM c_impsumsal &tcparametros
    CASE UPPER(ALLTRIM(tcpantalla))=="IMPBALSIT"
       DO FORM c_impbalsit &tcparametros
    CASE UPPER(ALLTRIM(tcpantalla))=="IMPBALSITDET"
       DO FORM c_impbalsitdet &tcparametros
    CASE UPPER(ALLTRIM(tcpantalla))=="IMPBALPYG"
       DO FORM c_impbalpyg &tcparametros
    CASE UPPER(ALLTRIM(tcpantalla))=="REGULARIZACION"
       DO FORM c_regul &tcparametros
    CASE UPPER(ALLTRIM(tcpantalla))=="CIERRE"
       DO FORM c_cierre &tcparametros
    CASE UPPER(ALLTRIM(tcpantalla))=="ELICIEREG"
       DO FORM c_eliciereg &tcparametros
    CASE UPPER(ALLTRIM(tcpantalla))=="INICIO"
       DO CARGARCONTA.PRG
    CASE UPPER(ALLTRIM(tcpantalla))=="VALIDAR"
       IF validarasientosdiario(cfgyear, LEFT(cfgserie, 2))
          MESSAGEBOX(traducir(pcidioma, "Los asientos son correctos"), 48, "Atención")
       ENDIF
 ENDCASE
ENDFUNC
**
