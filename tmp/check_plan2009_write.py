import os
from pathlib import Path

p = Path(".env")
for line in p.read_text(encoding="utf-8").splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"'))

import psycopg2
from psycopg2.extras import RealDictCursor

conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"], connect_timeout=20)
cur = conn.cursor(cursor_factory=RealDictCursor)

cur.execute("SELECT MAX(idplan::numeric) AS mx, COUNT(*) AS n FROM dunasoft.plan2009 WHERE idplan IS NOT NULL")
print("plan2009 max idplan:", cur.fetchone())

cur.execute(
    """
    SELECT grantee, privilege_type
    FROM information_schema.role_table_grants
    WHERE table_schema='dunasoft' AND table_name='plan2009'
    ORDER BY grantee, privilege_type
    """
)
print("grants plan2009:", [dict(r) for r in cur.fetchall()])

cur.execute(
    """
    SELECT column_name, is_nullable, column_default, data_type
    FROM information_schema.columns
    WHERE table_schema='dunasoft' AND table_name='plan2009'
    ORDER BY ordinal_position
    """
)
print("\nplan2009 columns:")
for r in cur.fetchall():
    print(f"  {r['column_name']:15} nullable={r['is_nullable']} default={r['column_default']}")

cur.execute(
    """
    SELECT COUNT(*) AS n FROM dunasoft.plan2009 p
    LEFT JOIN dunasoft.clientes c ON btrim(c.codcli)=btrim(p.codcli)
    WHERE btrim(coalesce(p.codcli,''))<>'' AND c.codcli IS NULL
    """
)
print("\norphan codcli:", cur.fetchone()["n"])

cur.execute("SELECT COUNT(*) AS n FROM dunasoft.sync_outbox")
print("sync_outbox rows:", cur.fetchone()["n"])

# numeracion table?
cur.execute(
    """
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='dunasoft' AND table_name ILIKE '%num%'
    ORDER BY 1
    """
)
print("num* tables:", [r["table_name"] for r in cur.fetchall()])

conn.close()
