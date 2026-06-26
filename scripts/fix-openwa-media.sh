#!/usr/bin/env bash
# Repara envío de media en OpenWA (whatsapp-web.js 1.34.7 rompe audio/imagen).
set -euo pipefail

CONTAINER="${OPENWA_CONTAINER:-openwa}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PATCH_PY="${PATCH_PY:-$SCRIPT_DIR/patch_send_audio_voice.py}"
[[ -f "$PATCH_PY" ]] || PATCH_PY="/tmp/patch_send_audio_voice.py"

echo "==> Fijando whatsapp-web.js@1.34.6 en $CONTAINER"
docker exec "$CONTAINER" sh -c 'cd /app && npm install whatsapp-web.js@1.34.6 --no-save'

echo "==> Parche notas de voz"
docker cp "$PATCH_PY" "$CONTAINER:/tmp/patch_send_audio_voice.py"
docker exec "$CONTAINER" python3 /tmp/patch_send_audio_voice.py

echo "==> Reiniciando contenedor"
docker restart "$CONTAINER"

echo "==> Esperando API..."
for _ in $(seq 1 30); do
  curl -sf "http://127.0.0.1:2785/api/health" >/dev/null 2>&1 && break
  sleep 2
done

if [[ -n "${OPENWA_API_KEY:-}" && -n "${OPENWA_SESSION_ID:-}" ]]; then
  echo "==> Iniciando sesión $OPENWA_SESSION_ID"
  sleep 15
  curl -sf -X POST "http://127.0.0.1:2785/api/sessions/${OPENWA_SESSION_ID}/start" \
    -H "X-API-Key: ${OPENWA_API_KEY}" -H "Content-Type: application/json" || true
fi

echo "Listo."
