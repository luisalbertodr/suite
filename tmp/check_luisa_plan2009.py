import os
import psycopg2
from pathlib import Path

for line in Path(".env").read_text(encoding="utf-8").splitlines():
    if line.startswith("SUPABASE_DB_URL="):
        os.environ["SUPABASE_DB_URL"] = line.split("=", 1)[1].strip().strip('"')

conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
cur = conn.cursor()
company = "5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4"

cur.execute(
    """
    SELECT idplan, fecha, horini, horfin, codemp, nomcli, facturada
    FROM dunasoft.plan2009
    WHERE company_id = %s AND idplan IN (111755, 111248)
    ORDER BY idplan
    """,
    (company,),
)
print("idplan rows:")
for r in cur.fetchall():
    print(r)

cur.execute(
    """
    SELECT count(*) FROM dunasoft.plan2009
    WHERE company_id = %s AND fecha = '2026-07-02'
    """,
    (company,),
)
print("Suite 2026-07-02 count", cur.fetchone()[0])

cur.execute(
    """
    SELECT idplan, horini, nomcli FROM dunasoft.plan2009
    WHERE company_id = %s AND fecha = '2026-07-02' AND nomcli ILIKE '%%luisa%%'
    """,
    (company,),
)
print("Luisa jul2", cur.fetchall())

cur.execute(
    """
    SELECT idplan, fecha, horini, nomcli FROM dunasoft.plan2009
    WHERE company_id = %s AND idplan = 111755
    """,
    (company,),
)
print("111755", cur.fetchone())

conn.close()
