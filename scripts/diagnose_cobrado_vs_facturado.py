"""Compara totfac vs impcob vs Suite para saber qué refleja lo cobrado."""
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

num = lambda c: f"COALESCE(NULLIF(regexp_replace(btrim({c}::text),',','.','g'),'')::numeric,0)"
cid = get_company_id()
conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
cur = conn.cursor(cursor_factory=RealDictCursor)

DUNA = {"2026-01": 15218.23, "2026-02": 16455.0, "2026-03": 12229.69}

print("=== legacy.faccab serie A: facturado vs cobrado ===")
for ym in DUNA:
    y, m = ym.split("-")
    ms, me = f"{y}-{m}-01", f"{y}-{int(m)+1:02d}-01"
    cur.execute(
        f"""
        SELECT
          COUNT(*) docs,
          ROUND(SUM({num('totfac')})::numeric,2) totfac,
          ROUND(SUM({num('impcob1')}+{num('impcob2')})::numeric,2) impcob,
          ROUND(SUM({num('totimpbas')})::numeric,2) base,
          COUNT(*) FILTER (WHERE {num('impcob1')}+{num('impcob2')} >= {num('totfac')}-0.02) cobrado_total,
          COUNT(*) FILTER (WHERE {num('impcob1')}+{num('impcob2')} > 0.02 AND {num('impcob1')}+{num('impcob2')} < {num('totfac')}-0.02) cobrado_parcial,
          COUNT(*) FILTER (WHERE {num('impcob1')}+{num('impcob2')} <= 0.02) sin_cobro
        FROM legacy.faccab
        WHERE serfac='A' AND fecfac::date >= %s AND fecfac::date < %s
        """,
        (ms, me),
    )
    r = cur.fetchone()
    print(f"\n{ym} Dunasoft={DUNA[ym]}")
    print(f"  totfac (facturado):     {r['totfac']} ({r['docs']} docs)")
    print(f"  impcob1+2 (cobrado):    {r['impcob']}")
    print(f"  totimpbas (base):       {r['base']}")
    print(f"  docs cobrado=totfac:    {r['cobrado_total']}")
    print(f"  docs cobrado parcial:   {r['cobrado_parcial']}")
    print(f"  docs sin cobro:         {r['sin_cobro']}")

print("\n=== faccab A: pendiente de cobro por mes ===")
for ym in DUNA:
    y, m = ym.split("-")
    ms, me = f"{y}-{m}-01", f"{y}-{int(m)+1:02d}-01"
    cur.execute(
        f"""
        SELECT ROUND(SUM(GREATEST({num('totfac')}-({num('impcob1')}+{num('impcob2')}),0))::numeric,2) pendiente
        FROM legacy.faccab WHERE serfac='A' AND fecfac::date>=%s AND fecfac::date<%s
        """,
        (ms, me),
    )
    print(f"{ym}: {cur.fetchone()['pendiente']} EUR pendiente")

print("\n=== Suite Q1: qué suma el dashboard ===")
cur.execute(
    """
    SELECT ROUND(SUM(total_amount)::numeric,2) inv
    FROM invoices WHERE company_id=%s AND issue_date>='2026-01-01' AND issue_date<'2026-04-01'
      AND lower(coalesce(status,'')) NOT IN ('cancelled','void','anulada')
    """,
    (cid,),
)
print("Facturas (issue_date):", cur.fetchone()["inv"])
cur.execute(
    """
    SELECT payment_method, COUNT(*), ROUND(SUM(total_amount)::numeric,2)
    FROM sales WHERE company_id=%s AND status='completed' AND created_at>='2026-01-01' AND created_at<'2026-04-01'
    GROUP BY payment_method
    """,
    (cid,),
)
print("Sales por payment_method:")
for r in cur.fetchall():
    print(" ", dict(r))

print("\n=== Tablas de cobros/pagos en public ===")
cur.execute(
    """
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND (table_name ILIKE '%pay%' OR table_name ILIKE '%cobr%' OR table_name ILIKE '%cash%')
    ORDER BY 1
    """
)
print([r["table_name"] for r in cur.fetchall()])

print("\n=== sales columns related to payment ===")
cur.execute(
    """
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='sales'
      AND (column_name ILIKE '%pay%' OR column_name ILIKE '%cobr%' OR column_name ILIKE '%cash%')
    """
)
print([r["column_name"] for r in cur.fetchall()])

conn.close()
