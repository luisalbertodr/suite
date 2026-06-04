import os
from pathlib import Path
import psycopg2
from psycopg2.extras import RealDictCursor

ROOT = Path(__file__).resolve().parents[1]
for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"'))
conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
cur = conn.cursor(cursor_factory=RealDictCursor)
cur.execute(
    """
    SELECT fecdoc, numcie, tipdoc, forpag, impdoc, desdoc
    FROM legacy.cieentsal WHERE tipdoc = 'E'
    ORDER BY fecdoc DESC NULLS LAST LIMIT 10
    """
)
for r in cur.fetchall():
    print(dict(r))
cur.execute(
    """
    SELECT left(fecdoc, 4) y, count(*)::int n
    FROM legacy.cieentsal WHERE tipdoc='E'
    GROUP BY 1 ORDER BY n DESC LIMIT 8
    """
)
print("fecdoc year prefix:", cur.fetchall())
conn.close()
