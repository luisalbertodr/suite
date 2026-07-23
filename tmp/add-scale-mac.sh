#!/bin/bash
set -euo pipefail
ENV=/root/renpho-gateway/ble-scale-sync/.env
MACS='60:30:F2:74:26:E2,60:30:F2:74:22:B6'
if grep -q '^SCALE_MACS=' "$ENV" 2>/dev/null; then
  sed -i "s|^SCALE_MACS=.*|SCALE_MACS=${MACS}|" "$ENV"
else
  printf '\nSCALE_MACS=%s\n' "$MACS" >> "$ENV"
fi
echo Updated:
grep '^SCALE_MACS=' "$ENV"
grep -n SCALE_MACS /root/renpho-gateway/ble-scale-sync/src/ble/autoDiscover.ts | head -5 || true
systemctl restart ble-scale-sync
sleep 2
systemctl is-active ble-scale-sync
journalctl -u ble-scale-sync -n 35 --no-pager
