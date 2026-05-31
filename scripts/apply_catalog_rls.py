import psycopg2
from pathlib import Path

url = None
for line in Path(".env").read_text(encoding="utf-8").splitlines():
    if line.startswith("SUPABASE_DB_URL="):
        url = line.split("=", 1)[1].strip().strip('"')
        break

sql = Path("supabase/migrations/20260531180000_work_center_catalog_rls.sql").read_text(encoding="utf-8")
conn = psycopg2.connect(url)
cur = conn.cursor()
cur.execute(sql)
conn.commit()

MEDICINA = "816af484-92a0-4f65-a5a7-1c907aa4bb3d"
cur.execute("""
SELECT count(*)
FROM articles a
JOIN article_families af ON af.name = a.familia AND af.company_id = a.company_id
WHERE af.billing_company_id = %s
  AND COALESCE(a.billing_company_id, af.billing_company_id) = af.billing_company_id
""", (MEDICINA,))
print("Articulos medicina alineados:", cur.fetchone()[0])

cur.execute("""
SELECT count(*) FROM article_families WHERE billing_company_id = %s
""", (MEDICINA,))
print("Familias medicina:", cur.fetchone()[0])

conn.close()
print("Migracion aplicada OK")
