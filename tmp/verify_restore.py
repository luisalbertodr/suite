import os
from pathlib import Path
import psycopg2
from psycopg2.extras import RealDictCursor

ROOT = Path(__file__).resolve().parents[1]
for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"'))
conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
cur = conn.cursor(cursor_factory=RealDictCursor)
cur.execute(
    """
    SELECT number FROM public.invoices
    WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4' AND issue_date = '2012-01-01'
    ORDER BY number LIMIT 3
    """
)
print("2012 sample:", [r["number"] for r in cur.fetchall()])
cur.execute(
    """
    SELECT count(*)::int AS n FROM public.agenda_appointments
    WHERE appointment_date = '2026-06-11' AND legacy_idplan IS NOT NULL
    """
)
print("Citas legacy 2026-06-11:", cur.fetchone())
cur.execute(
    """
    SELECT count(*)::int FROM public.sales s
    JOIN public.agenda_appointments a ON a.id = s.appointment_id
    WHERE a.appointment_date >= '2026-06-04' AND s.ticket_number LIKE 'LEG-%'
    """
)
print("LEG sales desde 2026-06-04:", cur.fetchone())
cur.execute(
    """
    SELECT session_date, closing_cash, notes FROM public.cash_register_sessions
    ORDER BY session_date DESC LIMIT 3
    """
)
print("últimas cajas:", cur.fetchall())
conn.close()
