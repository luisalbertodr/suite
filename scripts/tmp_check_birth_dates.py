"""Comprueba si birth_date se importó desde legacy.clientes.fecnac."""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
env = ROOT / ".env"
if env.is_file():
    for line in env.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k, v = k.strip(), v.strip().strip('"')
        if k and k not in os.environ:
            os.environ[k] = v

url = os.environ.get("SUPABASE_DB_URL", "").strip()
if not url:
    sys.exit("Falta SUPABASE_DB_URL")

import psycopg2

conn = psycopg2.connect(url)
cur = conn.cursor()

cur.execute("SELECT COUNT(*) FROM public.customers WHERE birth_date IS NOT NULL")
with_bd = cur.fetchone()[0]
cur.execute("SELECT COUNT(*) FROM public.customers")
total = cur.fetchone()[0]
cur.execute(
    "SELECT COUNT(*) FROM legacy.clientes WHERE NULLIF(btrim(fecnac), '') IS NOT NULL"
)
legacy_fecnac = cur.fetchone()[0]
cur.execute("SELECT COUNT(*) FROM legacy.clientes")
legacy_total = cur.fetchone()[0]
cur.execute(
    """
    SELECT COUNT(*)
    FROM public.customers c
    JOIN legacy.clientes l ON l.codcli = c.legacy_codcli
    WHERE c.birth_date IS NOT NULL
      AND NULLIF(btrim(l.fecnac), '') IS NOT NULL
    """
)
matched = cur.fetchone()[0]
cur.execute(
    """
    SELECT l.fecnac, c.birth_date::text
    FROM legacy.clientes l
    JOIN public.customers c ON c.legacy_codcli = l.codcli
    WHERE NULLIF(btrim(l.fecnac), '') IS NOT NULL
    LIMIT 8
    """
)
samples = cur.fetchall()

print(f"customers_total={total}")
print(f"customers_with_birth_date={with_bd}")
print(f"legacy_clientes_total={legacy_total}")
print(f"legacy_fecnac_filled={legacy_fecnac}")
print(f"customers_with_birth_and_legacy_fecnac={matched}")
print("samples (fecnac legacy, birth_date suite):")
for a, b in samples:
    print(f"  {a!r} -> {b!r}")

cur.close()
conn.close()
