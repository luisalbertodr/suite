"""Facturación de un ticket repartida por empresa emisora (Medicina / Estética)."""
from __future__ import annotations

import json
import uuid
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

IVA = Decimal("0.21")

ESTETICA_ID = "5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4"
MEDICINA_ID = "816af484-92a0-4f65-a5a7-1c907aa4bb3d"


def money(v: Any) -> Decimal:
    return Decimal(str(v or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def split_tax(total: Decimal) -> tuple[Decimal, Decimal]:
    subtotal = (total / (Decimal("1") + IVA)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return subtotal, (total - subtotal).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


@dataclass
class SaleLine:
    description: str
    quantity: Decimal
    unit_price: Decimal
    total_price: Decimal
    article_id: str | None
    target_company_id: str


def resolve_sale_lines(
    cur, sale_id: str, fallback_company_id: str, catalog_company_id: str
) -> list[SaleLine]:
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


def group_lines_by_company(lines: list[SaleLine]) -> dict[str, list[SaleLine]]:
    grouped: dict[str, list[SaleLine]] = defaultdict(list)
    for ln in lines:
        grouped[ln.target_company_id].append(ln)
    return dict(grouped)


def company_label(cur, company_id: str) -> str:
    cur.execute(
        "SELECT COALESCE(NULLIF(btrim(short_name), ''), name) AS label FROM public.companies WHERE id = %s::uuid",
        (company_id,),
    )
    row = cur.fetchone()
    return str(row["label"] if row else company_id[:8])


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


def insert_invoice(
    cur,
    *,
    sale: dict,
    company_id: str,
    lines: list[SaleLine],
    invoice_cols: set[str],
    item_cols: set[str],
    company_label_text: str,
) -> tuple[str, str]:
    total = sum((ln.total_price for ln in lines), Decimal("0"))
    subtotal, tax = split_tax(total)
    issue_date = (
        sale["created_at"].date()
        if isinstance(sale["created_at"], datetime)
        else date.fromisoformat(str(sale["created_at"])[:10])
    )
    number = invoice_number(cur, company_id)
    invoice_id = str(uuid.uuid4())
    ticket = sale.get("ticket_number") or ""
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
        "notes": f"Factura del ticket {ticket} ({company_label_text})",
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
    return invoice_id, number


def merge_sale_notes_with_split(notes: str | None, split_meta: list[dict]) -> str:
    parsed: dict = {}
    if notes:
        try:
            parsed = json.loads(notes)
            if not isinstance(parsed, dict):
                parsed = {"_text": notes}
        except Exception:
            parsed = {"_text": notes}
    parsed["split_invoices"] = split_meta
    return json.dumps(parsed, ensure_ascii=False)


def invoice_sale_by_billing(
    cur,
    sale: dict,
    *,
    catalog_company_id: str,
    invoice_cols: set[str],
    item_cols: set[str],
    sales_cols: set[str],
) -> list[dict]:
    """
    Crea una o más facturas para el ticket. Devuelve metadatos de cada factura creada.
    """
    lines = resolve_sale_lines(
        cur,
        sale["id"],
        sale.get("company_id") or catalog_company_id,
        catalog_company_id,
    )
    if not lines:
        return []

    grouped = group_lines_by_company(lines)
    split_meta: list[dict] = []

    for company_id in sorted(grouped.keys()):
        company_lines = grouped[company_id]
        label = company_label(cur, company_id)
        inv_id, inv_number = insert_invoice(
            cur,
            sale=sale,
            company_id=company_id,
            lines=company_lines,
            invoice_cols=invoice_cols,
            item_cols=item_cols,
            company_label_text=label,
        )
        total = sum((ln.total_price for ln in company_lines), Decimal("0"))
        split_meta.append(
            {
                "company_id": company_id,
                "company_label": label,
                "invoice_id": inv_id,
                "number": inv_number,
                "total_amount": float(total),
            }
        )

    primary = max(split_meta, key=lambda m: m["total_amount"])
    primary_id = primary["invoice_id"]
    primary_company = primary["company_id"]

    sets: list[str] = []
    params: list = []
    if "invoice_id" in sales_cols:
        sets.append("invoice_id = %s::uuid")
        params.append(primary_id)
    if "company_id" in sales_cols:
        sets.append("company_id = %s::uuid")
        params.append(primary_company)
    if "notes" in sales_cols:
        sets.append("notes = %s")
        params.append(merge_sale_notes_with_split(sale.get("notes"), split_meta))
    params.append(sale["id"])
    cur.execute(
        f"UPDATE public.sales SET {', '.join(sets)} WHERE id = %s::uuid",
        params,
    )

    return split_meta
