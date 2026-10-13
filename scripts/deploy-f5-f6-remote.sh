#!/usr/bin/env bash
set -euo pipefail
export SUITE_REPO_ROOT=/tmp/suite-f5-f6
cd /tmp/suite-f5-f6

FUNCTIONS_PATH="${SUITE_FUNCTIONS_PATH:-/root/supabase-project/volumes/functions}"
EDGE_CONTAINER="${SUITE_EDGE_CONTAINER:-supabase-edge-functions}"

echo "=== migration electric role ==="
docker exec -i supabase-db psql -U postgres -d postgres < supabase/migrations/20261013120000_electric_replication_role.sql || true

echo "=== setup Inngest ==="
python3 scripts/setup-inngest-portainer-stack.py

echo "=== setup Electric ==="
python3 scripts/setup-electric-portainer-stack.py || true

echo "=== edge electric-shape-proxy ==="
mkdir -p "$FUNCTIONS_PATH/electric-shape-proxy"
cp -f supabase/functions/electric-shape-proxy/index.ts "$FUNCTIONS_PATH/electric-shape-proxy/index.ts"
docker restart "$EDGE_CONTAINER" >/dev/null
sleep 3
docker logs --tail 40 "$EDGE_CONTAINER" || true
echo DONE_F5_F6
