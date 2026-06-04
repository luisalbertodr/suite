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

def agg_for(feccie: str):
    cur.execute(
        """
        WITH cab AS (
          SELECT numcie, feccie, impcie::numeric AS impcie
          FROM legacy.ciecab WHERE feccie = %s
        )
        SELECT cab.numcie, cab.impcie,
          sum(CASE WHEN e.forpag='EFECTIVO' AND e.tipdoc='E' THEN e.impdoc::numeric ELSE 0 END) e_cash,
          sum(CASE WHEN e.forpag='TARJETA' AND e.tipdoc='E' THEN e.impdoc::numeric ELSE 0 END) e_card,
          sum(CASE WHEN e.forpag='EFECTIVO' AND e.tipdoc='S' THEN e.impdoc::numeric ELSE 0 END) s_cash,
          sum(CASE WHEN e.forpag='EFECTIVO' AND e.tipdoc='A' THEN e.impdoc::numeric ELSE 0 END) a_cash,
          count(e.*)::int lines
        FROM cab
        LEFT JOIN legacy.cieentsal e ON (
          e.numcie = cab.numcie
          OR (NULLIF(btrim(e.numcie), '') IS NULL AND e.fecdoc = cab.feccie)
        )
        GROUP BY cab.numcie, cab.impcie
        """,
        (feccie,),
    )
    return cur.fetchall()

for d in ("2026-05-29", "2026-06-03", "2024-01-15"):
    print(d, agg_for(d))

conn.close()
