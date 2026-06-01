"""Importa mensajes de un chat desde Waha a Postgres (smoke test post-migración)."""
import json
import psycopg2
import urllib.request
from datetime import datetime, timezone

DB = "postgresql://postgres:q48Gj6Hw7sP9bQxR2yZ3cT5vU1aF0eL8@192.168.99.110:5433/postgres"
SUPABASE_URL = "https://supabase.lipoout.com"
ANON = open(".env", encoding="utf-8").read().split('VITE_SUPABASE_ANON_KEY="')[1].split('"')[0]

conn = psycopg2.connect(DB)
cur = conn.cursor()
cur.execute("SELECT company_id, api_key FROM whatsapp_config LIMIT 1")
company_id, api_key = cur.fetchone()
chat_id = "34609885413@c.us"
limit = 50

url = f"http://192.168.99.110:3333/api/default/chats/{chat_id}/messages?limit={limit}"
req = urllib.request.Request(url, headers={"X-Api-Key": api_key})
with urllib.request.urlopen(req, timeout=60) as r:
    msgs = json.loads(r.read().decode())

rows = []
for m in msgs:
    ts = datetime.fromtimestamp(m["timestamp"], tz=timezone.utc).isoformat()
    rows.append(
        {
            "company_id": company_id,
            "chat_id": chat_id,
            "waha_message_id": m["id"],
            "from_me": bool(m.get("fromMe")),
            "type": m.get("type") or "text",
            "body": m.get("body"),
            "timestamp": ts,
            "raw": m,
        }
    )

rest_url = f"{SUPABASE_URL}/rest/v1/whatsapp_messages?on_conflict=company_id,waha_message_id"
req2 = urllib.request.Request(
    rest_url,
    data=json.dumps(rows).encode(),
    headers={
        "apikey": ANON,
        "Authorization": f"Bearer {ANON}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    },
    method="POST",
)
with urllib.request.urlopen(req2, timeout=60) as r2:
    print("postgrest:", r2.status, "rows sent:", len(rows))

cur.execute(
    "SELECT COUNT(*) FROM whatsapp_messages WHERE company_id=%s AND chat_id=%s",
    (company_id, chat_id),
)
print("messages in db for chat:", cur.fetchone()[0])
cur.execute("SELECT COUNT(*) FROM whatsapp_messages")
print("total messages:", cur.fetchone()[0])
conn.close()
