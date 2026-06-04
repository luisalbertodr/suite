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
    SELECT pid, state, left(query, 120) AS q, now() - query_start AS age
    FROM pg_stat_activity
    WHERE datname = current_database() AND state <> 'idle'
    ORDER BY query_start
    """
)
for r in cur.fetchall():
    print(dict(r))
conn.close()
