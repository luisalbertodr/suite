import os
from pathlib import Path
p = Path(".env")
for line in p.read_text(encoding="utf-8").splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"'))
import psycopg2
from psycopg2.extras import RealDictCursor
conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
cur = conn.cursor(cursor_factory=RealDictCursor)
cur.execute(
    "SELECT left(planart, 300) AS pa, left(planartx, 300) AS pax FROM dunasoft.planinc "
    "WHERE planart IS NOT NULL AND btrim(planart) <> '' LIMIT 2"
)
for r in cur.fetchall():
    print("---OLD---")
    print(r["pa"])
    print("---NEW---")
    print(r["pax"])
conn.close()
