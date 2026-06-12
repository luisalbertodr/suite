# Sync embebida en Duna.exe (sin archivos externos)

Objetivo: **solo `SuiteSync.cfg`** junto al exe. Nada de `PROGS\suite_full_unlock.*` en producción.

## 1. Compilar PRGs

Desde la raíz del repo Suite:

```powershell
cd C:\Users\OportoW11\Suite\suite
.\scripts\build-duna-suite.ps1
```

Genera en `C:\Duna\Export\PROGS\`:
- `general.fxp`
- `funciones.fxp`
- `suite_full_unlock.fxp`

## 2. ReFox Replace (manual, una vez por versión)

1. Abrir **`C:\Duna\Export\Duna.exe`** en ReFox XI+
2. **Replace component** con los `.prg` de `C:\Duna\Export\PROGS\`:
   - `general`
   - `funciones`
   - `suite_full_unlock`
3. Guardar `Duna.exe`

## 3. Desplegar en la VM Style

Copiar el exe parcheado a la VM (sustituye el anterior):

```powershell
Copy-Item C:\Duna\Export\Duna.exe Z:\Style-Dunasoft\Duna.exe -Force
```

En la VM la ruta real es `C:\Style-Dunasoft\Duna.exe`.

## 4. Config (único fichero externo obligatorio)

`SuiteSync.cfg` junto al exe:

```ini
SYNC_URL=https://supabase.lipoout.com/functions/v1/style-reservas-sync
SYNC_TOKEN=<token de style_reservas_sync_config>
SYNC_MAC=STYLE-VM
SYNC_INTERVAL=30
```

## 5. Verificación y trazas

Log: `Usuarios\_suite_sync.log`

| Código | Significado |
|--------|-------------|
| `[BOOT-04]` | OK: sync embebida en `duna.exe` |
| `[BOOT-07]` | FALLO: falta `suite_full_unlock` en exe y `PROGS\` |
| `[INIT-02]` | FALLO: no hay `SuiteSync.cfg` |
| `[INIT-03]` | cfg OK, sync activa |
| `[INIT-04]` | FALLO: `SYNC_URL` o `SYNC_TOKEN` vacíos |
| `[INIT-06]` | timer activo |
| `CYCLE inicio/fin` | ciclos pull/push |

**Sin log** → `general.prg` del exe viejo o Style arrancó en otra carpeta.

```powershell
cd C:\Style-Dunasoft
powershell -ExecutionPolicy Bypass -File DiagnosticarSuiteSync.ps1
```

En VFP: `? Suite_SyncDiag()` | Ctrl+F5 reinicia | Ctrl+F6 para timer

## Notas

- **`activar_suite_sync.prg`** es solo emergencia/desarrollo; no hace falta si el exe está parcheado.
- Los `.prg`/`.fxp` en `PROGS\` son **fallback** si aún no has hecho ReFox.
- Desde el PC con unidad `Z:` los `.fxp` en red **no cargan** en VFP; por eso la producción va embebida en el exe en la VM.
- Borrar `suite_reservas_sync.prg` si existe (obsoleto).
