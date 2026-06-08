import os
from pathlib import Path

for line in Path(".env").read_text(encoding="utf-8").splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"'))

import psycopg2
from psycopg2.extras import RealDictCursor

conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"], connect_timeout=20)
cur = conn.cursor(cursor_factory=RealDictCursor)

cur.execute(
    """
    SELECT table_name, row_count_dbf, row_count_pg, status, last_full_sync
    FROM dunasoft.sync_meta
    WHERE row_count_dbf IS DISTINCT FROM row_count_pg
    ORDER BY ABS(COALESCE(row_count_dbf, 0) - COALESCE(row_count_pg, 0)) DESC
    LIMIT 25
    """
)
print("Top desfases sync_meta:")
for r in cur.fetchall():
    dbf = r["row_count_dbf"] if r["row_count_dbf"] is not None else "?"
    pg = r["row_count_pg"] if r["row_count_pg"] is not None else "?"
    print(f"  {r['table_name']:16} dbf={dbf!s:>8} pg={pg!s:>8} status={r['status']}")

cur.execute("SELECT status, COUNT(*) AS n FROM dunasoft.sync_meta GROUP BY status ORDER BY n DESC")
print("\nStatus sync_meta:", cur.fetchall())

cur.execute(
    """
    SELECT COUNT(*) AS orphan_planart
    FROM dunasoft.planart pa
    LEFT JOIN dunasoft.plan2009 p ON p.idplan::text = pa.idplan::text
    WHERE pa.idplan IS NOT NULL AND p.idplan IS NULL
    """
)
print("\nplanart sin plan2009 en PG:", cur.fetchone()["orphan_planart"])

cur.execute(
    """
    SELECT COUNT(*) AS n FROM dunasoft.plan2009 p
    WHERE NOT EXISTS (
      SELECT 1 FROM dunasoft.empleados e
      WHERE ltrim(btrim(e.codemp), '0') = ltrim(btrim(p.codemp::text), '0')
    ) AND p.codemp IS NOT NULL AND btrim(p.codemp::text) <> ''
    """
)
print("plan2009 codemp huérfano:", cur.fetchone()["n"])

cur.execute(
    """
    SELECT COUNT(*) AS n FROM dunasoft.plan2009 p
    WHERE NOT EXISTS (
      SELECT 1 FROM dunasoft.clientes c
      WHERE ltrim(btrim(c.codcli), '0') = ltrim(btrim(p.codcli::text), '0')
    ) AND p.codcli IS NOT NULL AND btrim(p.codcli::text) <> ''
    """
)
print("plan2009 codcli huérfano:", cur.fetchone()["n"])

# DBF path used for sync
cur.execute(
    "SELECT dbf_path, dbf_mtime, last_full_sync FROM dunasoft.sync_meta WHERE table_name = 'plan2009'"
)
print("\nplan2009 sync source:", cur.fetchone())

conn.close()
