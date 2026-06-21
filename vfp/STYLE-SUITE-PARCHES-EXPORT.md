# Style Dunasoft → Suite: parches VFP9 para export limpio (`mscomctl.exe`)

Documento de referencia para **reaplicar en una sola pasada** todos los cambios que funcionaron, partiendo del **primer export ReFox** (`C:\Duna\Export\`, proyecto `mscomctl.pjx`).

Úsalo como **contexto único** en Cursor/agente:

> Aplica **STYLE-SUITE-PARCHES-EXPORT.md** sobre un export ReFox fresco en `C:\Duna\Export\`. Copia los 3 PRGs desde `vfp/`, repara `mscomctl.pjx`, compila y despliega. No uses ReFox Replace salvo fallback. No reintroduzcas `suite_reservas_sync.prg` ni agente Python outbox en la VM.

---

## Objetivo

| Meta | Cómo |
|------|------|
| Build **VFP9 nativo** (sin depender de ReFox Replace en producción) | `BUILD PROJECT mscomctl` |
| Arranque **sin `IniciarStyle.bat`** | Bootstrap en `general.prg` |
| Sync reservas Suite embebida | `suite_full_unlock.prg` dentro del exe |
| Sin bloqueos licencia/demo Dunasoft | `SuiteApplyFullUnlock` |
| Datos en `dbf\` (no duplicar tablas en raíz) | `OPEN DATABASE dbf\wedb` |
| Sin error **1732** (clase no válida) | Sin `NEWOBJECT("licencias_unlock")` ni `SuiteCreatePolicencias` |
| Sin error **2005** (`usuarios.dbf` movido) | **No** enlazar solo `wedb.*` en raíz |

---

## Rutas y roles

| Ruta | Rol |
|------|-----|
| `C:\Duna\Export\` | Export ReFox + build (`mscomctl.pjx`, `mscomctl.exe`) |
| `C:\Duna\Export\PROGS\` | PRGs editables (`general`, `funciones`, `suite_full_unlock`) |
| `C:\Style-Dunasoft\` o VM `192.168.99.16` | Producción Style |
| `C:\Users\OportoW11\Suite\suite\vfp\` | **Fuente de verdad** de parches en el repo |
| `C:\Users\OportoW11\Suite\suite\scripts\` | Deploy PowerShell |

Salida build: `mscomctl.exe` → copiar a `Duna.exe` + `Duna2.exe`.

**Canal único de sync reservas:** Style ↔ Edge Function `style-reservas-sync` ↔ Postgres. **No** usar en paralelo el agente Python `C:\SuiteSync` (outbox/bridge) en la VM; desactivar su tarea programada si existe.

---

## Pasada única (orden estricto)

### Fase 0 — Backend Suite (una vez por entorno)

Antes de parchear VFP, el servidor debe tener:

| Pieza | Ruta repo | Deploy |
|-------|-----------|--------|
| Tablas + RPCs sync | `supabase/migrations/20260608120000_style_reservas_vfp_sync.sql` | `.\scripts\deploy-migration.ps1 …` |
| Last-write-wins | `supabase/migrations/20260609120000_style_reservas_lww.sql` | idem |
| Edge Function | `supabase/functions/style-reservas-sync/` | `.\scripts\deploy-edge-functions.ps1 style-reservas-sync` |

Token sync: Postgres `SELECT sync_token FROM public.style_reservas_sync_config WHERE company_id = …;`

Protocolo HTTP emulado (mismo que Android/central reservas Dunasoft):

| Tag POST | Dirección |
|----------|-----------|
| `stylegetreservas` | Suite → Style (pull citas pendientes) |
| `stylereservas` | Style → Suite (push alta/mod/baja) |

URL en `SuiteSync.cfg`: `https://supabase.lipoout.com/functions/v1/style-reservas-sync`

### Fase A — Preparar export fresco

1. Export ReFox original → `C:\Duna\Export\` (proyecto `mscomctl.pjx` intacto).
2. Desde el repo:
   ```cmd
   cd C:\Users\OportoW11\Suite\suite\vfp
   PrepararExportBuild.bat
   ```
   Copia scripts de build/reparación a `Export\PROGS\` (`VfpBuildProject.prg`, `VfpCompilePrgs.prg`, `suite_repair_lib.prg`, etc.). **No sobrescribe** `general.prg` / `funciones.prg` / `suite_full_unlock.prg` — copiarlos en el paso 3.

3. **Sobrescribir los 3 PRGs parcheados** (fuente completa en repo — copiar siempre los 3):
   ```powershell
   cd C:\Users\OportoW11\Suite\suite
   Copy-Item vfp\general.prg          C:\Duna\Export\PROGS\ -Force
   Copy-Item vfp\funciones.prg        C:\Duna\Export\PROGS\ -Force
   Copy-Item vfp\suite_full_unlock.prg C:\Duna\Export\PROGS\ -Force
   .\scripts\sync-vfp-export.ps1   # solo suite_full_unlock; no sustituye general/funciones
   ```
   Alternativa parcial: aplicar diffs descritos abajo leyendo `vfp/patches/*.txt`.

4. **(Opcional)** Parches licencia en `vcx\http.vcx` si compiláis esa librería (ver sección *http.vcx*). Con build Suite normal basta `httpasp_local` en `suite_full_unlock.prg` + `SuiteGetHttpLocal()` en `funciones.prg`.

5. Reparar proyecto — **elegir según estado del `.pjx`:**

   **A) Proyecto ReFox intacto** (~160 KB `.pjx`, abre en PM):
   ```cmd
   cd C:\Duna\Export
   "C:\Program Files (x86)\Microsoft Visual FoxPro 9\vfp9.exe" PROGS\RepararProyectoMscomctl.prg
   ```
   Cierra Project Manager antes si pide.

   **B) `.pjx`/`.pjt` corrupto o vacío** (memo invalid, 0–6 archivos):
   ```cmd
   cd C:\Users\OportoW11\Suite\suite\vfp
   REPARAR-PJT.bat
   ```
   Luego en VFP (Ctrl+F2), con PM abierto o tras crear proyecto manual `mscomctl`:
   ```foxpro
   SET DEFAULT TO C:\Duna\Export
   DO PROGS\RepairMscomctlFromLfn.prg
   ```
   Genera lista desde `mscomctl.lfn`:
   ```powershell
   python C:\Users\OportoW11\Suite\suite\scripts\repair_mscomctl_pjx.py
   ```
   (1633 entradas; mapea `.fxp` → `.prg` cuando existe fuente.)

   **`suite_repair_lib.prg` hace automáticamente:** quita refs `Z:\`, duplicados de `funciones`/`general`, **`suite_reservas_sync`** (obsoleto); añade `suite_full_unlock.prg`, `export_build_stubs.prg`, VCX/forms mínimos.

6. Verificar en Project Manager que **no están en Exclude**:
   - `PROGS\general.prg`
   - `PROGS\funciones.prg`
   - `PROGS\suite_full_unlock.prg`

   Conteo normal tras reparar: **~1227 registros** en `.pjx` (1633 rutas en lista LFN porque cuenta `scx`+`sct`, `vcx`+`vct`, etc.).

### Fase B — Compilar (dos caminos)

#### Camino 1 — Build VFP9 nativo (objetivo)

```cmd
cd C:\Duna\Export
"C:\Program Files (x86)\Microsoft Visual FoxPro 9\vfp9.exe" PROGS\VfpCompilePrgs.prg
```

En VFP con **Project Manager abierto** (`mscomctl`):

```foxpro
SET DEFAULT TO C:\Duna\Export
DO PROGS\VfpBuildProject.prg
```

O Build manual: martillo → **Win32 executable** → carpeta `C:\Duna\Export\`.

**Limitación probada:** `BUILD PROJECT` / `OPEN PROJECT` **desde PRG headless falla** en este VFP9 (`Syntax error`, `Unrecognized command`). El build real requiere PM abierto o Build manual.

#### Camino 2 — Fallback ReFox Replace (si el build global no genera exe)

Si `mscomctl.exe` no se crea pero solo cambiaste sync/unlock:

```foxpro
COMPILE PROGS\general.prg
COMPILE PROGS\funciones.prg
COMPILE PROGS\suite_full_unlock.prg
```

ReFox XI+: abrir **`mscomctl.exe` original** de Style → **Replace component** con los 3 PRG compilados. Ver `C:\Duna\Export\REFox-COMPILAR.md` §3a.

**No confundir:** los Undefined del build global (CONTA, FoxyPreviewer…) **no bloquean** sync Suite; vienen del export ReFox incompleto (§ *Errores Undefined*).

### Fase B (continuación) — Post-build

7. Normalizar exe:
   ```powershell
   cd C:\Users\OportoW11\Suite\suite
   .\scripts\copy-duna-exe.ps1
   ```

8. Revisar `build_mscomctl.log` y `mscomctl.ERR`. Warnings legacy (CONTA, http.vcx, FoxyPreviewer) pueden quedar; **no deben** aparecer `SUITE_FULL_UNLOCK - Undefined` en `funciones.prg`.

### Fase C — VM Style-Dunasoft

9. Desplegar:
   ```powershell
   .\scripts\deploy-duna-exe-vm.ps1
   ```
   Sube `Duna.exe`, `Duna2.exe`, `IniciarStyle.bat`, `ensure-style-dbc.ps1`, VCX mínimos y fallback PROGS si aplica.

10. En disco VM debe existir:
   - `Duna.exe` (build nuevo)
   - `SuiteSync.cfg` (ver `vfp/SuiteSync.cfg.example`)
   - `EMPRESA.DBF` en **raíz**
   - `dbf\wedb.dbc` + tablas en **`dbf\`**

11. **Limpiar enlaces erróneos** (una vez, Style cerrado):
    ```powershell
    .\scripts\ensure-style-dbc.ps1 -RemoveWedbRootOnly
    # Si Z: no montada: -StyleRoot "\\192.168.99.16\c$\Style-Dunasoft"
    # o: $env:SUITE_STYLE_ROOT = "ruta\Style-Dunasoft"
    ```

12. **Desactivar agente Python duplicado** (canal único VFP):
    ```cmd
    schtasks /Delete /TN "DunaSoft-Suite-CoexistSync" /F
    ```
    (En portátil y en VM si existía `C:\SuiteSync`.)

13. Arrancar: **doble clic `Duna.exe`** (build nuevo). `IniciarStyle.bat` es opcional.

14. Verificar log `Usuarios\_suite_sync.log`:
    - `[BOOT-00]` — root = carpeta del exe (`C:\Style-Dunasoft\`), **no** `...\dbf\`
    - `[BOOT-04]` — sync embebida OK
    - `[INIT-03]` — `SuiteSync.cfg` leído

---

## Cambios por archivo (estado final que funcionó)

### `PROGS\general.prg`

#### A. Bootstrap sin `.bat` (inicio del programa, tras `CLOSE ALL`)

```foxpro
LOCAL lcStyleRoot
lcStyleRoot = SuiteResolveStyleRoot()
DO SuiteApplyStyleEnvironment WITH lcStyleRoot
SET PATH TO (lcStyleRoot) ADDITIVE
SET PATH TO (lcStyleRoot+"PROGS") ADDITIVE
...
PUBLIC pcSuiteStyleRoot
pcSuiteStyleRoot = lcStyleRoot
```

#### B. `SuiteResolveStyleRoot()`

Detecta raíz Style en este orden:

1. Carpeta del exe (`SYS(16)`)
2. Variable entorno `STYLE_HOME`
3. `SYS(5)+SYS(2003)` (cwd)
4. `C:\Style-Dunasoft\`
5. `Z:\Style-Dunasoft\`

Validación: existe `EMPRESA.DBF`, `Duna.exe`, `SuiteSync.cfg` o `dbf\wedb.dbc`.

#### C. `SuiteApplyStyleEnvironment` — **wedb en `dbf\`**

```foxpro
= SuiteRemoveRootWedbLinks(pcSuiteStyleRoot, lcDbfRoot)   && quita wedb.* en raiz
SET DEFAULT TO (pcSuiteStyleRoot)                          && raiz Style, NO dbf\
CD (pcSuiteStyleRoot)
SET PATH TO (lcDbfRoot) ADDITIVE
IF .NOT. DBC()
   OPEN DATABASE (lcDbfRoot+"wedb") SHARED                 && dbf\wedb
ENDIF
MD Usuarios\ si falta
```

**Regla crítica wedb:**

| Acción | Resultado |
|--------|-----------|
| `OPEN DATABASE dbf\wedb` | Home = `dbf\` → tablas OK |
| Enlace `wedb.dbc` solo en raíz | Home = raíz → error **2005** `usuarios.dbf` |
| Elegir manualmente `dbf\wedb` en diálogo VFP | Equivalente al OPEN correcto (por eso “funcionaba”) |

#### D. `SuiteEnsureDatabaseOpen()`

Llamar **antes** de `DO FORM IDIOMA` y formularios con entorno de datos legacy.

#### E. Rutas `EMPRESA` e idioma (anti-bucle “Configuración Regional”)

- `SET DEFAULT` = **raíz** Style (`lcStyleRoot`), no `dbf\`
- `IF .NOT. FILE(lcStyleRoot+"EMPRESA.DBF")` → `DO FORM IDIOMA`
- `USE (lcStyleRoot+"EMPRESA")` — ruta absoluta
- `lcdirbase = lcStyleRoot`

#### F. Skip actualización Dunasoft

Si existe `SuiteSync.cfg` en raíz → no llamar `actualizar()` al arrancar:

```foxpro
IF FILE(ADDBS(lcStyleRoot)+"SuiteSync.cfg") OR FILE(...)
   llresultado = .T.
ELSE
   llresultado = actualizar(...)
ENDIF
```

#### G. Error 1732 — clases de arranque

**Usar** `SuiteSafeCreateObject` (captura error sin diálogo nativo VFP):

```foxpro
pousuario   = SuiteSafeCreateObject("usuario",   lcStyleRoot+"vcx\seguridad.vcx")
policencias = SuiteSafeCreateObject("licencias", lcStyleRoot+"vcx\licencias.vcx")
```

**No usar:**

- `NEWOBJECT("licencias_unlock", ...)`
- `SuiteCreatePolicencias()` — **eliminar** de `suite_full_unlock.prg` si existía
- `CREATEOBJECT("licencias_unlock")` directo

Si falla → log `[BOOT-FATAL]` y `RETURN .F.`

#### H. Sync bootstrap

Tras `PUBLIC pcidioma`:

```foxpro
= SuiteLoadUnlockFromFunciones(lcStyleRoot)
IF TYPE("Suite_SyncInit")="U"
   DO SuiteLoadUnlockProgram WITH lcStyleRoot
ENDIF
...
DO SuiteStartSyncIfReady
ON SHUTDOWN DO SuiteShutdown
```

Funciones auxiliares al final del PRG: `SuiteBootstrapLog`, `SuiteLoadUnlockProgram`, `SuiteStartSyncIfReady`, `SuiteSafeCreateObject`, `SuiteRemoveRootWedbLinks`, etc. (ver `vfp/general.prg` completo).

---

### `PROGS\suite_full_unlock.prg`

Copiar **íntegro** desde `vfp/suite_full_unlock.prg`. **Sustituye por completo** al antiguo `suite_reservas_sync.prg` (no usar ese PRG).

| Componente | Función |
|------------|---------|
| `SuiteApplyFullUnlock` | Desactiva demo, licencias, URLs Dunasoft |
| `Suite_SyncInit` / `Suite_SyncCycle` / push-pull | Sync reservas vía Edge Function |
| Tags HTTP | `stylegetreservas` (pull), `stylereservas` (push/baja) |
| `DEFINE CLASS licencias_unlock AS licencias` | Unlock licencias (embebida, no VCX) |
| `DEFINE CLASS httpasp_local AS Custom` | Stub HTTP (validar licencia/respuesta = `.T.`) |
| `SuiteCreateHttp` / `SuiteGetHttpLocal` | `SET PROCEDURE` + `CREATEOBJECT("httpasp_local")` |
| `SuiteSyncTimer` | Clase `Timer` en `_SCREEN` (milisegundos; **no** `ON TIMER` en PRG — falla en VFP9) |

**Unlock offline aplicado en `SuiteApplyFullUnlock`:**

- `plversiondemo = .F.` / `plversiondemoespecial = .T.` (sin límites demo 15 clientes/reservas)
- URLs Dunasoft → `127.0.0.1`; `VERSIONONLINEOK` siempre OK
- ComRed / FranquiciaWeb desactivados; `start_serviciosonline` vacío
- Resúmenes facturación online desactivados
- `ClienteConContrato` → `.T.`

**No incluir** `FUNCTION SuiteCreatePolicencias` — provocaba 1732 en exe que la buscaba vía `NEWOBJECT`.

Debe estar **incluido en el proyecto `.pjx`** (no Exclude) para log `[BOOT-04]`. Si falta → `[BOOT-07]`.

**Obsoleto:** `PROGS\suite_reservas_sync.prg` — el repair lo **elimina** del proyecto a propósito.

---

### `PROGS\funciones.prg`

Copiar **íntegro** desde `vfp/funciones.prg` o aplicar estos bloques:

#### `SuiteLoadUnlockFromFunciones`

Carga embebido vía `SET PROCEDURE TO suite_full_unlock ADDITIVE` (no `.fxp` suelto en PROGS como primario).

#### `SuiteGetHttpLocal`

Reemplaza `NEWOBJECT(..., "suite_full_unlock")` en llamadas HTTP:

```foxpro
lohttp = SuiteGetHttpLocal()   && en lugar de NEWOBJECT httpasp
```

Evita error compilación `Visual Class Library SUITE_FULL_UNLOCK - Undefined`.

#### `Actualizar`

Al inicio: si sync cargada o existe `SuiteSync.cfg` → `RETURN .T.` (no comprobar updates Dunasoft).

#### `BuscarAniversarios`

Ruta absoluta a clientes:

```foxpro
lcroot = pcSuiteStyleRoot  && o SuiteStyleRoot()
lcclientes = lcroot + "dbf\clientes"
USE SHARED (lcclientes) ...  && o vía DBC()
```

Evita `dbf\dbf\clientes` cuando `SET DEFAULT` apunta mal.

#### `Reservas_Incidencia`

Bloque `TRY` al final que llama `Suite_SyncInit` / `Suite_SyncAfterIncidencia` / `Suite_SyncPushDelete` si `plSuiteSyncEnabled`. Ver `vfp/patches/funciones_reservas_incidencia_sync.txt`.

#### `Start_ServicioComunicaciones`

Llama `SuiteLoadUnlockFromFunciones` + `Suite_SyncInit` si sync no cargada. Sustituye arranque ComRed/FranquiciaWeb por sync Suite.

#### HTTP en reservas / catálogo Android

Sustituir `CREATEOBJECT("httpasp", …)` / `NEWOBJECT(..., "http.vcx")` por:

```foxpro
lohttp = SuiteGetHttpLocal()
```

Ya aplicado en puntos clave de `Reservas_Incidencia`, export Android, etc. (grep `SuiteGetHttpLocal` en el PRG).

---

### `vcx\http.vcx` (opcional — solo si recompiláis la librería)

Con build Suite normal **no hace falta** tocar `http.vcx`: `httpasp_local` en `suite_full_unlock.prg` cubre las llamadas vía `SuiteGetHttpLocal()`.

Si parcheáis el diseñador de clases, sustituir cuerpo de métodos por stubs (ver `vfp/patches/httpasp_*.prg`):

| Método | Cambio |
|--------|--------|
| `androidonline_validarlicencia` | `RETURN .T.` |
| `centralreservasonline_validarlicencia` | `RETURN .T.` |
| `validarrespuesta` | `this.resultado = .T.` / `RETURN .T.` |

Compilar: `COMPILE CLASSLIB vcx\http.vcx`

---

## Qué NO hacer (trampas probadas)

| Trampa | Por qué falla |
|--------|----------------|
| Enlazar solo `wedb.dbc/.dct/.dcx` en raíz | Error 2005: VFP busca tablas en raíz |
| `IniciarStyle.bat` que borra `wedb.*` raíz cuando hay `dbf\wedb` | Forms legacy pierden ruta; inconsistencia |
| `SuiteEnsureLegacyWedbLink` / mklink wedb en bootstrap | Mismo problema 2005 |
| `NEWOBJECT("licencias_unlock", "suite_full_unlock")` | Error 1732 + ERR en build |
| Dejar `PROGS\suite_full_unlock.fxp` viejo en VM | Exe carga FXP roto antes que embebido |
| Dejar `PROGS\suite_reservas_sync.*` en VM/proyecto | Obsoleto; conflicto con embebido |
| `activar_suite_sync.prg` en producción | Solo desarrollo si el exe aún no tiene bootstrap |
| Arrancar exe viejo sin `STYLE_LEGACY=1` | Forms con rutas absolutas legacy rotas |
| Confiar en `Resolve-Path Z:\...` sin montar Z: | Script PowerShell falla; usar `-StyleRoot` o UNC |
| Build solo `mscomctl.exe` sin `copy-duna-exe.ps1` | VM sigue con `Duna.exe` antiguo |

---

## VM: layout de datos

```
Style-Dunasoft\
  Duna.exe              ← build nuevo
  Duna2.exe             ← copia trabajo
  SuiteSync.cfg
  EMPRESA.DBF           ← raíz
  IniciarStyle.bat      ← opcional
  ensure-style-dbc.ps1
  dbf\
    wedb.dbc            ← canónico
    usuarios.dbf
    clientes.dbf
    ...
  Usuarios\
    _suite_sync.log
  vcx\
    licencias.*         ← deploy mínimo si exe no embebe VCX
    seguridad.*
    screen_nueva.*
    tickets_nuevo.*
```

**No** debe haber `wedb.dbc` en raíz (salvo modo legacy abajo).

---

## `IniciarStyle.bat` (opcional)

Build **nuevo**: no hace falta; el exe bootstrap solo.

Build **backup** (`.bak` sin parches bootstrap):

```bat
set STYLE_LEGACY=1
IniciarStyle.bat
```

Con `STYLE_LEGACY=1` ejecuta `ensure-style-dbc.ps1 -LegacyTableLinks` (enlaces duros de **todas** las tablas `dbf\` → raíz + wedb). Es el workaround para exe original con rutas absolutas en forms.

---

## Scripts PowerShell (repo)

| Script | Uso |
|--------|-----|
| `repair_mscomctl_pjx.py` | Genera `repair_project_files.txt` desde `mscomctl.lfn` (fxp→prg) |
| `sync-vfp-export.ps1` | Copia `suite_full_unlock.prg` repo → Export |
| `copy-duna-exe.ps1` | `mscomctl.exe` → `Duna.exe` + `Duna2.exe` |
| `deploy-duna-exe-vm.ps1` | Export → VM Style |
| `ensure-style-dbc.ps1` | `-RemoveWedbRootOnly`, `-LegacyTableLinks`, `-RemoveRootCopies` |
| `deploy-edge-functions.ps1 style-reservas-sync` | Edge Function sync |
| `deploy-migration.ps1` | Migraciones SQL sync/LWW |

### `ensure-style-dbc.ps1`

```powershell
# Limpiar wedb en raiz (build nuevo)
.\scripts\ensure-style-dbc.ps1 -RemoveWedbRootOnly

# Modo exe.bak
.\scripts\ensure-style-dbc.ps1 -LegacyTableLinks

# Limpiar todos los enlaces raiz
.\scripts\ensure-style-dbc.ps1 -RemoveRootCopies
```

Auto-detecta ruta si `Z:` no existe (prueba `SUITE_STYLE_ROOT`, UNC `\\192.168.99.16\c$\Style-Dunasoft`).

---

## `SuiteSync.cfg`

Plantilla: `vfp/SuiteSync.cfg.example`

```ini
SYNC_URL=https://supabase.lipoout.com/functions/v1/style-reservas-sync
SYNC_TOKEN=<token desde Postgres style_reservas_sync_config>
SYNC_MAC=STYLE-VM
SYNC_INTERVAL=30
```

---

## Códigos de log (`Usuarios\_suite_sync.log`)

| Código | Significado |
|--------|-------------|
| `[BOOT-00]` | Arranque general, ruta Style |
| `[BOOT-01]` | `SuiteStartSyncIfReady` |
| `[BOOT-02]` | `SuiteApplyFullUnlock` OK / no disponible |
| `[BOOT-03]` | Unlock ya cargado |
| `[BOOT-04]` | `suite_full_unlock` embebido OK |
| `[BOOT-05]` | Embebido sin `Suite_SyncInit` |
| `[BOOT-06]` | **Exe viejo** probando `.fxp` externo — rebuild |
| `[BOOT-07]` | **FALLO**: sync no embebida — rebuild |
| `[BOOT-08]` | Sync ya activa (`plSuiteSyncEnabled`) |
| `[BOOT-FATAL]` | No se creó `usuario` o `licencias` |
| `[INIT-03]` | Config sync OK, timer arrancado |
| `[INIT-02]` | Falta `SuiteSync.cfg` |

---

## Errores «Undefined» al Build (export ReFox incompleto)

Estos avisos **no vienen de los parches Suite**. ReFox exportó el exe pero **no extrajo** componentes que el proyecto referencia. El exe original los tiene embebidos.

| Error en `mscomctl.ERR` | Causa | ¿Bloquea sync Suite? |
|-------------------------|-------|------------------------|
| `Application CONTA` | Falta app contabilidad (`CONTA.EXE` / módulo aparte) | No |
| `Form SALDOS` / `SELECCIONCENTROS` | Forms no exportados (solo en exe) | No |
| `Application SYSTEM` (`graficos.vcx`) | Librería .NET/GDI+ no exportada | No |
| `REPORTPREVIEW` / `REPORTOUTPUT` | FoxyPreviewer incompleto | No |
| `_MESSAGEBOX_ANDROID`, `LAARRAY*`, `DAMEMARGEN`, … | UDFs del exe no exportadas a PRG | No si no recompiláis esos `.vcx` |

**Acción práctica:** ignorar el Build global si solo queréis sync + unlock; compilar los 3 PRGs Suite y usar build nativo con PM o ReFox Replace (Camino 2).

**Si queréis Build limpio:** copiar desde VM Style `gestion-dunasoft\gestion\vcx\conta.vcx`, forms `conta\scx\`, etc. (ver `REFox-COMPILAR.md` §5).

**No confundir con “programas faltantes en el proyecto”:** tras reparar LFN, el `.pjx` tiene ~1227 entradas; la lista LFN tiene 1633 rutas (pares binario+memo). Solo suelen faltar 6 PNG/JPG con nombres problemáticos.

---

## Errores frecuentes

| Síntoma | Causa | Acción |
|---------|-------|--------|
| **1732** nombre de clase no válido | `licencias_unlock` / exe viejo / FXP suelto | Parches G + H; rebuild; quitar FXP fallback |
| **2005** `usuarios.dbf` movido / Weform12 | `wedb` abierto desde raíz | `-RemoveWedbRootOnly`; no mklink wedb; rebuild con `SuiteApplyStyleEnvironment` |
| Idioma cada arranque | `SET DEFAULT` en `dbf\` o exe viejo | Parche EMPRESA/IDIOMA; rebuild |
| Aniversarios vacíos | `BuscarAniversarios` ruta relativa mala | Parche funciones; rebuild |
| `wedb.dbc` no encontrado | Form con ruta `C:\Style-Dunasoft\wedb.dbc` | Build nuevo abre `dbf\wedb`; o legacy links |
| BOOT-07 | `suite_full_unlock` no en `.pjx` | `RepararProyectoMscomctl.prg` + rebuild |
| BOOT-06 | Exe carga `.fxp` externo antes que embebido | Quitar `PROGS\suite_full_unlock.fxp` en VM; rebuild |
| «Faltan 400 programas» en build | Confusión lista LFN (1633 rutas) vs `.pjx` (~1227); Undefined ≠ faltan archivos | Ver § Errores Undefined; reparar LFN si `.pjx` corrupto |
| Exe “nuevo” con errores viejos | VM tiene `Duna.exe` antiguo | `copy-duna-exe.ps1` + `deploy-duna-exe-vm.ps1`; comprobar fecha/tamaño |
| Dos syncs compitiendo | Agente Python + VFP activos | Borrar tarea `DunaSoft-Suite-CoexistSync`; canal único VFP |

---

## Parches de referencia (`vfp/patches/`)

| Archivo | Tema |
|---------|------|
| `general_bootstrap_sin_bat.txt` | Bootstrap exe |
| `general_fix_default_dbf.txt` | DEFAULT raíz vs dbf\ |
| `general_bootstrap_sin_enlaces_dbf.txt` | wedb sin enlaces raíz |
| `general_fix_policencias_1732.txt` | Error 1732 |
| `general_fix_licencias_unlock.txt` | Histórico SuiteCreatePolicencias (**supersedido**) |
| `funciones_fix_aniversarios.txt` | Aniversarios |
| `funciones_skip_actualizar_suite.txt` | Skip actualizar Dunasoft |
| `funciones_reservas_incidencia_sync.txt` | Sync incidencias |
| `funciones_load_unlock_fxp.txt` | Loader sync (histórico; embebido en exe) |
| `general_embedded_only.txt` | Sin fallback `.fxp` externo |
| `httpasp_validarlicencia.prg` | Stub método http.vcx |
| `httpasp_androidonline_validarlicencia.prg` | idem |
| `httpasp_centralreservas_validarlicencia.prg` | idem |
| `httpasp_validarrespuesta.prg` | idem |

---

## Checklist rápido post-export

- [ ] Backend: migraciones sync + Edge Function desplegadas
- [ ] `PrepararExportBuild.bat`
- [ ] Copiar `general.prg`, `funciones.prg`, `suite_full_unlock.prg` desde `vfp/`
- [ ] Reparar proyecto (`RepararProyectoMscomctl.prg` o `REPARAR-PJT.bat` + `RepairMscomctlFromLfn.prg`)
- [ ] `VfpCompilePrgs.prg` sin `.ERR` en los 3 PRGs Suite
- [ ] Build con PM abierto → `mscomctl.exe` (o ReFox Replace fallback)
- [ ] `copy-duna-exe.ps1`
- [ ] `deploy-duna-exe-vm.ps1`
- [ ] `ensure-style-dbc.ps1 -RemoveWedbRootOnly` (Style cerrado)
- [ ] `SuiteSync.cfg` en VM
- [ ] Tarea Python `DunaSoft-Suite-CoexistSync` eliminada (canal único)
- [ ] Arranque `Duna.exe` → log `[BOOT-04]` + `[INIT-03]`
- [ ] Login OK, sin 1732/2005
- [ ] Cita Style ↔ Suite en ~30 s

---

## Modo legacy (solo si usas `Duna.exe.bak` original)

1. `set STYLE_LEGACY=1`
2. `IniciarStyle.bat` → `-LegacyTableLinks`
3. No mezclar con build nuevo bootstrap (conflictos wedb)

---

## Fuente de verdad en el repo

Copiar estos archivos **completos** al export (no aplicar a mano si puedes copiar):

```
vfp/general.prg
vfp/funciones.prg
vfp/suite_full_unlock.prg
vfp/VfpBuildProject.prg
vfp/VfpCompilePrgs.prg
vfp/RepararProyectoMscomctl.prg
vfp/RepairMscomctlFromLfn.prg
vfp/RepairMscomctlFromPjx.prg
vfp/REPARAR-PJT.bat
vfp/suite_repair_lib.prg
vfp/export_build_stubs.prg
vfp/IniciarStyle.bat
vfp/SuiteSync.cfg.example
vfp/activar_suite_sync.prg          ← solo desarrollo / exe sin rebuild
```

Scripts: `scripts/repair_mscomctl_pjx.py`, `copy-duna-exe.ps1`, `deploy-duna-exe-vm.ps1`, `ensure-style-dbc.ps1`, `sync-vfp-export.ps1`.

Auditoría proyecto (opcional): `tmp/audit_mscomctl_project.py`, `tmp/compare_pjx_keys.py`.

---

*Última consolidación: junio 2026 — Style Dunasoft → Suite (Lipout). Incluye: canal único VFP+Edge Function, reparación LFN/pjx, build VFP9/ReFox fallback, bootstrap sin .bat, wedb en dbf\, unlock offline, sync embebida en suite_full_unlock.prg.*
