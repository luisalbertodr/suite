import psycopg2, re
from pathlib import Path
from collections import defaultdict, Counter

ESTETICA = "5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4"
MEDICINA = "816af484-92a0-4f65-a5a7-1c907aa4bb3d"
url = [l.split("=", 1)[1].strip().strip('"') for l in Path(".env").read_text().splitlines() if l.startswith("SUPABASE_DB_URL=")][0]
conn = psycopg2.connect(url)
cur = conn.cursor()

cur.execute("""
SELECT a.codigo, a.legacy_codart, upper(trim(a.descripcion)),
  COALESCE(a.billing_company_id, af.billing_company_id, %s)
FROM articles a
LEFT JOIN article_families af ON af.name=a.familia AND af.company_id=a.company_id
WHERE a.company_id=%s
""", (ESTETICA, ESTETICA))
by_code, by_legacy, by_desc = {}, {}, {}
for codigo, legacy, desc, billing in cur.fetchall():
    by_code[str(codigo).strip().upper()] = billing
    if legacy:
        by_legacy[str(legacy).strip()] = billing
        by_legacy[str(legacy).strip().upper()] = billing
    if desc not in by_desc:
        by_desc[desc] = billing

def resolve(desc):
    d = (desc or "").strip()
    if not d:
        return ESTETICA
    m = re.match(r"^([A-Za-z0-9._-]+)\s*[-–—]\s*(.*)$", d)
    if m:
        code, tail = m.group(1).strip(), m.group(2).strip()
        cu = code.upper()
        if cu in by_code:
            return by_code[cu]
        if code in by_legacy:
            return by_legacy[code]
        if tail.upper() in by_desc:
            return by_desc[tail.upper()]
    if d.upper() in by_desc:
        return by_desc[d.upper()]
    return ESTETICA

cur.execute("""
SELECT i.id, ii.description, ii.total_price
FROM invoices i JOIN invoice_items ii ON ii.invoice_id=i.id
WHERE i.company_id=%s
""", (ESTETICA,))
inv = defaultdict(lambda: Counter())
line_b = Counter()
for iid, desc, tot in cur.fetchall():
    b = resolve(desc)
    inv[iid][b] += float(tot or 0)
    line_b[b] += 1

pure_m = pure_e = mixed = 0
for iid, amounts in inv.items():
    cos = [c for c, a in amounts.items() if a > 0]
    if len(cos) == 1:
        pure_m += cos[0] == MEDICINA
        pure_e += cos[0] == ESTETICA
    else:
        mixed += 1

print("lines by billing", dict(line_b))
print("pure medicina inv", pure_m)
print("pure estetica inv", pure_e)
print("mixed inv", mixed)

conn.close()
