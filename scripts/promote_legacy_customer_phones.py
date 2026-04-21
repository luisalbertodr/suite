"""
Actualiza public.customers.phone_home, phone_mobile y phone desde legacy.clientes.

Convención (igual que en suite/src/lib/legacyCustomerPhones.ts):
  tel1cli → phone_home (casa; a veces móvil si el cliente no quiere SMS al móvil)
  tel2cli → phone_mobile (móvil / destino SMS)
  phone     → COALESCE(tel2, tel1) recortado

Requisitos: SUPABASE_DB_URL (cadena de conexión PostgreSQL completa, no solo el host).

  PowerShell (ejemplo):
    $env:SUPABASE_DB_URL = "postgresql://USUARIO:CONTRASENA@supabase.lipoout.com:5432/postgres"

  Si usas SSL (típico en la nube), añade al final: ?sslmode=require

Match: customers.legacy_codcli = trim(legacy.clientes.codcli) (debes rellenar legacy_codcli al importar clientes).

Uso:
  python scripts/promote_legacy_customer_phones.py --company-id <uuid>
  python scripts/promote_legacy_customer_phones.py --dry-run
"""
from __future__ import annotations

import argparse
import os
import sys

try:
    import psycopg2
except ImportError:
    print("pip install psycopg2-binary", file=sys.stderr)
    raise


def _dsn_looks_valid(url: str) -> bool:
    if "://" in url:
        return True
    # Formato clave=valor (libpq)
    if "=" in url and ("host=" in url or "dbname=" in url):
        return True
    return False


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--company-id", help="UUID empresa (recomendado)")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    url = os.environ.get("SUPABASE_DB_URL", "").strip()
    if not url:
        sys.exit("Falta SUPABASE_DB_URL")
    if not _dsn_looks_valid(url):
        sys.exit(
            "SUPABASE_DB_URL no parece una cadena de conexión PostgreSQL válida.\n"
            "No basta con el nombre del servidor; necesitas usuario, contraseña, host, puerto y base.\n"
            'Ejemplo: postgresql://postgres:TU_CLAVE@supabase.lipoout.com:5432/postgres?sslmode=require'
        )

    sql = """
    UPDATE public.customers c
    SET
      phone_home = NULLIF(btrim(l.tel1cli), ''),
      phone_mobile = NULLIF(btrim(l.tel2cli), ''),
      phone = COALESCE(NULLIF(btrim(l.tel2cli), ''), NULLIF(btrim(l.tel1cli), ''), c.phone)
    FROM legacy.clientes l
    WHERE NULLIF(btrim(c.legacy_codcli), '') = NULLIF(btrim(l.codcli), '')
      AND NULLIF(btrim(l.codcli), '') <> ''
    """
    params: list[str] = []
    if args.company_id:
        sql += " AND c.company_id = %s::uuid"
        params.append(args.company_id)
    sql += ";"

    if args.dry_run:
        print(sql.strip())
        print("params:", params)
        return

    conn = psycopg2.connect(url)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(sql, params)
    print("rows updated:", cur.rowcount)
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
