"""Auditoría cita Elisa Villauriz 008126."""
import json
import re
from pathlib import Path

import psycopg2
from psycopg2.extras import RealDictCursor

ROOT = Path(__file__).resolve().parents[1]
COMPANY = "5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4"


def load_db():
    for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
        if line.startswith("SUPABASE_DB_URL="):
            db = line.split("=", 1)[1].strip().strip('"').strip("'")
            return re.sub(r"@[^/:]+:\d+/", "@127.0.0.1:15432/", db)
    raise SystemExit("no db")


def parse_pricing(notes):
    if not notes or not str(notes).startswith("__pricing__"):
        return None
    try:
        return json.loads(str(notes)[len("__pricing__") :])
    except Exception:
        return None


conn = psycopg2.connect(load_db())
cur = conn.cursor(cursor_factory=RealDictCursor)

print("=== Cliente(s) 008126 ===")
cur.execute(
    """
    SELECT id, name, legacy_codcli, phone_mobile
    FROM customers
    WHERE company_id = %s
      AND (
        btrim(legacy_codcli) = '008126'
        OR btrim(legacy_codcli) = '8126'
        OR regexp_replace(btrim(legacy_codcli), '^0+', '') = '8126'
      )
    """,
    (COMPANY,),
)
customers = cur.fetchall()
for c in customers:
    print(c)

if not customers:
    cur.execute(
        "SELECT id, name, legacy_codcli FROM customers WHERE company_id=%s AND lower(name) LIKE '%%elisa%%villauriz%%'",
        (COMPANY,),
    )
    customers = cur.fetchall()
    print("Por nombre:", customers)

for c in customers:
    cid = c["id"]
    print(f"\n=== Citas hoy cliente {c['name']} ===")
    cur.execute(
        """
        SELECT a.id, a.start_time, a.status, a.legacy_codcli, a.legacy_idplan,
               a.employee_id
        FROM agenda_appointments a
        WHERE a.customer_id = %s
          AND COALESCE(a.appointment_date, a.start_time::date) = CURRENT_DATE
        ORDER BY a.start_time
        """,
        (cid,),
    )
    apts = cur.fetchall()
    for a in apts:
        print(dict(a))
        cur.execute(
            """
            SELECT kind, label, duration_minutes, article_id, notes
            FROM appointment_items WHERE appointment_id = %s ORDER BY sort_order
            """,
            (a["id"],),
        )
        total = 0.0
        for it in cur.fetchall():
            p = parse_pricing(it["notes"])
            if p:
                lt = float(p.get("unit_price", 0)) * float(p.get("quantity", 1))
            else:
                lt = 0.0
            total += lt
            print(f"  item: {it['kind']} | {it['label']} | pricing={p} | line={lt:.2f}")
        print(f"  TOTAL items pricing: {total:.2f}")

        cur.execute(
            """
            SELECT id, ticket_number, status, total_amount, invoice_id, created_at, notes
            FROM sales WHERE appointment_id = %s
            """,
            (a["id"],),
        )
        sales = cur.fetchall()
        print(f"  sales ({len(sales)}):", sales)

    print("\n=== Legacy albcab/faccab hoy Dunasoft ===")
    cod = c.get("legacy_codcli") or "008126"
    cur.execute(
        """
        SELECT seralb, numalb, fecha, hora, total, impcob, facturado
        FROM legacy.albcab
        WHERE btrim(codcli) IN (%s, regexp_replace(%s, '^0+', ''))
          AND fecha::date = CURRENT_DATE
        ORDER BY fecha, hora
        LIMIT 10
        """,
        (cod, cod),
    )
    for r in cur.fetchall():
        print(" albcab:", r)
    cur.execute(
        """
        SELECT numfac, fecfac, totfac, impcob1, impcob2, forpag1
        FROM legacy.faccab
        WHERE serfac = 'A' AND btrim(codcli) IN (%s, regexp_replace(%s, '^0+', ''))
          AND fecfac::date = CURRENT_DATE
        ORDER BY numfac
        LIMIT 10
        """,
        (cod, cod),
    )
    for r in cur.fetchall():
        print(" faccab:", r)

    cur.execute(
        """
        SELECT number, issue_date, total_amount, company_id::text, notes
        FROM invoices
        WHERE customer_id = %s AND issue_date = CURRENT_DATE
        ORDER BY created_at DESC LIMIT 5
        """,
        (cid,),
    )
    for r in cur.fetchall():
        print(" invoice:", r)

    cur.execute(
        "SELECT id, appointment_date, start_time, end_time, client_name FROM agenda_appointments WHERE id = %s",
        ("9afe31ee-46f7-483f-98b5-5d91086659dc",),
    )
    print("\n=== Detalle cita ===", cur.fetchone())

conn.close()
