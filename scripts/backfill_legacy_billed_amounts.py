"""
Recalcula importes facturados (totfac) en notas de venta legacy y facturas vinculadas.

Usa el mismo reparto proporcional por cliente/día que promote_legacy_agenda_sales.

Uso:
  python scripts/backfill_legacy_billed_amounts.py --dry-run
  python scripts/backfill_legacy_billed_amounts.py
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from collections import defaultdict
from decimal import ROUND_HALF_UP, Decimal
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
    parse_decimal,
    truthy_legacy,
)

ROOT = Path(__file__).resolve().parents[1]
IVA_RATE = Decimal("0.21")


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


def split_tax_included(total: Decimal) -> tuple[Decimal, Decimal, Decimal]:
    if total <= 0:
        return Decimal("0"), Decimal("0"), Decimal("0")
    subtotal = (total / (Decimal("1") + IVA_RATE)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    tax = (total - subtotal).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return subtotal, tax, total


def sale_item_weight(notes: str | None) -> Decimal:
    if not notes:
        return Decimal("0")
    try:
        payload = json.loads(notes)
        items = payload.get("items") or []
        return sum(Decimal(str(it.get("total") or 0)) for it in items)
    except Exception:
        return Decimal("0")


def allocate_shared(
    groups: dict[tuple[str, str], list[str]],
    pool: dict[tuple[str, str], dict],
    sale_rows: dict[str, dict],
    *,
    amount_field: str,
) -> dict[str, Decimal]:
    out: dict[str, Decimal] = {}
    for slot, sale_ids in groups.items():
        slot_data = pool.get(slot)
        if not slot_data:
            continue
        total = Decimal(str(slot_data.get(amount_field) or 0))
        if total <= 0 or not sale_ids:
            continue
        weights = [max(sale_item_weight(sale_rows[sid].get("notes")), Decimal("0")) for sid in sale_ids]
        weight_sum = sum(weights)
        if weight_sum <= 0:
            weights = [Decimal("1")] * len(sale_ids)
            weight_sum = Decimal(len(sale_ids))
        assigned = Decimal("0")
        for idx, sale_id in enumerate(sale_ids):
            if idx == len(sale_ids) - 1:
                share = (total - assigned).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            else:
                share = (total * weights[idx] / weight_sum).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                assigned += share
            if share > 0:
                out[sale_id] = share
    return out


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

    albcab_by_cli_date: dict[tuple[str, str], dict] = {}
    cur.execute("SELECT to_regclass('legacy.albcab') AS t")
    if cur.fetchone()["t"]:
        cur.execute(
            """
            SELECT codcli, fecha, total, impcob, anulada
            FROM legacy.albcab
            WHERE NULLIF(btrim(codcli), '') IS NOT NULL
            """
        )
        for row in cur.fetchall():
            d = norm_date(row.get("fecha"))
            if not d or truthy_legacy(row.get("anulada")):
                continue
            total = parse_decimal(row.get("total"))
            impcob = parse_decimal(row.get("impcob"))
            amount = impcob if impcob > 0 else total
            if amount <= 0:
                continue
            key = (norm_cli_key(str(row.get("codcli"))), d)
            albcab_by_cli_date[key] = {
                "amount": amount,
                "totfac": total if total > 0 else amount,
            }

    faccab_by_cli_date: dict[tuple[str, str], dict] = {}
    cur.execute("SELECT to_regclass('legacy.faccab') AS t")
    if cur.fetchone()["t"]:
        cur.execute(
            """
            SELECT codcli, fecfac, totfac, impcob1, impcob2, serfac
            FROM legacy.faccab
            WHERE NULLIF(btrim(codcli::text), '') IS NOT NULL
            """
        )
        for row in cur.fetchall():
            if not is_faccab_serie_a(row):
                continue
            d = norm_date(row.get("fecfac"))
            if not d:
                continue
            cod = str(row.get("codcli") or "").strip()
            cobrado = faccab_impcob(row)
            facturado = parse_decimal(row.get("totfac"))
            for key in cli_lookup_keys(cod):
                slot = faccab_by_cli_date.setdefault(
                    (key, d),
                    {"impcob": Decimal("0"), "totfac": Decimal("0")},
                )
                slot["impcob"] += cobrado
                slot["totfac"] += facturado

    cur.execute(
        """
        SELECT s.id, s.invoice_id, s.total_amount, s.notes,
               COALESCE(c.legacy_codcli, a.legacy_codcli) AS legacy_codcli,
               COALESCE(a.appointment_date, s.created_at::date) AS apt_date
        FROM public.sales s
        JOIN public.agenda_appointments a ON a.id = s.appointment_id
        LEFT JOIN public.customers c ON c.id = s.customer_id
        WHERE s.company_id = %s AND s.appointment_id IS NOT NULL
        """,
        (args.company_id,),
    )
    sales = cur.fetchall()

    albcab_groups: dict[tuple[str, str], list[str]] = defaultdict(list)
    faccab_groups: dict[tuple[str, str], list[str]] = defaultdict(list)
    sale_rows: dict[str, dict] = {}

    for row in sales:
        sale_id = str(row["id"])
        sale_rows[sale_id] = row
        apt_date = row["apt_date"]
        if hasattr(apt_date, "isoformat"):
            apt_date = apt_date.isoformat()[:10]
        else:
            apt_date = str(apt_date)[:10]
        cli_keys = cli_lookup_keys(str(row.get("legacy_codcli") or ""))
        for key in cli_keys:
            slot_a = (key, apt_date)
            if slot_a in albcab_by_cli_date and albcab_by_cli_date[slot_a].get("amount", 0) > 0:
                albcab_groups[slot_a].append(sale_id)
                break
            slot_f = (key, apt_date)
            if slot_f in faccab_by_cli_date and faccab_by_cli_date[slot_f].get("impcob", 0) > 0:
                faccab_groups[slot_f].append(sale_id)
                break

    albcab_billed = allocate_shared(albcab_groups, albcab_by_cli_date, sale_rows, amount_field="totfac")
    faccab_billed = allocate_shared(faccab_groups, faccab_by_cli_date, sale_rows, amount_field="totfac")

    updated_sales = 0
    updated_invoices = 0

    for sale_id, row in sale_rows.items():
        cobrado = Decimal(str(row["total_amount"] or 0))
        if sale_id in albcab_billed:
            facturado = albcab_billed[sale_id]
        elif sale_id in faccab_billed:
            facturado = faccab_billed[sale_id]
        else:
            facturado = cobrado

        if facturado <= 0:
            continue

        notes = row.get("notes")
        new_notes = notes
        if notes:
            try:
                payload = json.loads(notes)
                rev = payload.get("legacy_revenue") or {}
                if float(rev.get("facturado") or 0) != float(facturado):
                    rev["facturado"] = float(facturado)
                    rev["cobrado"] = float(rev.get("cobrado") or cobrado)
                    payload["legacy_revenue"] = rev
                    new_notes = json.dumps(payload, ensure_ascii=False)
            except Exception:
                pass

        subtotal, tax, total = split_tax_included(facturado)
        inv_id = row.get("invoice_id")

        if args.dry_run:
            if new_notes != notes or inv_id:
                updated_sales += 1
            continue

        if new_notes != notes:
            cur.execute("UPDATE public.sales SET notes = %s WHERE id = %s", (new_notes, sale_id))
            updated_sales += 1

        if inv_id:
            cur.execute(
                """
                UPDATE public.invoices
                SET subtotal = %s, tax_amount = %s, total_amount = %s
                WHERE id = %s AND company_id = %s
                """,
                (float(subtotal), float(tax), float(total), inv_id, args.company_id),
            )
            if cur.rowcount:
                updated_invoices += 1

        if (updated_sales + updated_invoices) % 500 == 0:
            conn.commit()

    if args.dry_run:
        conn.rollback()
        print(f"[dry-run] ventas a actualizar: {updated_sales}")
    else:
        conn.commit()
        print(f"Notas de venta actualizadas: {updated_sales}")
        print(f"Facturas actualizadas: {updated_invoices}")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
