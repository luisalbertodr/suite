"""
Corrige fechas de facturas legacy generadas en lote: issue_date/due_date/paid_date/created_at
según la fecha del ticket (sale.created_at) o appointment_date de la cita.

Uso:
  python scripts/fix_legacy_invoice_dates.py --dry-run
  python scripts/fix_legacy_invoice_dates.py
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    print("pip install psycopg2-binary", file=sys.stderr)
    raise

from legacy_company import get_company_id

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
        k, v = k.strip(), v.strip().strip('"')
        if k and k not in os.environ:
            os.environ[k] = v


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser()
    ap.add_argument("--company-id", default=get_company_id())
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    dsn = os.environ.get("SUPABASE_DB_URL", "").strip()
    if not dsn:
        sys.exit("Falta SUPABASE_DB_URL")

    conn = psycopg2.connect(dsn)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute(
        """
        SELECT
          i.id,
          i.number,
          i.issue_date AS old_issue,
          left(i.created_at::text, 10) AS old_created,
          COALESCE(
            a.appointment_date,
            (s.created_at)::date
          ) AS target_date,
          s.created_at AS sale_ts
        FROM public.invoices i
        JOIN public.sales s ON s.invoice_id = i.id
        LEFT JOIN public.agenda_appointments a ON a.id = s.appointment_id
        WHERE i.company_id = %s
          AND (
            i.notes LIKE 'Factura legacy automática%%'
            OR s.appointment_id IS NOT NULL
          )
          AND COALESCE(a.appointment_date, (s.created_at)::date) IS NOT NULL
          AND (
            i.issue_date IS DISTINCT FROM COALESCE(a.appointment_date, (s.created_at)::date)
            OR left(i.created_at::text, 10) >= CURRENT_DATE::text
          )
        ORDER BY i.number
        """,
        (args.company_id,),
    )
    rows = cur.fetchall()
    print(f"Facturas a corregir: {len(rows)}")

    updated = 0
    for row in rows:
        target = row["target_date"]
        sale_ts = row["sale_ts"]
        if args.dry_run:
            print(
                f"[dry-run] {row['number']} issue {row['old_issue']} -> {target} "
                f"(created {row['old_created']})"
            )
            updated += 1
            continue

        cur.execute(
            """
            UPDATE public.invoices
            SET issue_date = %s,
                due_date = %s,
                paid_date = %s,
                created_at = %s
            WHERE id = %s
            """,
            (target, target, target, sale_ts, row["id"]),
        )
        updated += cur.rowcount

        if updated % 500 == 0:
            conn.commit()
            print(f"... {updated} actualizadas", file=sys.stderr)

    if args.dry_run:
        conn.rollback()
    else:
        conn.commit()

    print(f"Actualizadas: {updated}")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
