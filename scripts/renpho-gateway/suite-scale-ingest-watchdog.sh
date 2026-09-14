#!/bin/bash
# Watchdog: scale-ingest debe responder. Si falla N veces seguidas → reinicia edge-functions.
# Instalar: /usr/local/bin/suite-scale-ingest-watchdog.sh + cron cada minuto.
set -eu

URL="${SCALE_INGEST_HEALTH_URL:-https://supabase.lipoout.com/functions/v1/scale-ingest}"
STATE_DIR="${SCALE_WATCHDOG_STATE_DIR:-/var/lib/suite-scale-watchdog}"
FAIL_FILE="$STATE_DIR/consecutive_fails"
LOG="${SCALE_WATCHDOG_LOG:-/var/log/suite/scale-ingest-watchdog.log}"
MAX_FAILS="${SCALE_WATCHDOG_MAX_FAILS:-3}"
COOLDOWN_FILE="$STATE_DIR/last_restart"
COOLDOWN_SEC="${SCALE_WATCHDOG_COOLDOWN_SEC:-300}"

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

code=$(curl -sS -m 8 -o /tmp/scale-ingest-health.out -w '%{http_code}' "$URL" || echo 000)
body_head=$(head -c 120 /tmp/scale-ingest-health.out 2>/dev/null || true)

if [[ "$code" == "200" ]]; then
  if [[ "$fails" -gt 0 ]]; then
    log "OK recovered after ${fails} fail(s) http=$code"
  fi
  echo 0 > "$FAIL_FILE"
  exit 0
fi

fails=$((fails + 1))
echo "$fails" > "$FAIL_FILE"
log "FAIL #$fails http=$code body=${body_head}"

if [[ "$fails" -lt "$MAX_FAILS" ]]; then
  exit 0
fi

now=$(date +%s)
last=0
if [[ -f "$COOLDOWN_FILE" ]]; then
  last=$(cat "$COOLDOWN_FILE" 2>/dev/null || echo 0)
fi
if [[ $((now - last)) -lt "$COOLDOWN_SEC" ]]; then
  log "SKIP restart (cooldown ${COOLDOWN_SEC}s, last=$last)"
  exit 0
fi

log "RESTART supabase-edge-functions (scale-ingest unhealthy)"
echo "$now" > "$COOLDOWN_FILE"
if docker restart supabase-edge-functions >>"$LOG" 2>&1; then
  sleep 8
  code2=$(curl -sS -m 10 -o /dev/null -w '%{http_code}' "$URL" || echo 000)
  log "post-restart http=$code2"
  if [[ "$code2" == "200" ]]; then
    echo 0 > "$FAIL_FILE"
  fi
else
  log "ERROR: docker restart failed"
fi
