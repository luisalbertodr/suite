from pathlib import Path
import psycopg2

E = "5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4"
M = "816af484-92a0-4f65-a5a7-1c907aa4bb3d"
url = [l.split("=", 1)[1].strip().strip('"') for l in Path(".env").read_text(encoding="utf-8").splitlines() if l.startswith("SUPABASE_DB_URL=")][0]
conn = psycopg2.connect(url)
cur = conn.cursor()

cur.execute(
    """
    SELECT i.number, i.issue_date, i.total_amount, i.company_id,
           string_agg(ii.description, ' | ')
    FROM invoices i
    JOIN invoice_items ii ON ii.invoice_id = i.id
    WHERE i.issue_date >= '2026-05-01' AND i.issue_date < '2026-06-01'
      AND (ii.description ILIKE '%%sculptra%%' OR ii.description ILIKE '%%scupltra%%')
    GROUP BY i.id, i.number, i.issue_date, i.total_amount, i.company_id
    ORDER BY i.issue_date
    """
)
print("=== Facturas mayo SCULPTRA ===")
for r in cur.fetchall():
    print(r)

cur.execute(
    """
    SELECT codigo, descripcion, familia, billing_company_id
    FROM articles
    WHERE company_id = %s AND (descripcion ILIKE '%%sculptra%%' OR codigo ILIKE '%%sculp%%')
    """,
    (E,),
)
print("\n=== Artículos catálogo ===")
for r in cur.fetchall():
    print(r)

cur.execute(
    """
    SELECT name, billing_company_id FROM article_families
    WHERE company_id = %s AND name ILIKE '%%sculp%%'
    """,
    (E,),
)
print("\n=== Familias ===", cur.fetchall())

cur.execute(
    """
    SELECT i.number, i.issue_date, i.total_amount, i.company_id::text, ii.description
    FROM invoices i
    JOIN invoice_items ii ON ii.invoice_id = i.id
    WHERE i.issue_date >= '2026-05-01' AND i.issue_date < '2026-06-01'
      AND i.company_id = %s
      AND (i.total_amount IN (500, 550) OR i.number IN ('007695', '000871'))
    ORDER BY i.issue_date
    """,
    (M,),
)
print("\n=== Medicina mayo 500/550 o nums legacy ===")
for r in cur.fetchall():
    print(r)

cur.execute(
    """
    SELECT i.number, i.issue_date, i.total_amount, i.company_id::text
    FROM invoices i
    WHERE i.issue_date >= '2026-05-01' AND i.issue_date < '2026-06-01'
      AND i.total_amount IN (500, 550)
    ORDER BY i.issue_date
    """
)
print("\n=== Todas facturas mayo 500/550 ===")
for r in cur.fetchall():
    print(r)

cur.execute(
    """
    SELECT i.number, i.issue_date, i.company_id::text, ii.description, i.total_amount
    FROM invoices i JOIN invoice_items ii ON ii.invoice_id = i.id
    WHERE i.number IN ('FAC-060098', 'FAC-060373')
    """
)
print("\n=== Líneas FAC-060098 / FAC-060373 ===")
for r in cur.fetchall():
    print(r)

cur.execute(
    "SELECT number, issue_date, company_id::text, total_amount FROM invoices WHERE number LIKE '%%007695%%' OR number LIKE '%%000871%%' OR number LIKE '%%060098%%'"
)
print("\n=== Por número legacy ===")
for r in cur.fetchall():
    print(r)

conn.close()
