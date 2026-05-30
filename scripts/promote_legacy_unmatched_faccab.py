"""
Crea facturas (public.invoices) para faccab serie A sin ticket/cita emparejada.

Dunasoft factura cobros sin cita en agenda; el dashboard Suite debe reflejar totfac
aunque no exista sale con appointment_id en ese cliente+día.

Idempotente: notes = 'Factura legacy sin cita · key {codcli}|{fecfac}|{numfac}'.

Requisitos: SUPABASE_DB_URL, empresa en legacy_company / PROMOTE_COMPANY_ID

Uso:
  python scripts/promote_legacy_unmatched_faccab.py --dry-run
  python scripts/promote_legacy_unmatched_faccab.py
"""
from __future__ import annotations

import argparse
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
from legacy_cobro import (
    cli_lookup_keys,
    faccab_impcob,
    is_faccab_serie_a,
    norm_cli_key,
    norm_date,
    paid_in_full,
    parse_decimal,
)

ROOT = Path(__file__).resolve().parents[1]
IVA_RATE = Decimal("0.21")
NOTE_PREFIX = "Factura legacy sin cita · key "


def faccab_key(row: dict) -> str:
    cod = str(row.get("codcli") or "").strip()
    d = norm_date(row.get("fecfac")) or ""
    numfac = str(row.get("numfac") or "").strip()
    return f"{cod}|{d}|{numfac}"


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
    if total == 0:
        return Decimal("0"), Decimal("0"), Decimal("0")
    sign = Decimal("1") if total > 0 else Decimal("-1")
    abs_total = abs(total)
    subtotal = (abs_total / (Decimal("1") + IVA_RATE)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP) * sign
    tax = (total - subtotal).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return subtotal, tax, total


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


def note_marker(key: str) -> str:
    return f"{NOTE_PREFIX}{key}"


def build_matched_slots(cur, company_id: str) -> set[tuple[str, str]]:
    """Cliente+día con al menos un ticket legacy ligado a cita."""
    cur.execute(
        """
        SELECT
          COALESCE(NULLIF(btrim(c.legacy_codcli::text), ''), NULLIF(btrim(a.legacy_codcli::text), '')) AS codcli,
          COALESCE(a.appointment_date, s.created_at::date) AS d
        FROM public.sales s
        JOIN public.agenda_appointments a ON a.id = s.appointment_id
        LEFT JOIN public.customers c ON c.id = s.customer_id
        WHERE s.company_id = %s
          AND s.appointment_id IS NOT NULL
        """,
        (company_id,),
    )
    matched: set[tuple[str, str]] = set()
    for row in cur.fetchall():
        cod = str(row.get("codcli") or "").strip()
        d = str(row.get("d") or "")[:10]
        if not cod or not d:
            continue
        for key in cli_lookup_keys(cod):
            matched.add((key, d))
    return matched


def load_existing_keys(cur, company_id: str) -> set[str]:
    cur.execute(
        """
        SELECT notes FROM public.invoices
        WHERE company_id = %s AND notes LIKE %s
        """,
        (company_id, f"{NOTE_PREFIX}%"),
    )
    out: set[str] = set()
    for row in cur.fetchall():
        notes = str(row.get("notes") or "")
        if notes.startswith(NOTE_PREFIX):
            out.add(notes[len(NOTE_PREFIX) :].strip())
    return out


def load_customers(cur, company_id: str) -> tuple[dict[str, dict], dict[str, str]]:
    cur.execute(
        """
        SELECT id, name, legacy_codcli
        FROM public.customers
        WHERE company_id = %s AND NULLIF(btrim(legacy_codcli::text), '') IS NOT NULL
        """,
        (company_id,),
    )
    by_key: dict[str, dict] = {}
    id_by_key: dict[str, str] = {}
    for row in cur.fetchall():
        code = str(row["legacy_codcli"]).strip()
        payload = {"id": str(row["id"]), "name": row.get("name")}
        for key in cli_lookup_keys(code):
            by_key[key] = payload
            id_by_key[key] = str(row["id"])
    return by_key, id_by_key


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser()
    ap.add_argument("--company-id", default=get_company_id())
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    dsn = os.environ.get("SUPABASE_DB_URL", "").strip()
    if not dsn:
        sys.exit("Falta SUPABASE_DB_URL")

    company_id = args.company_id
    conn = psycopg2.connect(dsn)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("SELECT to_regclass('legacy.faccab') AS t")
    if not cur.fetchone()["t"]:
        sys.exit("No existe legacy.faccab")

    inv_cols = table_columns(cur, "public", "invoices")
    item_cols = table_columns(cur, "public", "invoice_items")
    matched_slots = build_matched_slots(cur, company_id)
    existing_keys = load_existing_keys(cur, company_id)
    customers_by_key, _ = load_customers(cur, company_id)
    number_seq = InvoiceNumberSeq(cur, company_id)

    cur.execute(
        """
        SELECT codcli, fecfac, numfac, totfac, impcob1, impcob2, serfac
        FROM legacy.faccab
        WHERE NULLIF(btrim(codcli::text), '') IS NOT NULL
        ORDER BY fecfac, numfac
        """
    )
    faccab_rows = [r for r in cur.fetchall() if is_faccab_serie_a(r)]

    created = 0
    skipped_matched = 0
    skipped_exists = 0
    skipped_zero = 0
    skipped_no_customer = 0
    errors = 0

    for row in faccab_rows:
        d = norm_date(row.get("fecfac"))
        if not d:
            continue
        cod = str(row.get("codcli") or "").strip()
        legacy_key = faccab_key(row)
        numfac = str(row.get("numfac") or "").strip()
        if not numfac:
            continue

        slot_keys = [(key, d) for key in cli_lookup_keys(cod)]
        if any(k in matched_slots for k in slot_keys):
            skipped_matched += 1
            continue

        if legacy_key in existing_keys:
            skipped_exists += 1
            continue

        facturado = money(parse_decimal(row.get("totfac")))
        if facturado == 0:
            skipped_zero += 1
            continue

        customer = None
        for key in cli_lookup_keys(cod):
            customer = customers_by_key.get(key)
            if customer:
                break
        if not customer:
            skipped_no_customer += 1
            if skipped_no_customer <= 5:
                print(f"Sin cliente Suite codcli={cod} numfac={numfac}", file=sys.stderr)
            continue

        cobrado = faccab_impcob(row)
        is_paid = paid_in_full(cobrado, abs(facturado))
        subtotal, tax_amount, total_amount = split_tax_included(facturado)
        inv_number = number_seq.next()
        marker = note_marker(legacy_key)

        if args.dry_run:
            print(
                f"[dry-run] {inv_number} numfac={numfac} {d} "
                f"client={customer.get('name')} total={total_amount} paid={is_paid}"
            )
            created += 1
            continue

        try:
            invoice_id = str(uuid.uuid4())
            inv_row = {
                "id": invoice_id,
                "company_id": company_id,
                "customer_id": customer["id"],
                "number": inv_number,
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
                "created_at": datetime.fromisoformat(f"{d}T12:00:00"),
                "notes": marker,
            }
            insert_row(cur, "invoices", inv_row, inv_cols)

            item_row = {
                "invoice_id": invoice_id,
                "description": f"Facturación legacy Dunasoft · {numfac}"[:500],
                "quantity": 1.0,
                "unit_price": float(total_amount),
                "discount_percentage": 0,
                "iva_percentage": 21,
                "re_percentage": 0,
                "subtotal_after_discount": float(subtotal),
                "iva_amount": float(tax_amount),
                "re_amount": 0,
                "total_price": float(total_amount),
                "sort_order": 0,
                "article_id": None,
            }
            insert_row(cur, "invoice_items", item_row, item_cols)

            existing_keys.add(legacy_key)
            created += 1
            if created % 50 == 0:
                conn.commit()
                print(f"... {created} facturas sin cita", file=sys.stderr)
        except psycopg2.errors.UniqueViolation as exc:
            conn.rollback()
            if "invoices_number_company_unique" in str(exc):
                number_seq.sync(cur)
            errors += 1
            if errors <= 10:
                print(f"Error numfac={numfac}: {exc}", file=sys.stderr)
        except Exception as exc:
            conn.rollback()
            errors += 1
            if errors <= 10:
                print(f"Error numfac={numfac}: {exc}", file=sys.stderr)

    if args.dry_run:
        conn.rollback()
    else:
        conn.commit()

    cur.close()
    conn.close()

    print(f"Facturas sin cita creadas: {created}")
    print(f"Omitidas (slot con ticket): {skipped_matched}")
    print(f"Omitidas (ya importadas): {skipped_exists}")
    print(f"Omitidas (totfac=0): {skipped_zero}")
    print(f"Omitidas (sin cliente): {skipped_no_customer}")
    if errors:
        print(f"Errores: {errors}")


if __name__ == "__main__":
    main()
