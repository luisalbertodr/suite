#!/bin/bash
# Ejecutar cada minuto desde crontab en el servidor Supabase (110).
set -euo pipefail

ENV_FILE="${SUITE_SUPABASE_ENV:-/root/supabase-project/.env}"
LOG=/var/log/suite-service-monitor.log

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

curl -sS -X POST "$URL" \
  -H "Content-Type: application/json" \
  -H "x-monitor-secret: ${SECRET}" \
  -d '{"source":"cron","run_recovery":true}' \
  >> "$LOG" 2>&1
echo "" >> "$LOG"
