"""
Cierra tickets (sales completed) desde citas sin cobrar y factura ventas pendientes hasta una fecha.

Fase 1 — Crear ticket TPV por cita:
  - appointment_date <= --through (default: ayer)
  - sin sale completed vinculada
  - importe cobrable > 0 (excluye sesiones de bono a 0 €)
  - customer_id obligatorio

Fase 2 — Facturar tickets:
  - sales completed, created_at::date <= --through, sin invoice_id
  - customer_id obligatorio
  - tickets mixtos: dos facturas (Medicina + Estética) según líneas

Uso:
  python scripts/close_and_invoice_through.py --dry-run
  python scripts/close_and_invoice_through.py --apply
  python scripts/close_and_invoice_through.py --apply --through 2026-06-03
  python scripts/close_and_invoice_through.py --apply --sales-only   # solo facturar, no crear tickets
  python scripts/close_and_invoice_through.py --apply --tickets-only # solo crear tickets
  python scripts/close_and_invoice_through.py --apply --from 2026-01-01  # solo citas desde 2026
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import uuid
from collections import Counter
from dataclasses import dataclass
from datetime import date, datetime, timedelta
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


def parse_pricing_notes(notes: str | None) -> tuple[Decimal, Decimal, str]:
    if not notes or not str(notes).startswith("__pricing__"):
        return Decimal("1"), Decimal("0"), "none"
    try:
        p = json.loads(str(notes)[len("__pricing__") :])
        return (
            money(p.get("quantity") or 1),
            money(p.get("unit_price") or 0),
            str(p.get("bonus_payment_mode") or "none"),
        )
    except Exception:
        return Decimal("1"), Decimal("0"), "none"


def line_chargeable(row: dict) -> Decimal:
    qty = money(row.get("quantity"))
    unit = money(row.get("unit_price"))
    mode = str(row.get("bonus_payment_mode") or "none")
    notes = row.get("notes")
    if (qty <= 0 and unit <= 0) and notes:
        nqty, nunit, mode = parse_pricing_notes(notes)
        if nunit > 0:
            qty, unit = nqty, nunit
    kind = str(row.get("kind") or "service")
    bono_id = None
    if notes and "__pricing__" in str(notes):
        try:
            p = json.loads(str(notes)[len("__pricing__") :])
            bono_id = p.get("bono_id")
        except Exception:
            pass
    if kind == "service" and row.get("customer_voucher_id") and mode == "none" and row.get("occupies_time"):
        return Decimal("0")
    if bono_id and mode == "none" and row.get("occupies_time"):
        return Decimal("0")
    if kind == "bonus":
        if mode == "60":
            return (unit * Decimal("0.6")).quantize(Decimal("0.01"))
        if mode == "40":
            return (unit * Decimal("0.4")).quantize(Decimal("0.01"))
        if mode == "full":
            return (qty * unit).quantize(Decimal("0.01"))
        return Decimal("0")
    return (qty * unit).quantize(Decimal("0.01"))


def invoice_number(cur, company_id: str) -> str:
    cur.execute("SAVEPOINT inv_num")
    try:
        cur.execute("SELECT public.generate_invoice_number(%s::uuid, false)", (company_id,))
        cur.execute("RELEASE SAVEPOINT inv_num")
        return str(cur.fetchone()[0])
    except Exception:
        cur.execute("ROLLBACK TO SAVEPOINT inv_num")
        cur.execute("RELEASE SAVEPOINT inv_num")
        cur.execute(
            """
            SELECT COALESCE(MAX(CAST(SUBSTRING(number FROM 'FAC-(\\d+)$') AS INTEGER)), 0) + 1
            FROM public.invoices WHERE company_id=%s::uuid AND number ~ '^FAC-\\d+$'
            """,
            (company_id,),
        )
        row = cur.fetchone()
        n = int(list(row.values())[0] or 1)
        return f"FAC-{n:06d}"


@dataclass
class SaleLine:
    description: str
    quantity: Decimal
    unit_price: Decimal
    total_price: Decimal
    article_id: str | None
    target_company_id: str


def resolve_sale_lines(cur, sale_id: str, fallback_company_id: str, catalog_company_id: str) -> list[SaleLine]:
    cur.execute(
        """
        SELECT
          si.description, si.quantity, si.unit_price, si.total_price,
          si.article_id::text,
          COALESCE(a.billing_company_id, af.billing_company_id, %s::uuid)::text AS target_company_id
        FROM public.sale_items si
        LEFT JOIN public.articles a ON a.id = si.article_id
        LEFT JOIN public.article_families af
          ON af.company_id = COALESCE(a.company_id, %s::uuid) AND af.name = a.familia
        WHERE si.sale_id = %s::uuid
        ORDER BY si.id
        """,
        (fallback_company_id, catalog_company_id, sale_id),
    )
    return [
        SaleLine(
            description=r["description"] or "Servicio",
            quantity=money(r["quantity"] or 1),
            unit_price=money(r["unit_price"]),
            total_price=money(r["total_price"]),
            article_id=r["article_id"],
            target_company_id=r["target_company_id"],
        )
        for r in cur.fetchall()
    ]


def insert_invoice(
    cur,
    *,
    sale: dict,
    company_id: str,
    lines: list[SaleLine],
    invoice_cols: set[str],
    item_cols: set[str],
) -> str:
    total = sum((ln.total_price for ln in lines), Decimal("0"))
    subtotal, tax = split_tax(total)
    issue_date = sale["created_at"].date() if isinstance(sale["created_at"], datetime) else date.fromisoformat(str(sale["created_at"])[:10])
    number = invoice_number(cur, company_id)
    invoice_id = str(uuid.uuid4())
    inv = {
        "id": invoice_id,
        "company_id": company_id,
        "customer_id": sale["customer_id"],
        "number": number,
        "issue_date": issue_date,
        "due_date": issue_date,
        "subtotal": subtotal,
        "tax_amount": tax,
        "total_amount": total,
        "re_total": Decimal("0"),
        "status": "paid",
        "paid_status": True,
        "paid_date": sale["created_at"],
        "currency": "EUR",
        "notes": f"Factura del ticket {sale['ticket_number']}",
        "is_intracomunitario": False,
        "verifactu_status": "pending",
    }
    keys = [k for k in inv if k in invoice_cols]
    cur.execute(
        f"INSERT INTO public.invoices ({', '.join(keys)}) VALUES ({', '.join(['%s'] * len(keys))})",
        [inv[k] for k in keys],
    )
    for ln in lines:
        lt = ln.total_price
        lb, ltax = split_tax(lt)
        item = {
            "invoice_id": invoice_id,
            "article_id": ln.article_id,
            "description": ln.description[:500],
            "quantity": ln.quantity,
            "unit_price": (ln.unit_price / (Decimal("1") + IVA)).quantize(Decimal("0.01")),
            "discount_percentage": Decimal("0"),
            "iva_percentage": Decimal("21"),
            "re_percentage": Decimal("0"),
            "subtotal_after_discount": lb,
            "iva_amount": ltax,
            "re_amount": Decimal("0"),
            "total_price": lt,
        }
        ikeys = [k for k in item if k in item_cols]
        cur.execute(
            f"INSERT INTO public.invoice_items ({', '.join(ikeys)}) VALUES ({', '.join(['%s'] * len(ikeys))})",
            [item[k] for k in ikeys],
        )
    return invoice_id


def fetch_pending_appointments(
    cur, company_id: str, through: date, from_date: date | None = None
) -> list[dict]:
    date_filter = "AND COALESCE(a.appointment_date, a.start_time::date) <= %s"
    params: list = [company_id, through]
    if from_date:
        date_filter = (
            "AND COALESCE(a.appointment_date, a.start_time::date) >= %s "
            "AND COALESCE(a.appointment_date, a.start_time::date) <= %s"
        )
        params = [company_id, from_date, through]

    cur.execute(
        f"""
        WITH has_sale AS (
          SELECT DISTINCT appointment_id
          FROM public.sales
          WHERE status = 'completed' AND appointment_id IS NOT NULL
        )
        SELECT
          a.id::text AS appointment_id,
          a.customer_id::text,
          c.name AS customer_name,
          COALESCE(a.appointment_date, a.start_time::date) AS apt_date,
          a.start_time,
          a.status
        FROM public.agenda_appointments a
        JOIN public.customers c ON c.id = a.customer_id
        LEFT JOIN has_sale hs ON hs.appointment_id = a.id
        WHERE a.company_id = %s::uuid
          {date_filter}
          AND COALESCE(a.status, 'confirmed') <> 'cancelled'
          AND a.customer_id IS NOT NULL
          AND hs.appointment_id IS NULL
        ORDER BY apt_date, a.start_time
        """,
        tuple(params),
    )
    rows = cur.fetchall()
    if not rows:
        return []

    apt_ids = [r["appointment_id"] for r in rows]
    cur.execute(
        """
        SELECT
          appointment_id::text, id::text, kind, label, notes,
          quantity, unit_price, bonus_payment_mode,
          occupies_time, article_id::text, customer_voucher_id::text, sort_order
        FROM public.appointment_items
        WHERE appointment_id = ANY(%s::uuid[])
        ORDER BY sort_order
        """,
        (apt_ids,),
    )
    items_by: dict[str, list] = {}
    for it in cur.fetchall():
        items_by.setdefault(it["appointment_id"], []).append(dict(it))

    pending: list[dict] = []
    for row in rows:
        aid = row["appointment_id"]
        items = items_by.get(aid, [])
        charge_lines = []
        total = Decimal("0")
        for it in items:
            lt = line_chargeable(it)
            if lt <= 0:
                continue
            charge_lines.append({**it, "line_total": lt})
            total += lt
        if total <= 0 or not charge_lines:
            continue
        pending.append({**row, "items": charge_lines, "total": total})
    return pending


def create_sale_for_appointment(
    cur,
    *,
    apt: dict,
    host_company_id: str,
    sales_cols: set[str],
    catalog_company_id: str,
) -> str | None:
    total = money(apt["total"])
    subtotal, tax = split_tax(total)
    apt_date = apt["apt_date"]
    if isinstance(apt_date, datetime):
        apt_date = apt_date.date()
    created_at = datetime.combine(apt_date, datetime.min.time()).replace(hour=12)

    notes_payload = {
        "source": "agenda_appointment",
        "appointment_id": apt["appointment_id"],
        "customer_id": apt["customer_id"],
        "customer_name": apt["customer_name"],
        "appointment_date": apt_date.isoformat(),
        "appointment_status": apt.get("status"),
        "items": [
            {"name": it["label"], "total": float(it["line_total"]), "source_kind": it.get("kind")}
            for it in apt["items"]
        ],
        "bulk_close": True,
    }

    sale_row: dict = {
        "company_id": host_company_id,
        "ticket_number": "",
        "total_amount": float(total),
        "subtotal": float(subtotal),
        "tax_amount": float(tax),
        "payment_method": "card",
        "amount_paid": float(total),
        "change_amount": 0,
        "status": "completed",
        "currency": "EUR",
        "customer_name": apt["customer_name"],
        "customer_id": apt["customer_id"],
        "appointment_id": apt["appointment_id"],
        "notes": json.dumps(notes_payload, ensure_ascii=False),
        "created_at": created_at,
    }
    if "host_company_id" in sales_cols:
        sale_row["host_company_id"] = catalog_company_id

    cols = [k for k in sale_row if k in sales_cols]
    cur.execute(
        f"INSERT INTO public.sales ({', '.join(cols)}) VALUES ({', '.join(['%s'] * len(cols))}) RETURNING id::text, ticket_number",
        [sale_row[c] for c in cols],
    )
    row = cur.fetchone()
    sale_id = row["id"]

    cur.execute("SELECT to_regclass('public.sale_items') AS t")
    if cur.fetchone()["t"]:
        for it in apt["items"]:
            lt = money(it["line_total"])
            qty = money(it.get("quantity") or 1)
            unit = (lt / qty).quantize(Decimal("0.01")) if qty > 0 else lt
            cur.execute(
                """
                INSERT INTO public.sale_items (sale_id, article_id, description, quantity, unit_price, total_price)
                VALUES (%s::uuid, %s::uuid, %s, %s, %s, %s)
                """,
                (
                    sale_id,
                    it.get("article_id"),
                    str(it.get("label") or "Servicio")[:500],
                    float(qty),
                    float(unit),
                    float(lt),
                ),
            )
    return sale_id, row["ticket_number"], created_at


def invoice_pending_sales(cur, through: date, catalog_company_id: str, apply: bool) -> Counter:
    invoice_cols = table_columns(cur, "invoices")
    item_cols = table_columns(cur, "invoice_items")
    sales_cols = table_columns(cur, "sales")
    counts: Counter = Counter()

    cur.execute(
        """
        SELECT
          s.id::text, s.company_id::text, s.ticket_number, s.total_amount, s.created_at,
          s.customer_id::text, s.customer_name, s.appointment_id::text, s.invoice_id::text,
          s.notes,
          i.verifactu_status
        FROM public.sales s
        LEFT JOIN public.invoices i ON i.id = s.invoice_id
        WHERE s.status = 'completed'
          AND s.created_at::date <= %s
          AND s.invoice_id IS NULL
          AND s.total_amount > 0
          AND s.customer_id IS NOT NULL
        ORDER BY s.created_at, s.ticket_number
        """,
        (through,),
    )
    sales = cur.fetchall()

    for sale in sales:
        vf = sale.get("verifactu_status") or ""
        if vf in {"sent", "accepted", "rejected"}:
            counts["skip_verifactu"] += 1
            continue

        from sale_invoice_split import resolve_sale_lines

        lines = resolve_sale_lines(
            cur, sale["id"], sale["company_id"] or catalog_company_id, catalog_company_id
        )
        if not lines:
            counts["skip_no_lines"] += 1
            continue

        n_companies = len({ln.target_company_id for ln in lines})
        if n_companies > 1:
            counts["invoice_split"] += 1
        else:
            counts["invoice"] += 1

        if apply:
            invoice_sale_by_billing(
                cur,
                sale,
                catalog_company_id=catalog_company_id,
                invoice_cols=invoice_cols,
                item_cols=item_cols,
                sales_cols=sales_cols,
            )
    return counts


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser()
    ap.add_argument("--through", default=(date.today() - timedelta(days=1)).isoformat())
    ap.add_argument(
        "--from",
        dest="from_date",
        default="2026-01-01",
        help="Solo citas con fecha >= (default 2026-01-01; evita histórico legacy masivo)",
    )
    ap.add_argument("--company-id", default=DEFAULT_CATALOG)
    ap.add_argument("--catalog-company-id", default=DEFAULT_CATALOG)
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--tickets-only", action="store_true")
    ap.add_argument("--sales-only", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    if args.apply and args.dry_run:
        sys.exit("Usa solo --apply o --dry-run")

    through = date.fromisoformat(args.through)
    from_date = date.fromisoformat(args.from_date) if args.from_date else None
    dsn = os.environ.get("SUPABASE_DB_URL", "").strip()
    if not dsn:
        sys.exit("Falta SUPABASE_DB_URL")

    conn = psycopg2.connect(dsn, cursor_factory=RealDictCursor)
    conn.autocommit = False
    cur = conn.cursor()
    mode = "DRY-RUN" if args.dry_run or not args.apply else "APPLY"

    try:
        sales_cols = table_columns(cur, "sales")
        ticket_counts: Counter = Counter()
        invoice_counts: Counter = Counter()

        if not args.sales_only:
            pending = fetch_pending_appointments(cur, args.company_id, through, from_date)
            if args.limit > 0:
                pending = pending[: args.limit]
            print(f"=== Cerrar tickets ({mode}) {from_date} -> {through} ===")
            print(f"Citas pendientes de cobro: {len(pending)}")

            for apt in pending:
                ticket_counts["would_create"] += 1
                if args.apply and not args.dry_run:
                    try:
                        cur.execute("SAVEPOINT apt_sale")
                        sale_id, ticket, created_at = create_sale_for_appointment(
                            cur,
                            apt=apt,
                            host_company_id=args.company_id,
                            sales_cols=sales_cols,
                            catalog_company_id=args.catalog_company_id,
                        )
                        cur.execute("RELEASE SAVEPOINT apt_sale")
                        ticket_counts["created"] += 1
                        if ticket_counts["created"] <= 5 or ticket_counts["created"] % 50 == 0:
                            print(
                                f"  ticket {ticket} · {apt['customer_name'][:30]} · "
                                f"{apt['apt_date']} · {apt['total']} €",
                                file=sys.stderr,
                            )
                    except Exception as exc:
                        cur.execute("ROLLBACK TO SAVEPOINT apt_sale")
                        ticket_counts["errors"] += 1
                        if ticket_counts["errors"] <= 5:
                            print(f"  ERROR {apt['appointment_id']}: {exc}", file=sys.stderr)

            for k, v in sorted(ticket_counts.items()):
                print(f"  {k}: {v}")

        if not args.tickets_only:
            print(f"\n=== Facturar tickets ({mode}) hasta {through} ===")
            invoice_counts = invoice_pending_sales(
                cur, through, args.catalog_company_id, apply=args.apply and not args.dry_run
            )
            for k, v in sorted(invoice_counts.items()):
                print(f"  {k}: {v}")

        if args.apply and not args.dry_run:
            conn.commit()
            print("\nOK — cambios aplicados.")
        else:
            conn.rollback()
            print("\nSin cambios (dry-run).")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
