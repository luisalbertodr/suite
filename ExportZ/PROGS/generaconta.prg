 displaystatus('Creating database...')
 CLOSE DATABASES ALL
 CREATE DATABASE 'C_CONTA.DBC'
 displaystatus('Creating table C_CUENTAS...')
 maketable_c_cuentas()
 displaystatus('Creating table C_DIARIO...')
 maketable_c_diario()
 displaystatus('Creating table C_MANDIA...')
 maketable_c_mandia()
 displaystatus('Creating table C_REGISTROS...')
 maketable_c_registros()
 displaystatus('Creating table C_ASIPREC...')
 maketable_c_asiprec()
 displaystatus('Creating table C_ASIPREL...')
 maketable_c_asiprel()
 displaystatus('Finished.')
ENDPROC
**
PROCEDURE MakeTable_C_CUENTAS
 CREATE TABLE 'C_CUENTAS.DBF' NAME 'C_CUENTAS' (codcue C (10) NOT NULL, descue C (100) NOT NULL, tipcue C (1) NOT NULL, obscue M NOT NULL, dnicli C (20) NOT NULL, dircli C (100) NOT NULL, codposcli C (15) NOT NULL, pobcli C (80) NOT NULL, procli C (80) NOT NULL, pais C (80) NOT NULL)
 INDEX ON descue TAG descue COLLATE 'MACHINE'
 INDEX ON codcue TAG codcue COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_C_DIARIO
 CREATE TABLE 'C_DIARIO.DBF' NAME 'C_DIARIO' (serasi C (2) NOT NULL, ejeasi N (4, 0) NOT NULL, codcue C (10) NOT NULL, fecasi D NOT NULL, periodo C (2) NOT NULL, numasi N (10, 0) NOT NULL, numlin N (5, 0) NOT NULL, desasi C (100) NOT NULL, impdeb B (6) NOT NULL, imphab B (6) NOT NULL, tabrel C (15) NOT NULL, ordrel C (10) NOT NULL, codrel C (20) NOT NULL, diario C (4) NOT NULL, contraiva C (10) NOT NULL, numapu N (10, 0) NOT NULL, enviar L NOT NULL, bimp B (6) NOT NULL, iva N (5, 2) NOT NULL, rec N (5, 2) NOT NULL, tipiva C (1) NOT NULL, factura C (20) NOT NULL, fecfac D NOT NULL)
 INDEX ON numapu TAG numapu COLLATE 'MACHINE'
 INDEX ON fecasi TAG fecasi COLLATE 'MACHINE'
 INDEX ON STR(ejeasi, 4)+serasi+STR(numasi, 10) TAG numasi COLLATE 'MACHINE'
 INDEX ON tabrel+codrel TAG tabrel COLLATE 'MACHINE'
 INDEX ON codcue TAG codcue COLLATE 'MACHINE'
 INDEX ON codcue+periodo TAG periodos COLLATE 'MACHINE'
 INDEX ON STR(ejeasi, 4)+serasi+codcue+STR(numasi, 10) TAG cuereg COLLATE 'MACHINE'
 DBSETPROP('C_DIARIO.TIPIVA', 'Field', 'Comment', "'C'ompras, 'V'entas")
ENDPROC
**
PROCEDURE MakeTable_C_MANDIA
 CREATE TABLE 'C_MANDIA.DBF' NAME 'C_MANDIA' (diario C (2) NOT NULL, desdia C (80) NOT NULL, tipo N (1, 0) NOT NULL)
 INDEX ON desdia TAG desdia COLLATE 'MACHINE'
 INDEX ON diario TAG diario COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_C_REGISTROS
 CREATE TABLE 'C_REGISTROS.DBF' NAME 'C_REGISTROS' (tabla C (20) NOT NULL, serie C (2) NOT NULL, year N (4, 0) NOT NULL, numreg N (10, 0) NOT NULL, descrip C (40) NOT NULL, visible L NOT NULL)
ENDPROC
**
PROCEDURE MakeTable_C_ASIPREC
 CREATE TABLE 'C_ASIPREC.DBF' NAME 'C_ASIPREC' (codasipre C (15) NOT NULL, desasipre C (150) NOT NULL, lineas N (5, 0) NOT NULL)
 INDEX ON desasipre TAG desasipre COLLATE 'MACHINE'
 INDEX ON codasipre TAG codasipre COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE MakeTable_C_ASIPREL
 CREATE TABLE 'C_ASIPREL.DBF' NAME 'C_ASIPREL' (codasipre C (15) NOT NULL, linasipre N (5, 0) NOT NULL, codcue C (10) NOT NULL, desasi C (100) NOT NULL, impdeb B (6) NOT NULL, imphab B (6) NOT NULL, diario C (4) NOT NULL)
 INDEX ON codasipre+STR(linasipre, 5) TAG codasipre COLLATE 'MACHINE'
ENDPROC
**
PROCEDURE DisplayStatus
 LPARAMETERS lcmessage
 WAIT WINDOW NOWAIT lcmessage
ENDPROC
**
