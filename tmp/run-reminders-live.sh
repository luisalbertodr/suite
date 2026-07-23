#!/bin/bash
set -uo pipefail
ENV_FILE=/root/supabase-project/.env
read_env() {
  local key="$1"
  local line
  line="$(grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | tail -1 || true)"
  [[ -z "$line" ]] && { echo ""; return; }
  echo "${line#*=}" | sed 's/^["'\'' ]*//; s/["'\'' ]*$//'
}
SECRET="$(read_env WHATSAPP_AUTOMATION_CRON_SECRET)"
[[ -z "$SECRET" ]] && SECRET="$(read_env SERVICE_MONITOR_CRON_SECRET)"
CODE=$(curl -sS -o /tmp/wa_send_out.json -w '%{http_code}' -X POST \
  'https://supabase.lipoout.com/functions/v1/whatsapp-automation' \
  -H 'Content-Type: application/json' \
  -H "x-automation-secret: ${SECRET}" \
  -d '{"action":"run_reminders"}' || echo fail)
echo "http=$CODE"
python3 - <<'PY'
import json
d=json.load(open('/tmp/wa_send_out.json'))
cid='5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
print(json.dumps(d.get('summary',{}).get(cid), indent=2, ensure_ascii=False))
PY
