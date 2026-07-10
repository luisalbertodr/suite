#!/bin/bash
set -euo pipefail
SR=$(docker exec supabase-edge-functions printenv SUPABASE_SERVICE_ROLE_KEY)
CID=5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4
RUN="docker run --rm -e STYLE_ROOT=/mnt/style -e COMPANY_ID=$CID -e SUPABASE_URL=https://supabase.lipoout.com -e SUPABASE_SERVICE_ROLE_KEY=$SR -v /mnt/style:/mnt/style:ro style-sync-agent:0.2.1"

echo "=== Resync 2026-06 ==="
$RUN node dist/scripts/resync-faccab-billing.js --year=2026 --force 2026-06 2>&1 | tee /tmp/resync-2026-06.log

echo "=== Resync 2026-07 ==="
$RUN node dist/scripts/resync-faccab-billing.js --year=2026 --force 2026-07 2>&1 | tee /tmp/resync-2026-07.log

echo "=== Invalidar caché dashboard ==="
docker exec supabase-db psql -U postgres -d postgres -c "SELECT public.dashboard_billing_invalidate('$CID'::uuid, '2026-06-01'::date);"
docker exec supabase-db psql -U postgres -d postgres -c "SELECT public.dashboard_billing_invalidate('$CID'::uuid, '2026-07-01'::date);"

echo "=== Verificación RPC ==="
docker exec supabase-db psql -U postgres -d postgres -c "SELECT month_num, round(total::numeric,2) AS total FROM public.dashboard_billing_monthly('$CID'::uuid, 2026) WHERE month_num IN (6,7) ORDER BY 1;"

echo DONE
