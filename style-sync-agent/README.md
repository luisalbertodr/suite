# Style Sync Agent (Node.js)

Agente local entre **Style Dunasoft** (`cola_sincro.dbf` + DBF) y **Supabase Suite**.

## Por qué

- VFP9 solo encola eventos locales (rápido, sin red).
- Node hace polling, transformación JSON y Realtime.
- Si Supabase está caído, Style sigue guardando en la cola.

## Inicio rápido

```powershell
cd style-sync-agent
copy .env.example .env
# Editar SUPABASE_SERVICE_ROLE_KEY, COMPANY_ID, STYLE_ROOT
npm install
npm run dev
```

## VFP (Style)

Tras guardar una cita:

```foxpro
SET PROCEDURE TO suite_cola_sync ADDITIVE
= SuiteEnqueuePlan2009(plan2009.idplan, "UPD")
```

Ver `vfp/suite_cola_sync.prg`.

## Docker / Portainer

### LXC unprivileged en Proxmox (recomendado)

CIFS en el **host Proxmox** + bind mount al LXC + bind Docker `/mnt/style` → `/style`.

Guía completa: **[PROXMOX-LXC-CIFS.md](PROXMOX-LXC-CIFS.md)**  
Compose: **[docker-compose.snippet.yml](docker-compose.snippet.yml)** (bind mount)

Resumen:

1. Host: `mount //192.168.99.16/c$/Style-Dunasoft` → `/mnt/style-sync` + fstab
2. LXC: `mp0: /mnt/style-sync,mp=/mnt/style` + `features: nesting=1,keyctl=1`
3. Stack: volumen `/mnt/style:/style:rw`, `STYLE_ROOT=/style`
4. Watchdog host: `scripts/proxmox-check-style-mount.sh` (cron cada minuto)

### Alternativa (CIFS directo en Docker)

Solo LXC/VM **privilegiada**: [docker-compose.snippet.cifs-volume.yml](docker-compose.snippet.cifs-volume.yml)

### Secretos Portainer

| Variable | Descripción |
|----------|-------------|
| `STYLE_SYNC_SERVICE_ROLE_KEY` | service_role Supabase |
| `STYLE_SYNC_COMPANY_ID` | UUID empresa |

El contenedor escribe inbound como JSON en:

- `sync/inbound/*.json`
- lee confirmaciones en `sync/inbound_ack/*.ok`
- archiva procesados en `sync/archive/YYYY-MM-DD/`
- monitoriza `sync/heartbeat.txt` del worker VFP

## Resiliencia operativa

| Escenario | Comportamiento |
|-----------|----------------|
| JSON/.ok acumulados | Tras `style_reservas_ack` OK, el agente mueve JSON y `.ok` a `sync/archive/YYYY-MM-DD/` |
| JSON huérfanos >24h | Movidos a `sync/archive/failed/` |
| Microcorte CIFS | Reintentos con backoff (`FS_RETRY_*`); el contenedor no crashea |
| `cola_sincro.dbf` bloqueado | Mismo backoff al leer (VFP en `APPEND BLANK`) |
| Worker VFP caído | `heartbeat.txt` >5 min → `inbound_worker_status='stopped'` |
| N fallos RPC | `sync/deadletter/{outbound|inbound}/` → revisión manual |

Variables: `DEADLETTER_DIR`, `OUTBOUND_MAX_RETRIES`, `INBOUND_ACK_MAX_RETRIES`.

Ver [STYLE-SUITE-OPERATIONS.md](../vfp/STYLE-SUITE-OPERATIONS.md).

## Inbound (Suite -> Style) con worker VFP

El agente **no escribe** `plan2009.dbf` desde Linux. En su lugar:

1. El agente escribe JSONs en `sync/inbound/`.
2. Un worker VFP en la VM procesa esos JSONs y escribe DBF con locks nativos.
3. El worker genera `sync/inbound_ack/{queue_id}.ok` con este formato:

```text
idand=<n>;idplan=<n>;macand=<s>;ok=1;version=<n>;applied=<0|1>
```

Worker de referencia en repo: `vfp/suite_inbound_worker.prg`.

Programar en Task Scheduler **cada 30–60 s** (aunque no haya JSON), para mantener `heartbeat.txt` fresco:

```text
vfp9.exe "C:\Style-Dunasoft\PROGS\suite_inbound_worker.prg"
```

Log de errores: `sync/inbound_worker.log`

## Estado

- [x] Esqueleto agente + Realtime subscribe
- [x] Lector DBF `cola_sincro` (dbf-reader)
- [x] Outbound cola → RPC `style_reservas_apply_from_style`
- [x] Inbound queue → `sync/inbound/*.json` + ack → RPC `style_reservas_ack`
