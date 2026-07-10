import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

url = os.getenv("SUPABASE_DB_URL")
if not url:
    raise SystemExit("SUPABASE_DB_URL not set")

import psycopg2

conn = psycopg2.connect(url)
cur = conn.cursor()
cur.execute(
    "SELECT version FROM supabase_migrations.schema_migrations "
    "WHERE version LIKE '%command_board%' ORDER BY version"
)
print("migrations:", [r[0] for r in cur.fetchall()])

cur.execute("SELECT id FROM companies LIMIT 1")
row = cur.fetchone()
if not row:
    raise SystemExit("no company")
cid = row[0]
print("company:", cid)

try:
    cur.execute(
        "SELECT public.dashboard_command_board_stats(%s, %s, %s::date, %s::date)",
        (cid, cid, "2026-07-01", "2026-07-10"),
    )
    result = cur.fetchone()[0]
    print("OK", str(result)[:300])
except Exception as e:
    conn.rollback()
    print("ERROR:", type(e).__name__, e)
finally:
    conn.close()
