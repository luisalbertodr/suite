#!/bin/bash
# Recrea el contenedor OpenWA desde cero y aplica parches limpios

echo "==> 1. Creando contenedor openwa"
docker run -d \
  --name openwa \
  --restart unless-stopped \
  -p 2785:2785 \
  -e OPENWA_API_KEY="owa_k1_c13e59cd1f7eee1068af57ce8a3d2a213fc191fabf972da49152dd6ac33ce9b4" \
  ghcr.io/rmyndharis/openwa:latest

echo "==> 2. Esperando que arranque..."
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30; do
  curl -sf "http://127.0.0.1:2785/api/health" >/dev/null 2>&1 && echo "API OK" && break
  sleep 2
done

echo "==> 3. Fijando whatsapp-web.js@1.34.6"
docker exec openwa sh -c 'cd /app && npm install whatsapp-web.js@1.34.6 --no-save'

echo "==> 4. Aplicando parche notas de voz"
docker cp /tmp/patch_send_audio_voice.py openwa:/tmp/patch_send_audio_voice.py
docker exec openwa python3 /tmp/patch_send_audio_voice.py

echo "==> 5. Aplicando parche protocolTimeout"
docker cp /tmp/patch_getchats_timeout.py openwa:/tmp/patch_getchats_timeout.py
docker exec openwa python3 /tmp/patch_getchats_timeout.py

echo "==> 6. Reiniciando"
docker restart openwa

echo "==> 7. Esperando API..."
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30; do
  curl -sf "http://127.0.0.1:2785/api/health" >/dev/null 2>&1 && echo "API OK" && break
  sleep 2
done

echo "==> 8. Iniciando sesión"
sleep 15
curl -sf -X POST "http://127.0.0.1:2785/api/sessions/80ad9168-a82d-41d0-a75e-9806e850b4fe/start" \
  -H "X-API-Key: owa_k1_c13e59cd1f7eee1068af57ce8a3d2a213fc191fabf972da49152dd6ac33ce9b4" \
  -H "Content-Type: application/json" || true

echo "Listo."