#!/bin/bash
set -euo pipefail
ENV=/root/supabase-project/.env
TOKEN=$(grep '^ISSABEL_API_TOKEN=' "$ENV" | cut -d= -f2-)
SPA_PASS=$(grep '^SPA3102_PASSWORD=' "$ENV" | cut -d= -f2-)

echo "=== Issabel api_cdr ==="
CODE=$(curl -sS -o /tmp/cdr.json -w '%{http_code}' -H "Authorization: Bearer $TOKEN" \
  'http://192.168.99.36:8888/api_cdr.php?from=2026-07-01&limit=3' || echo fail)
echo "HTTP $CODE"
head -c 500 /tmp/cdr.json; echo

echo "=== SPA3102 ==="
CODE2=$(curl -sS -o /dev/null -w '%{http_code}' -u "admin:$SPA_PASS" 'http://192.168.99.82/admin/advanced' || echo fail)
echo "HTTP $CODE2"
