#!/bin/bash
set -euo pipefail
KEY=$(docker inspect waha-worker-1 --format '{{range .Config.Env}}{{println .}}{{end}}' | grep '^WAHA_API_KEY=' | cut -d= -f2-)

echo '==== Fix last_status ===='
docker exec -i supabase-db psql -U postgres -c "
UPDATE whatsapp_config
SET last_status='WORKING', last_status_at=now()
WHERE enabled=true AND coalesce(last_status,'')='';
"

echo '==== Compare overview vs DB (top 20) ===='
python3 <<'PY'
import json, subprocess, urllib.request

key=subprocess.check_output(
  "docker inspect waha-worker-1 --format '{{range .Config.Env}}{{println .}}{{end}}' | grep '^WAHA_API_KEY=' | cut -d= -f2-",
  shell=True, text=True
).strip()
req=urllib.request.Request(
  'http://127.0.0.1:3333/api/default/chats/overview?limit=30&offset=0',
  headers={'X-Api-Key': key}
)
overview=json.load(urllib.request.urlopen(req))
chats=overview if isinstance(overview,list) else overview.get('chats') or overview.get('data') or []

rows=[]
for c in chats[:25]:
  cid=c.get('id') or c.get('chatId') or ''
  last=c.get('lastMessage') or {}
  body=(last.get('body') or last.get('caption') or '')[:50]
  ts=last.get('timestamp') or last.get('messageTimestamp')
  name=c.get('name') or c.get('pushName') or ''
  rows.append((cid, name, ts, body))

# DB
sql="SELECT chat_id, name, extract(epoch from last_message_at)::bigint AS ts, left(coalesce(last_message_preview,''),50) AS preview FROM whatsapp_chats WHERE chat_id = ANY(ARRAY[%s]);" % (
  ','.join("'"+r[0].replace("'","''")+"'" for r in rows if r[0])
)
db=subprocess.check_output(['docker','exec','-i','supabase-db','psql','-U','postgres','-tAc',sql], text=True)
dbmap={}
for line in db.strip().splitlines():
  if not line.strip(): continue
  parts=line.split('|')
  if len(parts)>=4:
    dbmap[parts[0]]=(parts[1], parts[2], parts[3])

print(f"{'chat':<22}{'waha_ts':>12}{'db_ts':>12}  name / mismatch")
for cid,name,ts,body in rows:
  d=dbmap.get(cid)
  dbts=d[1] if d else '-'
  try:
    waha_i=int(ts) if ts else 0
    db_i=int(float(dbts)) if dbts not in (None,'','-') else 0
  except Exception:
    waha_i=0; db_i=0
  flag='OK' if abs(waha_i-db_i)<=2 else f'DIFF body={body!r}'
  print(f"{cid[:21]:<22}{waha_i:>12}{db_i:>12}  {(name or (d[0] if d else ''))[:20]} {flag}")
PY

echo '==== realtime publication ===='
docker exec -i supabase-db psql -U postgres -c "
SELECT schemaname, tablename FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename LIKE 'whatsapp%';
"

echo '==== newest DB messages now ===='
docker exec -i supabase-db psql -U postgres -c "
SELECT left(coalesce(body,''),50) body, chat_id, timestamp, created_at
FROM whatsapp_messages ORDER BY created_at DESC LIMIT 5;
"
