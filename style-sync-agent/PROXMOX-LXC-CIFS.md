# CIFS en LXC unprivileged (Proxmox) — bind mount desde el host

**Recomendado** cuando el agente corre en Docker dentro de un **LXC unprivileged** en Proxmox.  
El montaje CIFS lo hace el **host Proxmox**; el LXC solo recibe un bind mount. Docker monta esa ruta en `/style`.

```
VM Style (192.168.99.16)                    Proxmox host              LXC (Portainer)           Contenedor
//192.168.99.16/c$/Style-Dunasoft  ──CIFS──►  /mnt/style-sync  ──mp0──►  /mnt/style  ──bind──►  /style
```

> **No uses** el driver `cifs` del volumen Docker dentro de LXC unprivileged (suele fallar por permisos/capabilities).  
> Alternativa legacy (solo LXC privilegiado o VM): [docker-compose.snippet.cifs-volume.yml](docker-compose.snippet.cifs-volume.yml).

---

## 1. Host Proxmox

Sustituye IP, usuario y contraseña por los reales de tu red.

```bash
# cifs-utils
apt update && apt install -y cifs-utils

mkdir -p /mnt/style-sync
mkdir -p /etc/samba/creds
chmod 700 /etc/samba/creds

cat > /etc/samba/creds/style <<'EOF'
username=StyleSync
password=REEMPLAZAR_PASSWORD
domain=WORKGROUP
EOF
chmod 600 /etc/samba/creds/style

# Montaje manual (probar antes de fstab)
mount -t cifs //192.168.99.16/c$/Style-Dunasoft /mnt/style-sync \
  -o credentials=/etc/samba/creds/style,iocharset=utf8,vers=3.0,noserverino,uid=100000,gid=100000,file_mode=0664,dir_mode=0775

ls -la /mnt/style-sync/cola_sincro.dbf
ls -la /mnt/style-sync/sync/
```

### fstab (permanente)

```fstab
//192.168.99.16/c$/Style-Dunasoft /mnt/style-sync cifs credentials=/etc/samba/creds/style,iocharset=utf8,vers=3.0,noserverino,_netdev,uid=100000,gid=100000,file_mode=0664,dir_mode=0775 0 0
```

`uid=100000,gid=100000` corresponde al **root del LXC unprivileged** (UID 0 interno → 100000 en host). Ajusta si tu LXC usa otro rango (`grep lxc.idmap` en la config del CT).

### Permisos en el host

Opción A (recomendada): `chown` al UID mapeado del contenedor:

```bash
chown -R 100000:100000 /mnt/style-sync
```

Opción B (solo test): `chmod 777 /mnt/style-sync` — menos seguro.

---

## 2. Configuración LXC (`/etc/pve/lxc/<CTID>.conf`)

Añadir (ajusta `CTID` y rutas):

```text
# Bind mount CIFS (host → LXC)
mp0: /mnt/style-sync,mp=/mnt/style

# Docker dentro del LXC
features: nesting=1,keyctl=1
```

Reiniciar el CT tras editar:

```bash
pct stop <CTID> && pct start <CTID>
```

Dentro del LXC, verificar:

```bash
ls -la /mnt/style/cola_sincro.dbf
```

---

## 3. Stack Portainer / Docker Compose

Usar [docker-compose.snippet.yml](docker-compose.snippet.yml) — volumen **bind**, no CIFS:

```yaml
volumes:
  - /mnt/style:/style:rw
```

Variables de entorno: `STYLE_ROOT=/style` (ya en el snippet).

Build y despliegue:

```bash
cd /ruta/al/repo/style-sync-agent
docker build -t style-sync-agent:0.2.1 .
# En Portainer: stack con snippet + secretos STYLE_SYNC_*
```

Secretos Portainer:

| Variable | Descripción |
|----------|-------------|
| `STYLE_SYNC_SERVICE_ROLE_KEY` | `service_role` Supabase |
| `STYLE_SYNC_COMPANY_ID` | UUID empresa Dunasoft |

---

## 4. Watchdog de montaje (host Proxmox)

Copiar desde el repo:

```bash
install -m 755 /ruta/scripts/proxmox-check-style-mount.sh /usr/local/bin/check-style-mount.sh
```

Cron (cada minuto):

```cron
* * * * * /usr/local/bin/check-style-mount.sh >> /var/log/style-mount.log 2>&1
```

El script reintenta `mount -a` y opcionalmente reinicia el contenedor `style-sync-agent` si el montaje se recuperó.

Variable opcional en el host:

```bash
export STYLE_SYNC_DOCKER_CONTAINER=style-sync-agent
```

---

## 5. Verificación post-despliegue

Dentro del contenedor:

```bash
docker exec -it style-sync-agent ls -la /style/cola_sincro.dbf
docker exec -it style-sync-agent ls -la /style/sync/
docker logs -f style-sync-agent
```

Logs esperados: `Style sync agent v0.2.1 — root=/style`, ticks sin `tick omitido (CIFS/DBF)` persistente.

Postgres:

```sql
SELECT last_cola_id, agent_last_tick_at, inbound_worker_status,
       last_outbound_lag_ms, last_inbound_lag_ms
FROM dunasoft.style_sync_agent_state;
```

---

## 6. Troubleshooting rápido

| Síntoma | Acción |
|---------|--------|
| `Permission denied` en `/style` | Revisar `uid/gid` en mount y `chown 100000:100000` en host |
| `mount error(13)` | Credenciales SMB o cuenta sin acceso a `c$` |
| CIFS caído tras reboot host | `mount -a`; revisar `_netdev` en fstab |
| Agente `tick omitido (CIFS/DBF)` | Host: `mountpoint /mnt/style-sync`; LXC: `ls /mnt/style`; reiniciar contenedor |
| Docker no arranca en LXC | Añadir `features: nesting=1,keyctl=1` |

Ver también [STYLE-SUITE-TROUBLESHOOTING.md](../vfp/STYLE-SUITE-TROUBLESHOOTING.md).

---

## 7. Cuenta SMB sugerida en VM Style (192.168.99.16)

Crear usuario local `StyleSync` (o el nombre que uses) con:

- Lectura/escritura en `C:\Style-Dunasoft` y subcarpetas `sync\`
- **Sin** necesidad de admin; solo permisos NTFS en esa carpeta

Compartir vía `c$` administrativo o carpeta dedicada `\\192.168.99.16\StyleSync` (ajustar `device` en mount).
