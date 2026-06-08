import os
from pathlib import Path

p = Path(".env")
for line in p.read_text(encoding="utf-8").splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"'))

import psycopg2
from psycopg2.extras import RealDictCursor

conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"], connect_timeout=20)
cur = conn.cursor(cursor_factory=RealDictCursor)

cur.execute(
    """
    SELECT tipinc, COUNT(*) AS n
    FROM dunasoft.planinc
    GROUP BY tipinc
    ORDER BY n DESC
    LIMIT 15
    """
)
print("tipinc counts:", [dict(r) for r in cur.fetchall()])

cur.execute(
    """
    SELECT tipinc, idplan, codemp, codempx, fechax, planart, planartx
    FROM dunasoft.planinc
    WHERE upper(btrim(tipinc)) = 'CREAR'
    LIMIT 3
    """
)
print("CREAR samples:", cur.fetchall())

conn.close()
