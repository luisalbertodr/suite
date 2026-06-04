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
for num in ("4474", "4470"):
    cur.execute(
        """
        SELECT tipdoc, forpag, sum(impdoc::numeric) s, count(*)::int n
        FROM legacy.cieentsal WHERE numcie = %s
        GROUP BY tipdoc, forpag ORDER BY tipdoc, forpag
        """,
        (num,),
    )
    print(num, "by numcie:", cur.fetchall())
    cur.execute("SELECT feccie, impcie FROM legacy.ciecab WHERE numcie = %s", (num,))
    print("  cab", cur.fetchone())

cur.execute(
    """
    SELECT c.numcie, c.feccie, c.impcie,
      sum(CASE WHEN e.tipdoc='E' AND e.forpag='EFECTIVO' THEN e.impdoc::numeric ELSE 0 END) cash_e,
      sum(CASE WHEN e.tipdoc='E' AND e.forpag='TARJETA' THEN e.impdoc::numeric ELSE 0 END) card_e
    FROM legacy.ciecab c
    LEFT JOIN legacy.cieentsal e ON e.numcie = c.numcie
    WHERE c.feccie = '2026-06-03'
    GROUP BY c.numcie, c.feccie, c.impcie
    """
)
print("2026-06-03 join:", cur.fetchall())
cur.execute(
    """
    SELECT tipdoc, forpag, sum(impdoc::numeric) s, count(*)::int n
    FROM legacy.cieentsal WHERE fecdoc = '2026-06-03'
    GROUP BY tipdoc, forpag ORDER BY tipdoc, forpag
    """
)
print("2026-06-03 by fecdoc:", cur.fetchall())
cur.execute(
    """
    SELECT count(*) FILTER (WHERE NULLIF(btrim(numcie),'') IS NULL) no_cie,
           count(*) FILTER (WHERE NULLIF(btrim(numcie),'') IS NOT NULL) with_cie
    FROM legacy.cieentsal WHERE tipdoc = 'E'
    """
)
print("E numcie:", cur.fetchone())
conn.close()
