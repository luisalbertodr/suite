# Spotify Connect → salida física Proxmox (clínica)

Stack Portainer **#88** (`spotifyd`) en el LXC `portainer` / CT **701** (`192.168.99.110`).

## Arquitectura

```
App Spotify (móvil/PC)
        │  Spotify Connect
        ▼
  spotifyd (Docker, ALSA)
        │
  LXC 701  (/dev/snd)
        │
  Host Proxmox 192.168.99.9  → jack / HDMI → altavoces clínica
```

Requiere **Spotify Premium**.

## Estado del arreglo

1. En el LXC ya está el compose/conf con backend **ALSA** y nombre `Clinica-Lipoout`.
2. Hace falta **una vez** en el host Proxmox abrir permisos de `/dev/snd` para el CT unprivileged.

## Aplicar en el host (Shell Proxmox)

UI: `https://192.168.99.9:8006` → Shell del nodo, o SSH como root:

```bash
# Opción A: copiar desde el LXC (si hay clave SSH al 110)
scp root@192.168.99.110:/root/fix-spotifyd-alsa-on-proxmox-host.sh /tmp/fix-spotifyd-audio.sh
bash /tmp/fix-spotifyd-audio.sh
```

O pegar/ejecutar `scripts/spotifyd/fix-proxmox-host-audio.sh` de este repo.

## Uso diario

1. Mismo Wi‑Fi/LAN que `192.168.99.110`.
2. App Spotify → icono de altavoz → **Clinica-Lipoout**.
3. Volumen: app Spotify + `amixer` en el host si hace falta.

## Ficheros

| Ruta | Rol |
|------|-----|
| `docker-compose.yml` | Stack Portainer #88 |
| `spotifyd.conf` | Config ALSA montada en el contenedor |
| `fix-proxmox-host-audio.sh` | Arreglo de permisos + recreate en CT 701 |
