import os
from pathlib import Path
import psycopg2
import psycopg2.extras

for line in Path(".env").read_text(encoding="utf-8").splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"'))

conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
company = "5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4"

cur.execute(
    """
    SELECT ml.first_name, ml.last_name, st.name AS stage,
           i.number, i.issue_date, i.total_amount, i.notes,
           s.id AS sale_id, s.appointment_id, s.invoice_id, s.status AS sale_status
    FROM marketing_leads ml
    JOIN marketing_lead_stages st ON st.id = ml.stage_id
    JOIN customers c ON (
      c.id = ml.customer_id
      OR regexp_replace(coalesce(ml.phone,''), '\\D', '', 'g') IN (
        regexp_replace(coalesce(c.phone,''), '\\D', '', 'g'),
        right(regexp_replace(coalesce(c.phone,''), '\\D', '', 'g'), 9),
        regexp_replace(coalesce(c.phone_mobile,''), '\\D', '', 'g'),
        right(regexp_replace(coalesce(c.phone_mobile,''), '\\D', '', 'g'), 9)
      )
    )
    LEFT JOIN invoices i ON i.customer_id = c.id AND i.company_id = ml.company_id
      AND i.status IS DISTINCT FROM 'cancelled'
    LEFT JOIN sales s ON s.invoice_id = i.id
    WHERE ml.company_id = %s
      AND ml.archived_at IS NULL
      AND st.name NOT ILIKE '%%presentada%%exito%%'
      AND EXISTS (
        SELECT 1 FROM agenda_appointments ap
        WHERE ap.customer_id = c.id AND ap.company_id = ml.company_id
          AND (ap.appointment_date::timestamp + COALESCE(NULLIF(ap.start_time,''),'00:00')::time) >= ml.created_at
      )
      AND i.id IS NOT NULL
    ORDER BY ml.first_name, i.issue_date
    """,
    (company,),
)
for r in cur.fetchall():
    print(
        r["first_name"],
        r["stage"][:20],
        r["number"],
        r["issue_date"],
        r["total_amount"],
        "appt=",
        bool(r["appointment_id"]),
        (r["notes"] or "")[:40],
    )

print("\n--- completed sales on appts without invoice ---")
cur.execute(
    """
    SELECT ml.first_name, st.name, s.ticket_number, s.total_amount, s.status, s.invoice_id, s.appointment_id
    FROM marketing_leads ml
    JOIN marketing_lead_stages st ON st.id = ml.stage_id
    JOIN customers c ON (
      regexp_replace(coalesce(ml.phone,''), '\\D', '', 'g') IN (
        regexp_replace(coalesce(c.phone,''), '\\D', '', 'g'),
        right(regexp_replace(coalesce(c.phone,''), '\\D', '', 'g'), 9),
        regexp_replace(coalesce(c.phone_mobile,''), '\\D', '', 'g'),
        right(regexp_replace(coalesce(c.phone_mobile,''), '\\D', '', 'g'), 9)
      )
    )
    JOIN agenda_appointments ap ON ap.customer_id = c.id AND ap.company_id = ml.company_id
    JOIN sales s ON s.appointment_id = ap.id AND s.company_id = ml.company_id
    WHERE ml.company_id = %s AND ml.archived_at IS NULL
      AND st.name NOT ILIKE '%%presentada%%exito%%'
      AND s.status = 'completed'
    ORDER BY ml.first_name
    """,
    (company,),
)
for r in cur.fetchall():
    print(dict(r))

conn.close()
