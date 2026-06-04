import os
from pathlib import Path
import psycopg2

ROOT = Path(__file__).resolve().parents[1]
for line in (ROOT / ".env").read_text(encoding="utf-8", errors="replace").splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"'))

conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
cur = conn.cursor()
cur.execute(
    """
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='legacy' AND table_name='planinc'
      AND (column_name ILIKE '%emp%' OR column_name ILIKE '%fecha%' OR column_name ILIKE '%hor%')
    ORDER BY column_name
    """
)
print("Columnas relevantes:")
for r in cur.fetchall():
    print(" ", r[0])

# Sample row for idplan that might be Maria Isabel on jun 11 - search by name jun 11 any codemp
cur.execute(
    """
    SELECT codemp, codempx, fechax, fecha, horini, horinix, nomcli, tipinc, idplaninc
    FROM legacy.planinc
    WHERE lower(nomcli) LIKE '%maria isabel martinez%'
      AND (fechax::text LIKE '2026-06-11%' OR fecha::text LIKE '2026-06-11%')
    LIMIT 10
    """
)
print("\nMaria Isabel 11-jun:")
for r in cur.fetchall():
    print(r)

# Try jun 11 afternoon codemp 10 with fechax
cur.execute(
    """
    SELECT codemp, codempx, horini, horinix, nomcli, idplan, tipinc
    FROM legacy.planinc
    WHERE (fechax::text LIKE '2026-06-11%' OR fecha::text LIKE '2026-06-11%')
      AND btrim(codemp::text) = '10'
    ORDER BY horini
    """
)
print("\nTodo codemp 10 dia 11:")
for r in cur.fetchall():
    print(r)

conn.close()
