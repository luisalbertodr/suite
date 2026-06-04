"""
Reconstruye tickets y facturas Suite desde legacy.faccab + legacy.faclin.

Por defecto solo informa. Con --apply inserta:
  - public.sales: un ticket por cabecera legacy.faccab
  - public.sale_items: líneas desde legacy.faclin
  - public.invoices / invoice_items: factura enlazada al ticket

La empresa emisora se resuelve por importe dominante de las líneas:
  faclin.codart -> articles.billing_company_id -> article_families.billing_company_id
  -> empresa estética por defecto.

No elimina facturas Verifactu enviadas/aceptadas. --reset-existing solo borra
facturas/tickets legacy generados por scripts de importación.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import uuid
from collections import Counter, defaultdict
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    print("pip install psycopg2-binary", file=sys.stderr)
    raise

from legacy_cobro import cli_lookup_keys, paid_in_full, parse_decimal, truthy_legacy
from legacy_company import DEFAULT_COMPANY_ID, get_company_id

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ESTETICA_ID = DEFAULT_COMPANY_ID
DEFAULT_MEDICINA_ID = "816af484-92a0-4f65-a5a7-1c907aa4bb3d"
IVA_RATE = Decimal("0.21")
NOTE_PREFIX = "Legacy FACCAB rebuild · "
OLD_LEGACY_PREFIXES = (
    "Factura legacy automática",
    "Factura legacy sin cita",
)


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


def first_value(row) -> object:
    if isinstance(row, dict):
        return next(iter(row.values()))
    return row[0]


def money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def split_tax_included(total: Decimal) -> tuple[Decimal, Decimal, Decimal]:
    if total == 0:
        return Decimal("0.00"), Decimal("0.00"), Decimal("0.00")
    sign = Decimal("1") if total > 0 else Decimal("-1")
    abs_total = abs(total)
    subtotal = (abs_total / (Decimal("1") + IVA_RATE)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP) * sign
    tax = (total - subtotal).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return subtotal, tax, total


def table_columns(cur, schema: str, table: str) -> set[str]:
    cur.execute(
        """
        SELECT column_name FROM information_schema.columns
        WHERE table_schema=%s AND table_name=%s
        """,
        (schema, table),
    )
    return {r["column_name"] for r in cur.fetchall()}


def insert_row(cur, table: str, row: dict, cols: set[str]) -> None:
    payload = {k: v for k, v in row.items() if k in cols}
    keys = list(payload.keys())
    cur.execute(
        f"INSERT INTO public.{table} ({', '.join(keys)}) VALUES ({', '.join(['%s'] * len(keys))})",
        [payload[k] for k in keys],
    )


def legacy_key(row: dict) -> str:
    ser = str(row.get("serfac") or "").strip() or "BLANK"
    eje = str(row.get("ejefac") or "").strip() or "0"
    num = str(row.get("numfac") or "").strip() or "0"
    return f"{ser}|{eje}|{num}"


def legacy_number(row: dict) -> str:
    ser = str(row.get("serfac") or "").strip() or "BLANK"
    eje = str(row.get("ejefac") or "").strip() or "0"
    num = str(row.get("numfac") or "").strip() or "0"
    return f"LEG-{ser}-{eje}-{num}"[:64]


def legacy_date(row: dict) -> str | None:
    raw = str(row.get("fecfac") or "").strip()
    if len(raw) >= 10 and raw[4] == "-":
        return raw[:10]
    if len(raw) == 8 and raw.isdigit():
        return f"{raw[:4]}-{raw[4:6]}-{raw[6:8]}"
    return None


def load_customers(cur, company_id: str) -> dict[str, dict]:
    cur.execute(
        """
        SELECT id::text, name, legacy_codcli
        FROM public.customers
        WHERE company_id=%s::uuid
          AND NULLIF(btrim(legacy_codcli::text), '') IS NOT NULL
        """,
        (company_id,),
    )
    out: dict[str, dict] = {}
    for row in cur.fetchall():
        code = str(row["legacy_codcli"]).strip()
        payload = {"id": row["id"], "name": row["name"]}
        for key in cli_lookup_keys(code):
            out[key] = payload
    return out


def create_placeholder_customer(cur, company_id: str, codcli: str) -> dict:
    clean = str(codcli or "").strip()
    customer_id = str(uuid.uuid4())
    name = f"Cliente legacy {clean or customer_id[:8]}"
    email = f"legacy-{clean or customer_id[:8]}@legacy.local"
    cur.execute(
        """
        INSERT INTO public.customers (id, company_id, legacy_codcli, name, email, notes)
        VALUES (%s::uuid, %s::uuid, %s, %s, %s, %s)
        """,
        (
            customer_id,
            company_id,
            clean or None,
            name,
            email,
            "Cliente placeholder creado para reconstrucción de facturación legacy.",
        ),
    )
    return {"id": customer_id, "name": name}


def load_article_map(cur, catalog_company_id: str, default_billing_id: str) -> dict[str, dict]:
    cur.execute(
        """
        SELECT
          a.id::text,
          a.codigo,
          a.legacy_codart,
          a.descripcion,
          COALESCE(a.billing_company_id, af.billing_company_id, %s::uuid)::text AS billing_company_id
        FROM public.articles a
        LEFT JOIN public.article_families af
          ON af.company_id = a.company_id AND af.name = a.familia
        WHERE a.company_id=%s::uuid
        """,
        (default_billing_id, catalog_company_id),
    )
    out: dict[str, dict] = {}
    for row in cur.fetchall():
        payload = {
            "id": row["id"],
            "description": row["descripcion"],
            "billing_company_id": row["billing_company_id"] or default_billing_id,
        }
        for raw in (row.get("codigo"), row.get("legacy_codart")):
            key = str(raw or "").strip().upper()
            if key:
                out[key] = payload
    return out


def fetch_faccab_rows(cur, limit: int = 0) -> list[dict]:
    limit_sql = f"LIMIT {int(limit)}" if limit > 0 else ""
    cur.execute(
        f"""
        SELECT serfac, ejefac, numfac, fecfac, hora, codcli, totfac, impcob1, impcob2, anulada
        FROM legacy.faccab
        WHERE NULLIF(btrim(numfac::text), '') IS NOT NULL
          AND btrim(coalesce(serfac::text, '')) = 'A'
        ORDER BY fecfac, serfac, ejefac, numfac
        {limit_sql}
        """
    )
    return [dict(r) for r in cur.fetchall()]


def fetch_faclin_rows(cur) -> dict[str, list[dict]]:
    cur.execute(
        """
        SELECT serfac, ejefac, numfac, linfac, codart, desart, cant, preven, subtot, taniva
        FROM legacy.faclin
        ORDER BY serfac, ejefac, numfac, NULLIF(linfac, '')::int NULLS LAST
        """
    )
    out: dict[str, list[dict]] = defaultdict(list)
    for row in cur.fetchall():
        key = f"{str(row['serfac'] or '').strip() or 'BLANK'}|{str(row['ejefac'] or '').strip() or '0'}|{str(row['numfac'] or '').strip() or '0'}"
        out[key].append(dict(row))
    return out


def build_lines(row: dict, raw_lines: list[dict], article_map: dict[str, dict], default_billing_id: str) -> list[dict]:
    lines: list[dict] = []
    for raw in raw_lines:
        codart = str(raw.get("codart") or "").strip()
        article = article_map.get(codart.upper()) if codart else None
        total = money(parse_decimal(raw.get("subtot")))
        qty = parse_decimal(raw.get("cant")) or Decimal("1")
        unit = parse_decimal(raw.get("preven")) or total
        description = " - ".join(part for part in (codart, str(raw.get("desart") or "").strip()) if part).strip()
        if not description:
            description = f"Factura legacy {legacy_number(row)}"
        lines.append(
            {
                "article_id": article["id"] if article else None,
                "billing_company_id": article["billing_company_id"] if article else default_billing_id,
                "description": description[:500],
                "quantity": money(qty),
                "unit_price": money(unit),
                "total_price": total,
            }
        )
    if lines:
        return lines
    total = money(parse_decimal(row.get("totfac")))
    return [
        {
            "article_id": None,
            "billing_company_id": default_billing_id,
            "description": f"Factura legacy {legacy_number(row)}",
            "quantity": Decimal("1.00"),
            "unit_price": total,
            "total_price": total,
        }
    ]


def scale_lines_to_total(lines: list[dict], target_total: Decimal) -> list[dict]:
    current = sum((money(l["total_price"]) for l in lines), Decimal("0.00"))
    if current == target_total or current == 0:
        return lines
    ratio = target_total / current
    assigned = Decimal("0.00")
    out: list[dict] = []
    for idx, line in enumerate(lines):
        next_line = dict(line)
        if idx == len(lines) - 1:
            total = (target_total - assigned).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        else:
            total = (money(line["total_price"]) * ratio).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            assigned += total
        qty = money(next_line.get("quantity") or 1)
        next_line["total_price"] = total
        next_line["unit_price"] = (total / qty).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP) if qty else total
        out.append(next_line)
    return out


def target_company_for_lines(lines: list[dict], fallback: str) -> str:
    amounts: defaultdict[str, Decimal] = defaultdict(lambda: Decimal("0.00"))
    for line in lines:
        amounts[str(line.get("billing_company_id") or fallback)] += abs(money(line.get("total_price")))
    if not amounts:
        return fallback
    return max(amounts.items(), key=lambda item: item[1])[0]


def legacy_invoice_filter_sql() -> str:
    likes = " OR ".join(["i.notes LIKE %s"] * (len(OLD_LEGACY_PREFIXES) + 1))
    return f"({likes})"


def reset_existing(cur, company_ids: list[str], dry_run: bool) -> dict[str, int]:
    like_params = [f"{NOTE_PREFIX}%", *[f"{p}%" for p in OLD_LEGACY_PREFIXES]]
    params = [company_ids, *like_params]
    filt = legacy_invoice_filter_sql()
    stats: dict[str, int] = {}
    cur.execute(
        f"""
        SELECT count(*)
        FROM public.invoices i
        WHERE i.company_id = ANY(%s::uuid[])
          AND {filt}
          AND i.verifactu_status IN ('sent', 'accepted')
        """,
        params,
    )
    protected = int(first_value(cur.fetchone()))
    if protected:
        raise SystemExit(f"Hay {protected} facturas legacy con Verifactu enviado/aceptado; no se borran.")

    cur.execute(
        f"SELECT count(*) FROM public.invoices i WHERE i.company_id = ANY(%s::uuid[]) AND {filt}",
        params,
    )
    stats["invoices"] = int(first_value(cur.fetchone()))
    cur.execute(
        """
        SELECT count(*) FROM public.sales
        WHERE company_id = ANY(%s::uuid[])
          AND (ticket_number LIKE 'LEG-%%' OR notes LIKE %s)
        """,
        (company_ids, f"{NOTE_PREFIX}%"),
    )
    stats["sales"] = int(first_value(cur.fetchone()))
    if dry_run:
        return stats

    cur.execute(
        f"""
        DELETE FROM public.invoice_items
        WHERE invoice_id IN (
          SELECT i.id FROM public.invoices i
          WHERE i.company_id = ANY(%s::uuid[]) AND {filt}
        )
        """,
        params,
    )
    cur.execute(
        f"DELETE FROM public.invoices i WHERE i.company_id = ANY(%s::uuid[]) AND {filt}",
        params,
    )
    cur.execute(
        """
        DELETE FROM public.sale_items
        WHERE sale_id IN (
          SELECT id FROM public.sales
          WHERE company_id = ANY(%s::uuid[])
            AND (ticket_number LIKE 'LEG-%%' OR notes LIKE %s)
        )
        """,
        (company_ids, f"{NOTE_PREFIX}%"),
    )
    cur.execute(
        """
        DELETE FROM public.sales
        WHERE company_id = ANY(%s::uuid[])
          AND (ticket_number LIKE 'LEG-%%' OR notes LIKE %s)
        """,
        (company_ids, f"{NOTE_PREFIX}%"),
    )
    return stats


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser()
    ap.add_argument("--catalog-company-id", default=get_company_id())
    ap.add_argument("--estetica-company-id", default=os.environ.get("ESTETICA_BILLING_COMPANY_ID", DEFAULT_ESTETICA_ID).strip())
    ap.add_argument("--medicina-company-id", default=os.environ.get("MEDICINA_BILLING_COMPANY_ID", DEFAULT_MEDICINA_ID).strip())
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--reset-existing", action="store_true")
    ap.add_argument("--create-placeholder-customers", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--commit-every", type=int, default=1000)
    args = ap.parse_args()

    if args.apply and args.dry_run:
        raise SystemExit("Usa --apply o --dry-run, no ambos.")
    dry_run = not args.apply
    dsn = os.environ.get("SUPABASE_DB_URL", "").strip()
    if not dsn:
        raise SystemExit("Falta SUPABASE_DB_URL")

    conn = psycopg2.connect(dsn, cursor_factory=RealDictCursor)
    conn.autocommit = False
    cur = conn.cursor()
    inv_cols = table_columns(cur, "public", "invoices")
    inv_item_cols = table_columns(cur, "public", "invoice_items")
    sales_cols = table_columns(cur, "public", "sales")
    sale_item_cols = table_columns(cur, "public", "sale_items")

    company_ids = [args.estetica_company_id, args.medicina_company_id]
    if args.reset_existing:
        stats = reset_existing(cur, company_ids, dry_run=dry_run)
        print(f"{'[dry-run] ' if dry_run else ''}Reset legacy: {stats}")
        if dry_run:
            conn.rollback()

    customers = load_customers(cur, args.catalog_company_id)
    article_map = load_article_map(cur, args.catalog_company_id, args.estetica_company_id)
    faccab_rows = fetch_faccab_rows(cur, args.limit)
    faclin_by_key = fetch_faclin_rows(cur)

    counters = Counter()
    amount_by_company: defaultdict[str, Decimal] = defaultdict(lambda: Decimal("0.00"))
    sample_no_customer: list[str] = []

    try:
        for row in faccab_rows:
            counters["headers"] += 1
            if truthy_legacy(row.get("anulada")):
                counters["skip_cancelled"] += 1
                continue
            d = legacy_date(row)
            if not d:
                counters["skip_no_date"] += 1
                continue
            total = money(parse_decimal(row.get("totfac")))
            if total == 0:
                counters["skip_zero"] += 1
                continue
            codcli = str(row.get("codcli") or "").strip()
            customer = None
            for key in cli_lookup_keys(codcli):
                customer = customers.get(key)
                if customer:
                    break
            if not customer:
                if args.create_placeholder_customers:
                    counters["placeholder_customers"] += 1
                    if dry_run:
                        customer = {"id": "00000000-0000-0000-0000-000000000000", "name": f"Cliente legacy {codcli}"}
                    else:
                        customer = create_placeholder_customer(cur, args.catalog_company_id, codcli)
                    for key in cli_lookup_keys(codcli):
                        customers[key] = customer
                else:
                    counters["skip_no_customer"] += 1
                    if len(sample_no_customer) < 10:
                        sample_no_customer.append(f"{row.get('codcli')} {legacy_number(row)}")
                    continue

            key = legacy_key(row)
            number = legacy_number(row)
            raw_lines = faclin_by_key.get(key, [])
            lines = scale_lines_to_total(build_lines(row, raw_lines, article_map, args.estetica_company_id), total)
            target_company_id = target_company_for_lines(lines, args.estetica_company_id)
            amount_by_company[target_company_id] += total
            counters[f"target_{target_company_id}"] += 1
            counters["line_count"] += len(lines)
            counters["mapped_lines"] += sum(1 for line in lines if line.get("article_id"))

            if dry_run:
                counters["would_create"] += 1
                continue

            sale_id = str(uuid.uuid4())
            invoice_id = str(uuid.uuid4())
            created_at = datetime.fromisoformat(f"{d}T12:00:00")
            cobrado = parse_decimal(row.get("impcob1")) + parse_decimal(row.get("impcob2"))
            is_paid = paid_in_full(cobrado, abs(total))
            subtotal, tax_amount, total_amount = split_tax_included(total)
            notes = f"{NOTE_PREFIX}{json.dumps({'key': key, 'number': number, 'codcli': row.get('codcli')}, ensure_ascii=False)}"

            invoice_row = {
                "id": invoice_id,
                "company_id": target_company_id,
                "customer_id": customer["id"],
                "number": number,
                "issue_date": d,
                "due_date": d,
                "subtotal": float(subtotal),
                "tax_amount": float(tax_amount),
                "total_amount": float(total_amount),
                "re_total": 0,
                "status": "paid" if is_paid else "sent",
                "paid_status": is_paid,
                "paid_date": d if is_paid else None,
                "currency": "EUR",
                "created_at": created_at,
                "notes": notes,
                "verifactu_status": "pending",
            }
            insert_row(cur, "invoices", invoice_row, inv_cols)

            sale_row = {
                "id": sale_id,
                "company_id": target_company_id,
                "ticket_number": number,
                "total_amount": float(total_amount),
                "subtotal": float(subtotal),
                "tax_amount": float(tax_amount),
                "payment_method": "card",
                "amount_paid": float(cobrado if cobrado else total_amount),
                "change_amount": 0,
                "status": "completed",
                "currency": "EUR",
                "customer_id": customer["id"],
                "customer_name": customer.get("name"),
                "invoice_id": invoice_id,
                "created_at": created_at,
                "notes": notes,
            }
            insert_row(cur, "sales", sale_row, sales_cols)

            for idx, line in enumerate(lines):
                line_total = money(line["total_price"])
                line_subtotal, line_tax, _ = split_tax_included(line_total)
                sale_item = {
                    "sale_id": sale_id,
                    "description": line["description"],
                    "quantity": float(line["quantity"]),
                    "unit_price": float(line["unit_price"]),
                    "total_price": float(line_total),
                    "article_id": line.get("article_id"),
                }
                insert_row(cur, "sale_items", sale_item, sale_item_cols)
                invoice_item = {
                    "invoice_id": invoice_id,
                    "description": line["description"],
                    "quantity": float(line["quantity"]),
                    "unit_price": float((money(line["unit_price"]) / (Decimal("1") + IVA_RATE)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
                    "discount_percentage": 0,
                    "iva_percentage": 21,
                    "re_percentage": 0,
                    "subtotal_after_discount": float(line_subtotal),
                    "iva_amount": float(line_tax),
                    "re_amount": 0,
                    "total_price": float(line_total),
                    "sort_order": idx,
                    "article_id": line.get("article_id"),
                }
                insert_row(cur, "invoice_items", invoice_item, inv_item_cols)

            counters["created"] += 1
            if counters["created"] % args.commit_every == 0:
                conn.commit()
                print(f"... creadas {counters['created']} facturas", file=sys.stderr)

        if dry_run:
            conn.rollback()
        else:
            conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    print("=== rebuild_legacy_faccab_invoices ===")
    print("Modo:", "APPLY" if args.apply else "DRY-RUN")
    for k in sorted(counters):
        print(f"{k}: {counters[k]}")
    print("Importe por empresa:")
    for company_id, amount in sorted(amount_by_company.items()):
        print(f"  {company_id}: {amount}")
    if sample_no_customer:
        print("Ejemplos sin cliente:", "; ".join(sample_no_customer))


if __name__ == "__main__":
    main()
