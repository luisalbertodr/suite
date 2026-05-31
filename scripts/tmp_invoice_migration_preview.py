import psycopg2
import re
from pathlib import Path

ESTETICA = "5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4"
MEDICINA = "816af484-92a0-4f65-a5a7-1c907aa4bb3d"

url = [l.split("=", 1)[1].strip().strip('"') for l in Path(".env").read_text().splitlines() if l.startswith("SUPABASE_DB_URL=")][0]
conn = psycopg2.connect(url)
cur = conn.cursor()

# Build article lookup: codigo -> billing, descripcion prefix
cur.execute("""
SELECT a.codigo, a.descripcion, a.billing_company_id, af.billing_company_id as fam_billing
FROM articles a
LEFT JOIN article_families af ON af.name = a.familia AND af.company_id = a.company_id
WHERE a.company_id = %s
""", (ESTETICA,))
articles_by_code = {}
articles_by_desc = {}
for codigo, desc, ab, fb in cur.fetchall():
    billing = ab or fb or ESTETICA
    articles_by_code[str(codigo).strip().upper()] = billing
    articles_by_desc[desc.strip().upper()] = billing

def resolve_line(desc: str):
    d = (desc or "").strip()
    if not d:
        return ESTETICA
    m = re.match(r"^([A-Za-z0-9._-]+)\s*[-–—]\s*", d)
    if m:
        code = m.group(1).strip().upper()
        if code in articles_by_code:
            return articles_by_code[code]
    # try full desc after dash
    parts = re.split(r"\s*[-–—]\s*", d, maxsplit=1)
    if len(parts) == 2:
        tail = parts[1].strip().upper()
        if tail in articles_by_desc:
            return articles_by_desc[tail]
    if d.upper() in articles_by_desc:
        return articles_by_desc[d.upper()]
    return ESTETICA

cur.execute("""
SELECT i.id, ii.description, ii.total_price
FROM invoices i
JOIN invoice_items ii ON ii.invoice_id = i.id
WHERE i.company_id = %s
""", (ESTETICA,))

from collections import defaultdict
invoice_billing = defaultdict(lambda: defaultdict(float))
line_stats = {"medicina": 0, "estetica": 0, "unmatched": 0}

for inv_id, desc, total in cur.fetchall():
    b = resolve_line(desc)
    invoice_billing[inv_id][b] += float(total or 0)
    if b == MEDICINA:
        line_stats["medicina"] += 1
    else:
        line_stats["estetica"] += 1

pure_m = pure_e = mixed = 0
for inv_id, amounts in invoice_billing.items():
    companies = [c for c, amt in amounts.items() if amt > 0]
    if len(companies) == 1:
        if companies[0] == MEDICINA:
            pure_m += 1
        else:
            pure_e += 1
    else:
        mixed += 1

print("Line stats:", line_stats)
print("Invoices pure medicina:", pure_m)
print("Invoices pure estetica:", pure_e)
print("Invoices mixed:", mixed)
print("Total invoices with items:", len(invoice_billing))

cur.execute("SELECT count(*) FROM invoices WHERE company_id = %s AND id NOT IN (SELECT DISTINCT invoice_id FROM invoice_items)", (ESTETICA,))
print("Invoices without items:", cur.fetchone()[0])

conn.close()
