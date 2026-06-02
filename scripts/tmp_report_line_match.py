import re
from pathlib import Path
import psycopg2

E = "5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4"
M = "816af484-92a0-4f65-a5a7-1c907aa4bb3d"
url = [l.split("=", 1)[1].strip().strip('"') for l in Path(".env").read_text(encoding="utf-8").splitlines() if l.startswith("SUPABASE_DB_URL=")][0]
conn = psycopg2.connect(url)
cur = conn.cursor()
cur.execute("SELECT codigo, familia FROM articles WHERE company_id=%s", (E,))
by_code = {}
for codigo, familia in cur.fetchall():
    if codigo:
        by_code[str(codigo).strip().upper()] = familia

def parse_code(desc):
    m = re.match(r"^([A-Za-z0-9._-]+)\s*[-–—]\s*", (desc or "").strip())
    return m.group(1).strip().upper() if m else None

cur.execute(
    """
    SELECT DISTINCT ii.description FROM invoices i
    JOIN invoice_items ii ON ii.invoice_id=i.id
    WHERE i.company_id=%s AND i.issue_date>='2026-05-01' AND i.issue_date<'2026-06-01'
    """,
    (M,),
)
med_fams = {"025-MEDICINA ESTETICA", "23-BMED", "33-SKYMEDIC"}
# codigos per catalog family name
cur.execute(
    "SELECT familia, array_agg(upper(trim(codigo))) FROM articles WHERE company_id=%s AND familia = ANY(%s) GROUP BY familia",
    (E, list(med_fams)),
)
codigos_by_fam = {r[0]: set(r[1] or []) for r in cur.fetchall()}
print("codigos por familia med:", {k: len(v) for k, v in codigos_by_fam.items()})

matched = unmatched = 0
for (desc,) in cur.fetchall():
    code = parse_code(desc)
    fam = by_code.get(code) if code else None
    hit = any(code in codigos_by_fam.get(f, set()) for f in med_fams) if code else False
    if hit:
        matched += 1
    else:
        unmatched += 1
        if unmatched <= 10:
            print("NO", repr(desc), "code", code, "article.familia", fam)
print("matched by codigo in med family sets", matched, "unmatched", unmatched)
conn.close()
