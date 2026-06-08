* Activar sync Suite + unlock completo (sin servidores Dunasoft).

* Ejecutar tras abrir Style: DO activar_suite_sync.prg

* O en acceso directo: Style.exe -cDO activar_suite_sync



SET PROCEDURE TO suite_full_unlock ADDITIVE

SET PROCEDURE TO suite_reservas_sync ADDITIVE

SET PROCEDURE TO funciones ADDITIVE

DO SuiteApplyFullUnlock

DO Suite_SyncInit

WAIT WINDOW NOWAIT "Suite: sync activo, Dunasoft offline, funciones deslimitadas"

