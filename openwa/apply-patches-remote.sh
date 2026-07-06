#!/bin/bash
set -euo pipefail
echo "==> Parche notas de voz + protocolTimeout (sin getChats — rompe el adaptador)"
docker cp /tmp/patch_send_audio_voice.py openwa:/tmp/patch_send_audio_voice.py
docker exec openwa python3 /tmp/patch_send_audio_voice.py
docker exec openwa node --check /app/dist/engine/adapters/whatsapp-web-js.adapter.js
echo "==> Reiniciando contenedor"
docker restart openwa
echo "OK"
