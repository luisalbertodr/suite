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
    SELECT
      count(*) FILTER (WHERE number LIKE 'TMP-%') AS tmp_fmt,
      count(*) FILTER (WHERE number ~ '^F[0-9]{4}-') AS f_fmt,
      count(*) FILTER (WHERE number ~ '^FAC-') AS fac_fmt,
      count(*) AS total
    FROM public.invoices
    WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
    """
)
print("invoices:", cur.fetchone())
cur.execute("SELECT count(*) AS n FROM public.sales WHERE ticket_number LIKE 'LEG-%'")
print("LEG sales:", cur.fetchone())
cur.execute("SELECT count(*) AS n FROM public.cash_register_sessions")
print("cash sessions:", cur.fetchone())
conn.close()
