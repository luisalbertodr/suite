#!/bin/bash
# Actualiza WAHA a 2026.8.1 y aplica env recomendadas (Prometheus + media).
# Ejecutar en el host Portainer (192.168.99.110) como root.
set -euo pipefail

CONTAINER="${WAHA_CONTAINER:-waha-worker-1}"
IMAGE="${WAHA_IMAGE:-devlikeapro/waha:2026.8.1}"
ENV_FILE="${WAHA_ENV_FILE:-/var/lib/suite/waha-worker.env}"
HOST_PORT="${WAHA_HOST_PORT:-3333}"
VOLUME="${WAHA_VOLUME:-waha_waha-data-worker-1:/app/.sessions}"
NETWORK="${WAHA_NETWORK:-waha_default}"
EXTRA_NETWORKS="${WAHA_EXTRA_NETWORKS:-supabase_default}"

upsert_env() {
  local key="$1"
  local val="$2"
  local tmp
  tmp="$(mktemp)"
  if [[ -f "$ENV_FILE" ]]; then
    grep -v "^${key}=" "$ENV_FILE" > "$tmp" || true
  fi
  printf '%s=%s\n' "$key" "$val" >> "$tmp"
  mv "$tmp" "$ENV_FILE"
}

echo "=== Snapshot env actual ==="
if docker inspect "$CONTAINER" >/dev/null 2>&1; then
  docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$CONTAINER" > "$ENV_FILE"
  echo "Guardado en $ENV_FILE"
else
  echo "Contenedor $CONTAINER no encontrado; usando $ENV_FILE existente"
fi

echo "=== Añadiendo vars WAHA 2026.8 ==="
upsert_env WAHA_PROMETHEUS_ENABLED "True"
upsert_env WAHA_EVENTS_DOWNLOAD_MEDIA "true"
upsert_env WAHA_EVENTS_DOWNLOAD_MEDIA_MIMETYPES "audio,image/png,image/jpeg,image/webp"
upsert_env WAHA_API_DOWNLOAD_MEDIA "true"
upsert_env WAHA_API_DOWNLOAD_MEDIA_MIMETYPES "image,image/webp"

echo "=== Pull $IMAGE ==="
docker pull "$IMAGE"

echo "=== Recrear contenedor ==="
export WAHA_IMAGE="$IMAGE"
export WAHA_ENV_FILE="$ENV_FILE"
export WAHA_CONTAINER="$CONTAINER"
export WAHA_HOST_PORT="$HOST_PORT"
export WAHA_VOLUME="$VOLUME"
export WAHA_NETWORK="$NETWORK"
export WAHA_EXTRA_NETWORKS="$EXTRA_NETWORKS"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$SCRIPT_DIR/suite-waha-recover.sh" --force

echo "=== OK: WAHA $IMAGE desplegado ==="
docker inspect "$CONTAINER" --format 'Image={{.Config.Image}} Status={{.State.Status}}'
