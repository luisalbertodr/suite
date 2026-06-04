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
for ip in ("110462", "111301", "111259", "111101", "110434", "111172"):
    cur.execute("SELECT count(*) AS n FROM legacy.planinc WHERE btrim(idplan) = %s", (ip,))
    print(ip, "rows", cur.fetchone()["n"])
    cur.execute(
        """
        SELECT idplaninc, fecha, fechax, tipinc, codemp, horini, nomcli
        FROM legacy.planinc WHERE btrim(idplan) = %s
        ORDER BY idplaninc DESC NULLS LAST LIMIT 5
        """,
        (ip,),
    )
    for r in cur.fetchall():
        print(" ", dict(r))
conn.close()
