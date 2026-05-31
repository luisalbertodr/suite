import psycopg2
from pathlib import Path

ESTETICA = "5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4"
MEDICINA = "816af484-92a0-4f65-a5a7-1c907aa4bb3d"
url = [l.split("=", 1)[1].strip().strip('"') for l in Path(".env").read_text().splitlines() if l.startswith("SUPABASE_DB_URL=")][0]
conn = psycopg2.connect(url)
cur = conn.cursor()

cur.execute("""
SELECT a.descripcion,
  COALESCE(a.billing_company_id, af.billing_company_id, %s) as billing
FROM articles a
LEFT JOIN article_families af ON af.name=a.familia AND af.company_id=a.company_id
WHERE a.company_id=%s AND a.descripcion ILIKE '%%Rostro%%'
""", (ESTETICA, ESTETICA))
print("Rostro articles:", cur.fetchall()[:15])

# Build desc map - if duplicate desc with different billing, mark ambiguous
cur.execute("""
SELECT upper(trim(a.descripcion)),
  COALESCE(a.billing_company_id, af.billing_company_id, %s)
FROM articles a
LEFT JOIN article_families af ON af.name=a.familia AND af.company_id=a.company_id
WHERE a.company_id=%s AND a.estado='activo'
""", (ESTETICA, ESTETICA))
from collections import defaultdict
desc_billing = defaultdict(set)
for d, b in cur.fetchall():
    desc_billing[d].add(b)
ambiguous = {d for d, s in desc_billing.items() if len(s) > 1}
print("ambiguous descriptions", len(ambiguous))
print("sample ambiguous", list(ambiguous)[:5])

conn.close()
