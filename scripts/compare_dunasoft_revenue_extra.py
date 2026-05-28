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

def parse_dec(v):
    try:
        return Decimal(str(v).replace(",", "."))
    except Exception:
        return Decimal(0)

cid = get_company_id()
conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
cur = conn.cursor(cursor_factory=RealDictCursor)

# Build faccab A index by codcli+date
cur.execute(
    """
    SELECT codcli, fecfac, totfac, numfac
    FROM legacy.faccab
    WHERE btrim(coalesce(serfac::text,'')) = 'A'
      AND fecfac::date >= '2026-01-01' AND fecfac::date < '2026-04-01'
    """
)
faccab_idx = {}
for r in cur.fetchall():
    d = str(r["fecfac"])[:10]
    cod = str(r["codcli"] or "").strip()
    amt = parse_dec(r["totfac"])
    key = (cod, d)
    faccab_idx[key] = faccab_idx.get(key, Decimal(0)) + amt

cur.execute(
    """
    SELECT s.total_amount, s.ticket_number, a.legacy_codcli, a.appointment_date,
           left(a.start_time::text,10) AS st
    FROM sales s
    JOIN agenda_appointments a ON a.id = s.appointment_id
    WHERE s.company_id = %s AND s.status = 'completed'
      AND s.created_at >= '2026-01-01' AND s.created_at < '2026-04-01'
    """,
    (cid,),
)
matched = over = under = nofac = Decimal(0)
over_n = under_n = nofac_n = match_n = 0
march_over = Decimal(0)

for r in cur.fetchall():
    cod = str(r["legacy_codcli"] or "").strip()
    d = str(r["appointment_date"] or r["st"] or "")[:10]
    sale_amt = Decimal(str(r["total_amount"] or 0))
    fc = faccab_idx.get((cod, d))
    if fc is None:
        nofac += sale_amt
        nofac_n += 1
        continue
    diff = sale_amt - fc
    if abs(diff) < Decimal("0.02"):
        matched += sale_amt
        match_n += 1
    elif diff > 0:
        over += diff
        over_n += 1
        if d.startswith("2026-03"):
            march_over += diff
    else:
        under += -diff
        under_n += 1

total_suite = matched + over + under + nofac + (under * 0)  # under is negative diff accumulated separately
cur.execute(
    "SELECT ROUND(SUM(total_amount)::numeric,2) FROM sales WHERE company_id=%s AND status='completed' AND created_at>='2026-01-01' AND created_at<'2026-04-01' AND appointment_id IS NOT NULL",
    (cid,),
)
suite_q1 = list(cur.fetchone().values())[0]

print("Q1 Suite sales (appointments):", suite_q1)
print(f"Match faccab A codcli+date: {match_n} sales, {matched:.2f} EUR")
print(f"Over faccab: {over_n} sales, +{over:.2f} EUR")
print(f"Under faccab: {under_n} sales, -{under:.2f} EUR")
print(f"No faccab A match: {nofac_n} sales, {nofac:.2f} EUR")
print(f"March overpricing vs faccab A: +{march_over:.2f} EUR")

print("\n=== Marzo serfac A: top facturas que suman ~4000 ===")
cur.execute(
    """
    SELECT numfac, fecfac, totfac, codcli
    FROM legacy.faccab
    WHERE serfac='A' AND fecfac::date>='2026-03-01' AND fecfac::date<'2026-04-01'
    ORDER BY COALESCE(NULLIF(regexp_replace(btrim(totfac::text),',','.','g'),'')::numeric,0) DESC
    LIMIT 15
    """
)
rows = cur.fetchall()
s = Decimal(0)
for r in rows:
    a = parse_dec(r["totfac"])
    s += a
    print(r["numfac"], r["fecfac"], a, "codcli", r["codcli"])
print("top15 sum", s)

# Dunasoft march gap 4000
target = Decimal("4000")
cur.execute(
    """
    SELECT numfac, fecfac, totfac FROM legacy.faccab
    WHERE serfac='A' AND fecfac::date>='2026-03-01' AND fecfac::date<'2026-04-01'
    ORDER BY COALESCE(NULLIF(regexp_replace(btrim(totfac::text),',','.','g'),'')::numeric,0) DESC
    """
)
acc = Decimal(0)
print("\nFacturas A marzo acumuladas desde las mas grandes hasta ~4000:")
for r in cur.fetchall():
    a = parse_dec(r["totfac"])
    acc += a
    print(f"  +{a} (total {acc}) numfac={r['numfac']}")
    if acc >= target:
        break

conn.close()
