"""
Actualiza public.customers.phone_home, phone_mobile y phone desde legacy.clientes.

Convención Dunasoft (igual que suite/src/lib/legacyCustomerPhones.ts):
  tel1cli → phone_home   Fijo, o móvil si el cliente no desea SMS/campañas al móvil.
  tel2cli → phone_mobile Móvil principal (línea destino SMS).
  phone   → COALESCE(tel2, tel1) — contacto principal.

phone_norm se recalcula solo (columna generada; prioriza móvil).

Match: customers.legacy_codcli = trim(legacy.clientes.codcli)

Requisitos: SUPABASE_DB_URL (en .env o entorno)

Uso:
  python scripts/promote_legacy_customer_phones.py
  python scripts/promote_legacy_customer_phones.py --dry-run
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

try:
    import psycopg2
except ImportError:
    print("pip install psycopg2-binary", file=sys.stderr)
    raise

from legacy_company import DEFAULT_COMPANY_ID, get_company_id

ROOT = Path(__file__).resolve().parents[1]


def load_dotenv() -> None:
    env = ROOT / ".env"
    if not env.is_file():
        return
    for line in env.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k = k.strip()
        v = v.strip().strip('"')
        if k and k not in os.environ:
            os.environ[k] = v


def _dsn_looks_valid(url: str) -> bool:
    if "://" in url:
        return True
    if "=" in url and ("host=" in url or "dbname=" in url):
        return True
    return False


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--company-id",
        default=get_company_id(),
        help=f"UUID empresa (default: {DEFAULT_COMPANY_ID})",
    )
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    url = os.environ.get("SUPABASE_DB_URL", "").strip()
    if not url:
        sys.exit("Falta SUPABASE_DB_URL")
    if not _dsn_looks_valid(url):
        sys.exit(
            "SUPABASE_DB_URL no parece una cadena de conexión PostgreSQL válida.\n"
            'Ejemplo: postgresql://postgres:TU_CLAVE@host:5432/postgres?sslmode=require'
        )

    new_phone_expr = """
      COALESCE(
        NULLIF(btrim(l.tel2cli), ''),
        NULLIF(btrim(l.tel1cli), ''),
        c.phone
      )
    """
    new_mobile_expr = "NULLIF(btrim(l.tel2cli), '')"
    new_home_expr = "NULLIF(btrim(l.tel1cli), '')"

    sql = f"""
    WITH candidates AS (
      SELECT
        c.id,
        c.company_id,
        c.created_at,
        {new_home_expr} AS new_home,
        {new_mobile_expr} AS new_mobile,
        {new_phone_expr} AS new_phone
      FROM public.customers c
      INNER JOIN legacy.clientes l
        ON NULLIF(btrim(c.legacy_codcli), '') = NULLIF(btrim(l.codcli), '')
      WHERE NULLIF(btrim(l.codcli), '') <> ''
        AND c.company_id = %s::uuid
        AND (
          NULLIF(btrim(l.tel1cli), '') IS NOT NULL
          OR NULLIF(btrim(l.tel2cli), '') IS NOT NULL
        )
    ),
    with_norm AS (
      SELECT
        *,
        public.customer_primary_phone_last9(new_phone, new_mobile, new_home) AS new_norm
      FROM candidates
    ),
    ranked AS (
      SELECT
        *,
        row_number() OVER (
          PARTITION BY company_id, new_norm
          ORDER BY created_at ASC NULLS LAST, id ASC
        ) AS dup_rn
      FROM with_norm
    )
    UPDATE public.customers c
    SET
      phone_home = r.new_home,
      phone_mobile = r.new_mobile,
      phone = r.new_phone
    FROM ranked r
    WHERE c.id = r.id
      AND (r.new_norm IS NULL OR r.dup_rn = 1)
      AND NOT EXISTS (
        SELECT 1
        FROM public.customers other
        WHERE other.company_id = r.company_id
          AND other.id <> r.id
          AND other.phone_norm IS NOT NULL
          AND other.phone_norm = r.new_norm
      )
    """
    params: list[str] = [args.company_id]

    count_sql = """
    SELECT count(*)::bigint
    FROM public.customers c
    INNER JOIN legacy.clientes l
      ON NULLIF(btrim(c.legacy_codcli), '') = NULLIF(btrim(l.codcli), '')
    WHERE NULLIF(btrim(l.codcli), '') <> ''
      AND c.company_id = %s::uuid
      AND (
        NULLIF(btrim(l.tel1cli), '') IS NOT NULL
        OR NULLIF(btrim(l.tel2cli), '') IS NOT NULL
      )
    """

    skip_sql = f"""
    WITH candidates AS (
      SELECT
        c.id,
        c.company_id,
        c.created_at,
        {new_home_expr} AS new_home,
        {new_mobile_expr} AS new_mobile,
        {new_phone_expr} AS new_phone
      FROM public.customers c
      INNER JOIN legacy.clientes l
        ON NULLIF(btrim(c.legacy_codcli), '') = NULLIF(btrim(l.codcli), '')
      WHERE NULLIF(btrim(l.codcli), '') <> ''
        AND c.company_id = %s::uuid
        AND (
          NULLIF(btrim(l.tel1cli), '') IS NOT NULL
          OR NULLIF(btrim(l.tel2cli), '') IS NOT NULL
        )
    ),
    with_norm AS (
      SELECT
        *,
        public.customer_primary_phone_last9(new_phone, new_mobile, new_home) AS new_norm
      FROM candidates
    ),
    ranked AS (
      SELECT
        id,
        company_id,
        new_norm,
        dup_rn
      FROM (
        SELECT
          id,
          company_id,
          new_norm,
          row_number() OVER (
            PARTITION BY company_id, new_norm
            ORDER BY created_at ASC NULLS LAST, id ASC
          ) AS dup_rn
        FROM with_norm
      ) x
    )
    SELECT count(*)::bigint
    FROM ranked r
    WHERE r.new_norm IS NOT NULL
      AND (
        r.dup_rn > 1
        OR EXISTS (
          SELECT 1
          FROM public.customers other
          WHERE other.company_id = r.company_id
            AND other.id <> r.id
            AND other.phone_norm IS NOT NULL
            AND other.phone_norm = r.new_norm
        )
      )
    """

    if args.dry_run:
        print("company_id:", args.company_id)
        conn = psycopg2.connect(url)
        conn.autocommit = True
        cur = conn.cursor()
        cur.execute(count_sql, params)
        eligible = cur.fetchone()[0]
        cur.execute(skip_sql, params)
        skipped = cur.fetchone()[0]
        cur.close()
        conn.close()
        print(f"Clientes elegibles (con teléfono en legacy): {eligible}")
        print(f"Se omitirían por teléfono duplicado: {skipped}")
        print(f"Se actualizarían: {eligible - skipped}")
        return

    conn = psycopg2.connect(url)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(count_sql, params)
    eligible = cur.fetchone()[0]
    cur.execute(skip_sql, params)
    skipped = cur.fetchone()[0]
    cur.execute(sql, params)
    updated = cur.rowcount
    print(f"Clientes con teléfono en legacy (elegibles): {eligible}")
    print(f"Omitidos por teléfono duplicado: {skipped}")
    print(f"Filas actualizadas: {updated}")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
