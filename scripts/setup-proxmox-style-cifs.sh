#!/bin/bash
# Ejecutar en el HOST Proxmox (192.168.99.9) como root.
# Monta Style vía CIFS y configura bind mount al LXC de Portainer/Supabase (110).
set -euo pipefail

STYLE_VM="${STYLE_VM:-192.168.99.16}"
STYLE_SHARE="${STYLE_SHARE:-//${STYLE_VM}/c\$}"
STYLE_SUBDIR="${STYLE_SUBDIR:-Style-Dunasoft}"
MOUNT_POINT="${MOUNT_POINT:-/mnt/style-sync}"
CRED_FILE="${CRED_FILE:-/etc/samba/creds/style}"
LXC_CTID="${LXC_CTID:-}"
LXC_MP="${LXC_MP:-/mnt/style}"
MAP_UID="${MAP_UID:-100000}"
MAP_GID="${MAP_GID:-100000}"

echo "=== setup-proxmox-style-cifs ==="

if ! command -v mount.cifs >/dev/null 2>&1; then
  apt-get update -qq
  apt-get install -y cifs-utils
fi

mkdir -p "$MOUNT_POINT" /etc/samba/creds
chmod 700 /etc/samba/creds

if [[ ! -f "$CRED_FILE" ]]; then
  echo "Crea $CRED_FILE con username/password (cuenta SMB con acceso a Style-Dunasoft)."
  echo "Ejemplo:"
  echo "  username=Lipoout"
  echo "  password=TU_PASSWORD"
  echo "  domain="
  exit 1
fi
chmod 600 "$CRED_FILE"

MOUNT_ROOT="${MOUNT_ROOT:-/mnt/style-cifs-root}"
mkdir -p "$MOUNT_ROOT" "$MOUNT_POINT"

if mountpoint -q "$MOUNT_ROOT"; then umount "$MOUNT_ROOT" || true; fi
if mountpoint -q "$MOUNT_POINT"; then umount "$MOUNT_POINT" || true; fi

mount -t cifs "$STYLE_SHARE" "$MOUNT_ROOT" \
  -o "credentials=${CRED_FILE},iocharset=utf8,vers=3.0,noserverino,uid=${MAP_UID},gid=${MAP_GID},file_mode=0664,dir_mode=0775"

mount --bind "${MOUNT_ROOT}/${STYLE_SUBDIR}" "$MOUNT_POINT"

ls -la "$MOUNT_POINT/cola_sincro.dbf" "$MOUNT_POINT/dbf/PLAN2009.DBF"

FSTAB_LINE="${STYLE_SHARE} ${MOUNT_ROOT} cifs credentials=${CRED_FILE},iocharset=utf8,vers=3.0,noserverino,_netdev,uid=${MAP_UID},gid=${MAP_GID},file_mode=0664,dir_mode=0775 0 0"
BIND_LINE="${MOUNT_ROOT}/${STYLE_SUBDIR} ${MOUNT_POINT} none bind 0 0"
if ! grep -qF "$MOUNT_ROOT" /etc/fstab 2>/dev/null; then
  echo "$FSTAB_LINE" >> /etc/fstab
  echo "$BIND_LINE" >> /etc/fstab
  echo "Añadido a /etc/fstab"
fi

chown -R "${MAP_UID}:${MAP_GID}" "$MOUNT_POINT" || true

if [[ -n "$LXC_CTID" ]]; then
  CONF="/etc/pve/lxc/${LXC_CTID}.conf"
  if [[ -f "$CONF" ]]; then
    grep -q "mp0: ${MOUNT_POINT},mp=${LXC_MP}" "$CONF" || echo "mp0: ${MOUNT_POINT},mp=${LXC_MP}" >> "$CONF"
    grep -q 'features: nesting=1' "$CONF" || echo 'features: nesting=1,keyctl=1' >> "$CONF"
    echo "Config LXC ${LXC_CTID} actualizada. Reinicia: pct stop ${LXC_CTID} && pct start ${LXC_CTID}"
  else
    echo "AVISO: no existe $CONF — indica LXC_CTID correcto"
  fi
fi

SCRIPT_SRC="$(dirname "$0")/proxmox-check-style-mount.sh"
if [[ -f "$SCRIPT_SRC" ]]; then
  install -m 755 "$SCRIPT_SRC" /usr/local/bin/check-style-mount.sh
  echo "Watchdog: /usr/local/bin/check-style-mount.sh"
  echo "Cron sugerido: * * * * * /usr/local/bin/check-style-mount.sh >> /var/log/style-mount.log 2>&1"
fi

echo "OK — CIFS montado en ${MOUNT_POINT}"
