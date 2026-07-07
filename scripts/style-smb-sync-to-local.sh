#!/bin/bash
# Sincroniza Style-Dunasoft vía SMB al LXC 110 cuando CIFS directo no está permitido.
# Uso: style-smb-sync-to-local.sh [dest]
set -euo pipefail

DEST="${1:-/mnt/style-sync}"
CRED="${STYLE_SMB_CREDENTIALS:-/root/.dunasoft-smb.credentials}"
SMB="//192.168.99.16/c$"
SMB_SUBDIR="Style-Dunasoft"
LOG="${STYLE_SMB_SYNC_LOG:-/var/log/style-smb-sync.log}"

log() { echo "$(date -Iseconds) $*" | tee -a "$LOG"; }

if [[ ! -f "$CRED" ]]; then
  log "ERROR: sin credenciales $CRED"
  exit 1
fi

mkdir -p "$DEST/dbf" "$DEST/sync" "$DEST/PROGS"

pull_file() {
  local remote="$1"
  local local="$2"
  local dir
  dir="$(dirname "$local")"
  mkdir -p "$dir"
  smbclient "$SMB" -A "$CRED" -c "cd ${SMB_SUBDIR}; get \"${remote}\" \"${local}\"" >/dev/null 2>&1 || return 1
}

pull_dbf_dir() {
  smbclient "$SMB" -A "$CRED" -c "cd ${SMB_SUBDIR}/dbf; lcd ${DEST}/dbf; prompt off; mget *.dbf" >/dev/null 2>&1 || true
  # Linux: el agente busca nombres en minúsculas (plan2009.dbf)
  shopt -s nullglob
  for f in "$DEST/dbf"/*.DBF "$DEST/dbf"/*.dbf; do
    [[ -f "$f" ]] || continue
    base="$(basename "$f")"
    lower="$(echo "$base" | tr '[:upper:]' '[:lower:]')"
    [[ "$base" == "$lower" ]] || ln -sf "$base" "$DEST/dbf/$lower"
  done
}

log "sync start -> $DEST"

for f in cola_sincro.dbf control_sincro.dbf; do
  pull_file "$f" "$DEST/$f" || log "WARN: no se pudo bajar $f"
done

pull_dbf_dir

# sync/ (inbound, ack, etc.) — solo metadatos ligeros; no borrar archive local
for sub in inbound inbound_ack deadletter; do
  mkdir -p "$DEST/sync/$sub"
done

smbclient "$SMB" -A "$CRED" -c "cd ${SMB_SUBDIR}/sync/inbound; lcd ${DEST}/sync/inbound; prompt off; mget *.json" >/dev/null 2>&1 || true
smbclient "$SMB" -A "$CRED" -c "cd ${SMB_SUBDIR}/sync/inbound_ack; lcd ${DEST}/sync/inbound_ack; prompt off; mget *.ok" >/dev/null 2>&1 || true

if [[ -f "$DEST/cola_sincro.dbf" ]] && [[ -f "$DEST/dbf/plan2009.dbf" || -f "$DEST/dbf/PLAN2009.DBF" ]]; then
  log "sync OK cola+plan2009"
else
  log "ERROR: faltan DBFs tras sync"
  exit 1
fi
