import psycopg2, re
from pathlib import Path
from collections import defaultdict

ESTETICA = "5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4"
MEDICINA = "816af484-92a0-4f65-a5a7-1c907aa4bb3d"
url = [l.split("=", 1)[1].strip().strip('"') for l in Path(".env").read_text().splitlines() if l.startswith("SUPABASE_DB_URL=")][0]
conn = psycopg2.connect(url)
cur = conn.cursor()

cur.execute("""
SELECT upper(trim(a.codigo)), upper(trim(coalesce(a.legacy_codart,''))),
  COALESCE(a.billing_company_id, af.billing_company_id, %s::uuid)
FROM articles a
LEFT JOIN article_families af ON af.name=a.familia AND af.company_id=a.company_id
WHERE a.company_id=%s
""", (ESTETICA, ESTETICA))
by_code = {}
for codigo, legacy, billing in cur.fetchall():
    if codigo: by_code[codigo] = billing
    if legacy: by_code[legacy] = billing

def resolve(desc):
    m = re.match(r"^([A-Za-z0-9._-]+)\s*[-–—]\s*", (desc or "").strip())
    if m:
        return by_code.get(m.group(1).strip().upper(), ESTETICA)
    return ESTETICA

cur.execute("""
SELECT s.id FROM sales s
WHERE s.company_id=%s OR s.company_id IS NULL
""", (ESTETICA,))
# sales with items
cur.execute("""
SELECT s.id, si.description FROM sales s
JOIN sale_items si ON si.sale_id=s.id
WHERE s.company_id IN (%s, %s) OR s.host_company_id=%s
""", (ESTETICA, MEDICINA, ESTETICA))
sale_b = defaultdict(set)
for sid, desc in cur.fetchall():
    sale_b[sid].add(resolve(desc))

move = sum(1 for s in sale_b if s=={MEDICINA})
print("sales to medicina", move, "of", len(sale_b))

conn.close()
