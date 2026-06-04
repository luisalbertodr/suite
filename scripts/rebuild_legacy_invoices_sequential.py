#!/usr/bin/env python3
"""
Renumera facturas legacy por empresa y año de issue_date (F{YYYY}-{NNNNN}).

Solo afecta facturas importadas/históricas (no Verifactu enviadas).
Opcionalmente limita por --through (issue_date).

Uso:
  python scripts/rebuild_legacy_invoices_sequential.py --dry-run
  python scripts/rebuild_legacy_invoices_sequential.py --apply
  python scripts/rebuild_legacy_invoices_sequential.py --apply --company-id <uuid>
"""
from __future__ import annotations

import argparse
import os
import sys
import uuid
from collections import defaultdict
from datetime import date
from pathlib import Path

import psycopg2
from psycopg2.extras import RealDictCursor, execute_batch

from legacy_billing_common import default_no_auto_from, load_dotenv
from legacy_company import get_company_id

ROOT = Path(__file__).resolve().parents[1]
BATCH_SIZE = 500
COMMIT_EVERY = 5000

LEGACY_INVOICE_SQL = """
  (
    COALESCE(i.notes, '') ILIKE '%%legacy%%'
    OR COALESCE(i.notes, '') ILIKE '%%Legacy FACCAB%%'
    OR COALESCE(i.notes, '') ILIKE '%%Factura legacy%%'
    OR i.number ~ '^FAC-'
    OR EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.invoice_id = i.id
        AND (s.ticket_number LIKE 'LEG-%%' OR COALESCE(s.notes, '') ILIKE '%%legacy%%')
    )
  )
"""


def main() -> int:
    load_dotenv()
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--company-id", default="")
    ap.add_argument("--through", default="", help="issue_date máxima (YYYY-MM-DD)")
    ap.add_argument(
        "--no-auto-from",
        default="",
        help=f"No tocar facturas con issue_date >= esta fecha (default hoy: {default_no_auto_from().isoformat()})",
    )
    args = ap.parse_args()

    dsn = os.environ.get("SUPABASE_DB_URL", "").strip()
    if not dsn:
        print("Falta SUPABASE_DB_URL", file=sys.stderr)
        return 2

    company_id = (args.company_id or "").strip() or get_company_id()
    through = (args.through or "").strip() or None
    no_auto_from = (args.no_auto_from or "").strip() or default_no_auto_from().isoformat()

    conn = psycopg2.connect(dsn)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=RealDictCursor)

    params: list = [company_id, no_auto_from]
    date_filter = ""
    if through:
        date_filter = " AND i.issue_date <= %s"
        params.append(through)

    cur.execute(
        f"""
        SELECT i.id, i.number, i.issue_date, i.company_id, i.verifactu_status
        FROM public.invoices i
        WHERE i.company_id = %s
          AND i.issue_date < %s::date
          {date_filter}
          AND COALESCE(i.verifactu_status, '') NOT IN ('sent', 'accepted', 'rejected')
          AND {LEGACY_INVOICE_SQL}
        ORDER BY i.company_id, i.issue_date, i.created_at, i.id
        """,
        params,
    )
    rows = cur.fetchall()
    print(f"Facturas legacy a renumerar: {len(rows)} (issue_date < {no_auto_from}" + (f", <= {through}" if through else "") + ")")

    by_company_year: dict[tuple[str, int], list] = defaultdict(list)
    for r in rows:
        yr = int(str(r["issue_date"])[:4])
        by_company_year[(str(r["company_id"]), yr)].append(r)

    renames: list[tuple[str, str, str]] = []
    for (cid, yr), group in sorted(by_company_year.items()):
        prefix = f"F{yr}-"
        for idx, r in enumerate(group, start=1):
            new_num = f"{prefix}{idx:05d}"
            renames.append((str(r["id"]), str(r["number"]), new_num))

    print(f"Renumeraciones planificadas: {len(renames)}")
    for sample in renames[:5]:
        print(f"  {sample[1]} -> {sample[2]}")
    if len(renames) > 5:
        print(f"  ... y {len(renames) - 5} más")

    if args.dry_run or not args.apply:
        conn.rollback()
        print("--dry-run: sin cambios." if args.dry_run else "Use --apply para ejecutar.")
        return 0

    run_id = str(uuid.uuid4())[:8]
    tmp_sql = "UPDATE public.invoices SET number = %s WHERE id = %s::uuid"
    final_sql = "UPDATE public.invoices SET number = %s WHERE id = %s::uuid"

    all_ids = [inv_id for inv_id, _, _ in renames]
    current_numbers: dict[str, str] = {}
    for start in range(0, len(all_ids), 5000):
        chunk_ids = all_ids[start : start + 5000]
        cur.execute(
            "SELECT id::text, number FROM public.invoices WHERE id = ANY(%s::uuid[])",
            (chunk_ids,),
        )
        for row in cur.fetchall():
            current_numbers[str(row["id"])] = str(row["number"])

    print("Fase 1: números temporales…", flush=True)
    for start in range(0, len(renames), BATCH_SIZE):
        chunk = renames[start : start + BATCH_SIZE]
        pending = [
            (f"TMP-{run_id}-{inv_id.replace('-', '')}", inv_id)
            for inv_id, _, _ in chunk
            if not current_numbers.get(inv_id, "").startswith("TMP-")
        ]
        if not pending:
            continue
        execute_batch(cur, tmp_sql, pending, page_size=BATCH_SIZE)
        for tmp_name, inv_id in pending:
            current_numbers[inv_id] = tmp_name
        if (start + BATCH_SIZE) % COMMIT_EVERY == 0 or start + BATCH_SIZE >= len(renames):
            conn.commit()
            print(f"  tmp {min(start + BATCH_SIZE, len(renames))}/{len(renames)}", flush=True)

    print("Fase 2: numeración F{YYYY}-{NNNNN}…", flush=True)
    for start in range(0, len(renames), BATCH_SIZE):
        chunk = renames[start : start + BATCH_SIZE]
        execute_batch(
            cur,
            final_sql,
            [(new_num, inv_id) for inv_id, _, new_num in chunk],
            page_size=BATCH_SIZE,
        )
        if (start + BATCH_SIZE) % COMMIT_EVERY == 0 or start + BATCH_SIZE >= len(renames):
            conn.commit()
            print(f"  final {min(start + BATCH_SIZE, len(renames))}/{len(renames)}", flush=True)

    print(f"OK: {len(renames)} facturas renumeradas. run_id={run_id}")
    cur.close()
    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
