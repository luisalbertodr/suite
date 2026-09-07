"""
Rellena teléfonos vacíos en public.customers desde legacy.clientes (solo-vacíos).

Convención Style/Dunasoft:
  tel2cli → phone_mobile  (móvil / SMS)
  tel1cli → phone_home    (fijo; o móvil si tel2 vacío = no SMS)
  Si tel1 y tel2 son el mismo número → phone_home = NULL (duplicado erróneo)
  phone   → COALESCE(tel2, tel1)

No pisa fichas que ya tienen teléfono.
Permite phone_norm compartido entre clientes (familias).

Uso:
  python scripts/promote_legacy_customer_phones.py --dry-run
  python scripts/promote_legacy_customer_phones.py
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

    # Solo fichas sin ningún teléfono; no pisa existentes; permite compartir phone_norm
    fill_sql = """
    WITH mapped AS (
      SELECT
        c.id,
        CASE
          WHEN nullif(btrim(l.tel1cli), '') IS NOT NULL
           AND nullif(btrim(l.tel2cli), '') IS NOT NULL
           AND right(regexp_replace(l.tel1cli, '\\D', '', 'g'), 9)
             = right(regexp_replace(l.tel2cli, '\\D', '', 'g'), 9)
            THEN NULL
          ELSE nullif(btrim(l.tel1cli), '')
        END AS new_home,
        nullif(btrim(l.tel2cli), '') AS new_mobile,
        coalesce(nullif(btrim(l.tel2cli), ''), nullif(btrim(l.tel1cli), '')) AS new_phone
      FROM public.customers c
      INNER JOIN legacy.clientes l
        ON NULLIF(btrim(c.legacy_codcli), '') = NULLIF(btrim(l.codcli), '')
      WHERE c.company_id = %s::uuid
        AND c.archived_at IS NULL
        AND nullif(btrim(c.phone), '') IS NULL
        AND nullif(btrim(c.phone_mobile), '') IS NULL
        AND nullif(btrim(c.phone_home), '') IS NULL
        AND (
          nullif(btrim(l.tel1cli), '') IS NOT NULL
          OR nullif(btrim(l.tel2cli), '') IS NOT NULL
        )
    )
    UPDATE public.customers c
    SET
      phone_home = m.new_home,
      phone_mobile = m.new_mobile,
      phone = m.new_phone,
      updated_at = now()
    FROM mapped m
    WHERE c.id = m.id
    """

    count_sql = """
    SELECT count(*)::bigint
    FROM public.customers c
    INNER JOIN legacy.clientes l
      ON NULLIF(btrim(c.legacy_codcli), '') = NULLIF(btrim(l.codcli), '')
    WHERE c.company_id = %s::uuid
      AND c.archived_at IS NULL
      AND nullif(btrim(c.phone), '') IS NULL
      AND nullif(btrim(c.phone_mobile), '') IS NULL
      AND nullif(btrim(c.phone_home), '') IS NULL
      AND (
        nullif(btrim(l.tel1cli), '') IS NOT NULL
        OR nullif(btrim(l.tel2cli), '') IS NOT NULL
      )
    """

    params: list[str] = [args.company_id]
    print("company_id:", args.company_id)
    conn = psycopg2.connect(url)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(count_sql, params)
    eligible = cur.fetchone()[0]
    print(f"Fichas vacías con teléfono en legacy: {eligible}")
    if args.dry_run:
        print("Dry-run: no se actualiza.")
        cur.close()
        conn.close()
        return
    cur.execute(fill_sql, params)
    updated = cur.rowcount
    print(f"Actualizadas: {updated}")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
