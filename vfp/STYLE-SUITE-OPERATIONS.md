# STYLE ↔ SUITE — Operaciones

Runbook diario: monitorización, ciclo de vida de ficheros, dead-letter y heartbeat.

---

## Monitorización (`dunasoft.style_sync_agent_state`)

| Columna | Significado | Acción si anómalo |
|---------|-------------|-------------------|
| `last_cola_id` | Última fila cola procesada | Comparar con MAX(id) en `cola_sincro.dbf` |
| `last_outbound_ok_at` | Último RPC outbound OK | >5 min stale → revisar agente/CIFS |
| `last_inbound_ok_at` | Último RPC ack OK | >15 min stale → revisar worker |
| `outbound_errors` | Contador errores outbound | Crecimiento rápido → ver `deadletter/outbound` |
| `inbound_errors` | Contador errores inbound | Crecimiento rápido → ver `deadletter/inbound` |
| `agent_version` | Versión agente Node | Debe coincidir con imagen Docker |
| `worker_version` | Versión worker VFP (heartbeat) | Debe ser `1.1.0` o superior |
| `last_outbound_lag_ms` | Latencia outbound (ms) | >30000 → degradación CIFS/carga |
| `last_inbound_lag_ms` | Latencia inbound (ms) | >30000 → worker lento o cola grande |
| `inbound_worker_status` | `ok` / `stopped` / `unknown` | `stopped` → Task Scheduler |
| `inbound_worker_alert_message` | Texto alerta | Notificar operaciones |
| `last_error` / `last_error_at` | Último error registrado | Diagnóstico |
| `agent_last_tick_at` | Último ciclo agente | Contenedor vivo |

### Consulta dashboard

```sql
SELECT *
FROM dunasoft.style_sync_agent_state
WHERE company_id = '<UUID>';
```

### Cola pendiente (estimación)

Comparar `last_cola_id` con el máximo `id` en `cola_sincro.dbf` (manual o script). Diferencia grande = backlog outbound.

### Queue inbound pendiente

```sql
SELECT count(*) AS pending
FROM dunasoft.style_reservas_queue
WHERE company_id = '<UUID>' AND delivered_at IS NULL;
```

---

## Heartbeat

| Fichero | Quién escribe | Frecuencia |
|---------|---------------|------------|
| `sync/heartbeat.txt` | Worker VFP | Cada ejecución Task Scheduler |

Formato:

```text
17/06/2026 18:30:00|worker=1.1.0
```

El agente alerta si `mtime` > **5 min** (`HEARTBEAT_STALE_MS=300000`).

**Regla:** el worker debe ejecutarse **aunque no haya JSON** — solo así el heartbeat permanece vivo.

---

## Kill switch (`control_sincro.dbf`)

| `modo_activo` | Significado |
|---------------|-------------|
| `1` | v1 HTTP legacy activo — agente y worker **no procesan** |
| `2` | v2 cola + agente activo |

Creado por `suite_control_sync.prg`. En rollback a v1: `REPLACE modo_activo WITH '1'` y parar contenedor Docker.

---

## Ciclo de vida de ficheros

### `sync/inbound/*.json`

| Etapa | Quién | Destino |
|-------|-------|---------|
| Creado | Agente Node | Desde `style_reservas_queue` |
| Procesado | Worker VFP | Borrado tras aplicar DBF |
| Ack OK | Agente Node | Archivado en `sync/archive/YYYY-MM-DD/` |
| Huérfano >24h | Agente Node | `sync/archive/failed/` |
| Reciclaje | Worker VFP (cada 100 ciclos) | `failed/` → `inbound/` si >1h |
| N fallos ack | Agente Node | `sync/deadletter/inbound/` |

### `sync/inbound_ack/*.ok`

| Etapa | Destino |
|-------|---------|
| Creado por worker | Permanece hasta ack RPC |
| Tras `style_reservas_ack` OK | Archivado junto al JSON |

**No dejar miles de ficheros en `inbound/`** — ADIR/SYS(2000) en VFP se degradan.

---

## Dead-letter queue

Ruta: `sync/deadletter/`

```
deadletter/
├── outbound/
│   └── {cola_id}_{timestamp}/
│       ├── payload.json    ← fila cola con snapshot
│       ├── error.txt
│       └── stacktrace.txt
└── inbound/
    └── {queue_id}_{timestamp}/
        ├── payload.json    ← JSON original
        ├── error.txt
        └── stacktrace.txt
```

**Cuándo se genera:**

| Tipo | Condición | `last_cola_id` / queue |
|------|-----------|------------------------|
| Outbound | `OUTBOUND_MAX_RETRIES` (default 5) fallos RPC | **No avanza** — cita no se pierde |
| Inbound | `INBOUND_ACK_MAX_RETRIES` fallos ack RPC o worker `ok=0` | Queue sigue pendiente |

**Revisión manual:**

1. Leer `error.txt` y `payload.json`.
2. Corregir causa (RPC, datos, worker).
3. Reprocesar: outbound reintenta solo; inbound puede reescribir JSON o aplicar en VFP manualmente.
4. Borrar carpeta dead-letter tras resolver.

Variables: `DEADLETTER_DIR`, `OUTBOUND_MAX_RETRIES`, `INBOUND_ACK_MAX_RETRIES`.

---

## Resiliencia CIFS

El agente reintenta operaciones de fichero con backoff (`FS_RETRY_MAX=6`, base 100 ms).

| Síntoma en logs | Acción |
|-----------------|--------|
| `tick omitido (CIFS/DBF)` | Esperar; suele recuperarse solo |
| `AVISO: posible microcorte CIFS` | Revisar montaje Portainer |
| Persistente >10 min | Reiniciar stack Docker / remontar volumen |

---

## Logs

| Fichero | Contenido |
|---------|-----------|
| `sync/inbound_worker.log` | Errores worker VFP |
| `Usuarios\_suite_sync.log` | Bootstrap exe (`[BOOT-04]`) |
| stdout contenedor | Agente Node (Portainer logs) |

---

## Mantenimiento periódico

| Tarea | Frecuencia |
|-------|------------|
| Revisar `style_sync_agent_state` | Diario |
| Purgar `sync/archive/` antiguo (>30 días) | Mensual |
| Revisar `sync/deadletter/` | Cuando `*_errors` sube |
| Verificar Task Scheduler worker | Semanal |
| Purga opcional `cola_sincro.dbf` (filas id ≤ last_cola_id) | Semanal (PRG opcional) |
