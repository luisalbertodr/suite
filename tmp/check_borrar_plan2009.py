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
    """
    SELECT COUNT(*) AS n FROM dunasoft.planinc pi
    WHERE upper(btrim(pi.tipinc)) = 'BORRAR'
      AND EXISTS (SELECT 1 FROM dunasoft.plan2009 p WHERE p.idplan = pi.idplan)
    """
)
print("BORRAR planinc but still in plan2009:", cur.fetchone()["n"])
cur.execute("SELECT COUNT(*) AS n FROM dunasoft.plan2009")
print("plan2009 total:", cur.fetchone()["n"])
conn.close()
