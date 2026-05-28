"""
Vincula agenda_appointments.customer_id desde legacy_codcli → customers.legacy_codcli.

Para citas ya importadas sin customer_id (solo legacy_codcli / client_name).

Requisitos: SUPABASE_DB_URL (en .env o entorno)

Uso:
  python scripts/link_agenda_customer_ids.py
  python scripts/link_agenda_customer_ids.py --dry-run
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


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser()
    ap.add_argument("--company-id", default=get_company_id(), help=f"UUID empresa (default: {DEFAULT_COMPANY_ID})")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    url = os.environ.get("SUPABASE_DB_URL", "").strip()
    if not url:
        sys.exit("Falta SUPABASE_DB_URL")

    sql = """
    UPDATE public.agenda_appointments a
    SET customer_id = c.id
    FROM public.customers c
    WHERE a.company_id = %s::uuid
      AND c.company_id = a.company_id
      AND a.customer_id IS NULL
      AND NULLIF(btrim(a.legacy_codcli), '') IS NOT NULL
      AND NULLIF(btrim(c.legacy_codcli), '') IS NOT NULL
      AND (
        btrim(a.legacy_codcli) = btrim(c.legacy_codcli)
        OR NULLIF(ltrim(btrim(a.legacy_codcli), '0'), '') = NULLIF(ltrim(btrim(c.legacy_codcli), '0'), '')
      )
    """
    count_sql = """
    SELECT count(*)::bigint
    FROM public.agenda_appointments a
    INNER JOIN public.customers c
      ON c.company_id = a.company_id
      AND NULLIF(btrim(c.legacy_codcli), '') IS NOT NULL
      AND (
        btrim(a.legacy_codcli) = btrim(c.legacy_codcli)
        OR NULLIF(ltrim(btrim(a.legacy_codcli), '0'), '') = NULLIF(ltrim(btrim(c.legacy_codcli), '0'), '')
      )
    WHERE a.company_id = %s::uuid
      AND a.customer_id IS NULL
      AND NULLIF(btrim(a.legacy_codcli), '') IS NOT NULL
    """

    if args.dry_run:
        conn = psycopg2.connect(url)
        conn.autocommit = True
        cur = conn.cursor()
        cur.execute(count_sql, [args.company_id])
        print(f"Citas sin customer_id vinculables: {cur.fetchone()[0]}")
        cur.close()
        conn.close()
        return

    conn = psycopg2.connect(url)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(count_sql, [args.company_id])
    eligible = cur.fetchone()[0]
    cur.execute(sql, [args.company_id])
    updated = cur.rowcount
    print(f"Citas vinculables: {eligible}")
    print(f"Filas actualizadas: {updated}")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
