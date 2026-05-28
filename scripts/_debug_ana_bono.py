import os
import json
from pathlib import Path
import psycopg2

ROOT = Path(__file__).resolve().parents[1]
for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"'))

conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
cur = conn.cursor()

cur.execute(
    """
SELECT id, name, legacy_codcli, phone_mobile
FROM public.customers
WHERE phone_mobile ILIKE '%677061948%' OR name ILIKE '%ana%delgado%'
"""
)
print("=== Clientes Ana ===")
for r in cur.fetchall():
    print(r)
    cur.execute("SELECT count(*) FROM public.bonos WHERE customer_id=%s", (r[0],))
    print("  bonos:", cur.fetchone()[0])

cur.execute(
    """
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='bonus_definition_items'
ORDER BY 1
"""
)
print("bonus_definition_items cols:", [r[0] for r in cur.fetchall()])

cur.execute(
    """
SELECT b.id, b.legacy_codboncli, b.nombre, jsonb_array_length(COALESCE(b.coverage_items,'[]'::jsonb))
FROM public.bonos b
JOIN public.customers c ON c.id=b.customer_id
WHERE c.legacy_codcli='000103'
"""
)
print("=== Bonos legacy 000103 ===", cur.fetchall())
conn.close()
