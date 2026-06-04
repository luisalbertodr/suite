import os
from pathlib import Path
import psycopg2

ROOT = Path(__file__).resolve().parents[1]
for line in (ROOT / ".env").read_text(encoding="utf-8", errors="replace").splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"'))

C = "5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4"
conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
cur = conn.cursor()
cur.execute(
    """
    SELECT count(*) FROM sales
    WHERE company_id = %s AND ticket_number LIKE 'LEG-%%'
    """,
    (C,),
)
print("Tickets LEG- existentes:", cur.fetchone()[0])
cur.execute(
    """
    SELECT count(*) FROM invoices
    WHERE company_id = %s AND notes LIKE 'Factura legacy sin cita%%'
    """,
    (C,),
)
print("Facturas 'legacy sin cita':", cur.fetchone()[0])
conn.close()
