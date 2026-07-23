#!/bin/bash
echo "=== looking for renpho / mail ==="
for i in $(seq 1 30); do
  if timeout 0.4 bash -c "echo >/dev/tcp/192.168.99.$i/22" 2>/dev/null; then
    echo "OPEN 192.168.99.$i:22"
    ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=3 -o UserKnownHostsFile=/dev/null \
      root@192.168.99.$i "hostname; test -d /root/renpho-gateway/ble-scale-sync && echo FOUND_RENHO" 2>/dev/null
  fi
done
