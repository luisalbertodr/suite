import os
from pathlib import Path
import psycopg2

ROOT = Path(__file__).resolve().parents[1]
for line in (ROOT / ".env").read_text(encoding="utf-8", errors="replace").splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"'))

conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
cur = conn.cursor()
try:
    cur.execute("SELECT COUNT(*) FROM legacy.plan2009")
    print("legacy.plan2009 rows:", cur.fetchone()[0])
except Exception as e:
    print("legacy.plan2009:", e)
    conn.rollback()
conn.close()
