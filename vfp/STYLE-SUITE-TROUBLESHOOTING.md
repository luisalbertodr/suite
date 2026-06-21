# STYLE ↔ SUITE — Troubleshooting

Diagnóstico por síntoma. Ver [STYLE-SUITE-OPERATIONS.md](STYLE-SUITE-OPERATIONS.md) para métricas y [STYLE-SUITE-DEPLOY.md](STYLE-SUITE-DEPLOY.md) para cutover.

---

## Style no llega a Suite

**Síntoma:** cita guardada en Style; no aparece en Suite.

| Paso | Qué revisar |
|------|-------------|
| 1 | `cola_sincro.dbf` — ¿hay fila nueva con snapshot? |
| 2 | `last_cola_id` en `style_sync_agent_state` — ¿avanza? |
| 3 | Logs agente — `procesar plan2009 id=...` o `error fila` |
| 4 | `sync/deadletter/outbound/` — ¿RPC falló N veces? |
| 5 | RPC manual: `style_reservas_apply_from_style` con payload de `payload.json` |
| 6 | CIFS — ¿agente lee `cola_sincro.dbf`? (`tick omitido`) |

**Causas frecuentes:**

- Agente Docker parado o sin `COMPANY_ID`
- CIFS desmontado
- Fila en dead-letter (RPC rechazado)
- v1 y v2 en paralelo (conflictos)

---

## Suite no llega a Style

**Síntoma:** cita creada en Suite; no en agenda Style.

| Paso | Qué revisar |
|------|-------------|
| 1 | `style_reservas_queue` — fila con `delivered_at IS NULL` |
| 2 | `sync/inbound/{queue_id}.json` — ¿existe? |
| 3 | `sync/inbound_worker.log` — errores JSON/DBF |
| 4 | `sync/inbound_ack/{queue_id}.ok` — ¿worker aplicó? |
| 5 | `last_inbound_ok_at` — ¿avanza? |
| 6 | `sync/deadletter/inbound/` |

**Causas frecuentes:**

- Worker Task Scheduler parado
- JSON corrupto (worker no parsea)
- `plan2009` bloqueado exclusivo en Style
- Ack RPC falla repetidamente

---

## Heartbeat detenido

**Síntoma:** `inbound_worker_status = 'stopped'` o alerta en Postgres.

| Paso | Acción |
|------|--------|
| 1 | ¿Existe `sync/heartbeat.txt`? |
| 2 | ¿`mtime` reciente? |
| 3 | Task Scheduler — tarea habilitada, cada 30–60 s |
| 4 | Ejecutar manual: `DO suite_inbound_worker.prg` |
| 5 | Revisar `inbound_worker.log` |

**Regla:** sin heartbeat vivo, el inbound se considera caído aunque el agente Node funcione.

---

## CIFS caído / microcortes

**Síntoma:** logs `tick omitido (CIFS/DBF)`, `ack_readdir omitido`, `AVISO: posible microcorte CIFS`.

### LXC Proxmox (bind mount desde host) — recomendado

| Paso | Acción |
|------|--------|
| 1 | Esperar 1–2 min (reintentos automáticos del agente) |
| 2 | **Host Proxmox:** `mountpoint /mnt/style-sync` — si falla: `mount -a` |
| 3 | **LXC:** `ls /mnt/style/cola_sincro.dbf` |
| 4 | Portainer → reiniciar contenedor `style-sync-agent` |
| 5 | Cron watchdog: `scripts/proxmox-check-style-mount.sh` |
| 6 | Ver [PROXMOX-LXC-CIFS.md](../style-sync-agent/PROXMOX-LXC-CIFS.md) |

### Docker con volumen CIFS directo (legacy)

| Paso | Acción |
|------|--------|
| 1 | Reiniciar contenedor |
| 2 | Verificar credenciales SMB en volumen |
| 3 | Remontar volumen CIFS en stack |

El contenedor **no debe crashear** — diseñado para reintentar.

---

## `cola_sincro.dbf` bloqueado

**Síntoma:** agente loguea reintentos `cola_dbf`.

- Normal durante `APPEND BLANK` en VFP (milisegundos).
- Backoff automático 100 ms → 200 ms → …
- Si persistente: cerrar sesiones VFP con cola abierta EXCLUSIVE.

---

## Dead-letter acumulado

**Síntoma:** carpetas en `sync/deadletter/`, contadores `outbound_errors` / `inbound_errors` altos.

1. Abrir `payload.json` + `error.txt`.
2. Corregir datos o esquema (campos snapshot, RPC).
3. Outbound: tras fix, el agente reintenta (misma fila cola si `last_cola_id` no avanzó).
4. Inbound: corregir JSON o aplicar manual en VFP; luego ack o borrar queue duplicada con cuidado.
5. Eliminar carpeta dead-letter tras resolver.

---

## Error 1732 al arrancar Style

No es parte del sync v2 operativo — es problema de build ExportZ.

Ver [STYLE-SUITE-HISTORY.md](STYLE-SUITE-HISTORY.md): no embeber `suite_full_unlock.fxp`, usar ExportZ no Export.

---

## v1 y v2 simultáneos

**Síntoma:** duplicados, acks cruzados, citas fantasma.

**Solución:** parar uno. Solo v2 en producción:

- Sin `suite_full_unlock` en exe
- Sin `C:\SuiteSync`
- Sin `SuiteSync.cfg` activo con timer HTTP

---

## Comandos rápidos

```sql
-- Estado agente
SELECT * FROM dunasoft.style_sync_agent_state;

-- Inbound pendiente
SELECT id, idplan, operation, created_at
FROM dunasoft.style_reservas_queue
WHERE delivered_at IS NULL
ORDER BY created_at DESC LIMIT 20;
```

```foxpro
* Worker manual
DO C:\Style-Dunasoft\PROGS\suite_inbound_worker.prg

* Encolar test
SET PROCEDURE TO suite_cola_sync ADDITIVE
= SuiteEnqueuePlan2009(12345, "UPD")
```

```powershell
# Logs contenedor
docker logs -f style-sync-agent --tail 100
```
