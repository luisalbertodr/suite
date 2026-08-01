#!/bin/bash
# Recupera WAHA con el procedimiento validado:
#   docker pull + recreate del contenedor (misma env/volumen/puerto).
# Un simple restart NO basta cuando WhatsApp rechaza el protocolo (405 / STARTING eterno).
set -euo pipefail

CONTAINER="${WAHA_CONTAINER:-waha-worker-1}"
IMAGE="${WAHA_IMAGE:-devlikeapro/waha:latest}"
HOST_PORT="${WAHA_HOST_PORT:-3333}"
VOLUME="${WAHA_VOLUME:-waha_waha-data-worker-1:/app/.sessions}"
NETWORK="${WAHA_NETWORK:-waha_default}"
EXTRA_NETWORKS="${WAHA_EXTRA_NETWORKS:-supabase_default}"
STATE_DIR="${WAHA_STATE_DIR:-/var/lib/suite}"
ENV_FILE="${WAHA_ENV_FILE:-$STATE_DIR/waha-worker.env}"
LOCK_FILE="${WAHA_LOCK_FILE:-/var/lock/suite-waha-recover.lock}"
COOLDOWN_MIN="${WAHA_RECOVER_COOLDOWN_MIN:-30}"
LOG="${WAHA_RECOVER_LOG:-/var/log/suite-waha-recover.log}"
WAIT_SECS="${WAHA_RECOVER_WAIT_SECS:-90}"

mkdir -p "$STATE_DIR"
touch "$LOG"

log() {
  echo "$(date -Is) $*" | tee -a "$LOG"
}

in_cooldown() {
  local stamp_file="$STATE_DIR/waha-last-recover"
  [[ -f "$stamp_file" ]] || return 1
  local last now diff
  last="$(cat "$stamp_file" 2>/dev/null || echo 0)"
  now="$(date +%s)"
  diff=$((now - last))
  [[ "$diff" -lt $((COOLDOWN_MIN * 60)) ]]
}

acquire_lock() {
  if command -v flock >/dev/null 2>&1; then
    exec 9>"$LOCK_FILE"
    flock -n 9 || {
      log "Ya hay una recuperación en curso (lock)."
      exit 0
    }
  fi
}

snapshot_env() {
  if docker inspect "$CONTAINER" >/dev/null 2>&1; then
    docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$CONTAINER" > "$ENV_FILE.tmp"
    if [[ -s "$ENV_FILE.tmp" ]]; then
      mv -f "$ENV_FILE.tmp" "$ENV_FILE"
      log "Env snapshot guardado en $ENV_FILE ($(wc -l < "$ENV_FILE") vars)"
    else
      rm -f "$ENV_FILE.tmp"
    fi
  fi
  if [[ ! -s "$ENV_FILE" ]]; then
    log "ERROR: no hay env file usable ($ENV_FILE)"
    exit 1
  fi
}

wait_working() {
  local i status
  for i in $(seq 1 "$WAIT_SECS"); do
    if docker exec supabase-db psql -U postgres -d postgres -tAc \
      "SELECT last_status FROM whatsapp_config WHERE enabled LIMIT 1;" 2>/dev/null \
      | grep -qx 'WORKING'; then
      return 0
    fi
    # Fallback: logs recientes
    if docker logs --since 20s "$CONTAINER" 2>&1 | grep -q 'session.status.*"WORKING"\|status.:.WORKING\|WORKING'; then
      # confirmar vía API interna no siempre posible; si BD no actualiza aún, dar margen
      :
    fi
    sleep 1
  done
  status="$(docker exec supabase-db psql -U postgres -d postgres -tAc \
    "SELECT last_status FROM whatsapp_config WHERE enabled LIMIT 1;" 2>/dev/null | tr -d '[:space:]' || true)"
  log "Tras espera estado BD=$status"
  [[ "$status" == "WORKING" ]]
}

recreate_container() {
  local restart_policy
  restart_policy="$(docker inspect -f '{{.HostConfig.RestartPolicy.Name}}' "$CONTAINER" 2>/dev/null || echo unless-stopped)"
  [[ -n "$restart_policy" ]] || restart_policy=unless-stopped

  log "Pull $IMAGE ..."
  docker pull "$IMAGE"

  log "Recreando $CONTAINER (puerto $HOST_PORT, red $NETWORK) ..."
  docker stop "$CONTAINER" >/dev/null 2>&1 || true
  docker rm "$CONTAINER" >/dev/null 2>&1 || true

  docker run -d \
    --name "$CONTAINER" \
    --restart "$restart_policy" \
    --env-file "$ENV_FILE" \
    -p "${HOST_PORT}:3000" \
    -v "$VOLUME" \
    --label com.docker.compose.project=waha \
    --label com.docker.compose.service=waha-worker-1 \
    --label io.suite.waha.recovered="$(date -Is)" \
    --network "$NETWORK" \
    "$IMAGE" >/dev/null

  local net
  for net in $EXTRA_NETWORKS; do
    [[ -n "$net" ]] || continue
    docker network connect "$net" "$CONTAINER" 2>/dev/null || true
  done
}

main() {
  acquire_lock

  if [[ "${1:-}" != "--force" ]] && in_cooldown; then
    log "Cooldown activo (${COOLDOWN_MIN} min). Usa --force para saltarlo."
    exit 0
  fi

  log "=== Inicio recuperación WAHA ($CONTAINER) ==="
  snapshot_env
  recreate_container
  date +%s > "$STATE_DIR/waha-last-recover"

  log "Esperando sesión WORKING (hasta ${WAIT_SECS}s) ..."
  if wait_working; then
    log "OK: WAHA recuperado (WORKING)"
    exit 0
  fi

  log "AVISO: contenedor recreado pero sesión aún no WORKING"
  exit 2
}

main "$@"
