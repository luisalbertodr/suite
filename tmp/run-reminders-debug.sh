#!/bin/bash
set -uo pipefail
sleep 2
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
echo "secret_len=${#SECRET}"
CODE=$(curl -sS -o /tmp/wa_cron_out.json -w '%{http_code}' -X POST \
  'https://supabase.lipoout.com/functions/v1/whatsapp-automation' \
  -H 'Content-Type: application/json' \
  -H "x-automation-secret: ${SECRET}" \
  -d '{"action":"run_reminders"}' || echo fail)
echo "http=$CODE"
python3 - <<'PY'
import json
try:
  d=json.load(open('/tmp/wa_cron_out.json'))
except Exception as e:
  print('parse_error', e)
  print(open('/tmp/wa_cron_out.json').read()[:500])
  raise
cid='5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
print(json.dumps(d.get('summary',{}).get(cid), indent=2, ensure_ascii=False))
PY
