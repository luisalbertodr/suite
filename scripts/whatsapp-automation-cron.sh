#!/bin/bash
# Recordatorios WhatsApp de citas — cada 5 min en servidor Supabase (110).
set -euo pipefail

ENV_FILE="${SUITE_SUPABASE_ENV:-/root/supabase-project/.env}"
LOG=/var/log/suite-whatsapp-automation.log

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

URL="$(read_env SUPABASE_URL 'https://supabase.lipoout.com')/functions/v1/whatsapp-automation"
SECRET="$(read_env WHATSAPP_AUTOMATION_CRON_SECRET '')"
if [[ -z "$SECRET" ]]; then
  SECRET="$(read_env SERVICE_MONITOR_CRON_SECRET '')"
fi

if [[ -z "$SECRET" ]]; then
  echo "$(date -Is) WHATSAPP_AUTOMATION_CRON_SECRET vacío" >> "$LOG"
  exit 1
fi

curl -sS -X POST "$URL" \
  -H "Content-Type: application/json" \
  -H "x-automation-secret: ${SECRET}" \
  -d '{"action":"run_reminders","source":"cron"}' \
  >> "$LOG" 2>&1
echo "" >> "$LOG"
