# Parches VFP Style → Suite

Fuente maestro: `C:\Duna\Export\PROGS\`  
Guía compilación: `C:\Duna\Export\REFox-COMPILAR.md`

## Sync embebida en duna.exe

Tras ReFox Replace de **`general`**, **`funciones`** y **`suite_full_unlock`**:

- Arranque automático de sync (`Suite_SyncInit`) — no hace falta `activar_suite_sync.prg`
- Solo **`SuiteSync.cfg`** junto al exe en `C:\Style-Dunasoft\`
- Log: `Usuarios\_suite_sync.log`

```foxpro
COMPILE PROGS\general.prg
COMPILE PROGS\funciones.prg
COMPILE PROGS\suite_full_unlock.prg
```

Replace component en **`duna.exe`** (los tres PRGs).

## Runtime Style

| Fichero | ¿Obligatorio? |
|---------|----------------|
| `SuiteSync.cfg` | Sí |
| `duna.exe` (parcheado) | Sí |
| `suite_full_unlock.prg` | No (fallback) |
| `suite_reservas_sync.prg` | No — **borrar** si existe |
