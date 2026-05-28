import os, sys
from pathlib import Path
import psycopg2
from psycopg2.extras import RealDictCursor

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from legacy_company import get_company_id

for line in (ROOT / ".env").read_text().splitlines():
    if line.startswith("SUPABASE_DB_URL="):
        os.environ["SUPABASE_DB_URL"] = line.split("=", 1)[1].strip().strip('"')

cid = get_company_id()
conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
cur = conn.cursor(cursor_factory=RealDictCursor)
DUNA = {"2026-01": 15218.23, "2026-02": 16455.0, "2026-03": 12229.69}

print("=== Suite por mes (issue_date invoices + sales) ===")
for ym in DUNA:
    y, m = ym.split("-")
    ms, me = f"{y}-{m}-01", f"{y}-{int(m)+1:02d}-01"
    cur.execute(
        """
        SELECT ROUND(SUM(total_amount)::numeric,2) inv FROM invoices
        WHERE company_id=%s AND issue_date>=%s AND issue_date<%s
          AND status NOT IN ('cancelled','void','anulada')
        """,
        (cid, ms, me),
    )
    inv = cur.fetchone()["inv"] or 0
    cur.execute(
        """
        SELECT ROUND(SUM(total_amount)::numeric,2) tpv FROM sales
        WHERE company_id=%s AND created_at>=%s AND created_at<%s
          AND status='completed' AND appointment_id IS NULL
        """,
        (cid, ms, me),
    )
    tpv = cur.fetchone()["tpv"] or 0
    cur.execute(
        """
        SELECT ROUND(SUM(total_amount)::numeric,2) leg FROM sales
        WHERE company_id=%s AND created_at>=%s AND created_at<%s
          AND status='completed' AND appointment_id IS NOT NULL
        """,
        (cid, ms, me),
    )
    leg = cur.fetchone()["leg"] or 0
    total = float(inv) + float(tpv)
    print(
        f"{ym} Dunasoft={DUNA[ym]:.2f} | inv={inv} leg={leg} tpv={tpv} | dashboard={total:.2f} | diff={total-DUNA[ym]:+.2f}"
    )

print("\n=== fallback_paid sales Q1 (no faccab match, items>0) ===")
cur.execute(
    """
    SELECT COUNT(*), ROUND(SUM(s.total_amount)::numeric,2)
    FROM sales s
    JOIN agenda_appointments a ON a.id = s.appointment_id
    WHERE s.company_id=%s AND s.status='completed'
      AND s.created_at>='2026-01-01' AND s.created_at<'2026-04-01'
      AND NOT EXISTS (
        SELECT 1 FROM legacy.faccab f
        WHERE btrim(coalesce(f.serfac::text,''))='A'
          AND btrim(coalesce(f.codcli::text,'')) = btrim(coalesce(a.legacy_codcli::text,''))
          AND f.fecfac::date = a.appointment_date
      )
    """,
    (cid,),
)
r = cur.fetchone()
print(dict(r))

conn.close()
