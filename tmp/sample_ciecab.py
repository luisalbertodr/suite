import os
from pathlib import Path
import psycopg2
from psycopg2.extras import RealDictCursor

ROOT = Path(__file__).resolve().parents[1]
for line in (ROOT / ".env").read_text(encoding="utf-8", errors="replace").splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"'))

conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
cur = conn.cursor(cursor_factory=RealDictCursor)
for tbl in ("ciecab", "cieentsal"):
    cur.execute(f"SELECT count(*) AS n FROM legacy.{tbl}")
    print(tbl, cur.fetchone()["n"])
cur.execute("SELECT * FROM legacy.ciecab ORDER BY feccie DESC NULLS LAST LIMIT 5")
print("ciecab sample:")
for r in cur.fetchall():
    print(dict(r))
cur.execute(
    """
    SELECT tipdoc, forpag, count(*)::int n
    FROM legacy.cieentsal GROUP BY tipdoc, forpag ORDER BY n DESC LIMIT 15
    """
)
print("cieentsal tipdoc/forpag:", cur.fetchall())
conn.close()
