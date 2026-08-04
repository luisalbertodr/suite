#!/bin/bash
# Ejecutar cada minuto desde crontab en el servidor Supabase (110).
set -euo pipefail

ENV_FILE="${SUITE_SUPABASE_ENV:-/root/supabase-project/.env}"
LOG=/var/log/suite-service-monitor.log
RECOVER_SCRIPT="${WAHA_RECOVER_SCRIPT:-/usr/local/bin/suite-waha-recover.sh}"

read_env() {
  local key="$1"
  local default="${2:-}"
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "$default"
    return
  fi
  local line
  line="$(grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | tail -1 || true)"
  if [[ -z "$line" ]]; then
    echo "$default"
    return
  fi
  echo "${line#*=}" | sed 's/^["'\'' ]*//; s/["'\'' ]*$//'
}

URL="$(read_env SUPABASE_URL 'https://supabase.lipoout.com')/functions/v1/service-health-monitor"
SECRET="$(read_env SERVICE_MONITOR_CRON_SECRET '')"

if [[ -z "$SECRET" ]]; then
  echo "$(date -Is) SERVICE_MONITOR_CRON_SECRET vacío" >> "$LOG"
  exit 1
fi

RESP_FILE="$(mktemp)"
trap 'rm -f "$RESP_FILE"' EXIT

HTTP_CODE="$(curl -sS -o "$RESP_FILE" -w "%{http_code}" -X POST "$URL" \
  -H "Content-Type: application/json" \
  -H "x-monitor-secret: ${SECRET}" \
  -d '{"source":"cron","run_recovery":true}' \
  || echo "000")"

{
  echo "$(date -Is) HTTP ${HTTP_CODE}"
  cat "$RESP_FILE"
  echo
} >> "$LOG"

# Fallback local: si el monitor pide recuperación de host y el agente HTTP no arrancó,
# ejecuta el script directamente (tiene cooldown propio).
if [[ -x "$RECOVER_SCRIPT" ]] && [[ "$HTTP_CODE" == "200" ]]; then
  if grep -q '"host_recovery_needed"[[:space:]]*:[[:space:]]*true' "$RESP_FILE"; then
    if ! grep -q '"host_recovery_started"[[:space:]]*:[[:space:]]*true' "$RESP_FILE"; then
      echo "$(date -Is) Fallback host: suite-waha-recover.sh" >> "$LOG"
      "$RECOVER_SCRIPT" >> "$LOG" 2>&1 || true
    fi
  fi
fi
