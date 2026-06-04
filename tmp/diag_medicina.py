import os
from pathlib import Path
import psycopg2
from psycopg2.extras import RealDictCursor

EST = "5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4"
MED = "816af484-92a0-4f65-a5a7-1c907aa4bb3d"
ROOT = Path(__file__).resolve().parents[1]
for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"'))
conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
cur = conn.cursor(cursor_factory=RealDictCursor)

for label, cid in ("Estética", EST), ("Medicina", MED):
    cur.execute(
        "SELECT count(*)::int n FROM agenda_appointments WHERE company_id = %s",
        (cid,),
    )
    apt = cur.fetchone()["n"]
    cur.execute(
        """
        SELECT count(*)::int n FROM sales
        WHERE company_id = %s AND status = 'completed'
        """,
        (cid,),
    )
    sales = cur.fetchone()["n"]
    cur.execute(
        """
        SELECT count(*)::int n FROM sales
        WHERE company_id = %s AND ticket_number LIKE 'LEG-%%' AND status = 'completed'
        """,
        (cid,),
    )
    leg = cur.fetchone()["n"]
    cur.execute(
        "SELECT count(*)::int n FROM invoices WHERE company_id = %s",
        (cid,),
    )
    inv = cur.fetchone()["n"]
    cur.execute(
        "SELECT count(*)::int n FROM cash_register_sessions WHERE company_id = %s",
        (cid,),
    )
    cash = cur.fetchone()["n"]
    print(f"{label}: citas={apt} ventas={sales} LEG={leg} facturas={inv} caja={cash}")

cur.execute(
    """
    SELECT billing_company_id, count(*)::int n
    FROM articles WHERE company_id = %s OR billing_company_id = %s
    GROUP BY billing_company_id
    """,
    (EST, MED),
)
print("articles billing:", cur.fetchall())

conn.close()
