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
    SELECT count(*)::int n, count(*) FILTER (WHERE invoice_id IS NULL)::int no_inv
    FROM sales WHERE company_id = %s AND status = 'completed'
    """,
    (MED,),
)
print("sales medicina:", cur.fetchone())

cur.execute(
    """
    SELECT number, count(*)::int FROM invoices WHERE company_id = %s
    GROUP BY 1 LIKE 'F%%' ORDER BY count DESC LIMIT 5
    """
)
# fix query
cur.execute(
    """
    SELECT
      count(*) FILTER (WHERE number ~ '^F[0-9]{4}-') f,
      count(*) FILTER (WHERE number ~ '^FAC-') fac,
      count(*)::int total
    FROM invoices WHERE company_id = %s
    """,
    (MED,),
)
print("invoices format:", cur.fetchone())

cur.execute(
    """
    SELECT payment_method, count(*)::int n, sum(total_amount)::numeric s
    FROM sales WHERE company_id = %s AND status = 'completed'
    GROUP BY payment_method
    """,
    (MED,),
)
print("payment methods:", cur.fetchall())

cur.execute("SELECT codemp, count(*)::int FROM legacy.ciecab GROUP BY codemp")
print("ciecab codemp:", cur.fetchall())

cur.execute(
    """
    SELECT i.id, i.number, i.issue_date, i.total_amount
    FROM invoices i
    WHERE i.company_id = %s
    ORDER BY i.issue_date DESC LIMIT 5
    """,
    (MED,),
)
print("sample inv:", cur.fetchall())

conn.close()
