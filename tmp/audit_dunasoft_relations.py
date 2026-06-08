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

print("=== Infra sync dunasoft ===")
for t in ["sync_meta", "sync_outbox", "empresa"]:
    cur.execute(
        """
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'dunasoft' AND table_name = %s
        ORDER BY ordinal_position
        """,
        (t,),
    )
    cols = cur.fetchall()
    print(f"\n--- dunasoft.{t} ({len(cols)} cols) ---")
    for c in cols[:20]:
        print(f"  {c['column_name']:20} {c['data_type']}")
    if len(cols) > 20:
        print(f"  ... +{len(cols)-20} cols")
    cur.execute(f"SELECT COUNT(*) AS n FROM dunasoft.{t}")
    print("rows:", cur.fetchone()["n"])

cur.execute(
    """
    SELECT tc.table_name, kcu.column_name,
           ccu.table_schema AS ref_schema, ccu.table_name AS ref_table, ccu.column_name AS ref_column
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'dunasoft'
    ORDER BY tc.table_name, kcu.column_name
    """
)
fks = cur.fetchall()
print(f"\n=== FK en dunasoft: {len(fks)} ===")
for r in fks[:30]:
    print(f"  {r['table_name']}.{r['column_name']} -> {r['ref_schema']}.{r['ref_table']}.{r['ref_column']}")

print("\n=== plan2009: rango fechas en PG ===")
cur.execute(
    """
    SELECT MIN(fecha) AS min_f,
           MAX(fecha) AS max_f,
           COUNT(*) AS n
    FROM dunasoft.plan2009
    """
)
print(cur.fetchone())

print("\n=== plan2009: citas futuras en DBF sample via idplan join? ===")
cur.execute(
    """
    SELECT COUNT(*) AS orphan_planart
    FROM dunasoft.planart pa
    LEFT JOIN dunasoft.plan2009 p ON btrim(p.idplan) = btrim(pa.idplan)
    WHERE btrim(coalesce(pa.idplan,'')) <> '' AND p.idplan IS NULL
    """
)
print("planart sin plan2009:", cur.fetchone()["orphan_planart"])

cur.execute(
    """
    SELECT COUNT(*) AS orphan
    FROM dunasoft.plan2009 p
    LEFT JOIN dunasoft.empleados e ON ltrim(btrim(e.codemp),'0') = ltrim(btrim(p.codemp),'0')
    WHERE btrim(coalesce(p.codemp,'')) <> '' AND e.codemp IS NULL
    """
)
print("plan2009 codemp sin empleado:", cur.fetchone()["orphan"])

cur.execute(
    """
    SELECT COUNT(*) AS orphan
    FROM dunasoft.plan2009 p
    LEFT JOIN dunasoft.clientes c ON ltrim(btrim(c.codcli),'0') = ltrim(btrim(p.codcli),'0')
    WHERE btrim(coalesce(p.codcli,'')) <> '' AND c.codcli IS NULL
    """
)
print("plan2009 codcli sin cliente:", cur.fetchone()["orphan"])

print("\n=== Columnas import en dunasoft.plan2009? ===")
cur.execute(
    """
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='dunasoft' AND table_name='plan2009'
    ORDER BY ordinal_position
    """
)
print([r["column_name"] for r in cur.fetchall()])

print("\n=== legacy vs dunasoft plan2009 counts ===")
for schema in ("legacy", "dunasoft"):
    cur.execute(f"SELECT COUNT(*) n FROM {schema}.plan2009")
    print(schema, cur.fetchone()["n"])

conn.close()
