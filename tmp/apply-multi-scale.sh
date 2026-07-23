#!/bin/bash
set -euo pipefail
ROOT=/root/renpho-gateway/ble-scale-sync

# discovery allowlist
python3 /tmp/patch-discovery-allowlist.py
sed -i 's/\r$//' "$ROOT/src/ble/handler-node-ble/discovery.ts"

# MSC04 adapter
sed -i 's/\r$//' "$ROOT/src/scales/renpho-msc04.ts"

# config: auto-discovery
cp -a "$ROOT/config.yaml" "$ROOT/config.yaml.bak-multimac"
cp /tmp/config-multimac.yaml "$ROOT/config.yaml"
sed -i 's/\r$//' "$ROOT/config.yaml"

# .env: SCALE_MACS + drop SCALE_MAC if present
python3 - <<'PY'
from pathlib import Path
p = Path('/root/renpho-gateway/ble-scale-sync/.env')
lines = []
if p.exists():
    for line in p.read_text().splitlines():
        if line.startswith('SCALE_MAC=') or line.startswith('SCALE_MACS='):
            continue
        if line.strip():
            lines.append(line.rstrip('\r'))
# keep existing secrets
vals = dict(l.split('=',1) for l in lines if '=' in l)
vals.setdefault('SCALE_INGEST_URL', 'https://supabase.lipoout.com/functions/v1/scale-ingest')
vals.setdefault('CONTINUOUS_MODE', 'true')
# known first MorphoScan; append second MAC later
vals['SCALE_MACS'] = '60:30:F2:74:26:E2'
out = [
    f"SCALE_INGEST_SECRET={vals.get('SCALE_INGEST_SECRET','')}",
    f"SUITE_COMPANY_ID={vals.get('SUITE_COMPANY_ID','')}",
    f"SCALE_INGEST_URL={vals['SCALE_INGEST_URL']}",
    f"SCALE_MACS={vals['SCALE_MACS']}",
    f"CONTINUOUS_MODE={vals['CONTINUOUS_MODE']}",
]
p.write_text('\n'.join(out) + '\n')
print(p.read_text())
PY

systemctl restart ble-scale-sync
sleep 2
systemctl is-active ble-scale-sync
journalctl -u ble-scale-sync -n 20 --no-pager
grep -n 'allowedScaleMacs\|SCALE_MACS\|allowlist' "$ROOT/src/ble/handler-node-ble/discovery.ts" | head -15
