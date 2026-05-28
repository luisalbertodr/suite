"""Tickets (sales) vs facturado (invoices): por qué difieren."""
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

print("=== Q1 2026: tickets vs facturas (global) ===")
cur.execute(
    """
    SELECT
      ROUND(SUM(s.total_amount)::numeric,2) sales_total,
      COUNT(*) sales_n,
      ROUND(SUM(i.total_amount)::numeric,2) inv_total,
      COUNT(DISTINCT i.id) inv_n
    FROM sales s
    FULL OUTER JOIN invoices i ON i.id = s.invoice_id
    WHERE (s.company_id = %s AND s.status='completed' AND s.created_at>='2026-01-01' AND s.created_at<'2026-04-01')
       OR (i.company_id = %s AND i.issue_date>='2026-01-01' AND i.issue_date<'2026-04-01'
           AND lower(coalesce(i.status,'')) NOT IN ('cancelled','void','anulada'))
    """,
    (cid, cid),
)
# Better separate queries

for label, sql, params in [
    ("Ventas completed Q1", """
        SELECT COUNT(*) n, ROUND(SUM(total_amount)::numeric,2) t,
               COUNT(*) FILTER (WHERE invoice_id IS NOT NULL) with_inv,
               COUNT(*) FILTER (WHERE invoice_id IS NULL) without_inv,
               ROUND(SUM(total_amount) FILTER (WHERE invoice_id IS NULL)::numeric,2) no_inv_sum
        FROM sales WHERE company_id=%s AND status='completed'
          AND created_at>='2026-01-01' AND created_at<'2026-04-01'
    """, (cid,)),
    ("Facturas Q1 (issue_date)", """
        SELECT COUNT(*) n, ROUND(SUM(total_amount)::numeric,2) t
        FROM invoices WHERE company_id=%s AND issue_date>='2026-01-01' AND issue_date<'2026-04-01'
          AND lower(coalesce(status,'')) NOT IN ('cancelled','void','anulada')
    """, (cid,)),
    ("Facturas legacy auto Q1", """
        SELECT COUNT(*) n, ROUND(SUM(total_amount)::numeric,2) t
        FROM invoices WHERE company_id=%s AND issue_date>='2026-01-01' AND issue_date<'2026-04-01'
          AND notes ILIKE '%%Factura legacy autom%%'
    """, (cid,)),
]:
    cur.execute(sql, params)
    print(f"\n{label}:", dict(cur.fetchone()))

print("\n=== Por mes: ventas vs facturas ===")
for ym, ms, me in [("2026-01","2026-01-01","2026-02-01"),("2026-02","2026-02-01","2026-03-01"),("2026-03","2026-03-01","2026-04-01")]:
    cur.execute(
        """SELECT ROUND(SUM(total_amount)::numeric,2) t, COUNT(*) n FROM sales
           WHERE company_id=%s AND status='completed' AND created_at>=%s AND created_at<%s""",
        (cid, ms, me),
    )
    s = cur.fetchone()
    cur.execute(
        """SELECT ROUND(SUM(total_amount)::numeric,2) t, COUNT(*) n FROM invoices
           WHERE company_id=%s AND issue_date>=%s AND issue_date<%s
             AND lower(coalesce(status,'')) NOT IN ('cancelled','void','anulada')""",
        (cid, ms, me),
    )
    i = cur.fetchone()
    cur.execute(
        """SELECT COUNT(*) AS count, ROUND(SUM(s.total_amount)::numeric,2) AS round FROM sales s
           WHERE s.company_id=%s AND s.status='completed' AND s.created_at>=%s AND s.created_at<%s
             AND s.invoice_id IS NULL""",
        (cid, ms, me),
    )
    no = cur.fetchone()
    print(f"{ym}: sales {s['t']} ({s['n']}) | invoices {i['t']} ({i['n']}) | diff {float(s['t'] or 0)-float(i['t'] or 0):+.2f} | sin factura {no['round']} ({no['count']} tickets)")

print("\n=== Ventas sin factura (detalle Q1) ===")
cur.execute(
    """
    SELECT ticket_number, total_amount, created_at::date d, appointment_id IS NOT NULL AS from_apt
    FROM sales WHERE company_id=%s AND status='completed' AND invoice_id IS NULL
      AND created_at>='2026-01-01' AND created_at<'2026-04-01'
    ORDER BY created_at
    """,
    (cid,),
)
for r in cur.fetchall():
    print(dict(r))

print("\n=== Facturas sin venta enlazada (huérfanas) Q1 ===")
cur.execute(
    """
    SELECT COUNT(*), ROUND(SUM(i.total_amount)::numeric,2)
    FROM invoices i
    WHERE i.company_id=%s AND i.issue_date>='2026-01-01' AND i.issue_date<'2026-04-01'
      AND NOT EXISTS (SELECT 1 FROM sales s WHERE s.invoice_id = i.id)
    """,
    (cid,),
)
print("count/sum:", cur.fetchone())

print("\n=== Parejas sale-invoice: importe distinto ===")
cur.execute(
    """
    SELECT COUNT(*), ROUND(SUM(ABS(s.total_amount - i.total_amount))::numeric,2)
    FROM sales s JOIN invoices i ON i.id = s.invoice_id
    WHERE s.company_id=%s AND s.created_at>='2026-01-01' AND s.created_at<'2026-04-01'
      AND ABS(s.total_amount - i.total_amount) > 0.02
    """,
    (cid,),
)
print("mismatch count / sum diff:", cur.fetchone())

print("\n=== Parejas sale-invoice: fecha distinta (created_at vs issue_date) ===")
cur.execute(
    """
    SELECT COUNT(*) FILTER (WHERE s.created_at::date <> i.issue_date) diff_date,
           COUNT(*) total
    FROM sales s JOIN invoices i ON i.id = s.invoice_id
    WHERE s.company_id=%s AND s.created_at>='2026-01-01' AND s.created_at<'2026-04-01'
    """,
    (cid,),
)
print(dict(cur.fetchone()))

print("\n=== Legacy Q1: albcab (tickets) vs faccab (facturas) ===")
num = lambda c: f"COALESCE(NULLIF(regexp_replace(btrim({c}::text),',','.','g'),'')::numeric,0)"
for ym, ms, me in [("2026-01","2026-01-01","2026-02-01"),("2026-02","2026-02-01","2026-03-01"),("2026-03","2026-03-01","2026-04-01")]:
    cur.execute(f"SELECT COUNT(*), ROUND(SUM({num('totfac')})::numeric,2) FROM legacy.faccab WHERE fecfac::date>=%s AND fecfac::date<%s", (ms, me))
    fc = cur.fetchone()
    cur.execute(f"SELECT COUNT(*), ROUND(SUM({num('total')})::numeric,2) FROM legacy.albcab WHERE fecha::date>=%s AND fecha::date<%s", (ms, me))
    al = cur.fetchone()
    cur.execute(f"SELECT COUNT(*), ROUND(SUM({num('impcob')})::numeric,2) FROM legacy.albcab WHERE fecha::date>=%s AND fecha::date<%s AND {num('impcob')}>0", (ms, me))
    alc = cur.fetchone()
    print(f"{ym}: faccab {fc[1]} ({fc[0]} docs) | albcab total {al[1]} ({al[0]}) | albcab impcob {alc[1]} ({alc[0]})")

conn.close()
