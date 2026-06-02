"""Elimina facturas legacy huérfanas en empresa Medicina (p. ej. tras reimport en Estética)."""
from __future__ import annotations

import argparse
import os
from pathlib import Path

import psycopg2

ROOT = Path(__file__).resolve().parents[1]
MEDICINA = "816af484-92a0-4f65-a5a7-1c907aa4bb3d"


def load_dotenv() -> None:
    env = ROOT / ".env"
    if not env.is_file():
        return
    for line in env.read_text(encoding="utf-8", errors="replace").splitlines():
        if line.startswith("SUPABASE_DB_URL="):
            os.environ["SUPABASE_DB_URL"] = line.split("=", 1)[1].strip().strip('"')


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument(
        "--only-prefix",
        default="FAC-03",
        help="Borrar solo facturas cuyo number empiece así (prefijo importación anterior)",
    )
    args = ap.parse_args()

    conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
    conn.autocommit = False
    cur = conn.cursor()
    pattern = f"{args.only_prefix}%"
    cur.execute(
        """
        SELECT COUNT(*) FROM invoices
        WHERE company_id = %s::uuid AND number LIKE %s
        """,
        (MEDICINA, pattern),
    )
    n = cur.fetchone()[0]
    print(f"Facturas Medicina con number LIKE {pattern!r}: {n}")
    if n and not args.dry_run:
        cur.execute(
            """
            DELETE FROM invoice_items
            WHERE invoice_id IN (
              SELECT id FROM invoices
              WHERE company_id = %s::uuid AND number LIKE %s
            )
            """,
            (MEDICINA, pattern),
        )
        cur.execute(
            """
            DELETE FROM invoices
            WHERE company_id = %s::uuid AND number LIKE %s
            """,
            (MEDICINA, pattern),
        )
        conn.commit()
        print(f"Eliminadas {cur.rowcount} facturas.")
    elif args.dry_run:
        conn.rollback()
        print("[dry-run]")
    conn.close()


if __name__ == "__main__":
    main()
