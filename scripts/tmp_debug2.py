import psycopg2, re
from pathlib import Path
from collections import defaultdict

ESTETICA = "5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4"
MEDICINA = "816af484-92a0-4f65-a5a7-1c907aa4bb3d"
url = [l.split("=", 1)[1].strip().strip('"') for l in Path(".env").read_text().splitlines() if l.startswith("SUPABASE_DB_URL=")][0]
conn = psycopg2.connect(url)
cur = conn.cursor()
cur.execute("""
SELECT a.codigo, COALESCE(a.billing_company_id, af.billing_company_id, %s)
FROM articles a LEFT JOIN article_families af ON af.name=a.familia AND af.company_id=a.company_id
WHERE a.company_id=%s
""", (ESTETICA, ESTETICA))
by_code = {str(c).strip().upper(): b for c, b in cur.fetchall()}

def resolve(desc):
    d = (desc or "").strip()
    m = re.match(r"^([A-Za-z0-9._-]+)\s*[-–—]\s*", d)
    if m:
        return by_code.get(m.group(1).strip().upper(), ESTETICA)
    return ESTETICA

cur.execute("""
SELECT i.id, ii.description FROM invoices i
JOIN invoice_items ii ON ii.invoice_id=i.id WHERE i.company_id=%s
""", (ESTETICA,))
inv = defaultdict(set)
for iid, desc in cur.fetchall():
    inv[iid].add(resolve(desc))

mixed = [(i, s) for i, s in inv.items() if len(s) > 1]
print("mixed count", len(mixed))
print("sample sets", mixed[:5])

# invoices with medicina
med = [i for i,s in inv.items() if MEDICINA in s]
print("invoices with medicina", len(med))

conn.close()
