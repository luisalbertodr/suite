#!/usr/bin/env bash
# FreeRDP → VM Compaq (192.168.99.16). Audio local vía Pulse/PipeWire.
# NO redirigir ACR122U USB (/usb:...) — el agente NFC corre en este Linux.
set -euo pipefail

export DISPLAY="${DISPLAY:-:0}"

if command -v xfreerdp3 >/dev/null 2>&1; then
  RDP=xfreerdp3
elif command -v xfreerdp >/dev/null 2>&1; then
  RDP=xfreerdp
else
  echo "No hay FreeRDP (xfreerdp)." >&2
  exit 1
fi

RDP_HOST="${RDP_HOST:-192.168.99.16}"
RDP_USER="${RDP_USER:-Compaq}"
RDP_PASS="${RDP_PASS:-}"
# Usuario Linux local (NO mezclar con RDP_USER)
LOCAL_USER="$(id -un)"
DRIVE_PATH="${RDP_DRIVE_PATH:-/media/${LOCAL_USER}}"
if [[ ! -d "$DRIVE_PATH" ]]; then
  DRIVE_PATH="/media"
fi

# Prefer Pulse (PipeWire compatibility layer); fallback ALSA.
SOUND_SYS=pulse
MIC_SYS=pulse
if ! "$RDP" /buildconfig 2>&1 | grep -qi 'WITH_PULSE'; then
  SOUND_SYS=alsa
  MIC_SYS=alsa
fi

AUTH=()
if [[ -n "$RDP_PASS" ]]; then
  AUTH=(/p:"$RDP_PASS")
elif [[ -n "${RDP_PASS_FILE:-}" && -r "$RDP_PASS_FILE" ]]; then
  AUTH=(/p:"$(cat "$RDP_PASS_FILE")")
else
  # Empty /p: makes FreeRDP prompt; desktop launchers usually set RDP_PASS_FILE.
  AUTH=(/p:)
fi

exec "$RDP" \
  /v:"$RDP_HOST" \
  /u:"$RDP_USER" \
  "${AUTH[@]}" \
  /sec:nla \
  /f \
  /drive:USB,"$DRIVE_PATH" \
  /sound:sys:"$SOUND_SYS" \
  /microphone:sys:"$MIC_SYS" \
  +clipboard \
  /cert:ignore \
  "$@"
