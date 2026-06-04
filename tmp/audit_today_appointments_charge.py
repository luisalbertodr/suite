"""Simula por qué citas de hoy no permiten cobro en TPV."""
import json
import re
from decimal import Decimal
from pathlib import Path

import psycopg2
from psycopg2.extras import RealDictCursor

ROOT = Path(__file__).resolve().parents[1]
COMPANY = "5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4"


def load_db():
    for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
        if line.startswith("SUPABASE_DB_URL="):
            db = line.split("=", 1)[1].strip().strip('"').strip("'")
            return re.sub(r"@([^/:]+):\d+/", "@127.0.0.1:15432/", db)
    raise SystemExit("no db")


def line_total(kind, notes):
    qty, unit = Decimal("1"), Decimal("0")
    if notes and str(notes).startswith("__pricing__"):
        try:
            p = json.loads(str(notes)[len("__pricing__") :])
            qty = Decimal(str(p.get("quantity", 1)))
            unit = Decimal(str(p.get("unit_price", 0)))
        except Exception:
            pass
    if kind == "bonus":
        return qty * unit
    return qty * unit


conn = psycopg2.connect(load_db())
cur = conn.cursor(cursor_factory=RealDictCursor)
cur.execute(
    """
    SELECT a.id, COALESCE(a.appointment_date, a.start_time::date) d,
           substring(a.start_time::text,12,5) hora, a.status, c.name,
           (SELECT COUNT(*) FROM sales s WHERE s.appointment_id=a.id AND s.status='completed') n_sales,
           (SELECT COALESCE(SUM(s.total_amount),0) FROM sales s WHERE s.appointment_id=a.id AND s.status='completed') sales_sum
    FROM agenda_appointments a
    LEFT JOIN customers c ON c.id=a.customer_id
    WHERE a.company_id=%s AND COALESCE(a.appointment_date,a.start_time::date)=CURRENT_DATE
      AND COALESCE(a.status,'confirmed')<>'cancelled'
    ORDER BY hora
    LIMIT 25
    """,
    (COMPANY,),
)
rows = cur.fetchall()
print(f"Citas hoy (no canceladas): {len(rows)}\n")
for r in rows:
    cur.execute(
        "SELECT kind, notes FROM appointment_items WHERE appointment_id=%s",
        (r["id"],),
    )
    items = cur.fetchall()
    charge = sum(line_total(i["kind"], i["notes"]) for i in items)
    reason = "OK cobrar"
    if r["status"] == "cancelled":
        reason = "cancelada"
    elif float(r["sales_sum"] or 0) >= float(charge) - 0.01 and charge > 0:
        reason = "ya cobrada"
    elif charge <= 0 and int(r["n_sales"]) == 0:
        reason = "importe 0 (bono/serie 00?)"
    elif charge <= 0 and int(r["n_sales"]) > 0:
        reason = "ticket con importe 0"
    print(f"{r['hora']} {r['name'] or '?'} | items={len(items)} importe={charge:.2f} | sales={r['n_sales']} ({r['sales_sum']}) | {reason}")

cur.execute(
    """
    SELECT COUNT(*) FROM invoices i
    WHERE i.issue_date >= CURRENT_DATE
      AND i.notes ILIKE '%%Legacy FACCAB%%'
    """
)
print(f"\nFacturas legacy FACCAB con fecha emisión >= hoy: {cur.fetchone()['count']}")
conn.close()
