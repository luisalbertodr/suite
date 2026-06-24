* Diagnostico carga suite_cola_sync (ejecutar en VFP9 con cwd = Style-Suite-Test).
LOCAL lcRoot, lcCola, lcSav, lcErr, lcType
lcRoot = "C:\Duna\Style-Suite-Test\"
SET DEFAULT TO (lcRoot)
lcCola = lcRoot + "PROGS\suite_cola_sync.prg"
lcSav = ON("ERROR")
lcErr = ""
STRTOFILE("=== sync_diag "+TTOC(DATETIME())+CHR(13), lcRoot+"Usuarios\_sync_diag.log", .F.)
STRTOFILE("FILE(prg)="+IIF(FILE(lcCola), "1", "0")+CHR(13), lcRoot+"Usuarios\_sync_diag.log", .T.)
IF .NOT. FILE(lcCola)
   lcCola = lcRoot + "suite_cola_sync.prg"
   STRTOFILE("FILE(root)="+IIF(FILE(lcCola), "1", "0")+CHR(13), lcRoot+"Usuarios\_sync_diag.log", .T.)
ENDIF
ON ERROR lcErr = MESSAGE()
SET PROCEDURE TO (lcCola) ADDITIVE
lcType = TYPE("SuiteEnqueuePlan2009")
ON ERROR &lcSav
STRTOFILE("TYPE(SuiteEnqueuePlan2009)="+lcType+" err="+lcErr+CHR(13), lcRoot+"Usuarios\_sync_diag.log", .T.)
MESSAGEBOX("FILE="+IIF(FILE(lcCola),"OK","NO")+CHR(13)+"TYPE="+lcType+CHR(13)+lcErr, 64, "sync_diag")
