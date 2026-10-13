#!/bin/bash
# Run on Proxmox HOST (192.168.99.9) as root.
# Opens /dev/snd for unprivileged CT 701 (portainer / 192.168.99.110)
# so spotifyd can play Spotify Connect to the physical audio jack/HDMI.
set -euo pipefail

CTID="${CTID:-701}"
DEPLOY_PUB="${DEPLOY_PUB:-ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAINlARksTywPuuCibITtil6nyLX8mXza6Im9b6n5aqX9b suite-deploy}"

echo "=== cards on host ==="
cat /proc/asound/cards || true
aplay -l || true

echo "=== open device nodes for CT $CTID ==="
chmod 666 /dev/snd/* 2>/dev/null || true

idx=0
for node in \
  /dev/snd/controlC0 /dev/snd/pcmC0D0p /dev/snd/pcmC0D1p \
  /dev/snd/controlC1 /dev/snd/pcmC1D3p /dev/snd/pcmC1D7p \
  /dev/snd/pcmC1D8p /dev/snd/pcmC1D9p /dev/snd/pcmC1D10p /dev/snd/pcmC1D11p \
  /dev/snd/timer /dev/snd/seq
do
  if [ -e "$node" ]; then
    pct set "$CTID" -dev${idx} "path=${node},mode=0666,uid=0,gid=0" || true
    idx=$((idx + 1))
  fi
done

cat > /etc/udev/rules.d/99-spotifyd-snd.rules <<'UDEV'
KERNEL=="controlC[0-9]*", MODE="0666"
KERNEL=="pcmC[0-9]*D[0-9]*p", MODE="0666"
KERNEL=="pcmC[0-9]*D[0-9]*c", MODE="0666"
KERNEL=="timer", MODE="0666"
KERNEL=="seq", MODE="0666"
UDEV
udevadm control --reload-rules || true
udevadm trigger --subsystem-match=sound || true
chmod 666 /dev/snd/* 2>/dev/null || true

echo "=== unmute analog defaults (card 0 PCH) ==="
amixer -c 0 sset Master unmute 100% 2>/dev/null || true
amixer -c 0 sset Headphone unmute 100% 2>/dev/null || true
amixer -c 0 sset Speaker unmute 100% 2>/dev/null || true
amixer -c 0 sset PCM unmute 100% 2>/dev/null || true
amixer -c 0 sset 'Front' unmute 100% 2>/dev/null || true
amixer -c 0 sset 'Line Out' unmute 100% 2>/dev/null || true

echo "=== install suite-deploy SSH key (idempotent) ==="
mkdir -p /root/.ssh
chmod 700 /root/.ssh
touch /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys
grep -qxF "$DEPLOY_PUB" /root/.ssh/authorized_keys || echo "$DEPLOY_PUB" >> /root/.ssh/authorized_keys

echo "=== verify from CT ==="
pct exec "$CTID" -- bash -lc 'ls -la /dev/snd | head -20; aplay -l; cat /proc/asound/cards'

echo "=== recreate spotifyd ==="
pct exec "$CTID" -- bash -lc '
  set -e
  cd /var/lib/docker/volumes/portainer_data/_data/compose/88
  docker rm -f spotifyd 2>/dev/null || true
  docker compose up -d
  sleep 2
  docker ps --filter name=spotifyd --format "{{.Names}} {{.Status}}"
  docker logs --tail 30 spotifyd 2>&1 || true
'

echo "DONE. Device name in Spotify Connect: Clinica-Lipoout"
