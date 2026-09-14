#!/bin/bash
# Reinicia ble-scale-sync SOLO si no hay «Pesar» abierto (evita tumbar mid-weigh).
set -eu
SECRET=$(grep '^SCALE_INGEST_SECRET=' /root/renpho-gateway/ble-scale-sync/.env | cut -d= -f2- | tr -d '\r')
CID=$(grep '^SUITE_COMPANY_ID=' /root/renpho-gateway/ble-scale-sync/.env | cut -d= -f2- | tr -d '\r')
URL=$(grep '^SCALE_INGEST_URL=' /root/renpho-gateway/ble-scale-sync/.env | cut -d= -f2- | tr -d '\r')
URL=${URL:-https://supabase.lipoout.com/functions/v1/scale-ingest}

body=$(curl -sS -m 10 \
  -H "X-Scale-Ingest-Secret: $SECRET" \
  -H "X-Suite-Company-Id: $CID" \
  "${URL}?pending=1" || echo '{"pending":true}')

if echo "$body" | grep -q '"pending"[[:space:]]*:[[:space:]]*true'; then
  echo "REFUSE restart: weigh pending open → $body"
  exit 2
fi

echo "No pending weigh — restarting ble-scale-sync"
systemctl restart ble-scale-sync
sleep 2
systemctl is-active ble-scale-sync
