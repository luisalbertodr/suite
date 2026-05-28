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

DUNA = {"2026-01": 15218.23, "2026-02": 16455.0, "2026-03": 12229.69}
cid = get_company_id()
conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
cur = conn.cursor(cursor_factory=RealDictCursor)

for ym in DUNA:
    y, m = ym.split("-")
    ms, me = f"{y}-{m}-01", f"{y}-{int(m)+1:02d}-01"
    cur.execute(
        """
        SELECT
          ROUND(SUM(s.total_amount)::numeric,2) suite,
          ROUND(SUM(fc.amt)::numeric,2) faccab_a,
          ROUND(SUM(GREATEST(s.total_amount - COALESCE(fc.amt,0), 0))::numeric,2) excess_items,
          ROUND(COALESCE(SUM(s.total_amount) FILTER (WHERE fc.amt IS NULL),0)::numeric,2) no_faccab,
          COUNT(*) FILTER (WHERE fc.amt IS NULL) no_faccab_n
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
          AND s.created_at>=%s AND s.created_at<%s
        """,
        (cid, ms, me),
    )
    r = cur.fetchone()
    duna = DUNA[ym]
    print(f"\n{ym} Dunasoft={duna:.2f}")
    print(f"  Suite ventas cita: {r['suite']}")
    print(f"  Si usara faccab A emparejado: {r['faccab_a']}")
    print(f"  Exceso precio items vs faccab: +{r['excess_items']}")
    print(f"  Sin faccab A (fallback): {r['no_faccab']} ({r['no_faccab_n']} tickets)")
    print(f"  Desfase Suite-Dunasoft: {float(r['suite'])-duna:+.2f}")

conn.close()
