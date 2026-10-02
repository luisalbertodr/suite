"""
Re-vincula inbody_measurements.customer_id usando DNI (sin filtrar por empresa).

Los clientes se comparten entre companies: un DNI en Style enlaza pesajes
importados bajo Medicina (y viceversa).

Uso:
  python scripts/relink_inbody_customers.py
  python scripts/relink_inbody_customers.py --dry-run
  python scripts/relink_inbody_customers.py --company-id <uuid>   # prioriza esa company
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

from import_lookinbody_mdb import dni_match_keys, find_customer_id, load_customer_map, load_dotenv
from legacy_company import get_company_id

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(
        description="Re-vincular mediciones InBody a clientes por DNI (cross-company)"
    )
    parser.add_argument(
        "--company-id",
        default=None,
        help="Opcional: prioriza fichas de esta company en colisiones de DNI",
    )
    parser.add_argument(
        "--prefer-default-company",
        action="store_true",
        help=f"Usa LEGACY_COMPANY_ID / default ({get_company_id()}) como prioridad",
    )
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--via-sql",
        action="store_true",
        help="Usa public.link_all_orphan_inbody_measurements_by_dni() en el servidor",
    )
    args = parser.parse_args()

    db_url = os.environ.get("SUPABASE_DB_URL", "").strip()
    if not db_url:
        raise SystemExit("Falta SUPABASE_DB_URL")

    prefer = args.company_id
    if args.prefer_default_company and not prefer:
        prefer = get_company_id()

    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    if args.via_sql:
        if args.dry_run:
            cur.execute(
                """
                SELECT count(*) FROM public.inbody_measurements im
                WHERE im.customer_id IS NULL
                  AND EXISTS (
                    SELECT 1 FROM public.customers c
                    WHERE nullif(btrim(c.tax_id), '') IS NOT NULL
                      AND NOT public.is_inbody_placeholder_customer_name(c.name)
                      AND public.normalize_inbody_dni_key(im.inbody_user_id)
                          = ANY (public.inbody_dni_match_keys(c.tax_id))
                  )
                """
            )
            print(f"Huérfanos matchables (dry-run): {cur.fetchone()[0]}")
            conn.close()
            return
        cur.execute("SELECT public.link_all_orphan_inbody_measurements_by_dni()")
        n = cur.fetchone()[0]
        conn.commit()
        conn.close()
        print(f"Actualizadas via SQL: {n}")
        return

    customer_map = load_customer_map(cur, prefer)

    cur.execute(
        """
        SELECT id, inbody_user_id, customer_id
        FROM public.inbody_measurements
        """
    )
    rows = cur.fetchall()

    updated = 0
    already_ok = 0
    still_unlinked = 0

    for mid, inbody_user_id, current_customer_id in rows:
        new_customer_id = find_customer_id(inbody_user_id, customer_map)
        if not new_customer_id:
            if current_customer_id is None:
                still_unlinked += 1
            else:
                already_ok += 1
            continue
        if str(current_customer_id) == new_customer_id:
            already_ok += 1
            continue
        if not args.dry_run:
            cur.execute(
                "UPDATE public.inbody_measurements SET customer_id = %s::uuid, updated_at = now() WHERE id = %s::uuid",
                (new_customer_id, str(mid)),
            )
        updated += 1

    if not args.dry_run:
        conn.commit()

    conn.close()
    print(f"Total mediciones: {len(rows)}")
    print(f"  Ya vinculadas correctamente: {already_ok}")
    print(f"  Actualizadas: {updated}{' (dry-run)' if args.dry_run else ''}")
    print(f"  Sin ficha en Suite: {still_unlinked}")


if __name__ == "__main__":
    main()
