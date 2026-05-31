import psycopg2
from pathlib import Path

ESTETICA = "5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4"
url = [l.split("=", 1)[1].strip().strip('"') for l in Path(".env").read_text().splitlines() if l.startswith("SUPABASE_DB_URL=")][0]
conn = psycopg2.connect(url)
cur = conn.cursor()

cur.execute("SELECT count(*) FROM sales WHERE invoice_id IS NOT NULL")
print("sales with invoice:", cur.fetchone())

cur.execute("""
SELECT column_name FROM information_schema.columns
WHERE table_name='sale_items' AND table_schema='public'
""")
print("sale_items cols:", [r[0] for r in cur.fetchall()])

cur.execute("""
SELECT count(*) FROM sale_items si WHERE si.article_id IS NOT NULL
""")
print("sale_items with article_id:", cur.fetchone())

cur.execute("""
SELECT count(*) FROM invoices i
JOIN sales s ON s.invoice_id = i.id
WHERE i.company_id = %s
""", (ESTETICA,))
print("estetica invoices linked to sales:", cur.fetchone())

cur.execute("SELECT legacy_codart, count(*) FROM articles WHERE company_id=%s AND legacy_codart IS NOT NULL GROUP BY 1 LIMIT 5", (ESTETICA,))
print("legacy_codart sample:", cur.fetchall())

cur.execute("SELECT count(*) FROM articles WHERE company_id=%s AND legacy_codart IS NOT NULL", (ESTETICA,))
print("articles with legacy_codart:", cur.fetchone())

conn.close()
