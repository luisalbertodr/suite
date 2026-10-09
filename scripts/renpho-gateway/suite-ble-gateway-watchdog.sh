#!/bin/bash
# Watchdog del gateway BLE (MorphoScan): detecta escaneo/D-Bus colgado.
#
# Con modo on-demand, ble-scale-sync puede estar parado a propósito (sin «Pesar»).
# Solo es fallo si hay pending abierto y el unit no corre, o si hay hung_scan.
#
# Instalar en suite-web (.112):
#   install -m 755 suite-ble-gateway-watchdog.sh /usr/local/bin/
#   cron: * * * * * /usr/local/bin/suite-ble-gateway-watchdog.sh
set -eu

UNIT="${BLE_WATCHDOG_UNIT:-ble-scale-sync}"
ENV_FILE="${BLE_WATCHDOG_ENV:-/root/renpho-gateway/ble-scale-sync/.env}"
STATE_DIR="${BLE_WATCHDOG_STATE_DIR:-/var/lib/suite-ble-watchdog}"
LOG="${BLE_WATCHDOG_LOG:-/var/log/suite/ble-gateway-watchdog.log}"
STALE_SEC="${BLE_WATCHDOG_STALE_SEC:-180}"
# Con «Pesar» abierto, un escaneo colgado >45s ya es fallo clínico (Gemma 2026-10-09).
STALE_PENDING_SEC="${BLE_WATCHDOG_STALE_PENDING_SEC:-45}"
MAX_FAILS="${BLE_WATCHDOG_MAX_FAILS:-2}"
# Con pending: reiniciar al primer fallo (no esperar 2 minutos de cron).
MAX_FAILS_PENDING="${BLE_WATCHDOG_MAX_FAILS_PENDING:-1}"
COOLDOWN_SEC="${BLE_WATCHDOG_COOLDOWN_SEC:-300}"
COOLDOWN_PENDING_SEC="${BLE_WATCHDOG_COOLDOWN_PENDING_SEC:-60}"
RESTART_SCRIPT="${BLE_WATCHDOG_RESTART_SCRIPT:-/usr/local/bin/restart-ble-safe.sh}"
FAIL_FILE="$STATE_DIR/consecutive_fails"
COOLDOWN_FILE="$STATE_DIR/last_restart"

mkdir -p "$STATE_DIR" "$(dirname "$LOG")"

ts() { date -Is; }
log() { echo "$(ts) $*" | tee -a "$LOG"; }

pending_open() {
  local secret cid url pend
  secret=$(grep '^SCALE_INGEST_SECRET=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r')
  cid=$(grep '^SUITE_COMPANY_ID=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r')
  url=$(grep '^SCALE_INGEST_URL=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r')
  url=${url:-https://supabase.lipoout.com/functions/v1/scale-ingest}
  pend=$(curl -sS -m 8 \
    -H "X-Scale-Ingest-Secret: $secret" \
    -H "X-Suite-Company-Id: $cid" \
    "${url}?pending=1" 2>/dev/null || echo '{}')
  echo "$pend" | grep -q '"pending":true'
}

fails=0
if [[ -f "$FAIL_FILE" ]]; then
  fails=$(cat "$FAIL_FILE" 2>/dev/null || echo 0)
fi
case "$fails" in
  ''|*[!0-9]*) fails=0 ;;
esac

if ! systemctl is-active --quiet "$UNIT"; then
  if pending_open; then
    fails=$((fails + 1))
    echo "$fails" > "$FAIL_FILE"
    log "FAIL #$fails unit=$UNIT not active while pending weigh open"
  else
    # Parado a propósito (ondemand idle) — OK.
    if [[ "$fails" -gt 0 ]]; then
      log "OK idle-stopped recovered after ${fails} fail(s)"
    else
      minute=$(date +%M)
      if [[ "$minute" == "00" || "$minute" == "30" ]]; then
        log "OK idle-stopped (ondemand)"
      fi
    fi
    echo 0 > "$FAIL_FILE"
    exit 0
  fi
else
  pending_now=0
  if pending_open; then pending_now=1; fi
  stale_lim=$STALE_SEC
  max_fails_lim=$MAX_FAILS
  cooldown_lim=$COOLDOWN_SEC
  if [[ "$pending_now" -eq 1 ]]; then
    stale_lim=$STALE_PENDING_SEC
    max_fails_lim=$MAX_FAILS_PENDING
    cooldown_lim=$COOLDOWN_PENDING_SEC
  fi

  last_ts=$(journalctl -u "$UNIT" -n 1 -o short-unix --no-pager 2>/dev/null \
    | awk '{print int($1)}' | tail -1 || true)
  case "$last_ts" in
    ''|*[!0-9]*) last_ts=0 ;;
  esac
  now=$(date +%s)
  age=$((now - last_ts))

  discovering=$(bluetoothctl show 2>/dev/null | awk -F': ' '/Discovering:/ {print $2; exit}' || true)
  discovering=${discovering:-no}
  last_line=$(journalctl -u "$UNIT" -n 1 --no-pager -o cat 2>/dev/null | tr -d '\r' || true)
  recent=$(journalctl -u "$UNIT" --since "2 min ago" --no-pager -o cat 2>/dev/null | tr -d '\r' || true)

  hung_scan=0
  if [[ "$age" -gt "$stale_lim" && "$discovering" == "yes" ]]; then
    hung_scan=1
  elif [[ "$age" -gt "$stale_lim" && "$last_line" == *"Still scanning"* ]]; then
    hung_scan=1
  elif [[ "$pending_now" -eq 1 ]] && echo "$recent" | grep -qiE 'GATT_STALE|handshake aborted|WriteValue'; then
    # Proxy GATT muerto con Pesar abierto: no esperar a stale_lim de escaneo.
    if [[ "$age" -gt 20 && ( "$discovering" == "yes" || "$last_line" == *"Still scanning"* ) ]]; then
      hung_scan=1
    fi
  fi

  if [[ "$hung_scan" -eq 1 ]]; then
    fails=$((fails + 1))
    echo "$fails" > "$FAIL_FILE"
    log "FAIL #$fails hung_scan journal_age=${age}s pending=$pending_now stale_lim=${stale_lim}s discovering=$discovering last=${last_line:0:80}"
  else
    if [[ "$fails" -gt 0 ]]; then
      log "OK recovered after ${fails} fail(s) journal_age=${age}s discovering=$discovering"
    else
      minute=$(date +%M)
      if [[ "$minute" == "00" || "$minute" == "30" ]]; then
        log "OK journal_age=${age}s discovering=$discovering"
      fi
    fi
    echo 0 > "$FAIL_FILE"
    exit 0
  fi
fi

# Releer pending para umbrales de restart (puede haber cambiado).
pending_now=0
if pending_open; then pending_now=1; fi
max_fails_lim=$MAX_FAILS
cooldown_lim=$COOLDOWN_SEC
if [[ "$pending_now" -eq 1 ]]; then
  max_fails_lim=$MAX_FAILS_PENDING
  cooldown_lim=$COOLDOWN_PENDING_SEC
fi

if [[ "$fails" -lt "$max_fails_lim" ]]; then
  exit 0
fi

now=$(date +%s)
last=0
if [[ -f "$COOLDOWN_FILE" ]]; then
  last=$(cat "$COOLDOWN_FILE" 2>/dev/null || echo 0)
fi
case "$last" in
  ''|*[!0-9]*) last=0 ;;
esac
if [[ $((now - last)) -lt "$cooldown_lim" ]]; then
  log "SKIP restart (cooldown ${cooldown_lim}s)"
  exit 0
fi

echo "$now" > "$COOLDOWN_FILE"
log "RESTART $UNIT (watchdog recovery pending=$pending_now)"
soft_reset_hci() {
  log "HCI soft-reset hci0 (hciconfig down/up)"
  hciconfig hci0 down 2>/dev/null || true
  sleep 1
  hciconfig hci0 up 2>/dev/null || true
  bluetoothctl power on >/dev/null 2>&1 || true
}
# Con pending abierto NO usar restart-ble-safe (rechaza). Arrancar/reiniciar directo + HCI.
if [[ "$pending_now" -eq 1 ]]; then
  systemctl stop "$UNIT" 2>/dev/null || true
  soft_reset_hci
  systemctl reset-failed "$UNIT" 2>/dev/null || true
  systemctl start "$UNIT" >>"$LOG" 2>&1 || systemctl restart "$UNIT" >>"$LOG" 2>&1 || log "ERROR: systemctl start failed"
  sleep 3
  systemctl is-active --quiet "$UNIT" && echo 0 > "$FAIL_FILE" || true
  exit 0
fi

if [[ -x "$RESTART_SCRIPT" ]]; then
  if "$RESTART_SCRIPT" >>"$LOG" 2>&1; then
    echo 0 > "$FAIL_FILE"
    log "restart-ble-safe OK"
  else
    rc=$?
    log "ERROR: restart-ble-safe failed rc=$rc — forcing systemctl restart"
    systemctl restart "$UNIT" >>"$LOG" 2>&1 || log "ERROR: systemctl restart failed"
    sleep 3
    systemctl is-active --quiet "$UNIT" && echo 0 > "$FAIL_FILE" || true
  fi
else
  systemctl restart "$UNIT" >>"$LOG" 2>&1 || log "ERROR: systemctl restart failed"
  sleep 3
  systemctl is-active --quiet "$UNIT" && echo 0 > "$FAIL_FILE" || true
fi
