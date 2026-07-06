#!/bin/bash
set -euo pipefail
API_KEY=$(docker exec waha-worker-1 printenv WAHA_API_KEY)
CHAT='34667435503@c.us'
URL='https://github.com/devlikeapro/waha/raw/core/examples/dev.likeapro.opus'

echo "=== WAHA version ==="
curl -s "http://127.0.0.1:3333/api/server/status" -H "X-Api-Key: $API_KEY" | python3 -m json.tool 2>/dev/null | head -20

echo ""
echo "=== sendVoice via URL (known-good opus) ==="
RESP=$(curl -s -w "\nHTTP:%{http_code}" -X POST "http://127.0.0.1:3333/api/sendVoice" \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: $API_KEY" \
  -d "{\"session\":\"default\",\"chatId\":\"$CHAT\",\"file\":{\"mimetype\":\"audio/ogg; codecs=opus\",\"url\":\"$URL\"},\"convert\":false}")
echo "$RESP" | head -c 800
echo ""

MSG_ID=$(echo "$RESP" | python3 -c "import sys,json,re; t=sys.stdin.read().split('HTTP:')[0]; d=json.loads(t); print(d.get('id',{}).get('_serialized') or d.get('id',''))" 2>/dev/null || true)
echo "MSG_ID=$MSG_ID"

if [ -n "$MSG_ID" ]; then
  sleep 8
  echo ""
  echo "=== ack after 8s ==="
  curl -s "http://127.0.0.1:3333/api/messages?session=default&chatId=${CHAT}&limit=3" \
    -H "X-Api-Key: $API_KEY" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for m in d[:5]:
  mid=m.get('id')
  if isinstance(mid,dict): mid=mid.get('_serialized',mid)
  print(mid, m.get('type'), 'ack=', m.get('ack'), m.get('ackName'), (m.get('_data') or {}).get('status'))
"
fi
