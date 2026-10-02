#!/bin/bash
# Reinicia ble-scale-sync SOLO si no hay «Pesar» abierto (evita tumbar mid-weigh).
set -eu
ENV_FILE=/root/renpho-gateway/ble-scale-sync/.env
SECRET=$(grep '^SCALE_INGEST_SECRET=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r')
CID=$(grep '^SUITE_COMPANY_ID=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r')
URL=$(grep '^SCALE_INGEST_URL=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r')
URL=${URL:-https://supabase.lipoout.com/functions/v1/scale-ingest}

pend=$(curl -sS -m 10 \
  -H "X-Scale-Ingest-Secret: $SECRET" \
  -H "X-Suite-Company-Id: $CID" \
  "${URL}?pending=1" || echo '{"pending":true,"error":"curl_failed"}')
echo "pending_response=$pend"

if echo "$pend" | grep -q '"pending":true'; then
  echo "REFUSE: pending weigh open — not restarting"
  exit 2
fi

echo "No pending weigh — restarting ble-scale-sync"
systemctl restart ble-scale-sync
sleep 3
systemctl is-active ble-scale-sync
