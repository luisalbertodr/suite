#!/usr/bin/env bash
# FreeRDP → VM Compaq (192.168.99.16). Audio local vía Pulse/PipeWire.
# Perfil estable: keepalive + auto-reconnect + menos carga visual (evita congelados).
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
# lan = LAN cableada/Wi‑Fi local estable; wan/modem si hay cortes; auto deja decidir a FreeRDP
RDP_NETWORK="${RDP_NETWORK:-lan}"
# Reintentos de auto-reconnect dentro de la misma sesión FreeRDP
RDP_RECONNECT_RETRIES="${RDP_RECONNECT_RETRIES:-50}"
RDP_KEEPALIVE_SEC="${RDP_KEEPALIVE_SEC:-20}"
# Si FreeRDP sale con error (caída dura), reabrir sesión (0 = no; N = máx. reintentos)
RDP_OUTER_RETRIES="${RDP_OUTER_RETRIES:-20}"
RDP_OUTER_SLEEP_SEC="${RDP_OUTER_SLEEP_SEC:-2}"
RDP_LOG="${RDP_LOG:-$HOME/.local/share/rdp-recepcion.log}"

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

mkdir -p "$(dirname "$RDP_LOG")" 2>/dev/null || true

log() {
  local ts
  ts="$(date '+%Y-%m-%d %H:%M:%S')"
  echo "[$ts] $*" >>"$RDP_LOG" 2>/dev/null || true
  echo "$*" >&2
}

# Flags opcionales según versión (FreeRDP 2 vs 3).
HELP_TXT="$("$RDP" /help 2>&1 || true)"
EXTRA=()
if grep -qiE 'auto-reconnect-max-retries' <<<"$HELP_TXT"; then
  EXTRA+=(/auto-reconnect-max-retries:"$RDP_RECONNECT_RETRIES")
fi
if grep -qiE 'keepalive-interval' <<<"$HELP_TXT"; then
  EXTRA+=(/keepalive-interval:"$RDP_KEEPALIVE_SEC")
fi
if grep -qiE '/network' <<<"$HELP_TXT"; then
  EXTRA+=(/network:"$RDP_NETWORK")
fi

# Sin /gfx:AVC444 por defecto: en thin clients provoca pausas de varios segundos
# al encode/decode. RFX solo si RDP_GFX=rfx|avc444.
case "${RDP_GFX:-off}" in
  rfx|RFX)
    EXTRA+=(/gfx:rfx)
    ;;
  avc444|AVC444|h264)
    EXTRA+=(/gfx:avc444)
    ;;
  off|''|none)
    ;;
  *)
    EXTRA+=(/gfx:"$RDP_GFX")
    ;;
esac

run_rdp() {
  # set +e: queremos el código de salida de FreeRDP
  set +e
  "$RDP" \
    /v:"$RDP_HOST" \
    /u:"$RDP_USER" \
    "${AUTH[@]}" \
    /sec:nla \
    /f \
    /bpp:16 \
    +compression \
    +auto-reconnect \
    "${EXTRA[@]}" \
    -wallpaper \
    -menu-anims \
    -window-drag \
    -themes \
    -fonts \
    -aero \
    /drive:USB,"$DRIVE_PATH" \
    /sound:sys:"$SOUND_SYS" \
    /microphone:sys:"$MIC_SYS" \
    +clipboard \
    /cert:ignore \
    "$@"
  local code=$?
  set -e
  return "$code"
}

log "Inicio RDP → ${RDP_HOST} (${RDP} network=${RDP_NETWORK} sound=${SOUND_SYS})"

attempt=0
while true; do
  attempt=$((attempt + 1))
  set +e
  run_rdp "$@"
  code=$?
  set -e

  # Salida limpia (usuario cerró la ventana / logout): no reabrir.
  if [[ "$code" -eq 0 ]]; then
    log "Sesión RDP cerrada limpia (código 0)."
    exit 0
  fi

  if [[ "$RDP_OUTER_RETRIES" -le 0 ]] || [[ "$attempt" -gt "$RDP_OUTER_RETRIES" ]]; then
    log "RDP terminó con código ${code}; sin más reintentos (attempt=${attempt})."
    exit "$code"
  fi

  log "RDP caído (código ${code}); reintento ${attempt}/${RDP_OUTER_RETRIES} en ${RDP_OUTER_SLEEP_SEC}s…"
  sleep "$RDP_OUTER_SLEEP_SEC"
done
