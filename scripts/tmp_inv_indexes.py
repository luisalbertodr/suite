import psycopg2
from pathlib import Path
url = [l.split("=", 1)[1].strip().strip('"') for l in Path(".env").read_text().splitlines() if l.startswith("SUPABASE_DB_URL=")][0]
conn = psycopg2.connect(url)
cur = conn.cursor()
cur.execute("""
SELECT indexname, indexdef FROM pg_indexes
WHERE tablename='invoices' AND schemaname='public'
""")
for r in cur.fetchall():
    print(r)
conn.close()
