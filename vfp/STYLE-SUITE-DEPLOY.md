# STYLE ↔ SUITE — Despliegue

Guía de despliegue por fases. Ver también [STYLE-SUITE-SYNC-V2-IMPLEMENTACION.md](STYLE-SUITE-SYNC-V2-IMPLEMENTACION.md) para checklists detallados.

---

## Prerrequisitos

| Host | Rol |
|------|-----|
| `192.168.99.16` | VM Style (`\\192.168.99.16\c$\Style-Dunasoft`) |
| `192.168.99.110` | Supabase (`suite-supabase`) |
| Portainer | Contenedor `style-sync-agent` |
| VFP9 IDE | Build manual `mscomctlOk` en ExportZ |

---

## 1. Migraciones SQL (orden)

```powershell
cd C:\Users\OportoW11\Suite\suite
.\scripts\deploy-migration.ps1 20260617190000_style_sync_agent_state.sql
.\scripts\deploy-migration.ps1 20260617193000_style_sync_agent_health.sql
.\scripts\deploy-migration.ps1 20260617200000_style_sync_agent_metrics.sql
```

Las migraciones `20260608*` … `20260610*` de `style_reservas_*` deben estar ya aplicadas.

---

## 2. Build ExportZ (Duna.exe thin)

```powershell
.\scripts\build-style-exportz.ps1
```

VFP9:

```foxpro
SET DEFAULT TO C:\Duna\ExportZ
DO PROGS\VfpCompilePrgs.prg
DO PROGS\VfpBuildProject.prg
```

Post-build:

```powershell
.\scripts\build-style-exportz.ps1 -AfterBuild -DeployTest
```

**Incluir en exe:** `general.prg`, `funciones.prg`, `suite_cola_sync.prg`  
**Excluir:** `suite_full_unlock.prg`

---

## 3. Agente Node (desarrollo)

```powershell
cd style-sync-agent
copy .env.example .env
npm install
npm run dev
```

Variables obligatorias: `SUPABASE_SERVICE_ROLE_KEY`, `COMPANY_ID`, `STYLE_ROOT`.

---

## 4. Worker VFP inbound (VM Style)

```powershell
Copy-Item vfp\suite_inbound_worker.prg \\192.168.99.16\c$\Style-Dunasoft\PROGS\
```

**Task Scheduler** — cada **30–60 s**, siempre:

- Programa: `C:\Program Files (x86)\Microsoft Visual FoxPro 9\vfp9.exe`
- Argumentos: `"C:\Style-Dunasoft\PROGS\suite_inbound_worker.prg"`
- Ejecutar sin sesión de usuario

Crear carpetas si no existen:

```
sync\inbound\
sync\inbound_ack\
sync\archive\
sync\deadletter\
```

---

## 5. Docker / Portainer (LXC Proxmox)

**Arquitectura recomendada:** CIFS montado en el **host Proxmox**, bind al LXC, bind al contenedor.

Documentación: [style-sync-agent/PROXMOX-LXC-CIFS.md](../style-sync-agent/PROXMOX-LXC-CIFS.md)

```bash
# En el LXC (Portainer)
cd style-sync-agent
docker build -t style-sync-agent:0.2.1 .
```

Stack: [docker-compose.snippet.yml](../style-sync-agent/docker-compose.snippet.yml) — volumen:

```yaml
volumes:
  - /mnt/style:/style:rw   # mp0 del LXC apunta aquí
```

Watchdog en host Proxmox: [scripts/proxmox-check-style-mount.sh](../scripts/proxmox-check-style-mount.sh)

Migración lag (añadir a fase 1):

```powershell
.\scripts\deploy-migration.ps1 20260617210000_style_sync_agent_lag.sql
```

Secretos Portainer:

| Variable | Descripción |
|----------|-------------|
| `STYLE_SYNC_SERVICE_ROLE_KEY` | service_role Supabase |
| `STYLE_SYNC_COMPANY_ID` | UUID empresa |

> **No usar** driver `cifs` del volumen Docker dentro de LXC **unprivileged**. Alternativa privilegiada: `docker-compose.snippet.cifs-volume.yml`.

---

## 6. Cutover v1 → v2

1. Parar agente Python `C:\SuiteSync` si existía.
2. Desactivar timer HTTP (`suite_full_unlock` no en exe).
3. Desplegar migraciones + agente Docker + worker.
4. Validar E2E en test.
5. Desplegar `Duna.exe` ExportZ en producción.

**Rollback:** exe Z original + reactivar v1; parar contenedor agente.

---

## 7. Verificación post-despliegue

```sql
SELECT company_id, last_cola_id, last_outbound_ok_at, last_inbound_ok_at,
       inbound_worker_status, agent_version, worker_version,
       outbound_errors, inbound_errors, last_error
FROM dunasoft.style_sync_agent_state;
```

- Contenedor `running`, logs sin errores RPC repetidos.
- `heartbeat.txt` actualizado cada minuto.
- `inbound_worker_status = 'ok'`.
