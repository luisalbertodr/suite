import os, sys
from pathlib import Path
from collections import Counter

ROOT = Path(__file__).resolve().parents[1]
for line in (ROOT / ".env").read_text(encoding="utf-8", errors="replace").splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"'))

import psycopg2

conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
cur = conn.cursor()
cur.execute("SELECT count(*) FROM legacy.plan2009")
print("plan2009 total", cur.fetchone()[0])
cur.execute("SELECT count(DISTINCT btrim(idplan)) FROM legacy.plan2009 WHERE btrim(idplan) <> ''")
print("distinct idplan", cur.fetchone()[0])
cur.execute(
    """
    SELECT count(*) FROM (
      SELECT btrim(idplan) ip FROM legacy.plan2009
      WHERE btrim(idplan) <> '' GROUP BY btrim(idplan) HAVING count(*) > 1
    ) t
    """
)
print("idplans duplicated in plan2009", cur.fetchone()[0])

# Compare promote counts
cur.execute("SELECT count(*) FROM legacy.planinc")
print("planinc rows", cur.fetchone()[0])

conn.close()
