#!/bin/bash
set -euo pipefail
KEY=$(docker inspect waha-worker-1 --format '{{range .Config.Env}}{{println .}}{{end}}' | grep '^WAHA_API_KEY=' | cut -d= -f2-)
CHAT='34667435503@c.us'

echo '==== WAHA last messages ===='
curl -sS -H "X-Api-Key: $KEY" \
  "http://127.0.0.1:3333/api/default/chats/${CHAT}/messages?limit=12" \
  | python3 -c '
import json,sys,datetime
data=json.load(sys.stdin)
if isinstance(data, dict):
  msgs=data.get("messages") or data.get("data") or []
else:
  msgs=data
for m in msgs[:12]:
  body=(m.get("body") or m.get("text") or "")[:70]
  ts=m.get("timestamp") or m.get("messageTimestamp")
  fm=m.get("fromMe")
  mid=(m.get("id") or {}).get("_serialized") if isinstance(m.get("id"),dict) else m.get("id")
  print(f"{ts}\tfromMe={fm}\t{mid}\t{body!r}")
'

echo '==== DB last messages same chat ===='
docker exec -i supabase-db psql -U postgres -c "
SELECT left(coalesce(body,''),70) AS body, from_me, timestamp, created_at, waha_message_id
FROM whatsapp_messages
WHERE chat_id='34667435503@c.us'
ORDER BY timestamp DESC
LIMIT 12;
"

echo '==== recent message events in waha log ===='
docker logs --since 20m waha-worker-1 2>&1 | grep -E 'event\":\"message\"|Sending POST.*event\":\"message\"|status code: [45]|error' | tail -40

echo '==== kong uptime / edge ===='
docker ps --format '{{.Names}} {{.Status}}' | grep -iE 'kong|edge'
