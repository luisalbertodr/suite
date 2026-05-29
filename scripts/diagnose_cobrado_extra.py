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

print("=== Suite invoices paid_status Q1 ===")
cur.execute(
    """
    SELECT paid_status, COUNT(*), ROUND(SUM(total_amount)::numeric,2)
    FROM invoices WHERE company_id=%s AND issue_date>='2026-01-01' AND issue_date<'2026-04-01'
    GROUP BY paid_status ORDER BY paid_status NULLS FIRST
    """,
    (cid,),
)
for r in cur.fetchall():
    print(dict(r))

print("\n=== legacy albcab Q1 (all series) ===")
cur.execute(
    f"""
    SELECT COUNT(*) n,
           ROUND(SUM({num('total')})::numeric,2) total,
           ROUND(SUM({num('impcob')})::numeric,2) impcob,
           COUNT(*) FILTER (WHERE {num('impcob')}>0) with_impcob
    FROM legacy.albcab WHERE fecha::date>='2026-01-01' AND fecha::date<'2026-04-01'
    """
)
print(dict(cur.fetchone()))

print("\n=== legacy albcab ever (sample months 2025) ===")
for ym in ["2025-01", "2025-06", "2025-12"]:
    y, m = ym.split("-")
    ms, me = f"{y}-{m}-01", f"{y}-{int(m)+1:02d}-01"
    cur.execute(
        f"SELECT COUNT(*), ROUND(SUM({num('impcob')})::numeric,2) FROM legacy.albcab WHERE fecha::date>=%s AND fecha::date<%s",
        (ms, me),
    )
    print(ym, cur.fetchone())

print("\n=== Cobrado real Dunasoft Q1 = faccab A impcob + albcab impcob? ===")
for ym in ["2026-01", "2026-02", "2026-03"]:
    y, m = ym.split("-")
    ms, me = f"{y}-{m}-01", f"{y}-{int(m)+1:02d}-01"
    cur.execute(
        f"SELECT ROUND(SUM({num('impcob1')}+{num('impcob2')})::numeric,2) FROM legacy.faccab WHERE serfac='A' AND fecfac::date>=%s AND fecfac::date<%s",
        (ms, me),
    )
    fc = cur.fetchone()[list(cur.fetchone.__class__.__dict__.keys())[0] if False else list(cur.description)[0].name]
    # fix - use dict
    cur.execute(
        f"SELECT ROUND(SUM({num('impcob1')}+{num('impcob2')})::numeric,2) imp FROM legacy.faccab WHERE serfac='A' AND fecfac::date>=%s AND fecfac::date<%s",
        (ms, me),
    )
    imp_a = list(cur.fetchone().values())[0]
    cur.execute(
        f"SELECT ROUND(SUM({num('impcob')})::numeric,2) imp FROM legacy.albcab WHERE fecha::date>=%s AND fecha::date<%s",
        (ms, me),
    )
    imp_alb = list(cur.fetchone().values())[0]
    print(f"{ym}: faccab A impcob={imp_a} + albcab impcob={imp_alb or 0}")

conn.close()
