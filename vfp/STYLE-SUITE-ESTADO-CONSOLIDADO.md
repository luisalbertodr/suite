# STYLE ↔ SUITE Sync v2 — Estado consolidado (implementado vs pendiente)

> **Propósito:** documento autocontenido para validación cruzada con otros modelos de IA u operaciones.  
> **Fecha de corte:** junio 2026  
> **Arquitectura:** cola local VFP + agente Node Docker + worker VFP inbound (sin HTTP VFP→Supabase).

---

## 1. Resumen ejecutivo

| Ámbito | Estado |
|--------|--------|
| **Código en repo** | Completo para v2 (VFP outbound, worker inbound, agente Node, migraciones SQL, scripts ops) |
| **Build `Duna.exe` ExportZ** | Scripts listos; **falta compilación manual en VFP IDE** y validación en test/prod |
| **Despliegue infra** | Migraciones agente, stack Docker/Portainer, Task Scheduler y cutover **pendientes en servidores** |
| **E2E formal** | Plan documentado; ejecución completa en VM test/prod **pendiente de confirmación** |
| **UI Suite (alertas sync)** | **No implementada** (opcional) |

**Regla crítica:** no ejecutar v1 (HTTP / `suite_full_unlock` / `C:\SuiteSync`) y v2 en paralelo. Kill switch: `control_sincro.dbf` → `modo_activo`: `'1'`=v1, `'2'`=v2.

---

## 2. Reglas de oro y garantías

### Reglas

1. VFP **nunca** habla con Supabase.
2. Node **nunca** escribe DBF (`plan2009`, `planart`, `cola_sincro`).
3. Todo cambio pasa por una **cola** (`cola_sincro.dbf` outbound / `style_reservas_queue` inbound).
4. Operaciones **idempotentes** + entrega **at-least-once**.
5. Recuperación automática (reintentos CIFS, dead-letter, reciclaje failed).
6. Heartbeat del worker **siempre vivo** (Task Scheduler periódico).
7. Kill switch antes de cada ciclo enqueue / agente / worker.

### Garantías por dirección

| Dirección | Mecanismo |
|-----------|-----------|
| **Style → Suite** | Snapshot en cola → agente → RPC `style_reservas_apply_from_style`; `last_cola_id` solo avanza tras OK |
| **Suite → Style** | Dual-write Suite → `style_reservas_queue` → JSON → worker VFP → ACK → RPC `style_reservas_ack` |
| **LWW Suite→Style** | Postgres (cola) + worker compara `version` vs `plan2009.sync_version` |
| **ACK siempre** | Worker genera `.ok` aunque Style pierda conflicto (`applied=0`) para evitar reintentos infinitos |

---

## 3. Ownership de datos y ficheros

| Elemento | Dueño escritura | Notas |
|----------|-----------------|-------|
| `plan2009.dbf`, `planart.dbf` | VFP (POS + worker inbound) | Node solo lee cola |
| `cola_sincro.dbf` | VFP (`SuiteEnqueuePlan2009`) | Snapshot completo de cita |
| `control_sincro.dbf` | VFP | `modo_activo` kill switch |
| `sync/inbound/*.json` | Agente Node | Desde `style_reservas_queue` |
| `sync/inbound_ack/*.ok` | Worker VFP | Tras procesar JSON |
| `sync/archive/` | Agente Node | Tras ack RPC OK |
| `sync/archive/failed/` | Agente Node (huérfanos) + Worker (reciclaje) | JSON >24h sin ack |
| `sync/deadletter/` | Agente Node | Tras N fallos RPC |
| `sync/heartbeat.txt` | Worker VFP | Cada ejecución scheduler |
| `style_reservas_queue` | Supabase (Suite dual-write) | Hasta `delivered_at` |
| `agenda_appointments` | Supabase (Suite) | Tabla final agenda |
| `dunasoft.style_sync_agent_state` | Agente Node | Cursor + métricas |

---

## 4. Flujos (máquinas de estado)

### Outbound (Style → Suite)

```
Usuario guarda cita (Duna.exe)
  → Reservas_Incidencia → SuiteEnqueuePlan2009 (si modo_activo='2')
  → cola_sincro.dbf (snapshot + version)
  → Agente lee DBF vía CIFS (id > last_cola_id)
  → RPC style_reservas_apply_from_style
  → last_cola_id++ | lag_ms registrado
```

### Inbound (Suite → Style)

```
Suite escribe agenda + style_reservas_queue (misma transacción)
  → Agente poll queue (delivered_at IS NULL)
  → sync/inbound/{queue_id}.json (incluye version)
  → Worker VFP: LWW check → plan2009/planart
  → sync/inbound_ack/{queue_id}.ok (siempre)
  → Agente RPC style_reservas_ack
  → Archivo JSON+.ok en sync/archive/YYYY-MM-DD/
```

---

## 5. Contratos técnicos (para validación IA)

### 5.1 `cola_sincro.servicios` (Memo)

Formato acordado: **JSON array**

```json
[{"servicio":"corte","hora":"10:00"},{"servicio":"tinte","hora":"11:00"}]
```

| Componente | Comportamiento |
|------------|----------------|
| VFP enqueue | `SuiteBuildServiciosJson` serializa desde `planart` |
| Agente Node | `serviciosJsonToLegacy()` → texto RPC (`codart+hora` por línea `\r`) |
| Worker inbound | Si empieza por `[` → `SuiteJsonParse`; si no → parser legacy |

**Escaping VFP:** `SuiteColaJsonEscape` escapa `\`, `"`, tab, LF, CR y omite otros controles (<32).  
**Nota:** `&` no requiere escape en JSON. Caso de prueba E2E: servicio `Peinado "Express" & más`.

### 5.2 Campo `version` / LWW

| Capa | Campo |
|------|-------|
| Cola outbound | `cola_sincro.version` (epoch vía `SuiteColaEpochNow`) |
| JSON inbound | `version` en payload; fallback `modificado` |
| DBF Style | `plan2009.sync_version` (ALTER automático en worker) |
| Regla worker | Aplicar si `incoming > local` o registro no existe; si no → skip + ACK `applied=0` |

### 5.3 ACK worker (`.ok`)

```text
idand=<n>;idplan=<n>;macand=<s>;ok=1;version=<n>;applied=<0|1>
```

- `ok=1` = recibido y procesado (no implica que Style ganó el conflicto).
- Agente solo hace RPC ack si `ok != 0`.

### 5.4 Kill switch `control_sincro.dbf`

| `modo_activo` | Efecto |
|---------------|--------|
| `'1'` | v1 HTTP legacy; enqueue, agente y worker **no procesan** v2 |
| `'2'` | v2 cola + agente activo (default al crear tabla) |

Comprobado en: `SuiteEnqueuePlan2009`, `suite_inbound_worker.prg`, agente `isSyncV2Active()`.

### 5.5 Heartbeat

```text
DD/MM/YYYY HH:MM:SS|worker=1.1.0
```

Agente alerta si mtime > 5 min (`HEARTBEAT_STALE_MS=300000`).

### 5.6 Métricas de lag (Postgres)

| Columna | Cálculo |
|---------|---------|
| `last_outbound_lag_ms` | `NOW() - cola_sincro.creado` del último outbound OK |
| `last_inbound_lag_ms` | `NOW() - style_reservas_queue.created_at` del último ACK OK |

Alerta log agente si lag > 30 s (`LAG_ALERT_MS=30000`).

---

## 6. Inventario implementado (repo)

### 6.1 VFP — outbound y utilidades

| Archivo | Versión / estado | Función |
|---------|------------------|---------|
| `vfp/suite_cola_sync.prg` | Implementado | Cola, snapshot, JSON servicios, version, kill switch en enqueue, migración inline |
| `vfp/suite_migrar_cola_sincro.prg` | Implementado | ALTER columnas snapshot sin borrar cola (Fase 0 / pre-prod) |
| `vfp/suite_control_sync.prg` | Implementado | Crea/lee `control_sincro.dbf`, `SuiteSyncModoV2Active()` |
| `vfp/funciones.prg` | Modificado | Hook `Reservas_Incidencia` → `SuiteEnqueuePlan2009`; loader v2 **sin** `suite_full_unlock` |
| `vfp/general.prg` | Modificado | Bootstrap sync v2 |
| `vfp/suite_repair_lib.prg` | Implementado | Build ExportZ sin unlock HTTP |
| `vfp/VfpBuildProject.prg` | Modificado | Proyecto incluye `suite_cola_sync`, excluye `suite_full_unlock` |
| `vfp/suite_full_unlock.prg` | **Legacy v1** | Permanece en repo; **no** se copia a ExportZ |

**Embebido en `Duna.exe` (ExportZ):** `suite_cola_sync.prg` vía `funciones.prg`.  
**Copia suelta en VM (Task Scheduler):** `suite_inbound_worker.prg`, `suite_control_sync.prg`, `suite_migrar_cola_sincro.prg`.

### 6.2 VFP — worker inbound

| Archivo | Versión | Función |
|---------|---------|---------|
| `vfp/suite_inbound_worker.prg` | **1.1.0** | JSON→DBF, LWW, ACK siempre, parse JSON servicios, heartbeat, kill switch, reciclaje `archive/failed/` cada 100 ciclos (>1h) |

**Nota sobre reciclaje failed:** el worker reinyecta JSON con antigüedad >1h; el contador «5 reintentos permanentes» de la propuesta de arquitectura **no está implementado en VFP** — el límite duro está en el agente (`deadletter/` tras N fallos RPC).

### 6.3 Agente Node (`style-sync-agent/` v0.2.1)

| Archivo | Función |
|---------|---------|
| `src/index.ts` | Loop outbound/inbound, ack drain, heartbeat check, stale purge, kill switch |
| `src/agentState.ts` | Patch `style_sync_agent_state` (incl. lag) |
| `src/controlSync.ts` | Lee `control_sincro.dbf` |
| `src/servicios.ts` | JSON servicios → legacy RPC; `resolveVersion()` |
| `src/fsRetry.ts` | Backoff CIFS/DBF |
| `src/deadLetter.ts` | `sync/deadletter/{outbound|inbound}/` |
| `Dockerfile` | Imagen producción |
| `docker-compose.snippet.yml` | Snippet Portainer + volumen CIFS |
| `.env.example` | Variables requeridas |

**Compilación:** `npm run build` OK (TypeScript).

### 6.4 Supabase — migraciones (repo)

| Migración | Contenido | Deploy 110 |
|-----------|-----------|------------|
| `20260608120000_style_reservas_vfp_sync.sql` | Esquema base cola + RPCs | Presumiblemente aplicada |
| `20260609120000_style_reservas_lww.sql` | LWW Postgres outbound | Presumiblemente aplicada |
| `20260617190000_style_sync_agent_state.sql` | `last_cola_id`, estado agente | **Pendiente confirmar** |
| `20260617193000_style_sync_agent_health.sql` | Heartbeat, alertas inbound | **Pendiente confirmar** |
| `20260617200000_style_sync_agent_metrics.sql` | Errores, versiones, timestamps OK | **Pendiente confirmar** |
| `20260617210000_style_sync_agent_lag.sql` | `last_outbound_lag_ms`, `last_inbound_lag_ms` | **Pendiente confirmar** |

**Legacy v1 (no usar en v2):** Edge Function `supabase/functions/style-reservas-sync/` — deshabilitar en cutover.

### 6.5 Scripts PowerShell / ops

| Script | Estado | Uso |
|--------|--------|-----|
| `scripts/build-style-exportz.ps1` | Implementado | Sync PRGs v2 a `C:\Duna\ExportZ`, pipeline build |
| `scripts/verify-style-cutover.ps1` | Implementado | Verificación binaria: nuevo exe sin `suite_full_unlock` |
| `scripts/validate-style-exportz-build.ps1` | Existente | Validación post-build |
| `scripts/deploy-migration.ps1` | Existente | Aplicar SQL en 110 |
| `scripts/setup-style-exportz-test.ps1` | Existente | Entorno test local |

### 6.6 Documentación

| Documento | Contenido |
|-----------|-----------|
| `vfp/STYLE-SUITE-ARCHITECTURE.md` | Arquitectura, ownership, LWW, contrato JSON |
| `vfp/STYLE-SUITE-SYNC-V2-IMPLEMENTACION.md` | Guía maestra implementación + cutover + E2E |
| `vfp/STYLE-SUITE-DEPLOY.md` | Fases despliegue |
| `vfp/STYLE-SUITE-OPERATIONS.md` | Monitorización, lag, kill switch, dead-letter |
| `vfp/STYLE-SUITE-TROUBLESHOOTING.md` | Diagnóstico por síntoma |
| `vfp/STYLE-SUITE-HISTORY.md` | Cronología |
| `vfp/STYLE-SUITE-PARCHES-EXPORT.md` | Parches ExportZ / errores 1732 |
| `style-sync-agent/README.md` | Uso agente local/Docker |
| **`vfp/STYLE-SUITE-ESTADO-CONSOLIDADO.md`** | **Este documento** |

---

## 7. Entornos y rutas

| Rol | Host / ruta | Notas |
|-----|-------------|-------|
| Supabase | `192.168.99.110` / `https://supabase.lipoout.com` | Postgres + RPCs |
| Frontend Suite | `192.168.99.112` / `https://suite.lipoout.com` | React/Vite |
| VM Style prod | `192.168.99.16` / `\\192.168.99.16\c$\Style-Dunasoft` | `Duna.exe`, cola, sync/ |
| Build ExportZ | `C:\Duna\ExportZ` | `mscomctlOk.pjx` — **no** mezclar con `C:\Duna\Export` |
| Test local | `C:\Duna\Style-Suite-Test` | Deploy `-DeployTest` |
| Agente legacy v1 | `C:\SuiteSync` (Python) | **Parar** en cutover |
| Portainer (LXC Proxmox) | CIFS en host → bind `/mnt/style` → contenedor `/style` | Ver `style-sync-agent/PROXMOX-LXC-CIFS.md` |

---

## 8. Estructura objetivo en VM Style (post-cutover)

```text
Style-Dunasoft\
├── Duna.exe                          ← ExportZ sin suite_full_unlock
├── Duna.exe.v1.legacy.bak            ← Backup pre-cutover
├── control_sincro.dbf                ← modo_activo='2'
├── cola_sincro.dbf                   ← snapshot + version
├── PROGS\
│   ├── suite_cola_sync.prg           ← (también embebido en exe)
│   ├── suite_inbound_worker.prg      ← Task Scheduler 30–60 s
│   ├── suite_control_sync.prg
│   └── suite_migrar_cola_sincro.prg
└── sync\
    ├── inbound\                      ← Agente escribe JSON
    ├── inbound_ack\                  ← Worker escribe .ok
    ├── archive\
    │   ├── YYYY-MM-DD\               ← Procesados OK
    │   └── failed\                   ← Huérfanos + reciclaje worker
    ├── deadletter\                   ← Agente (N fallos RPC)
    ├── heartbeat.txt
    ├── inbound_worker.log
    └── worker_cycle.txt              ← Contador reciclaje (mod 100)
```

---

## 9. Plan de pruebas E2E (documentado)

| # | Prueba | Criterio éxito | Estado ejecución |
|---|--------|----------------|------------------|
| 1 | Crear cita Style | Cola <2s; Suite <10s | Pendiente confirmar |
| 2 | Modificar Style | Mismo idplan actualizado Suite | Pendiente confirmar |
| 3 | Borrar Style | Cancelada/eliminada Suite | Pendiente confirmar |
| 4 | Crear Suite | JSON inbound; Style <15s | Pendiente confirmar |
| 5 | LWW (versiones forzadas) | Suite gana si version mayor; ACK siempre | Pendiente confirmar |
| 6 | Caos: Supabase 30 min off | Cola crece; catch-up al volver | Pendiente confirmar |
| 7 | Worker parado 10 min | `inbound_worker_status='stopped'` | Pendiente confirmar |
| 8 | Reinicio agente | Sin duplicados (`last_cola_id`) | Pendiente confirmar |
| 9 | Arranque Lipout | Sin error 1732; exe ~30 MB; log `[BOOT-04]` | Pendiente confirmar |
| 10 | Servicio con comillas en nombre | JSON válido; parse OK en agente y worker | Pendiente confirmar |

**Notas prueba #5:** crear en Suite v=1 → modificar Style con v antiguo (ignorado) → Suite v=2 aplica → Style v=3 aplica vía cola; verificar `.ok` con `applied=0` en conflictos perdidos.

---

## 10. Cutover v1 → v2 (checklist ops)

| Paso | Acción | Estado |
|------|--------|--------|
| 1 | Migraciones `171900`–`172100` en 110 | Pendiente |
| 2 | Imagen Docker + stack Portainer CIFS → VM 192.168.99.16 | Pendiente |
| 3 | Copiar PRGs worker/control/migrar a `PROGS\` | Pendiente |
| 4 | `DO suite_migrar_cola_sincro.prg` si cola antigua | Pendiente |
| 5 | `control_sincro.modo_activo='2'` | Pendiente |
| 6 | E2E en baja actividad (test o prod) | Pendiente |
| 7 | `verify-style-cutover.ps1 -Backup` | Pendiente |
| 8 | Desplegar nuevo `Duna.exe` | Pendiente |
| 9 | Parar `C:\SuiteSync` y timer HTTP v1 | Pendiente |
| 10 | Deshabilitar Edge Function `style-reservas-sync` | Pendiente |

**Rollback:** restaurar `Duna.exe.v1.legacy.bak`, `modo_activo='1'`, parar contenedor, reactivar v1 HTTP.

---

## 11. Pendiente de implementar / ejecutar

### 11.1 Código (repo)

| Ítem | Prioridad | Notas |
|------|-----------|-------|
| Panel UI Suite (alertas `style_sync_agent_state`) | Baja / opcional | No hay componente React en repo |
| Contador 5 reintentos en reciclaje VFP `failed/` | Baja | Solo reciclaje por edad >1h; dead-letter en agente cubre RPC |
| Tests automatizados E2E | Media | Solo plan manual en docs |
| Actualizar README agente (formato ACK con `version`/`applied`) | Baja | Código ya usa formato extendido |

### 11.2 Build y validación local (usuario VFP)

| Ítem | Estado |
|------|--------|
| `DO PROGS\VfpCompilePrgs.prg` + `VfpBuildProject.prg` en ExportZ | Pendiente usuario |
| `build-style-exportz.ps1 -AfterBuild -DeployTest` | Pendiente usuario |
| Validar exe ~30 MB, sin 1732, sin `[BOOT-07]`, con `[BOOT-04]` | Pendiente usuario |
| `validate-style-exportz-build.ps1` | Pendiente usuario |

### 11.3 Despliegue infraestructura

| Ítem | Estado |
|------|--------|
| 4 migraciones agente en Postgres 110 | Pendiente |
| Build/push imagen `style-sync-agent:0.2.1` | Pendiente |
| Stack Portainer prod (LXC + bind CIFS host) | Pendiente |
| Task Scheduler worker en VM 192.168.99.16 (30–60 s, siempre) | Pendiente |
| Variables `.env`: `COMPANY_ID`, `SERVICE_ROLE_KEY`, `STYLE_ROOT` | Pendiente |
| Cutover prod con verificación binaria | Pendiente |

### 11.4 Fuera de alcance v2 (no confundir)

Estos cambios en el repo **no forman parte** del sync Style↔Suite v2:

- Marketing WhatsApp (`MarketingWhatsapp*`, `marketing-whatsapp-queue`)
- Scripts portable sync test (`build-style-portable.ps1`, `test-portable-sync.ps1`)
- Cambios UI `ClienteDetailView.tsx`, `tabs.tsx`

---

## 12. Comandos de referencia

```powershell
cd C:\Users\OportoW11\Suite\suite

# Preparar ExportZ
.\scripts\build-style-exportz.ps1
.\scripts\build-style-exportz.ps1 -AfterBuild -DeployTest

# Verificación pre-cutover
.\scripts\verify-style-cutover.ps1 -NewExe "C:\Duna\ExportZ\Duna.exe" -Backup

# Migraciones (orden)
.\scripts\deploy-migration.ps1 20260617190000_style_sync_agent_state.sql
.\scripts\deploy-migration.ps1 20260617193000_style_sync_agent_health.sql
.\scripts\deploy-migration.ps1 20260617200000_style_sync_agent_metrics.sql
.\scripts\deploy-migration.ps1 20260617210000_style_sync_agent_lag.sql

# Agente local
cd style-sync-agent
npm install && npm run build && npm run dev

# Imagen Docker
docker build -t style-sync-agent:0.2.1 style-sync-agent
```

```foxpro
* Migrar cola (sin borrar datos)
DO PROGS\suite_migrar_cola_sincro.prg

* Encolar manual (debug)
SET PROCEDURE TO suite_cola_sync ADDITIVE
= SuiteEnqueuePlan2009(12345, "UPD")

* Worker inbound manual
DO C:\Style-Dunasoft\PROGS\suite_inbound_worker.prg
```

```sql
-- Estado agente
SELECT company_id, last_cola_id, last_outbound_lag_ms, last_inbound_lag_ms,
       inbound_worker_status, inbound_worker_alert_message,
       agent_version, worker_version, agent_last_tick_at
FROM dunasoft.style_sync_agent_state;
```

---

## 13. Preguntas para validación con otra IA — respuestas consolidadas

| # | Pregunta | Veredicto | Notas |
|---|----------|-----------|-------|
| 1 | ¿JSON `servicios` suficiente para caracteres especiales? | **Formato sí; generador debe escapar** | `SuiteColaJsonEscape` escapa `\`, `"`, tab/LF/CR; `&` no requiere escape JSON. Probar E2E #10. |
| 2 | ¿LWW solo en worker coherente bidireccional? | **Sí** | Conflicto solo en inbound (Style). Outbound: Style es fuente; Postgres aplica siempre (`20260610130000`). |
| 3 | ¿ACK `applied=0` evita loops? | **Sí** | ACK = recibido/procesado; `style_reservas_ack` cierra el ciclo at-least-once. |
| 4 | ¿Kill switch cubre rollback v1? | **Sí** | Tres capas + `modo_activo='1'`. Ítems ya en cola/inbound quedan huérfanos → limpieza manual en rollback. |
| 5 | ¿`last_cola_id` solo en Postgres? | **Correcto** | Cursor en destino; sobrevive disaster recovery VM Style. |
| 6 | ¿Reciclaje sin contador 5 = hueco? | **No** | División: agente → dead-letter (transporte); worker → reciclaje por edad (aplicación). |
| 7 | ¿Migraciones 171900–172100 idempotentes? | **Sí (auditadas)** | Ver sección 15. |

---

## 14. Versiones de componentes

| Componente | Versión |
|------------|---------|
| Agente Node (`style-sync-agent`) | **0.2.1** |
| Worker VFP (`suite_inbound_worker.prg`) | **1.1.0** |
| Arquitectura sync | **v2** (cola + Docker) |
| Arquitectura legacy | **v1** (HTTP / `suite_full_unlock` / Python) — retirar en cutover |

---

## 15. Validación cruzada IA — riesgos y auditoría (junio 2026)

### 15.1 Puntos fuertes confirmados

- **SoC:** VFP sin Supabase; Node sin DBF — acoplamiento peligroso evitado.
- **Consistencia:** LWW + idempotencia + colas + `last_cola_id` — patrón maduro.
- **Operaciones:** kill switch, heartbeat, lag, dead-letter desde el diseño.
- **Resiliencia:** backoff CIFS + reciclaje worker sin over-engineering (sin circuit breaker).

### 15.2 Riesgos identificados y mitigación

| Riesgo | Severidad | Mitigación en diseño |
|--------|-----------|----------------------|
| RPC outbound OK pero fallo al actualizar `last_cola_id` → reproceso mismo `cola_id` | Media | RPC `style_reservas_apply_from_style` es idempotente: UPDATE por `legacy_idplan`, no INSERT duplicado (`20260610130000`). DELETE idempotente. |
| Carrera LWW inbound (usuario Style modifica entre read y write worker) | Baja | Ventana ms; LWW aceptable para agenda peluquería; coherencia eventual. |
| JSON `servicios` inválido por caracteres especiales en VFP | Media | `SuiteColaJsonEscape` reforzado (sección 5.1); prueba E2E #10. |
| Rollback v1 deja eventos en cola/inbound sin consumir | Baja | Procedimiento manual: vaciar o ignorar; v1 no lee cola v2. |

### 15.3 Idempotencia RPC outbound (`style_reservas_apply_from_style`)

Documentado en `20260610130000_style_push_always_apply.sql`:

- Style es **fuente de verdad** en push (sin LWW bloqueante outbound).
- `plan2009`: `IF EXISTS → UPDATE` / `ELSE INSERT` por `idplan`.
- `agenda_appointments`: busca por `legacy_idplan`; INSERT solo si no existe; bridge `ON CONFLICT DO UPDATE`.
- **Reprocesar el mismo `cola_id`** = actualización redundante, no cita duplicada.

### 15.4 Auditoría migraciones `171900`–`172100`

| Migración | Idempotente | Detalle |
|-----------|-------------|---------|
| `20260617190000_style_sync_agent_state.sql` | **Sí** | `CREATE TABLE IF NOT EXISTS`; `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER`; `CREATE OR REPLACE FUNCTION` touch |
| `20260617193000_style_sync_agent_health.sql` | **Sí** | Solo `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` |
| `20260617200000_style_sync_agent_metrics.sql` | **Sí** | Solo `ADD COLUMN IF NOT EXISTS` + `COMMENT` (re-ejecutar COMMENT es seguro) |
| `20260617210000_style_sync_agent_lag.sql` | **Sí** | Solo `ADD COLUMN IF NOT EXISTS` |

**Seguro aplicar en bloque en 110** vía `deploy-migration.ps1` (una por ejecución, orden cronológico).  
**No alteran** firmas de RPCs existentes ni tablas de negocio (`agenda_appointments`, `style_reservas_queue`).

### 15.5 Acciones pre-cutover (máximo valor)

1. **E2E #10:** cita con servicio `Peinado "Express" & más` → verificar cola JSON válido y llegada a Suite.
2. **Deploy migraciones** `171900`–`172100` en 110 (auditadas arriba).
3. **Verificación binaria** `verify-style-cutover.ps1 -Backup`.

---

*Generado para revisión cruzada. Documentación detallada: [STYLE-SUITE-SYNC-V2-IMPLEMENTACION.md](STYLE-SUITE-SYNC-V2-IMPLEMENTACION.md) y [STYLE-SUITE-ARCHITECTURE.md](STYLE-SUITE-ARCHITECTURE.md).*
