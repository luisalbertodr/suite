import psycopg2
from pathlib import Path

url = [
    l.split("=", 1)[1].strip().strip('"')
    for l in Path(".env").read_text(encoding="utf-8").splitlines()
    if l.startswith("SUPABASE_DB_URL=")
][0]
HUB = "5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4"
MED_BILL = "816af484-92a0-4f65-a5a7-1c907aa4bb3d"
conn = psycopg2.connect(url)
cur = conn.cursor()
cur.execute(
    "SELECT name, billing_company_id FROM article_families WHERE company_id=%s ORDER BY name",
    (HUB,),
)
print("=== FAMILIES ===")
for n, b in cur.fetchall():
    tag = "MED" if str(b) == MED_BILL else ("EST" if str(b) == HUB else str(b))
    print(f"{tag:4} {n}")
cur.execute(
    """
    SELECT codigo, descripcion, familia, billing_company_id
    FROM articles WHERE company_id=%s AND upper(familia) LIKE %s
    ORDER BY codigo LIMIT 40
    """,
    (HUB, "%09%FACIAL%"),
)
print("=== 09-FACIAL sample ===")
for r in cur.fetchall():
    print(r)
cur.execute(
    """
    SELECT codigo, descripcion, familia, billing_company_id
    FROM articles WHERE company_id=%s AND (
      upper(descripcion) LIKE %s OR upper(descripcion) LIKE %s
      OR upper(codigo) LIKE %s OR upper(descripcion) LIKE %s
    )
    """,
    (HUB, "%FOTREJ%", "%MANCHA%", "%FOT%", "%FOTORREJ%"),
)
print("=== Fotrej/manchas ===")
for r in cur.fetchall():
    print(r)
conn.close()
