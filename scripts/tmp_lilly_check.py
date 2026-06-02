import os
from pathlib import Path
import psycopg2, psycopg2.extras

for line in Path(".env").read_text(encoding="utf-8").splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"'))

conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

cur.execute(
    """
    SELECT ml.id, ml.first_name, ml.phone, ml.created_at, ml.external_created_at, c.id AS customer_id, c.name
    FROM marketing_leads ml
    JOIN customers c ON regexp_replace(coalesce(ml.phone,''), '\\D', '', 'g') = right(regexp_replace(coalesce(c.phone,''), '\\D', '', 'g'), 9)
       OR regexp_replace(coalesce(ml.phone,''), '\\D', '', 'g') = regexp_replace(coalesce(c.phone,''), '\\D', '', 'g')
    WHERE ml.first_name ILIKE 'Lilly%' AND ml.archived_at IS NULL
    LIMIT 3
    """
)
print("LEAD", cur.fetchall())

cur.execute(
    """
    SELECT i.id, i.customer_id, i.issue_date, i.total_amount, i.number, s.appointment_id, s.company_id
    FROM sales s
    JOIN invoices i ON i.id = s.invoice_id
    JOIN agenda_appointments ap ON ap.id = s.appointment_id
    WHERE ap.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
      AND (ap.client_name ILIKE '%lilly%' OR EXISTS (
        SELECT 1 FROM customers c WHERE c.id = ap.customer_id AND c.name ILIKE '%lilly%'
      ))
    LIMIT 5
    """
)
print("SALES/INV", cur.fetchall())
conn.close()
