#!/bin/bash
# Watchdog CIFS Style → reinicio agente si el montaje se recupera.
# Instalar en host Proxmox: /usr/local/bin/check-style-mount.sh
#
# Cron: * * * * * /usr/local/bin/check-style-mount.sh >> /var/log/style-mount.log 2>&1

set -euo pipefail

MOUNT_POINT="${STYLE_SYNC_MOUNT_POINT:-/mnt/style-sync}"
DOCKER_CONTAINER="${STYLE_SYNC_DOCKER_CONTAINER:-style-sync-agent}"
LOG_PREFIX="$(date -Iseconds)"

if mountpoint -q "${MOUNT_POINT}"; then
  exit 0
fi

echo "${LOG_PREFIX}: CIFS caído en ${MOUNT_POINT}, reintentando mount -a..."

if mount -a 2>/dev/null || true; then
  :
fi

if mountpoint -q "${MOUNT_POINT}"; then
  echo "${LOG_PREFIX}: Montaje recuperado"
  if command -v docker >/dev/null 2>&1; then
    if docker ps -a --format '{{.Names}}' | grep -qx "${DOCKER_CONTAINER}"; then
      docker restart "${DOCKER_CONTAINER}" || true
      echo "${LOG_PREFIX}: docker restart ${DOCKER_CONTAINER}"
    fi
  fi
else
  echo "${LOG_PREFIX}: ERROR - No se pudo montar CIFS en ${MOUNT_POINT}"
  exit 1
fi
