#!/bin/bash
# Watchdog del gateway BLE (MorphoScan): detecta escaneo/D-Bus colgado.
#
# Caso típico: btAdapter.devices() no resuelve → no más logs "Still scanning"
# aunque el event loop (setInterval heartbeat) siga vivo. WatchdogSec de
# systemd NO lo detecta. Este cron mira frescura del journal + Discovering.
#
# En idle normal Discovering=no y el journal puede estar callado horas → OK.
#
# Instalar en suite-web (.112):
#   install -m 755 suite-ble-gateway-watchdog.sh /usr/local/bin/
#   cron: * * * * * /usr/local/bin/suite-ble-gateway-watchdog.sh
set -eu

UNIT="${BLE_WATCHDOG_UNIT:-ble-scale-sync}"
STATE_DIR="${BLE_WATCHDOG_STATE_DIR:-/var/lib/suite-ble-watchdog}"
LOG="${BLE_WATCHDOG_LOG:-/var/log/suite/ble-gateway-watchdog.log}"
# Sin líneas nuevas en journal durante este tiempo → colgado (discovery=120s + margen).
STALE_SEC="${BLE_WATCHDOG_STALE_SEC:-180}"
MAX_FAILS="${BLE_WATCHDOG_MAX_FAILS:-2}"
COOLDOWN_SEC="${BLE_WATCHDOG_COOLDOWN_SEC:-300}"
RESTART_SCRIPT="${BLE_WATCHDOG_RESTART_SCRIPT:-/usr/local/bin/restart-ble-safe.sh}"
FAIL_FILE="$STATE_DIR/consecutive_fails"
COOLDOWN_FILE="$STATE_DIR/last_restart"

mkdir -p "$STATE_DIR" "$(dirname "$LOG")"

ts() { date -Is; }
log() { echo "$(ts) $*" | tee -a "$LOG"; }

fails=0
if [[ -f "$FAIL_FILE" ]]; then
  fails=$(cat "$FAIL_FILE" 2>/dev/null || echo 0)
fi
case "$fails" in
  ''|*[!0-9]*) fails=0 ;;
esac

if ! systemctl is-active --quiet "$UNIT"; then
  fails=$((fails + 1))
  echo "$fails" > "$FAIL_FILE"
  log "FAIL #$fails unit=$UNIT not active"
else
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

  hung_scan=0
  if [[ "$age" -gt "$STALE_SEC" && "$discovering" == "yes" ]]; then
    hung_scan=1
  elif [[ "$age" -gt "$STALE_SEC" && "$last_line" == *"Still scanning"* ]]; then
    hung_scan=1
  fi

  if [[ "$hung_scan" -eq 1 ]]; then
    fails=$((fails + 1))
    echo "$fails" > "$FAIL_FILE"
    log "FAIL #$fails hung_scan journal_age=${age}s discovering=$discovering last=${last_line:0:80}"
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

if [[ "$fails" -lt "$MAX_FAILS" ]]; then
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
if [[ $((now - last)) -lt "$COOLDOWN_SEC" ]]; then
  log "SKIP restart (cooldown ${COOLDOWN_SEC}s)"
  exit 0
fi

echo "$now" > "$COOLDOWN_FILE"
log "RESTART $UNIT (hung BLE gateway)"
if [[ -x "$RESTART_SCRIPT" ]]; then
  if "$RESTART_SCRIPT" >>"$LOG" 2>&1; then
    echo 0 > "$FAIL_FILE"
    log "restart-ble-safe OK"
  else
    rc=$?
    if [[ "$rc" -eq 2 ]]; then
      log "SKIP restart: pending weigh open (safe script refused)"
      echo 1 > "$FAIL_FILE"
    else
      log "ERROR: restart-ble-safe failed rc=$rc — forcing systemctl restart"
      systemctl restart "$UNIT" >>"$LOG" 2>&1 || log "ERROR: systemctl restart failed"
      sleep 3
      systemctl is-active --quiet "$UNIT" && echo 0 > "$FAIL_FILE" || true
    fi
  fi
else
  systemctl restart "$UNIT" >>"$LOG" 2>&1 || log "ERROR: systemctl restart failed"
  sleep 3
  systemctl is-active --quiet "$UNIT" && echo 0 > "$FAIL_FILE" || true
fi
