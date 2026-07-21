#!/bin/bash
set -euo pipefail
ENV=/root/supabase-project/.env
TOKEN=$(grep '^ISSABEL_API_TOKEN=' "$ENV" | cut -d= -f2-)
CODE=$(curl -sS -o /tmp/cdr.json -w '%{http_code}' -H "Authorization: Bearer $TOKEN" \
  'http://192.168.99.36:8888/api_cdr.php?from=2026-07-01&limit=2')
echo "issabel_from_110: HTTP $CODE"
python3 - <<'PY'
import json
with open('/tmp/cdr.json', encoding='utf-8') as f:
    d = json.load(f)
data = d.get('data') or []
print('cdr_rows', len(data))
if data:
    print('latest', data[0].get('calldate'), data[0].get('src'), '->', data[0].get('dst'))
PY
