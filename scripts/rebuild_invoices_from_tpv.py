"""
Rehace facturas desde tickets TPV hasta una fecha.

Por defecto es dry-run. Con --apply:
  - no toca facturas Verifactu sent/accepted/rejected,
  - tickets mixtos: genera una factura por empresa (Medicina / Estética),
  - no toca tickets sin cliente,
  - recrea factura desde sales + sale_items y enlaza sales.invoice_id.

La tabla public.invoice_rebuild_audit conserva trazabilidad básica.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import uuid
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor, Json
except ImportError:
    print("pip install psycopg2-binary", file=sys.stderr)
    raise

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CATALOG = "5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4"
IVA = Decimal("0.21")

sys.path.insert(0, str(ROOT / "scripts"))
from sale_invoice_split import invoice_sale_by_billing  # noqa: E402


def load_dotenv() -> None:
    env = ROOT / ".env"
    if not env.is_file():
        return
    for line in env.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def money(v) -> Decimal:
    return Decimal(str(v or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def split_tax(total: Decimal) -> tuple[Decimal, Decimal]:
    subtotal = (total / (Decimal("1") + IVA)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return subtotal, (total - subtotal).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def table_columns(cur, table: str) -> set[str]:
    cur.execute(
        """
        SELECT column_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name=%s
        """,
        (table,),
    )
    return {r["column_name"] for r in cur.fetchall()}


def ensure_audit_table(cur) -> None:
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS public.invoice_rebuild_audit (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          run_id uuid NOT NULL,
          sale_id uuid,
          old_invoice_id uuid,
          new_invoice_id uuid,
          action text NOT NULL,
          reason text,
          payload jsonb NOT NULL DEFAULT '{}'::jsonb,
          created_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )


def insert_audit(cur, run_id: str, *, sale_id: str | None, old_invoice_id: str | None, new_invoice_id: str | None, action: str, reason: str | None, payload: dict) -> None:
    cur.execute(
        """
        INSERT INTO public.invoice_rebuild_audit
          (run_id, sale_id, old_invoice_id, new_invoice_id, action, reason, payload)
        VALUES (%s::uuid, %s::uuid, %s::uuid, %s::uuid, %s, %s, %s::jsonb)
        """,
        (
            run_id,
            sale_id,
            old_invoice_id,
            new_invoice_id,
            action,
            reason,
            json.dumps(payload, ensure_ascii=False, default=str),
        ),
    )


@dataclass
class SaleLine:
    id: str
    article_id: str | None
    description: str
    quantity: Decimal
    unit_price: Decimal
    total_price: Decimal
    target_company_id: str


def resolve_sale_lines(cur, sale_id: str, fallback_company_id: str, catalog_company_id: str) -> list[SaleLine]:
    cur.execute(
        """
        SELECT
          si.id::text,
          si.article_id::text,
          si.description,
          si.quantity,
          si.unit_price,
          si.total_price,
          COALESCE(a.billing_company_id, af.billing_company_id, %s::uuid)::text AS target_company_id
        FROM public.sale_items si
        LEFT JOIN public.articles a ON a.id = si.article_id
        LEFT JOIN public.article_families af
          ON af.company_id = COALESCE(a.company_id, %s::uuid)
         AND af.name = a.familia
        WHERE si.sale_id = %s::uuid
        ORDER BY si.id
        """,
        (fallback_company_id, catalog_company_id, sale_id),
    )
    return [
        SaleLine(
            id=r["id"],
            article_id=r["article_id"],
            description=r["description"] or "Servicio",
            quantity=money(r["quantity"] or 1),
            unit_price=money(r["unit_price"]),
            total_price=money(r["total_price"]),
            target_company_id=r["target_company_id"],
        )
        for r in cur.fetchall()
    ]


def invoice_number(cur, company_id: str) -> str:
    cur.execute("SAVEPOINT invoice_number_fn")
    try:
        cur.execute("SELECT public.generate_invoice_number(%s::uuid, false)", (company_id,))
        cur.execute("RELEASE SAVEPOINT invoice_number_fn")
        return str(cur.fetchone()[0])
    except Exception:
        cur.execute("ROLLBACK TO SAVEPOINT invoice_number_fn")
        cur.execute("RELEASE SAVEPOINT invoice_number_fn")
        cur.execute(
            """
            SELECT COALESCE(MAX(CAST(SUBSTRING(number FROM 'FAC-(\\d+)$') AS INTEGER)), 0) + 1
            FROM public.invoices
            WHERE company_id=%s::uuid AND number ~ '^FAC-\\d+$'
            """,
            (company_id,),
        )
        row = cur.fetchone()
        return f"FAC-{int(next(iter(row.values())) or 1):06d}"


def insert_invoice(cur, *, sale: dict, company_id: str, lines: list[SaleLine], invoice_cols: set[str], item_cols: set[str]) -> str:
    total = sum((line.total_price for line in lines), Decimal("0.00")).quantize(Decimal("0.01"))
    subtotal, tax = split_tax(total)
    issue_date = sale["created_at"].date() if isinstance(sale["created_at"], datetime) else date.fromisoformat(str(sale["created_at"])[:10])
    number = invoice_number(cur, company_id)
    invoice_id = str(uuid.uuid4())
    invoice = {
        "id": invoice_id,
        "company_id": company_id,
        "customer_id": sale["customer_id"],
        "number": number,
        "issue_date": issue_date,
        "due_date": issue_date,
        "subtotal": subtotal,
        "tax_amount": tax,
        "total_amount": total,
        "re_total": Decimal("0.00"),
        "status": "paid",
        "paid_status": True,
        "paid_date": sale["created_at"],
        "currency": "EUR",
        "notes": f"Factura del ticket {sale['ticket_number']}",
        "is_intracomunitario": False,
        "verifactu_status": "pending",
    }
    keys = [k for k in invoice if k in invoice_cols]
    cur.execute(
        f"INSERT INTO public.invoices ({', '.join(keys)}) VALUES ({', '.join(['%s'] * len(keys))})",
        [invoice[k] for k in keys],
    )
    for line in lines:
        line_total = line.total_price
        line_base, line_tax = split_tax(line_total)
        item = {
            "invoice_id": invoice_id,
            "article_id": line.article_id,
            "description": line.description,
            "quantity": line.quantity,
            "unit_price": (line.unit_price / (Decimal("1") + IVA)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            "discount_percentage": Decimal("0"),
            "iva_percentage": Decimal("21"),
            "re_percentage": Decimal("0"),
            "subtotal_after_discount": line_base,
            "iva_amount": line_tax,
            "re_amount": Decimal("0"),
            "total_price": line_total,
        }
        item_keys = [k for k in item if k in item_cols]
        cur.execute(
            f"INSERT INTO public.invoice_items ({', '.join(item_keys)}) VALUES ({', '.join(['%s'] * len(item_keys))})",
            [item[k] for k in item_keys],
        )
    return invoice_id


def resolve_customer_id(cur, sale: dict, catalog_company_id: str) -> str | None:
    if sale.get("customer_id"):
        return str(sale["customer_id"])
    notes = sale.get("notes")
    if notes:
        try:
            parsed = json.loads(notes)
            customer_id = parsed.get("customer_id")
            if customer_id:
                return str(customer_id)
            agenda = parsed.get("agenda_appointment")
            if isinstance(agenda, dict) and agenda.get("customer_id"):
                return str(agenda["customer_id"])
        except Exception:
            pass
    if sale.get("appointment_id"):
        cur.execute(
            "SELECT customer_id::text FROM public.agenda_appointments WHERE id=%s::uuid",
            (sale["appointment_id"],),
        )
        row = cur.fetchone()
        if row and row["customer_id"]:
            return str(row["customer_id"])
    name = str(sale.get("customer_name") or "").strip()
    if name:
        cur.execute(
            """
            SELECT id::text
            FROM public.customers
            WHERE company_id=%s::uuid
              AND lower(name) = lower(%s)
            ORDER BY updated_at DESC NULLS LAST
            LIMIT 1
            """,
            (catalog_company_id, name),
        )
        row = cur.fetchone()
        if row and row["id"]:
            return str(row["id"])
    return None


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser()
    parser.add_argument("--through", default=date.today().isoformat())
    parser.add_argument("--catalog-company-id", default=DEFAULT_CATALOG)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()

    dsn = os.environ.get("SUPABASE_DB_URL", "").strip()
    if not dsn:
        sys.exit("Falta SUPABASE_DB_URL en .env")

    run_id = str(uuid.uuid4())
    conn = psycopg2.connect(dsn, cursor_factory=RealDictCursor)
    conn.autocommit = False
    cur = conn.cursor()
    try:
        ensure_audit_table(cur)
        invoice_cols = table_columns(cur, "invoices")
        item_cols = table_columns(cur, "invoice_items")
        limit_sql = f"LIMIT {int(args.limit)}" if args.limit > 0 else ""
        cur.execute(
            f"""
            SELECT
              s.id::text, s.company_id::text, s.ticket_number, s.total_amount,
              s.created_at, s.customer_id::text, s.customer_name, s.appointment_id::text, s.notes,
              s.invoice_id::text,
              i.verifactu_status, i.number AS old_invoice_number
            FROM public.sales s
            LEFT JOIN public.invoices i ON i.id = s.invoice_id
            WHERE s.status='completed'
              AND s.created_at::date <= %s
              AND s.total_amount > 0
            ORDER BY s.created_at, s.ticket_number
            {limit_sql}
            """,
            (date.fromisoformat(args.through),),
        )
        sales = cur.fetchall()
        counts = Counter()
        for sale in sales:
            source_company_id = sale["company_id"] or args.catalog_company_id
            lines = resolve_sale_lines(cur, sale["id"], source_company_id, args.catalog_company_id)
            target_ids = {line.target_company_id for line in lines}
            old_invoice_id = sale["invoice_id"]
            vf = sale["verifactu_status"] or ""
            resolved_customer_id = resolve_customer_id(cur, sale, args.catalog_company_id)
            sale["customer_id"] = resolved_customer_id
            if not resolved_customer_id:
                counts["skip_no_customer"] += 1
                action, reason = "skip", "no_customer"
            elif not lines:
                counts["skip_no_lines"] += 1
                action, reason = "skip", "no_lines"
            elif vf in {"sent", "accepted", "rejected"}:
                counts["skip_verifactu"] += 1
                action, reason = "skip", f"verifactu_{vf}"
            else:
                action, reason = "rebuild", None

            if action == "skip":
                insert_audit(cur, run_id, sale_id=sale["id"], old_invoice_id=old_invoice_id, new_invoice_id=None, action=action, reason=reason, payload=dict(sale))
                continue

            if len(target_ids) > 1:
                counts["rebuild_split"] += 1
            else:
                counts["rebuild"] += 1
            new_invoice_id = None
            split_meta = None
            if args.apply:
                sales_cols = table_columns(cur, "sales")
                if old_invoice_id:
                    cur.execute("DELETE FROM public.invoice_items WHERE invoice_id=%s::uuid", (old_invoice_id,))
                    cur.execute("DELETE FROM public.invoices WHERE id=%s::uuid", (old_invoice_id,))
                if "notes" not in sale and "notes" in sales_cols:
                    cur.execute("SELECT notes FROM public.sales WHERE id=%s::uuid", (sale["id"],))
                    nrow = cur.fetchone()
                    if nrow:
                        sale["notes"] = nrow.get("notes")
                split_meta = invoice_sale_by_billing(
                    cur,
                    sale,
                    catalog_company_id=args.catalog_company_id,
                    invoice_cols=invoice_cols,
                    item_cols=item_cols,
                    sales_cols=sales_cols,
                )
                new_invoice_id = split_meta[0]["invoice_id"] if split_meta else None
            insert_audit(
                cur,
                run_id,
                sale_id=sale["id"],
                old_invoice_id=old_invoice_id,
                new_invoice_id=new_invoice_id,
                action="rebuild",
                reason=None,
                payload={
                    "target_company_ids": list(target_ids),
                    "split_invoices": split_meta,
                    "ticket_number": sale["ticket_number"],
                },
            )

        if args.apply:
            conn.commit()
        else:
            conn.rollback()
        mode = "APPLY" if args.apply else "DRY-RUN"
        print(f"=== rebuild_invoices_from_tpv {mode} ===")
        print(f"run_id: {run_id}")
        print(f"tickets revisados: {len(sales)}")
        for key in sorted(counts):
            print(f"{key}: {counts[key]}")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
