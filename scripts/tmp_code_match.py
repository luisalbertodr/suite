import psycopg2, re
from pathlib import Path
from collections import Counter

ESTETICA = "5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4"
MEDICINA = "816af484-92a0-4f65-a5a7-1c907aa4bb3d"
url = [l.split("=", 1)[1].strip().strip('"') for l in Path(".env").read_text().splitlines() if l.startswith("SUPABASE_DB_URL=")][0]
conn = psycopg2.connect(url)
cur = conn.cursor()

cur.execute("""
SELECT a.codigo, COALESCE(a.billing_company_id, af.billing_company_id, %s)
FROM articles a
LEFT JOIN article_families af ON af.name=a.familia AND af.company_id=a.company_id
WHERE a.company_id=%s
""", (ESTETICA, ESTETICA))
by_code = {str(c).strip().upper(): b for c, b in cur.fetchall()}

cur.execute("""
SELECT a.legacy_codart, COALESCE(a.billing_company_id, af.billing_company_id, %s)
FROM articles a
LEFT JOIN article_families af ON af.name=a.familia AND af.company_id=a.company_id
WHERE a.company_id=%s AND a.legacy_codart IS NOT NULL AND a.legacy_codart ~ '^[0-9]+$'
""", (ESTETICA, ESTETICA))
by_legacy = {}
for lc, b in cur.fetchall():
    by_legacy[str(lc).strip()] = b
print("numeric legacy codarts", len(by_legacy))

cur.execute("""
SELECT ii.description FROM invoice_items ii
JOIN invoices i ON i.id=ii.invoice_id
WHERE i.company_id=%s LIMIT 5000
""", (ESTETICA,))
matched = Counter()
billing_hits = Counter()
for (desc,) in cur.fetchall():
    m = re.match(r"^([A-Za-z0-9._-]+)\s*[-–—]\s*", (desc or "").strip())
    if not m:
        continue
    code = m.group(1).strip()
    matched["total_parsed"] += 1
    cu = code.upper()
    if cu in by_code:
        matched["by_codigo"] += 1
        billing_hits[by_code[cu]] += 1
    elif code in by_legacy:
        matched["by_legacy"] += 1
        billing_hits[by_legacy[code]] += 1
    else:
        matched["no_match"] += 1

print("match stats sample 5k:", dict(matched))
print("billing hits:", billing_hits)

conn.close()
