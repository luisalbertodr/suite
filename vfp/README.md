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

## 5. Verificación

1. Arrancar Style con `IniciarStyle.bat`
2. Log: `Usuarios\_suite_sync.log` → `INIT ok url=...`
3. Ciclos cada ~30 s: `CYCLE inicio` / `CYCLE fin`
4. Ctrl+F5 = reiniciar sync manualmente

## Notas

- **`activar_suite_sync.prg`** es solo emergencia/desarrollo; no hace falta si el exe está parcheado.
- Los `.prg`/`.fxp` en `PROGS\` son **fallback** si aún no has hecho ReFox.
- Desde el PC con unidad `Z:` los `.fxp` en red **no cargan** en VFP; por eso la producción va embebida en el exe en la VM.
- Borrar `suite_reservas_sync.prg` si existe (obsoleto).
