#!/bin/bash
set -euo pipefail
sed -i 's/\r$//' /root/renpho-gateway/ble-scale-sync/src/runtime/loop.ts
cp -a /root/renpho-gateway/ble-scale-sync/config.yaml /root/renpho-gateway/ble-scale-sync/config.yaml.bak-cooldown
sed -i 's/scan_cooldown: 30/scan_cooldown: 5/' /root/renpho-gateway/ble-scale-sync/config.yaml
grep -n 'scan_cooldown\|IDLE_RETRY\|CONN_BACKOFF' /root/renpho-gateway/ble-scale-sync/config.yaml /root/renpho-gateway/ble-scale-sync/src/runtime/loop.ts | head -20
systemctl restart ble-scale-sync
sleep 2
systemctl is-active ble-scale-sync
journalctl -u ble-scale-sync -n 15 --no-pager
