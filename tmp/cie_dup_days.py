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
    SELECT feccie, count(*)::int n, array_agg(numcie ORDER BY numcie) nums
    FROM legacy.ciecab
    GROUP BY feccie HAVING count(*) > 1
    ORDER BY n DESC LIMIT 10
    """
)
print("duplicate feccie:", cur.fetchall())
cur.execute("SELECT count(*) FROM public.cash_register_sessions")
print("existing sessions:", cur.fetchone())
conn.close()
