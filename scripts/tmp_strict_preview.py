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
    if codigo:
        by_code[codigo] = billing
    if legacy:
        by_code[legacy] = billing

def resolve(desc):
    d = (desc or "").strip()
    m = re.match(r"^([A-Za-z0-9._-]+)\s*[-–—]\s*", d)
    if m:
        return by_code.get(m.group(1).strip().upper(), ESTETICA)
    return ESTETICA

cur.execute("""
SELECT i.id, ii.id as line_id, ii.description, ii.total_price,
  i.subtotal, i.tax_amount, i.total_amount, i.customer_id, i.issue_date, i.number
FROM invoices i JOIN invoice_items ii ON ii.invoice_id=i.id
WHERE i.company_id=%s
""", (ESTETICA,))
rows = cur.fetchall()

inv_lines = defaultdict(list)
for r in rows:
    inv_lines[r[0]].append(r)

stats = {"move_medicina": 0, "stay_estetica": 0, "mixed": 0, "med_lines": 0}
mixed_ids = []
for iid, lines in inv_lines.items():
    billings = {resolve(l[2]) for l in lines}
    if billings == {MEDICINA}:
        stats["move_medicina"] += 1
    elif MEDICINA in billings:
        stats["mixed"] += 1
        mixed_ids.append(iid)
        stats["med_lines"] += sum(1 for l in lines if resolve(l[2]) == MEDICINA)
    else:
        stats["stay_estetica"] += 1

print(stats)
if mixed_ids:
    iid = mixed_ids[0]
    print("sample mixed", [(l[2], resolve(l[2])==MEDICINA) for l in inv_lines[iid][:5]])

conn.close()
