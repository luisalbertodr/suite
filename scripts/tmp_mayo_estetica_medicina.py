import os
from pathlib import Path
import psycopg2
from psycopg2.extras import RealDictCursor

ESTETICA = "5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4"
MEDICINA = "816af484-92a0-4f65-a5a7-1c907aa4bb3d"
for line in Path(".env").read_text().splitlines():
    if line.startswith("SUPABASE_DB_URL="):
        os.environ["SUPABASE_DB_URL"] = line.split("=", 1)[1].strip().strip('"')
conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
cur = conn.cursor(cursor_factory=RealDictCursor)
cur.execute(
    """
    SELECT COUNT(*) c, ROUND(SUM(i.total_amount)::numeric, 2) t
    FROM invoices i
    WHERE i.issue_date >= '2026-05-01' AND i.issue_date < '2026-06-01'
      AND i.company_id = %s
      AND public.resolve_invoice_billing_company_id(i.id, %s::uuid) = %s
    """,
    (ESTETICA, ESTETICA, MEDICINA),
)
print("Mayo facturas en Estética con billing Medicina:", cur.fetchone())
cur.execute(
    """
    SELECT COUNT(*) c, ROUND(SUM(i.total_amount)::numeric, 2) t
    FROM invoices i
    WHERE i.issue_date >= '2026-05-01' AND i.issue_date < '2026-06-01'
      AND i.company_id = %s
    """,
    (ESTETICA,),
)
print("Mayo facturas en Estética (total):", cur.fetchone())
conn.close()
