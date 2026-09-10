#!/usr/bin/env bash
# FreeRDP → Windows 10 LTSC (rápido + reconexión estable)
# Uso:
#   chmod +x ~/bin/rdp-win10.sh
#   ~/bin/rdp-win10.sh                 # conecta
#   RDP_HOST=192.168.x.y ~/bin/rdp-win10.sh
#
# Requisitos (Linux Mint):
#   sudo apt update
#   sudo apt install -y freerdp2-x11   # o freerdp3-x11 si está en tu repo
#
# En la VM Windows (recomendado una vez):
#   - Activar Escritorio remoto
#   - Desactivar "NLA" solo si da problemas de auth (mejor dejarlo ON)
#   - En Experiencia RDP del cliente: priorizar rendimiento
#   - Power: alto rendimiento; no suspender red
#   - Desactivar animaciones / transparencia ayuda

set -euo pipefail

HOST="${RDP_HOST:-192.168.99.20}"   # <-- cambia a la IP de tu VM Win10 LTSC
USER="${RDP_USER:-$USER}"
# Si usas dominio: USER='PCNAME\\usuario' o 'usuario@dominio'

# Detectar binario FreeRDP 2 o 3
if command -v xfreerdp3 >/dev/null 2>&1; then
  RDP=xfreerdp3
elif command -v xfreerdp >/dev/null 2>&1; then
  RDP=xfreerdp
else
  echo "No hay FreeRDP. Instala: sudo apt install -y freerdp2-x11" >&2
  exit 1
fi

# Credenciales: usa ~/.config/freerdp o pregunta
# Mejor: winpr-hash / almacenamiento seguro; aquí prompt interactivo si no hay RDP_PASS
AUTH=()
if [[ -n "${RDP_PASS:-}" ]]; then
  AUTH=(/p:"$RDP_PASS")
else
  AUTH=(/p:)
fi

# Perfil rendimiento + estabilidad
# /auto-reconnect + /auto-reconnect-max-retries: reintenta al caer el enlace
# /keepalive-interval: evita cortes por idle/NAT
# /network:lan (o :auto) — si vas por Wi‑Fi floja usa /network:modem
# GFX/AVC444 acelera en LAN con GPU decente; si va peor, quita /gfx:AVC444
# /compression + /bpp:16 reduce ancho de banda
# /fonts /aero /wallpaper /menu-anims /themes OFF = menos lag visual
#
# NFC / ACR122U (Suite):
#   NO añadir /usb:id,dev:072f:2200 si el agente acr122 corre en este Linux.
#   Deja el USB al pcscd local; Chrome en Windows usa station_id = NFC_STATION_ID.

NETWORK="${RDP_NETWORK:-lan}"   # lan | wan | modem | auto

exec "$RDP" \
  /v:"$HOST" \
  /u:"$USER" \
  "${AUTH[@]}" \
  /size:1920x1080 \
  /dynamic-resolution \
  /network:"$NETWORK" \
  /bpp:16 \
  +auto-reconnect \
  /auto-reconnect-max-retries:30 \
  /keepalive-interval:30 \
  /compression \
  -wallpaper \
  -menu-anims \
  -window-drag \
  -themes \
  -fonts \
  -aero \
  +clipboard \
  /sound:sys:alsa \
  /cert:ignore \
  "$@"
