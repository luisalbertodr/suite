import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1)
        k, v = k.strip(), v.strip().strip('"')
        if k and k not in os.environ:
            os.environ[k] = v

import psycopg2

conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
cur = conn.cursor()
cur.execute(
    """
    SELECT
      MAX(CAST(NULLIF(ltrim(btrim(legacy_codcli), '0'), '') AS bigint)),
      COUNT(*) FILTER (WHERE legacy_codcli IS NULL OR btrim(legacy_codcli) = '')
    FROM public.customers
    """
)
print("suite max, sin_codigo:", cur.fetchone())
cur.execute(
    """
    SELECT MAX(CAST(NULLIF(ltrim(btrim(codcli::text), '0'), '') AS bigint)), COUNT(*)
    FROM legacy.clientes
    WHERE codcli IS NOT NULL AND btrim(codcli::text) <> ''
    """
)
print("legacy max, total:", cur.fetchone())
cur.execute(
    """
    SELECT legacy_codcli FROM public.customers
    WHERE legacy_codcli ~ '^[0-9]+$'
    ORDER BY CAST(ltrim(legacy_codcli, '0') AS bigint) DESC NULLS LAST
    LIMIT 3
    """
)
print("top suite:", cur.fetchall())
cur.execute(
    """
    SELECT codcli::text FROM legacy.clientes
    WHERE codcli::text ~ '^[0-9]+$'
    ORDER BY CAST(ltrim(btrim(codcli::text), '0') AS bigint) DESC NULLS LAST
    LIMIT 3
    """
)
print("top legacy:", cur.fetchall())
cur.execute(
    """
    SELECT length(legacy_codcli) AS len, COUNT(*)
    FROM public.customers
    WHERE legacy_codcli IS NOT NULL AND btrim(legacy_codcli) <> ''
    GROUP BY 1 ORDER BY 2 DESC LIMIT 5
    """
)
print("suite code lengths:", cur.fetchall())
conn.close()
