import os
from pathlib import Path
import psycopg2
from psycopg2.extras import RealDictCursor

MED = "816af484-92a0-4f65-a5a7-1c907aa4bb3d"
ROOT = Path(__file__).resolve().parents[1]
for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"'))
conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
cur = conn.cursor(cursor_factory=RealDictCursor)
cur.execute(
    """
    SELECT count(*) FILTER (WHERE number ~ '^F[0-9]{4}-') f,
           count(*)::int total
    FROM invoices WHERE company_id = %s
    """,
    (MED,),
)
print("Medicina invoices:", cur.fetchone())
cur.execute(
    """
    SELECT session_date, expected_cash, expected_card, counted_cash, counted_card, notes
    FROM cash_register_sessions WHERE company_id = %s
    ORDER BY session_date DESC LIMIT 2
    """,
    (MED,),
)
for r in cur.fetchall():
    print(dict(r))
conn.close()
