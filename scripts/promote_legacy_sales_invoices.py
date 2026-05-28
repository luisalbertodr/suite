"""
Genera facturas (public.invoices) para tickets TPV legacy sin facturar.

Idempotente: solo sales con appointment_id, status=completed, invoice_id IS NULL.

Requisitos: SUPABASE_DB_URL, empresa en legacy_company / PROMOTE_COMPANY_ID

Uso:
  python scripts/promote_legacy_sales_invoices.py --dry-run
  python scripts/promote_legacy_sales_invoices.py
  python scripts/promote_legacy_sales_invoices.py --limit 100
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import uuid
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    print("pip install psycopg2-binary", file=sys.stderr)
    raise

from legacy_company import get_company_id

ROOT = Path(__file__).resolve().parents[1]
IVA_RATE = Decimal("0.21")
PAGE_SIZE = 200


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


def money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def split_tax_included(total: Decimal) -> tuple[Decimal, Decimal, Decimal]:
    if total <= 0:
        return Decimal("0"), Decimal("0"), Decimal("0")
    subtotal = (total / (Decimal("1") + IVA_RATE)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    tax = (total - subtotal).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return subtotal, tax, total


def parse_sale_notes_items(notes: str | None) -> list[dict]:
    if not notes:
        return []
    try:
        parsed = json.loads(notes)
        return list(parsed.get("items") or [])
    except Exception:
        return []


def table_columns(cur, schema: str, table: str) -> set[str]:
    cur.execute(
        """
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = %s AND table_name = %s
        """,
        (schema, table),
    )
    return {r["column_name"] for r in cur.fetchall()}


def insert_row(cur, table: str, row: dict, cols: set[str]) -> None:
    payload = {k: v for k, v in row.items() if k in cols}
    if not payload:
        return
    keys = list(payload.keys())
    cur.execute(
        f"INSERT INTO public.{table} ({', '.join(keys)}) VALUES ({', '.join(['%s'] * len(keys))})",
        [payload[k] for k in keys],
    )


def next_invoice_number(cur, company_id: str) -> str:
    cur.execute(
        """
        SELECT COALESCE(
          MAX(CAST(SUBSTRING(number FROM 'FAC-(\\d+)$') AS INTEGER)), 0
        ) + 1 AS n
        FROM public.invoices
        WHERE company_id = %s AND number ~ '^FAC-\\d+$'
        """,
        (company_id,),
    )
    n = int(cur.fetchone()["n"] or 1)
    return f"FAC-{n:06d}"


class InvoiceNumberSeq:
    def __init__(self, cur, company_id: str) -> None:
        self.company_id = company_id
        self._n = 0
        self.sync(cur)

    def sync(self, cur) -> None:
        cur.execute(
            """
            SELECT COALESCE(
              MAX(CAST(SUBSTRING(number FROM 'FAC-(\\d+)$') AS INTEGER)), 0
            ) AS n
            FROM public.invoices
            WHERE company_id = %s AND number ~ '^FAC-\\d+$'
            """,
            (self.company_id,),
        )
        self._n = int(cur.fetchone()["n"] or 0)

    def next(self) -> str:
        self._n += 1
        return f"FAC-{self._n:06d}"


def open_conn(dsn: str):
    conn = psycopg2.connect(dsn)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("SET session_replication_role = 'replica'")
    except Exception:
        conn.rollback()
    return conn, cur


def fetch_pending_sales(cur, company_id: str, limit: int) -> list[dict]:
    limit_sql = f"LIMIT {int(limit)}" if limit > 0 else f"LIMIT {PAGE_SIZE}"
    cur.execute(
        f"""
        SELECT id, customer_id, customer_name, total_amount, created_at, ticket_number, notes
        FROM public.sales
        WHERE company_id = %s
          AND status = 'completed'
          AND appointment_id IS NOT NULL
          AND invoice_id IS NULL
          AND customer_id IS NOT NULL
        ORDER BY created_at
        FOR UPDATE SKIP LOCKED
        {limit_sql}
        """,
        (company_id,),
    )
    return cur.fetchall()


def fetch_sale_items(cur, sale_ids: list[str]) -> dict[str, list]:
    if not sale_ids:
        return {}
    cur.execute(
        """
        SELECT sale_id, description, quantity, unit_price, total_price, article_id
        FROM public.sale_items
        WHERE sale_id = ANY(%s::uuid[])
        ORDER BY sale_id
        """,
        (sale_ids,),
    )
    out: dict[str, list] = {}
    for row in cur.fetchall():
        out.setdefault(str(row["sale_id"]), []).append(dict(row))
    return out


def process_one_sale(
    cur,
    *,
    company_id: str,
    sale: dict,
    items_by_sale: dict[str, list],
    inv_cols: set[str],
    item_cols: set[str],
    has_invoice_id: bool,
    dry_run: bool,
    number_seq: InvoiceNumberSeq,
) -> tuple[bool, str | None]:
    sale_id = str(sale["id"])
    total = money(sale["total_amount"])
    if total <= 0:
        return False, "zero_total"

    subtotal, tax_amount, total_amount = split_tax_included(total)
    issue_date = sale["created_at"]
    if isinstance(issue_date, datetime):
        issue_iso = issue_date.date().isoformat()
    else:
        issue_iso = str(issue_date)[:10]

    line_rows = items_by_sale.get(sale_id) or []
    if not line_rows:
        for it in parse_sale_notes_items(sale.get("notes")):
            lt = money(it.get("total") or 0)
            if lt <= 0:
                continue
            line_rows.append(
                {
                    "description": str(it.get("name") or "Servicio")[:500],
                    "quantity": Decimal("1"),
                    "unit_price": lt,
                    "total_price": lt,
                    "article_id": None,
                }
            )
    if not line_rows:
        line_rows = [
            {
                "description": f"Ticket {sale.get('ticket_number') or sale_id[:8]}",
                "quantity": Decimal("1"),
                "unit_price": total,
                "total_price": total,
                "article_id": None,
            }
        ]

    inv_number = number_seq.next()
    if dry_run:
        print(f"[dry-run] {inv_number} sale={sale_id[:8]} total={total_amount}")
        return True, None

    invoice_id = str(uuid.uuid4())
    inv_row = {
        "id": invoice_id,
        "company_id": company_id,
        "customer_id": str(sale["customer_id"]),
        "number": inv_number,
        "issue_date": issue_iso,
        "due_date": issue_iso,
        "subtotal": float(subtotal),
        "tax_amount": float(tax_amount),
        "total_amount": float(total_amount),
        "re_total": 0,
        "status": "paid",
        "paid_status": True,
        "paid_date": issue_iso,
        "currency": "EUR",
        "created_at": issue_date if isinstance(issue_date, datetime) else f"{issue_iso}T12:00:00",
        "notes": f"Factura legacy automática · ticket {sale.get('ticket_number') or sale_id[:8]}",
    }
    insert_row(cur, "invoices", inv_row, inv_cols)

    for idx, it in enumerate(line_rows):
        line_total = money(it.get("total_price") or 0)
        ls, lt, _ = split_tax_included(line_total)
        qty = money(it.get("quantity") or 1)
        unit = money(it.get("unit_price") or line_total)
        item_row = {
            "invoice_id": invoice_id,
            "description": str(it.get("description") or "Servicio")[:500],
            "quantity": float(qty),
            "unit_price": float(unit),
            "discount_percentage": 0,
            "iva_percentage": 21,
            "re_percentage": 0,
            "subtotal_after_discount": float(ls),
            "iva_amount": float(lt),
            "re_amount": 0,
            "total_price": float(line_total),
            "sort_order": idx,
            "article_id": it.get("article_id"),
        }
        insert_row(cur, "invoice_items", item_row, item_cols)

    if has_invoice_id:
        cur.execute(
            "UPDATE public.sales SET invoice_id = %s WHERE id = %s",
            (invoice_id, sale_id),
        )
    return True, None


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser()
    ap.add_argument("--company-id", default=get_company_id())
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--limit", type=int, default=0, help="Máximo de facturas a crear (0 = todas)")
    ap.add_argument("--commit-every", type=int, default=25, help="Commit cada N facturas")
    args = ap.parse_args()

    dsn = os.environ.get("SUPABASE_DB_URL", "").strip()
    if not dsn:
        sys.exit("Falta SUPABASE_DB_URL")

    company_id = args.company_id
    created = 0
    skipped = 0
    errors = 0
    remaining_limit = args.limit if args.limit > 0 else None

    while True:
        conn, cur = open_conn(dsn)
        cur.execute("SELECT pg_advisory_lock(hashtext(%s))", (f"legacy_inv_{company_id}",))
        inv_cols = table_columns(cur, "public", "invoices")
        item_cols = table_columns(cur, "public", "invoice_items")
        sales_cols = table_columns(cur, "public", "sales")
        has_invoice_id = "invoice_id" in sales_cols

        page_limit = PAGE_SIZE
        if remaining_limit is not None:
            page_limit = min(PAGE_SIZE, remaining_limit)

        sales = fetch_pending_sales(cur, company_id, page_limit)
        if not sales:
            cur.close()
            conn.close()
            break

        items_by_sale = fetch_sale_items(cur, [str(s["id"]) for s in sales])
        batch_count = 0
        number_seq = InvoiceNumberSeq(cur, company_id)

        for sale in sales:
            attempts = 0
            while attempts < 2:
                try:
                    ok, reason = process_one_sale(
                        cur,
                        company_id=company_id,
                        sale=sale,
                        items_by_sale=items_by_sale,
                        inv_cols=inv_cols,
                        item_cols=item_cols,
                        has_invoice_id=has_invoice_id,
                        dry_run=args.dry_run,
                        number_seq=number_seq,
                    )
                    if not ok:
                        skipped += 1
                    else:
                        created += 1
                        batch_count += 1
                        if remaining_limit is not None:
                            remaining_limit -= 1
                    break
                except psycopg2.errors.UniqueViolation as exc:
                    conn.rollback()
                    if "invoices_number_company_unique" in str(exc) and attempts == 0:
                        number_seq.sync(cur)
                        attempts += 1
                        continue
                    errors += 1
                    if errors <= 10:
                        print(f"Error sale={sale['id']}: {exc}", file=sys.stderr)
                    break
                except Exception as exc:
                    conn.rollback()
                    errors += 1
                    if errors <= 10:
                        print(f"Error sale={sale['id']}: {exc}", file=sys.stderr)
                    cur.close()
                    conn.close()
                    conn, cur = open_conn(dsn)
                    number_seq = InvoiceNumberSeq(cur, company_id)
                    batch_count = 0
                    break
            else:
                errors += 1

            if not args.dry_run and batch_count >= args.commit_every:
                conn.commit()
                print(f"... {created} facturas creadas", file=sys.stderr)
                batch_count = 0
                cur.close()
                conn.close()
                conn, cur = open_conn(dsn)
                number_seq = InvoiceNumberSeq(cur, company_id)

            if remaining_limit is not None and remaining_limit <= 0:
                break

        if not args.dry_run and batch_count > 0:
            conn.commit()
        elif args.dry_run:
            conn.rollback()

        try:
            cur.execute("SELECT pg_advisory_unlock(hashtext(%s))", (f"legacy_inv_{company_id}",))
        except Exception:
            pass
        cur.close()
        conn.close()

        if remaining_limit is not None and remaining_limit <= 0:
            break
        if len(sales) < page_limit:
            break

    print(f"Facturas creadas: {created}")
    print(f"Omitidos (sin importe): {skipped}")
    if errors:
        print(f"Errores: {errors}")


if __name__ == "__main__":
    main()
