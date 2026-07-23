#!/bin/bash
set -a
# shellcheck disable=SC1091
source /root/renpho-gateway/ble-scale-sync/.env
set +a
URL="${SCALE_INGEST_URL:-https://supabase.lipoout.com/functions/v1/scale-ingest}?pending=1"
curl -sS -w "\nHTTP %{http_code}\n" \
  -H "X-Scale-Ingest-Secret: ${SCALE_INGEST_SECRET}" \
  -H "X-Suite-Company-Id: ${SUITE_COMPANY_ID}" \
  "$URL"
