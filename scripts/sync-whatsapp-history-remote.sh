#!/bin/bash
set -euo pipefail

SERVICE_KEY="$(docker exec supabase-edge-functions printenv SUPABASE_SERVICE_ROLE_KEY)"
SUPABASE_URL="$(docker exec supabase-edge-functions printenv SUPABASE_URL)"
COMPANY_ID="$(docker exec supabase-db psql -U postgres -d postgres -t -A -c "SELECT company_id FROM whatsapp_config WHERE enabled = true LIMIT 1;")"

if [ -z "$COMPANY_ID" ]; then
  echo "No hay whatsapp_config activa" >&2
  exit 1
fi

ENDPOINT="${SUPABASE_URL%/}/functions/v1/whatsapp-proxy"
offset=0
total=0
batch=0

while [ "$batch" -lt 40 ]; do
  refresh="false"
  if [ "$offset" -eq 0 ]; then refresh="true"; fi

  payload=$(printf '{"action":"messages.sync_history","company_id":"%s","limit_per_chat":200,"max_chats":25,"offset":%s,"refresh_chats":%s}' \
    "$COMPANY_ID" "$offset" "$refresh")

  resp=$(curl -sS -X POST "$ENDPOINT" \
    -H "Authorization: Bearer ${SERVICE_KEY}" \
    -H "Content-Type: application/json" \
    -d "$payload")

  echo "$resp"

  messages=$(echo "$resp" | sed -n 's/.*"messages":\([0-9][0-9]*\).*/\1/p' | head -1)
  messages=${messages:-0}
  total=$((total + messages))

  next=$(echo "$resp" | sed -n 's/.*"next_offset":\([0-9][0-9]*\).*/\1/p' | head -1)
  if [ -z "$next" ]; then
    break
  fi
  offset=$next
  batch=$((batch + 1))
done

echo "OK total_messages=$total company_id=$COMPANY_ID"
