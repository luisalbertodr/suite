# Duna.exe — build completo VFP9 (sin ReFox)

El exe se genera con **`BUILD PROJECT mscomctl`** en `C:\Duna\Export\`. Todo el codigo Suite (unlock, sync, rutas de arranque) va **dentro** del exe via el proyecto `.pjx`, no con Replace externo.

## Flujo

```
1. Parches en C:\Duna\Export\PROGS\  (general.prg, funciones.prg, suite_full_unlock.prg)
2. BUILD PROJECT mscomctl  →  mscomctl.exe  →  Duna.exe
3. deploy-duna-exe-vm.ps1  →  VM Style-Dunasoft
```

## 1. Sincronizar PRGs del repo

```powershell
cd C:\Users\OportoW11\Suite\suite
.\scripts\sync-vfp-export.ps1
```

`general.prg` y `funciones.prg` viven en **Export** (export del exe original). Los parches de referencia estan en `vfp/patches/*.txt`.

Parches recientes (arranque sin `.bat`, idioma, aniversarios):

| Parche | Fichero Export |
|--------|----------------|
| `general_bootstrap_sin_bat.txt` | `PROGS\general.prg` |
| `general_fix_default_dbf.txt` | `PROGS\general.prg` |
| `general_fix_licencias_unlock.txt` | `PROGS\general.prg` |
| `funciones_fix_aniversarios.txt` | `PROGS\funciones.prg` |

## 2. Build VFP9

En la maquina con Visual FoxPro 9:

```cmd
cd C:\Duna\Export
BUILD-DUNA.bat
```

O dentro de VFP9:

```foxpro
SET DEFAULT TO C:\Duna\Export
DO PROGS\VfpBuildProject.prg
```

Salida: `C:\Duna\Export\Duna.exe` (copia de `mscomctl.exe`).

**Trampa habitual:** el Build genera `mscomctl.exe`. Style en la VM arranca **`Duna.exe`**. Tras cada build:

```powershell
.\scripts\copy-duna-exe.ps1
.\scripts\deploy-duna-exe-vm.ps1
```

Si `Duna.exe` es viejo verás errores ya corregidos (p. ej. «nombre de clase no válido»).

Revisa `build_mscomctl.log` y `mscomctl.ERR` si falla.

### Proyecto mscomctl.pjx

Debe incluir (entre otros):

- `PROGS\general.prg`
- `PROGS\funciones.prg`
- `PROGS\suite_full_unlock.prg` — sync + unlock embebidos

No marques esos PRGs como **Exclude** del exe. En produccion **no** hace falta copiar `PROGS\suite_full_unlock.*` a la VM (el deploy los elimina si existen como fallback).

## 3. Despliegue VM

```powershell
.\scripts\deploy-duna-exe-vm.ps1
```

En la VM debe existir:

- `Duna.exe` (nuevo build)
- `SuiteSync.cfg`
- `EMPRESA.DBF` (raiz)
- `dbf\wedb.dbc` + tablas

**No** hace falta `IniciarStyle.bat` tras el parche de bootstrap (doble clic en `Duna.exe` OK si el exe esta en `Style-Dunasoft`).

## Verificacion

Tras arrancar Style, en `Usuarios\_suite_sync.log`:

- `[BOOT-00]` — ruta Style detectada (debe ser `C:\Style-Dunasoft\`, no `...\dbf\`)
- `[BOOT-04]` o `[INIT-03]` — sync embebida activa

## Scripts

| Script | Uso |
|--------|-----|
| `sync-vfp-export.ps1` | Repo → Export antes del build |
| `build-duna-suite.ps1` | Lanza `BUILD-DUNA.bat` |
| `deploy-duna-exe-vm.ps1` | Export → VM |
| `build-style-portable.ps1` | Empaquetado portable (runtime + datos) |

## Errores frecuentes

| Sintoma | Causa | Accion |
|---------|-------|--------|
| Idioma cada arranque | Exe viejo sin parche `SuiteResolveStyleRoot` | Rebuild + deploy |
| Aniversarios vacios | `BuscarAniversarios` sin DBC | Rebuild `funciones.prg` |
| Clase no valida | Exe sin `suite_full_unlock` en proyecto | Incluir PRG en `.pjx` y rebuild |
| BOOT-07 en log | Sync no embebida | Verificar `suite_full_unlock.prg` en proyecto |
