import psycopg2, re
from pathlib import Path
from collections import defaultdict

ESTETICA = "5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4"
MEDICINA = "816af484-92a0-4f65-a5a7-1c907aa4bb3d"
url = [l.split("=", 1)[1].strip().strip('"') for l in Path(".env").read_text().splitlines() if l.startswith("SUPABASE_DB_URL=")][0]
conn = psycopg2.connect(url)
cur = conn.cursor()
cur.execute("""
SELECT a.codigo, a.billing_company_id, af.billing_company_id
FROM articles a
LEFT JOIN article_families af ON af.name=a.familia AND af.company_id=a.company_id
WHERE a.company_id=%s
""", (ESTETICA,))
by_code = {}
for codigo, ab, fb in cur.fetchall():
    by_code[str(codigo).strip().upper()] = ab or fb or ESTETICA

cur.execute("""
SELECT i.id, ii.description FROM invoices i
JOIN invoice_items ii ON ii.invoice_id=i.id WHERE i.company_id=%s
""", (ESTETICA,))
inv_cos = defaultdict(set)
med_lines = []
for iid, desc in cur.fetchall():
    m = re.match(r"^([A-Za-z0-9._-]+)\s*[-–—]\s*", (desc or "").strip())
    b = by_code.get(m.group(1).strip().upper(), ESTETICA) if m else ESTETICA
    inv_cos[iid].add(b)
    if b == MEDICINA:
        med_lines.append((iid, desc))

mixed = [i for i, s in inv_cos.items() if len(s) > 1]
print("medicina lines", len(med_lines))
print("mixed invoices", len(mixed))
print("sample med lines", med_lines[:5])
if mixed[:3]:
    for mid in mixed[:3]:
        cur.execute("SELECT description FROM invoice_items WHERE invoice_id=%s", (mid,))
        print("mixed inv", mid, cur.fetchall())

# duplicate codigos?
cur.execute("SELECT codigo, count(*), array_agg(distinct billing_company_id) FROM articles WHERE company_id=%s GROUP BY codigo HAVING count(*)>1", (ESTETICA,))
print("dup codigos", cur.fetchall()[:5])

conn.close()
