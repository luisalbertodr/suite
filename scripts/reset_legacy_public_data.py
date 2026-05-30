"""
Borra datos promovidos desde legacy en public.* antes de una reimportación.

Ámbitos (--scope):
  sales       Ventas LEG-* / citas legacy + facturas automáticas asociadas
  appointments  Citas con legacy_planinc_id / legacy_idplan (+ ítems y ventas en cascada)
  all         sales + appointments (no toca clientes, catálogo ni bonos)

Uso:
  python scripts/reset_legacy_public_data.py --scope sales --dry-run
  python scripts/reset_legacy_public_data.py --scope all
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


def legacy_appointment_filter(alias: str = "a") -> str:
    parts = [f"{alias}.legacy_planinc_id IS NOT NULL"]
    return f"({parts[0]} OR NULLIF(btrim({alias}.legacy_idplan::text), '') IS NOT NULL)"


def legacy_sale_ids_sql(company_param: str = "%s") -> str:
    apt_legacy = legacy_appointment_filter("a")
    return f"""
        SELECT s.id
        FROM public.sales s
        LEFT JOIN public.agenda_appointments a ON a.id = s.appointment_id
        WHERE s.company_id = {company_param}
          AND (
            s.ticket_number LIKE 'LEG-%%'
            OR ({apt_legacy})
          )
    """


def count_rows(cur, sql: str, params: tuple) -> int:
    cur.execute(f"SELECT COUNT(*) AS c FROM ({sql}) x", params)
    return int(cur.fetchone()["c"])


def delete_legacy_sales(cur, company_id: str, dry_run: bool) -> dict[str, int]:
    sale_ids = legacy_sale_ids_sql("%s")
    stats = {
        "sales": 0,
        "sale_items": 0,
        "invoices": 0,
        "invoice_items": 0,
        "orphan_invoices": 0,
        "unmatched_faccab_invoices": 0,
    }

    stats["sales"] = count_rows(cur, sale_ids, (company_id,))
    cur.execute(
        f"""
        SELECT COUNT(*) AS c FROM public.sale_items si
        WHERE si.sale_id IN ({sale_ids})
        """,
        (company_id,),
    )
    stats["sale_items"] = int(cur.fetchone()["c"])

    cur.execute(
        f"""
        SELECT COUNT(DISTINCT s.invoice_id) AS c
        FROM public.sales s
        WHERE s.id IN ({sale_ids}) AND s.invoice_id IS NOT NULL
        """,
        (company_id,),
    )
    stats["invoices"] = int(cur.fetchone()["c"])

    cur.execute(
        f"""
        SELECT COUNT(*) AS c FROM public.invoice_items ii
        WHERE ii.invoice_id IN (
          SELECT DISTINCT s.invoice_id FROM public.sales s
          WHERE s.id IN ({sale_ids}) AND s.invoice_id IS NOT NULL
        )
        """,
        (company_id,),
    )
    stats["invoice_items"] = int(cur.fetchone()["c"])

    if dry_run:
        stats["orphan_invoices"] = delete_orphan_legacy_invoices(cur, company_id, dry_run=True)
        stats["unmatched_faccab_invoices"] = delete_unmatched_faccab_invoices(cur, company_id, dry_run=True)
        return stats

    cur.execute(
        f"""
        DELETE FROM public.invoice_items
        WHERE invoice_id IN (
          SELECT DISTINCT s.invoice_id FROM public.sales s
          WHERE s.id IN ({sale_ids}) AND s.invoice_id IS NOT NULL
        )
        """,
        (company_id,),
    )
    cur.execute(
        f"""
        DELETE FROM public.invoices
        WHERE id IN (
          SELECT DISTINCT s.invoice_id FROM public.sales s
          WHERE s.id IN ({sale_ids}) AND s.invoice_id IS NOT NULL
        )
        """,
        (company_id,),
    )
    cur.execute(
        f"DELETE FROM public.sale_items WHERE sale_id IN ({sale_ids})",
        (company_id,),
    )
    cur.execute(f"DELETE FROM public.sales WHERE id IN ({sale_ids})", (company_id,))
    stats["orphan_invoices"] = delete_orphan_legacy_invoices(cur, company_id, dry_run=False)
    stats["unmatched_faccab_invoices"] = delete_unmatched_faccab_invoices(cur, company_id, dry_run=False)
    return stats


def delete_unmatched_faccab_invoices(cur, company_id: str, dry_run: bool) -> int:
    """Facturas faccab sin cita (promote_legacy_unmatched_faccab)."""
    cur.execute(
        """
        SELECT COUNT(*) AS c
        FROM public.invoices i
        WHERE i.company_id = %s
          AND i.notes LIKE 'Factura legacy sin cita%%'
        """,
        (company_id,),
    )
    count = int(cur.fetchone()["c"])
    if dry_run or count == 0:
        return count

    cur.execute(
        """
        DELETE FROM public.invoice_items
        WHERE invoice_id IN (
          SELECT i.id FROM public.invoices i
          WHERE i.company_id = %s AND i.notes LIKE 'Factura legacy sin cita%%'
        )
        """,
        (company_id,),
    )
    cur.execute(
        """
        DELETE FROM public.invoices
        WHERE company_id = %s AND notes LIKE 'Factura legacy sin cita%%'
        """,
        (company_id,),
    )
    return count


def delete_orphan_legacy_invoices(cur, company_id: str, dry_run: bool) -> int:
    """Facturas legacy automáticas sin ticket vinculado (restos de importaciones fallidas)."""
    cur.execute(
        """
        SELECT COUNT(*) AS c
        FROM public.invoices i
        WHERE i.company_id = %s
          AND i.notes LIKE 'Factura legacy automática%%'
          AND NOT EXISTS (
            SELECT 1 FROM public.sales s WHERE s.invoice_id = i.id
          )
        """,
        (company_id,),
    )
    count = int(cur.fetchone()["c"])

    if dry_run or count == 0:
        return count

    cur.execute(
        """
        DELETE FROM public.invoice_items
        WHERE invoice_id IN (
          SELECT i.id
          FROM public.invoices i
          WHERE i.company_id = %s
            AND i.notes LIKE 'Factura legacy automática%%'
            AND NOT EXISTS (SELECT 1 FROM public.sales s WHERE s.invoice_id = i.id)
        )
        """,
        (company_id,),
    )
    cur.execute(
        """
        DELETE FROM public.invoices
        WHERE company_id = %s
          AND notes LIKE 'Factura legacy automática%%'
          AND NOT EXISTS (SELECT 1 FROM public.sales s WHERE s.invoice_id = public.invoices.id)
        """,
        (company_id,),
    )
    return count


def delete_legacy_appointments(cur, company_id: str, dry_run: bool) -> dict[str, int]:
    apt_filter = legacy_appointment_filter("a")
    stats = {"appointments": 0, "appointment_items": 0}

    cur.execute(
        f"""
        SELECT COUNT(*) AS c FROM public.agenda_appointments a
        WHERE a.company_id = %s AND {apt_filter}
        """,
        (company_id,),
    )
    stats["appointments"] = int(cur.fetchone()["c"])

    cur.execute(
        f"""
        SELECT COUNT(*) AS c FROM public.appointment_items ai
        WHERE ai.appointment_id IN (
          SELECT a.id FROM public.agenda_appointments a
          WHERE a.company_id = %s AND {apt_filter}
        )
        """,
        (company_id,),
    )
    stats["appointment_items"] = int(cur.fetchone()["c"])

    if dry_run:
        return stats

    delete_legacy_sales(cur, company_id, dry_run=False)

    cur.execute(
        f"""
        DELETE FROM public.appointment_items
        WHERE appointment_id IN (
          SELECT a.id FROM public.agenda_appointments a
          WHERE a.company_id = %s AND {apt_filter}
        )
        """,
        (company_id,),
    )
    cur.execute(
        f"""
        DELETE FROM public.agenda_appointments a
        WHERE a.company_id = %s AND {apt_filter}
        """,
        (company_id,),
    )
    return stats


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser(description="Reset datos legacy promovidos en public.*")
    ap.add_argument("--company-id", default=get_company_id())
    ap.add_argument(
        "--scope",
        choices=["sales", "appointments", "all"],
        default="sales",
        help="sales=solo ventas/facturas legacy; appointments=+citas; all=igual que appointments",
    )
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    dsn = os.environ.get("SUPABASE_DB_URL", "").strip()
    if not dsn:
        sys.exit("Falta SUPABASE_DB_URL")

    conn = psycopg2.connect(dsn)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=RealDictCursor)

    print(f"Empresa: {args.company_id}")
    print(f"Ámbito: {args.scope}  dry_run={args.dry_run}\n")

    if args.scope in {"appointments", "all"}:
        apt_stats = delete_legacy_appointments(cur, args.company_id, args.dry_run)
        print("Citas legacy:", apt_stats)
    else:
        sale_stats = delete_legacy_sales(cur, args.company_id, args.dry_run)
        print("Ventas legacy:", sale_stats)

    if args.dry_run:
        conn.rollback()
        print("\n[dry-run] Sin cambios.")
    else:
        conn.commit()
        print("\nHecho.")


if __name__ == "__main__":
    main()
