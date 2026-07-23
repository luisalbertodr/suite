#!/bin/bash
set -euo pipefail
echo '==== containers ===='
docker ps --format '{{.Names}}\t{{.Status}}' | grep -iE 'waha|edge|kong' || true

echo '==== waha env (redacted) ===='
docker inspect waha-worker-1 --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -iE 'WEBHOOK|WAHA_' | sed -E 's/(KEY|SECRET|TOKEN)=.*/\1=***/'

echo '==== waha recent logs ===='
docker logs --tail 150 waha-worker-1 2>&1 | tail -80

echo '==== session status via curl ===='
KEY=$(docker inspect waha-worker-1 --format '{{range .Config.Env}}{{println .}}{{end}}' | grep '^WAHA_API_KEY=' | cut -d= -f2-)
curl -sS -H "X-Api-Key: $KEY" "http://127.0.0.1:3333/api/sessions/default" | head -c 1200
echo
echo '==== webhook ping ===='
# get secret from db
SECRET=$(docker exec supabase-db psql -U postgres -tAc "select webhook_secret from whatsapp_config limit 1")
curl -sS -w "\nhttp=%{http_code}\n" -X POST "http://127.0.0.1:8000/functions/v1/whatsapp-webhook" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: $SECRET" \
  -d '{"event":"session.status","session":"default","payload":{"status":"WORKING"}}' | tail -c 500
