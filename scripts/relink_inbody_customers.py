"""
Re-vincula inbody_measurements.customer_id usando DNI numérico (sin letra).

Cruza variantes: 32809252, 32809252M, 32809252m → mismo cliente con tax_id 32809252M.

Uso:
  python scripts/relink_inbody_customers.py
  python scripts/relink_inbody_customers.py --dry-run
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
    parser = argparse.ArgumentParser(description="Re-vincular mediciones InBody a clientes por DNI")
    parser.add_argument("--company-id", default=get_company_id())
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    db_url = os.environ.get("SUPABASE_DB_URL", "").strip()
    if not db_url:
        raise SystemExit("Falta SUPABASE_DB_URL")

    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    customer_map = load_customer_map(cur, args.company_id)

    cur.execute(
        """
        SELECT id, inbody_user_id, customer_id
        FROM public.inbody_measurements
        WHERE company_id = %s::uuid
        """,
        (args.company_id,),
    )
    rows = cur.fetchall()

    updated = 0
    already_ok = 0
    still_unlinked = 0

    for mid, inbody_user_id, current_customer_id in rows:
        new_customer_id = find_customer_id(inbody_user_id, customer_map)
        if not new_customer_id:
            still_unlinked += 1
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
