"""Diagnóstico sync Presentada — Joanella +34642757330."""
import os
from pathlib import Path

for line in Path(".env").read_text(encoding="utf-8").splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"'))

import psycopg2
import psycopg2.extras

conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

cur.execute(
    """
SELECT id, first_name, last_name, phone, email, customer_id, stage_id, value,
       external_created_at, created_at, archived_at, company_id
FROM marketing_leads
WHERE phone ILIKE %s OR phone ILIKE %s OR first_name ILIKE %s
ORDER BY created_at DESC LIMIT 10
""",
    ("%642757330%", "%+34642757330%", "%Joanella%"),
)
leads = cur.fetchall()
print("=== LEADS ===")
for r in leads:
    print(dict(r))

if not leads:
    raise SystemExit("No lead found")

lead = leads[0]
since = str(lead["external_created_at"] or lead["created_at"])[:10]
print("since_date:", since)

cur.execute(
    """
SELECT id, company_id, name, phone, phone_mobile, phone_home, email
FROM customers
WHERE regexp_replace(COALESCE(phone,'') || COALESCE(phone_mobile,'') || COALESCE(phone_home,''), '[^0-9]', '', 'g') LIKE %s
   OR regexp_replace(COALESCE(phone,''), '[^0-9]', '', 'g') LIKE %s
""",
    ("%642757330%", "%642757330%"),
)
customers = cur.fetchall()
print("=== CUSTOMERS ===")
for r in customers:
    print(dict(r))

cid = lead["customer_id"] or (customers[0]["id"] if customers else None)
print("resolved customer_id:", cid)

if lead.get("stage_id"):
    cur.execute("SELECT id, name FROM marketing_lead_stages WHERE id = %s", (lead["stage_id"],))
    print("current stage:", dict(cur.fetchone() or {}))

cur.execute(
    """
SELECT id, name FROM marketing_lead_stages
WHERE company_id = %s AND (
  lower(name) LIKE '%%presentada%%' AND (lower(name) LIKE '%%exito%%' OR lower(name) LIKE '%%éxito%%')
)
""",
    (lead["company_id"],),
)
print("presentada stage:", dict(cur.fetchone() or {}))

if cid:
    cur.execute(
        """
    SELECT id, company_id, issue_date::text, total_amount, status, number
    FROM invoices WHERE customer_id = %s AND status IS DISTINCT FROM 'cancelled'
    ORDER BY issue_date
    """,
        (cid,),
    )
    print("=== INVOICES ===")
    for r in cur.fetchall():
        print(dict(r))

    cur.execute(
        """
    SELECT s.id, s.company_id, s.status, s.total_amount, s.created_at::text,
           s.appointment_id, s.invoice_id, s.customer_id
    FROM sales s
    WHERE s.status = 'completed' AND s.appointment_id IS NOT NULL
      AND (s.customer_id = %s OR s.appointment_id IN (
        SELECT id FROM agenda_appointments WHERE customer_id = %s
      ))
    ORDER BY s.created_at
    """,
        (cid, cid),
    )
    print("=== APPOINTMENT SALES ===")
    for r in cur.fetchall():
        d = dict(r)
        d["charged_on"] = (d.get("created_at") or "")[:10]
        d["after_lead"] = d["charged_on"] >= since
        print(d)

    cur.execute(
        """
    SELECT id, company_id, customer_id, start_time::text, title, client_name, status
    FROM agenda_appointments WHERE customer_id = %s
    ORDER BY start_time DESC LIMIT 10
    """,
        (cid,),
    )
    print("=== APPOINTMENTS ===")
    for r in cur.fetchall():
        print(dict(r))

# appointments without customer but maybe phone in title?
cur.execute(
    """
SELECT id, company_id, customer_id, start_time::text, title, client_name, status
FROM agenda_appointments
WHERE client_name ILIKE %s OR title ILIKE %s
ORDER BY start_time DESC LIMIT 10
""",
    ("%Joanella%", "%Joanella%"),
)
print("=== APPOINTMENTS BY NAME ===")
for r in cur.fetchall():
    print(dict(r))

conn.close()
