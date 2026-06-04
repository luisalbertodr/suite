#!/usr/bin/env python3
"""
Alinea facturación Suite con Dunasoft (legacy.faccab serie A).

  1. Purga facturas/ventas legacy importadas (ambas empresas de facturación).
  2. Elimina duplicados por (company_id, number) en histórico.
  3. Reconstruye desde legacy.faccab (--apply).

  python scripts/align_billing_with_dunasoft_faccab.py --dry-run
  python scripts/align_billing_with_dunasoft_faccab.py --apply
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

import psycopg2
from psycopg2.extras import RealDictCursor

from legacy_billing_common import default_no_auto_from, load_dotenv
from legacy_company import DEFAULT_COMPANY_ID, MEDICINA_COMPANY_ID
from rebuild_legacy_faccab_invoices import reset_existing

SCRIPTS_DIR = Path(__file__).resolve().parent
PYTHON = sys.executable

# Mismo criterio que rebuild_legacy_invoices_sequential.py
LEGACY_INVOICE_SQL = """
  (
    i.number LIKE 'LEG-%%'
    OR COALESCE(i.notes, '') ILIKE '%%legacy%%'
    OR COALESCE(i.notes, '') ILIKE '%%Legacy FACCAB%%'
    OR COALESCE(i.notes, '') ILIKE '%%Factura legacy%%'
    OR i.number ~ '^FAC-[0-9]'
    OR EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.invoice_id = i.id
        AND (
          s.ticket_number LIKE 'LEG-%%'
          OR s.ticket_number ~ '^FAC-[0-9]'
          OR COALESCE(s.notes, '') ILIKE '%%legacy%%'
        )
    )
  )
"""


def _count(cur, sql: str, params: list) -> int:
    cur.execute(sql, params)
    row = cur.fetchone()
    return int(next(iter(row.values())))


def purge_extended_legacy(
    cur,
    company_ids: list[str],
    before_date: str,
    dry_run: bool,
) -> dict[str, int]:
    cur.execute(
        f"""
        SELECT COUNT(*) AS c FROM public.invoices i
        WHERE i.company_id = ANY(%s::uuid[])
          AND i.issue_date < %s::date
          AND COALESCE(i.verifactu_status, '') IN ('sent', 'accepted')
          AND {LEGACY_INVOICE_SQL}
        """,
        [company_ids, before_date],
    )
    protected = int(cur.fetchone()["c"])
    if protected:
        raise SystemExit(
            f"Hay {protected} facturas legacy con Verifactu enviado/aceptado; revísalas antes de continuar."
        )

    stats = {
        "invoices": _count(
            cur,
            f"""
            SELECT COUNT(*) FROM public.invoices i
            WHERE i.company_id = ANY(%s::uuid[])
              AND i.issue_date < %s::date
              AND COALESCE(i.verifactu_status, '') NOT IN ('sent', 'accepted', 'rejected')
              AND {LEGACY_INVOICE_SQL}
            """,
            [company_ids, before_date],
        ),
        "sales": _count(
            cur,
            """
            SELECT COUNT(*) FROM public.sales s
            WHERE s.company_id = ANY(%s::uuid[])
              AND (
                s.ticket_number LIKE 'LEG-%%'
                OR s.ticket_number ~ '^FAC-[0-9]'
                OR COALESCE(s.notes, '') ILIKE '%%legacy%%'
              )
            """,
            [company_ids],
        ),
    }
    if dry_run:
        return stats

    cur.execute(
        f"""
        DELETE FROM public.invoice_items
        WHERE invoice_id IN (
          SELECT i.id FROM public.invoices i
          WHERE i.company_id = ANY(%s::uuid[])
            AND i.issue_date < %s::date
            AND COALESCE(i.verifactu_status, '') NOT IN ('sent', 'accepted', 'rejected')
            AND {LEGACY_INVOICE_SQL}
        )
        """,
        [company_ids, before_date],
    )
    stats["invoice_items_deleted"] = cur.rowcount
    cur.execute(
        f"""
        DELETE FROM public.invoices i
        WHERE i.company_id = ANY(%s::uuid[])
          AND i.issue_date < %s::date
          AND COALESCE(i.verifactu_status, '') NOT IN ('sent', 'accepted', 'rejected')
          AND {LEGACY_INVOICE_SQL}
        """,
        [company_ids, before_date],
    )
    stats["invoices_deleted"] = cur.rowcount
    cur.execute(
        """
        DELETE FROM public.sale_items
        WHERE sale_id IN (
          SELECT s.id FROM public.sales s
          WHERE s.company_id = ANY(%s::uuid[])
            AND (
              s.ticket_number LIKE 'LEG-%%'
              OR s.ticket_number ~ '^FAC-[0-9]'
              OR COALESCE(s.notes, '') ILIKE '%%legacy%%'
            )
        )
        """,
        [company_ids],
    )
    stats["sale_items_deleted"] = cur.rowcount
    cur.execute(
        """
        DELETE FROM public.sales s
        WHERE s.company_id = ANY(%s::uuid[])
          AND (
            s.ticket_number LIKE 'LEG-%%'
            OR s.ticket_number ~ '^FAC-[0-9]'
            OR COALESCE(s.notes, '') ILIKE '%%legacy%%'
          )
        """,
        [company_ids],
    )
    stats["sales_deleted"] = cur.rowcount
    return stats


def dedupe_invoice_numbers(
    cur,
    company_ids: list[str],
    before_date: str,
    dry_run: bool,
) -> int:
    cur.execute(
        """
        SELECT company_id::text, number,
               array_agg(id::text ORDER BY created_at, id) AS ids
        FROM public.invoices
        WHERE company_id = ANY(%s::uuid[])
          AND issue_date < %s::date
          AND number IS NOT NULL AND btrim(number) <> ''
          AND COALESCE(verifactu_status, '') NOT IN ('sent', 'accepted')
        GROUP BY company_id, number
        HAVING COUNT(*) > 1
        """,
        (company_ids, before_date),
    )
    to_delete: list[str] = []
    for row in cur.fetchall():
        ids = list(row["ids"])
        to_delete.extend(ids[1:])
    if dry_run:
        return len(to_delete)
    for inv_id in to_delete:
        cur.execute("DELETE FROM public.invoice_items WHERE invoice_id = %s::uuid", (inv_id,))
        cur.execute("UPDATE public.sales SET invoice_id = NULL WHERE invoice_id = %s::uuid", (inv_id,))
        cur.execute("DELETE FROM public.invoices WHERE id = %s::uuid", (inv_id,))
    return len(to_delete)


def main() -> int:
    load_dotenv()
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--catalog-company-id", default=DEFAULT_COMPANY_ID)
    ap.add_argument("--estetica-company-id", default=DEFAULT_COMPANY_ID)
    ap.add_argument("--medicina-company-id", default=MEDICINA_COMPANY_ID)
    ap.add_argument("--no-auto-from", default="")
    ap.add_argument("--skip-rebuild", action="store_true")
    args = ap.parse_args()

    if not args.apply and not args.dry_run:
        print("Indica --dry-run o --apply", file=sys.stderr)
        return 2

    dry_run = not args.apply
    dsn = os.environ.get("SUPABASE_DB_URL", "").strip()
    if not dsn:
        print("Falta SUPABASE_DB_URL", file=sys.stderr)
        return 2

    before_date = (args.no_auto_from or "").strip() or default_no_auto_from().isoformat()
    company_ids = list({args.estetica_company_id, args.medicina_company_id})

    conn = psycopg2.connect(dsn)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=RealDictCursor)

    print("=== 1) Purga ampliada (legacy import) ===")
    stats1 = purge_extended_legacy(cur, company_ids, before_date, dry_run=dry_run)
    print(stats1)

    print("=== 2) Purga notas rebuild (reset_existing) ===")
    stats2 = reset_existing(cur, company_ids, dry_run=dry_run)
    print(stats2)

    print("=== 3) Duplicados (company_id, number) ===")
    dupes = dedupe_invoice_numbers(cur, company_ids, before_date, dry_run=dry_run)
    print(f"Facturas duplicadas a eliminar: {dupes}")

    if dry_run:
        conn.rollback()
        print("\n[dry-run] Sin cambios en BD.")
    else:
        conn.commit()
        print("\nPurga aplicada.")

    if args.skip_rebuild:
        return 0

    rebuild_argv = [
        PYTHON,
        str(SCRIPTS_DIR / "rebuild_legacy_faccab_invoices.py"),
        "--catalog-company-id",
        args.catalog_company_id,
        "--estetica-company-id",
        args.estetica_company_id,
        "--medicina-company-id",
        args.medicina_company_id,
        "--create-placeholder-customers",
    ]
    rebuild_argv.append("--apply" if args.apply else "--dry-run")

    print("\n=== 4) Rebuild desde legacy.faccab ===")
    return subprocess.run(rebuild_argv, cwd=str(SCRIPTS_DIR), env=os.environ.copy()).returncode


if __name__ == "__main__":
    raise SystemExit(main())
