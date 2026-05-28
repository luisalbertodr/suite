import os, sys
from decimal import Decimal
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
TARGET = Decimal("12229.69")

print("=== Marzo faccab A: acumulado por dia ===")
cur.execute(
    f"""
    SELECT fecfac::date d, ROUND(SUM({num('totfac')})::numeric,2) t
    FROM legacy.faccab WHERE serfac='A' AND fecfac::date>='2026-03-01' AND fecfac::date<'2026-04-01'
    GROUP BY 1 ORDER BY 1
    """
)
acc = Decimal(0)
for r in cur.fetchall():
    acc += Decimal(str(r["t"]))
    if abs(acc - TARGET) < Decimal("1") or abs(acc - Decimal("16229.69")) < Decimal("1"):
        print(f"  {r['d']} day={r['t']} cum={acc}")

print(f"\nTotal marzo A: {acc}")

print("\n=== Buscar subconjunto que sume 12229.69 (por dia) ===")
cur.execute(
    f"""
    SELECT fecfac::date d, ROUND(SUM({num('totfac')})::numeric,2) t
    FROM legacy.faccab WHERE serfac='A' AND fecfac::date>='2026-03-01' AND fecfac::date<'2026-04-01'
    GROUP BY 1 ORDER BY 1
    """
)
days = [(r["d"], Decimal(str(r["t"]))) for r in cur.fetchall()]
for cut in range(len(days)):
    s = sum(t for _, t in days[: cut + 1])
    if abs(s - TARGET) < Decimal("0.02"):
        print(f"Corte hasta {days[cut][0]}: {s}")

print("\n=== Marzo: items_total vs faccab por citas con venta ===")
cur.execute(
    """
    SELECT
      COUNT(*) FILTER (WHERE s.total_amount > fc.amt + 0.02) over_cnt,
      ROUND(SUM(GREATEST(s.total_amount - fc.amt, 0))::numeric, 2) over_sum,
      COUNT(*) FILTER (WHERE s.total_amount < fc.amt - 0.02) under_cnt,
      ROUND(SUM(GREATEST(fc.amt - s.total_amount, 0))::numeric, 2) under_sum,
      COUNT(*) FILTER (WHERE fc.amt IS NULL) no_fc,
      ROUND(COALESCE(SUM(s.total_amount) FILTER (WHERE fc.amt IS NULL), 0)::numeric, 2) no_fc_sum
    FROM sales s
    JOIN agenda_appointments a ON a.id = s.appointment_id
    LEFT JOIN LATERAL (
      SELECT SUM(COALESCE(NULLIF(regexp_replace(btrim(f.totfac::text),',','.','g'),'')::numeric,0)) amt
      FROM legacy.faccab f
      WHERE btrim(coalesce(f.serfac::text,''))='A'
        AND btrim(coalesce(f.codcli::text,'')) = btrim(coalesce(a.legacy_codcli::text,''))
        AND f.fecfac::date = a.appointment_date
    ) fc ON true
    WHERE s.company_id=%s AND s.status='completed'
      AND s.created_at>='2026-03-01' AND s.created_at<'2026-04-01'
    """,
    (cid,),
)
print(dict(cur.fetchone()))

conn.close()
