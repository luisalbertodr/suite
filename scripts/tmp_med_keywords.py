import psycopg2, re
from pathlib import Path
from collections import defaultdict

ESTETICA = "5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4"
MEDICINA = "816af484-92a0-4f65-a5a7-1c907aa4bb3d"
url = [l.split("=", 1)[1].strip().strip('"') for l in Path(".env").read_text().splitlines() if l.startswith("SUPABASE_DB_URL=")][0]
conn = psycopg2.connect(url)
cur = conn.cursor()

cur.execute("SELECT name FROM article_families WHERE billing_company_id=%s AND company_id=%s", (MEDICINA, ESTETICA))
med_families = [r[0] for r in cur.fetchall()]
print("medicina families:", med_families)

cur.execute("""
SELECT a.codigo, a.descripcion, a.familia FROM articles a
WHERE COALESCE(a.billing_company_id, (SELECT billing_company_id FROM article_families af WHERE af.name=a.familia AND af.company_id=a.company_id)) = %s
AND a.company_id=%s
""", (MEDICINA, ESTETICA))
med_arts = cur.fetchall()
print("medicina articles count", len(med_arts))
print("sample", med_arts[:8])

# keyword search in invoice lines
keywords = ['MEDIC', 'BMED', 'SKYMED', 'ROSTRO', 'INGLES']
for kw in keywords:
    cur.execute("""
      SELECT count(*) FROM invoice_items ii
      JOIN invoices i ON i.id=ii.invoice_id
      WHERE i.company_id=%s AND ii.description ILIKE %s
    """, (ESTETICA, f'%{kw}%'))
    print(kw, cur.fetchone()[0])

conn.close()
