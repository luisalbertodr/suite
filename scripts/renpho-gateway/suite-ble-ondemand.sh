#!/bin/bash
# Controlador bajo demanda de ble-scale-sync (MorphoScan).
#
# - Al aparecer «Pesar» en Suite → start del bridge (NO reinicia si ya está activo).
# - Tras IDLE_STOP_SEC sin pending (default 10 min) → stop.
# - Un proceso ligero (suite-ble-ondemand.service) llama a este script en bucle.
#
# Uso:
#   suite-ble-ondemand.sh once     # un ciclo (cron/timer)
#   suite-ble-ondemand.sh loop     # bucle (systemd)
set -eu

UNIT="${BLE_ONDEMAND_UNIT:-ble-scale-sync}"
ENV_FILE="${BLE_ONDEMAND_ENV:-/root/renpho-gateway/ble-scale-sync/.env}"
STATE_DIR="${BLE_ONDEMAND_STATE_DIR:-/var/lib/suite-ble-ondemand}"
LOG="${BLE_ONDEMAND_LOG:-/var/log/suite/ble-ondemand.log}"
IDLE_STOP_SEC="${BLE_ONDEMAND_IDLE_STOP_SEC:-600}"
POLL_SEC="${BLE_ONDEMAND_POLL_SEC:-5}"
ARMED_FILE="$STATE_DIR/armed_sig"
LAST_PENDING_FILE="$STATE_DIR/last_pending_at"
MODE="${1:-once}"

mkdir -p "$STATE_DIR" "$(dirname "$LOG")"

ts() { date -Is; }
log() { echo "$(ts) $*" | tee -a "$LOG"; }

fetch_pending() {
  local secret cid url
  secret=$(grep '^SCALE_INGEST_SECRET=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r')
  cid=$(grep '^SUITE_COMPANY_ID=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r')
  url=$(grep '^SCALE_INGEST_URL=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r')
  url=${url:-https://supabase.lipoout.com/functions/v1/scale-ingest}
  # Importante: no devolver pending:false en fallo de red (eso borraba armed_sig y
  # provocaba restart a mitad de pesaje).
  if ! curl -sS -m 10 \
    -H "X-Scale-Ingest-Secret: $secret" \
    -H "X-Suite-Company-Id: $cid" \
    "${url}?pending=1"; then
    echo '{"pending":null,"error":"curl_failed"}'
  fi
}

# Imprime: state|signature
#   state = true | false | unknown
parse_pending() {
  python3 - "$1" <<'PY'
import json, hashlib, sys
raw = sys.argv[1]
try:
    d = json.loads(raw)
except Exception:
    print("unknown|")
    raise SystemExit(0)
if d.get("error") and d.get("pending") is None:
    print("unknown|")
    raise SystemExit(0)
# Arrancar aunque ready=false (calienta el bridge mientras Suite completa perfil).
if not bool(d.get("pending")):
    print("false|")
    raise SystemExit(0)
rid = str(d.get("weigh_request_id") or d.get("request_id") or d.get("id") or "")
if rid:
    sig = hashlib.sha256(rid.encode()).hexdigest()[:16]
else:
    parts = [
        str(d.get("target_scale_mac") or ""),
        str(d.get("name") or ""),
        str(d.get("height_cm") or ""),
        str(d.get("age_years") or ""),
        str(d.get("gender") or d.get("sex") or ""),
        raw.strip(),
    ]
    sig = hashlib.sha256("|".join(parts).encode()).hexdigest()[:16]
print(f"true|{sig}")
PY
}

# Arranca el bridge si está parado. Si ya está activo, NO reinicia (evita cortar BLE).
ensure_started() {
  local why="$1"
  systemctl reset-failed "$UNIT" 2>/dev/null || true
  if systemctl is-active --quiet "$UNIT"; then
    log "KEEP $UNIT already active ($why)"
    return 0
  fi
  log "START $UNIT ($why)"
  systemctl start "$UNIT"
  local i
  for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
    if systemctl is-active --quiet "$UNIT"; then
      log "START_OK $UNIT active"
      return 0
    fi
    sleep 1
  done
  log "START_WARN $UNIT not active after 12s: $(systemctl is-active "$UNIT" || true)"
  return 1
}

ensure_stopped() {
  local why="$1"
  if ! systemctl is-active --quiet "$UNIT" && ! systemctl is-failed --quiet "$UNIT" 2>/dev/null; then
    return 0
  fi
  log "STOP $UNIT ($why)"
  systemctl stop "$UNIT" 2>/dev/null || true
  systemctl reset-failed "$UNIT" 2>/dev/null || true
  log "STOP_OK $UNIT inactive"
}

tick() {
  local now pend parsed is_pending sig armed last_pending age
  now=$(date +%s)
  pend=$(fetch_pending)
  parsed=$(parse_pending "$pend")
  is_pending=${parsed%%|*}
  sig=${parsed#*|}

  # Fallo temporal de red/API: no tocar armed ni parar el bridge.
  if [[ "$is_pending" == "unknown" ]]; then
    log "PENDING_FETCH_UNKNOWN keep armed/unit"
    return 0
  fi

  if [[ "$is_pending" == "true" ]]; then
    echo "$now" > "$LAST_PENDING_FILE"
    armed=""
    if [[ -f "$ARMED_FILE" ]]; then
      armed=$(cat "$ARMED_FILE" 2>/dev/null || true)
    fi
    if [[ "$armed" != "$sig" ]]; then
      # Nueva petición «Pesar»: arrancar si hace falta, sin matar una sesión BLE en curso.
      ensure_started "new pending sig=$sig"
      echo "$sig" > "$ARMED_FILE"
      return 0
    fi
    if ! systemctl is-active --quiet "$UNIT"; then
      ensure_started "pending open but unit down sig=$sig"
      echo "$sig" > "$ARMED_FILE"
    fi
    return 0
  fi

  # Sin pending real: limpiar arma; parar tras gracia.
  rm -f "$ARMED_FILE"
  last_pending=0
  if [[ -f "$LAST_PENDING_FILE" ]]; then
    last_pending=$(cat "$LAST_PENDING_FILE" 2>/dev/null || echo 0)
  fi
  case "$last_pending" in
    ''|*[!0-9]*) last_pending=0 ;;
  esac

  if ! systemctl is-active --quiet "$UNIT"; then
    return 0
  fi

  if [[ "$last_pending" -eq 0 ]]; then
    ensure_stopped "no pending history (ondemand idle)"
    return 0
  fi

  age=$((now - last_pending))
  if [[ "$age" -ge "$IDLE_STOP_SEC" ]]; then
    ensure_stopped "idle ${age}s >= ${IDLE_STOP_SEC}s"
  fi
}

case "$MODE" in
  once)
    tick
    ;;
  loop)
    log "LOOP start poll=${POLL_SEC}s idle_stop=${IDLE_STOP_SEC}s unit=$UNIT"
    while true; do
      tick || log "TICK_ERROR rc=$?"
      sleep "$POLL_SEC"
    done
    ;;
  *)
    echo "usage: $0 once|loop" >&2
    exit 2
    ;;
esac
