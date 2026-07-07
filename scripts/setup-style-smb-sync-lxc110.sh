#!/bin/bash
# Ejecutar EN el LXC 110 (suite-supabase) como root.
# Sincronización SMB periódica + bind /mnt/style-sync -> /mnt/style + agente Docker.
set -euo pipefail

REPO_DIR="${REPO_DIR:-/root/style-sync-setup}"
DEST="/mnt/style-sync"
STYLE_MOUNT="/mnt/style"
CRED_SRC="/root/.dunasoft-smb.credentials"

apt-get update -qq
apt-get install -y -qq cifs-utils samba-client

mkdir -p "$DEST" "$REPO_DIR"
cp -f "$REPO_DIR/style-smb-sync-to-local.sh" /usr/local/bin/style-smb-sync.sh 2>/dev/null || true
chmod +x /usr/local/bin/style-smb-sync.sh

/usr/local/bin/style-smb-sync.sh "$DEST"

# Bind mount: el agente usa /mnt/style
if mountpoint -q "$STYLE_MOUNT"; then
  umount "$STYLE_MOUNT" 2>/dev/null || true
fi
if [[ -d "$STYLE_MOUNT" && ! -L "$STYLE_MOUNT" ]]; then
  rmdir "$STYLE_MOUNT/sync" 2>/dev/null || true
  # preservar sync local si no venía del share
fi
mkdir -p "$STYLE_MOUNT"
mount --bind "$DEST" "$STYLE_MOUNT"

grep -q "$DEST $STYLE_MOUNT" /etc/fstab 2>/dev/null || echo "$DEST $STYLE_MOUNT none bind 0 0" >> /etc/fstab

# Cron cada minuto (LXC no permite CIFS kernel mount)
CRON_LINE="* * * * * root /usr/local/bin/style-smb-sync.sh $DEST >> /var/log/style-smb-sync.log 2>&1"
grep -q style-smb-sync /etc/cron.d/style-smb-sync 2>/dev/null || echo "$CRON_LINE" > /etc/cron.d/style-smb-sync
chmod 644 /etc/cron.d/style-smb-sync

echo "Bind OK: $STYLE_MOUNT -> $DEST"
ls -la "$STYLE_MOUNT/cola_sincro.dbf" "$STYLE_MOUNT/dbf/plan2009.dbf"
