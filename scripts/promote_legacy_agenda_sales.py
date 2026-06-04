"""
Crea tickets TPV (public.sales) para citas legacy con cobro verificado en Dunasoft.

Criterios de cobro (importe = lo efectivamente cobrado):
  - legacy.albcab: impcob (o total si no hay impcob), no anulado
  - legacy.faccab serie A: impcob1 + impcob2 (no totfac)
  - legacy.agenda.facturado solo cuenta si hay además cobro en faccab/albcab

No crea ticket si hay factura serie A pero impcob = 0 (pendiente de cobro).
Opcional: --include-fallback para citas pasadas con precio en ítems sin señal legacy.

Idempotente: no inserta si ya existe sale con appointment_id.
Antes de reimportar ventas: python scripts/reset_legacy_public_data.py --scope sales

Requisitos: SUPABASE_DB_URL, empresa en legacy_company / PROMOTE_COMPANY_ID

Uso:
  python scripts/promote_legacy_agenda_sales.py --dry-run
  python scripts/promote_legacy_agenda_sales.py
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import date, datetime
from collections import defaultdict
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    print("pip install psycopg2-binary", file=sys.stderr)
    raise

from legacy_billing_common import (
    default_auto_invoice_through,
    default_no_auto_from,
    load_dotenv as load_billing_dotenv,
)
from legacy_company import MEDICINA_COMPANY_ID, get_company_id
from legacy_cobro import (
    cli_lookup_keys,
    faccab_impcob,
    is_faccab_serie_a,
    norm_cli_key,
    norm_date,
    paid_in_full,
    parse_decimal,
    truthy_legacy,
)

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


def resolve_apt_date(apt: dict, has_appointment_date: bool) -> str | None:
    if has_appointment_date and apt.get("appointment_date"):
        ad = apt["appointment_date"]
        if isinstance(ad, date):
            return ad.isoformat()
        if isinstance(ad, datetime):
            return ad.date().isoformat()
        return norm_date(str(ad))

    start = apt.get("start_time")
    if isinstance(start, datetime):
        return start.date().isoformat()
    s = str(start or "")
    if len(s) >= 10 and s[4] == "-":
        return s[:10]
    return None


def resolve_created_at(apt: dict, apt_date: str | None):
    start = apt.get("start_time")
    if isinstance(start, datetime):
        return start

    hhmm = "12:00"
    s = str(start or "").strip()
    if s and ":" in s and len(s) <= 8:
        hhmm = s[:5] if len(s) >= 5 else s

    if apt_date:
        try:
            return datetime.fromisoformat(f"{apt_date}T{hhmm}:00")
        except ValueError:
            pass
    return datetime.now()


def table_columns(cur, schema: str, table: str) -> set[str]:
    cur.execute(
        """
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = %s AND table_name = %s
        """,
        (schema, table),
    )
    return {r["column_name"] for r in cur.fetchall()}


def parse_pricing_notes(notes: str | None) -> tuple[Decimal, Decimal]:
    if not notes or not str(notes).startswith("__pricing__"):
        return Decimal("1"), Decimal("0")
    try:
        parsed = json.loads(str(notes)[len("__pricing__") :])
        qty = Decimal(str(parsed.get("quantity", 1)))
        unit = Decimal(str(parsed.get("unit_price", 0)))
        return max(Decimal("0"), qty), max(Decimal("0"), unit)
    except Exception:
        return Decimal("1"), Decimal("0")


def item_line_total(kind: str | None, qty: Decimal, unit: Decimal, notes: str | None) -> Decimal:
    line = qty * unit
    if kind == "bonus":
        if notes and "__pricing__" in notes:
            try:
                parsed = json.loads(notes.split("__pricing__", 1)[1])
                mode = str(parsed.get("bonus_payment_mode") or "none")
                if mode == "60":
                    return unit * Decimal("0.6")
                if mode == "40":
                    return unit * Decimal("0.4")
                if mode == "full":
                    return unit
                return Decimal("0")
            except Exception:
                return Decimal("0")
        return Decimal("0")
    return line


def build_sale_notes(
    appointment_id: str,
    customer_id: str | None,
    customer_name: str | None,
    appointment_date: str | None,
    status: str | None,
    legacy_idplan: str | None,
    items: list[dict],
    revenue: dict | None = None,
) -> str:
    payload = {
        "source": "agenda_appointment",
        "legacy_import": True,
        "appointment_id": appointment_id,
        "customer_id": customer_id,
        "customer_name": customer_name,
        "appointment_date": appointment_date,
        "appointment_status": status,
        "legacy_idplan": legacy_idplan,
        "legacy_revenue": revenue,
        "items": [
            {
                "name": it.get("label") or "Servicio",
                "total": float(it.get("line_total") or 0),
                "source_kind": it.get("kind"),
            }
            for it in items
        ],
    }
    return json.dumps(payload, ensure_ascii=False)


def resolve_pool_slot(
    cli_keys: list[str],
    apt_date: str,
    pool: dict[tuple[str, str], dict],
) -> tuple[str, str] | None:
    for key in cli_keys:
        slot = (key, apt_date)
        if slot in pool:
            return slot
    return None


def allocate_shared_cobro(
    groups: dict[tuple[str, str], list[dict]],
    pool: dict[tuple[str, str], dict],
    *,
    amount_field: str,
) -> dict[str, tuple[Decimal, dict, tuple[str, str]]]:
    """Reparte un único cobro legacy entre varias citas del mismo cliente/día."""
    allocation: dict[str, tuple[Decimal, dict, tuple[str, str]]] = {}
    for slot, members in groups.items():
        slot_data = pool.get(slot)
        if not slot_data:
            continue
        total_cobrado = Decimal(str(slot_data.get(amount_field) or 0))
        if total_cobrado <= 0 or not members:
            continue

        weights = [max(Decimal(str(m.get("items_total") or 0)), Decimal("0")) for m in members]
        weight_sum = sum(weights)
        if weight_sum <= 0:
            weights = [Decimal("1")] * len(members)
            weight_sum = Decimal(len(members))

        assigned = Decimal("0")
        for idx, member in enumerate(members):
            apt_id = str(member["apt_id"])
            if idx == len(members) - 1:
                share = (total_cobrado - assigned).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            else:
                share = (total_cobrado * weights[idx] / weight_sum).quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_UP
                )
                assigned += share
            if share > 0:
                allocation[apt_id] = (share, slot_data, slot)
    return allocation


def main() -> None:
    load_dotenv()
    load_billing_dotenv()
    ap = argparse.ArgumentParser()
    ap.add_argument("--company-id", default=get_company_id())
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument(
        "--through",
        default="",
        help=f"Última fecha de cita incluida (YYYY-MM-DD). Default: {default_auto_invoice_through().isoformat()}",
    )
    ap.add_argument(
        "--no-auto-from",
        default="",
        help=f"No crear tickets con cita >= esta fecha (default hoy: {default_no_auto_from().isoformat()})",
    )
    ap.add_argument(
        "--include-fallback",
        action="store_true",
        help="Crea ticket también en citas confirmadas pasadas con importe>0 sin señal legacy (más agresivo).",
    )
    args = ap.parse_args()

    dsn = os.environ.get("SUPABASE_DB_URL", "").strip()
    if not dsn:
        sys.exit("Falta SUPABASE_DB_URL")

    company_id = args.company_id
    through = (args.through or "").strip() or default_auto_invoice_through().isoformat()
    no_auto_from = (args.no_auto_from or "").strip() or default_no_auto_from().isoformat()
    today = date.today().isoformat()

    conn = psycopg2.connect(dsn)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=RealDictCursor)

    sales_cols = table_columns(cur, "public", "sales")
    apt_cols = table_columns(cur, "public", "agenda_appointments")

    has_appointment_id = "appointment_id" in sales_cols
    has_customer_id = "customer_id" in sales_cols
    has_notes = "notes" in sales_cols
    has_legacy_idplan = "legacy_idplan" in apt_cols
    has_appointment_date = "appointment_date" in apt_cols

    cur.execute(
        """
        SELECT id, legacy_codcli
        FROM public.customers
        WHERE company_id = %s AND NULLIF(btrim(legacy_codcli), '') IS NOT NULL
        """,
        (company_id,),
    )
    customer_by_legacy: dict[str, str] = {}
    for row in cur.fetchall():
        code = str(row["legacy_codcli"]).strip()
        cid = str(row["id"])
        customer_by_legacy[code] = cid
        customer_by_legacy[norm_cli_key(code)] = cid

    agenda_facturado: dict[str, bool] = {}
    cur.execute("SELECT to_regclass('legacy.agenda') AS t")
    if cur.fetchone()["t"]:
        cur.execute("SELECT idplan, facturado FROM legacy.agenda WHERE NULLIF(btrim(idplan), '') IS NOT NULL")
        for row in cur.fetchall():
            pid = str(row["idplan"]).strip()
            agenda_facturado[pid] = truthy_legacy(row.get("facturado"))

    albcab_by_cli_date: dict[tuple[str, str], dict] = {}
    cur.execute("SELECT to_regclass('legacy.albcab') AS t")
    if cur.fetchone()["t"]:
        cur.execute(
            """
            SELECT seralb, ejealb, numalb, fecha, hora, codcli, total, impcob, facturado, anulada
            FROM legacy.albcab
            WHERE NULLIF(btrim(codcli), '') IS NOT NULL
            """
        )
        for row in cur.fetchall():
            d = norm_date(row.get("fecha"))
            if not d:
                continue
            key = (norm_cli_key(str(row.get("codcli"))), d)
            total = parse_decimal(row.get("total"))
            impcob = parse_decimal(row.get("impcob"))
            amount = impcob if impcob > 0 else total
            if amount <= 0:
                continue
            if truthy_legacy(row.get("anulada")):
                continue
            albcab_by_cli_date[key] = {
                "amount": amount,
                "totfac": total if total > 0 else amount,
                "ticket": f"LEG-{row.get('seralb') or 'A'}-{row.get('numalb') or '0'}".replace(" ", ""),
                "facturado": truthy_legacy(row.get("facturado")),
            }

    faccab_by_cli_date: dict[tuple[str, str], dict] = {}
    cur.execute("SELECT to_regclass('legacy.faccab') AS t")
    if cur.fetchone()["t"]:
        cur.execute(
            """
            SELECT codcli, fecfac, numfac, totfac, impcob1, impcob2, serfac
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
            ticket = f"FAC-{row.get('numfac') or '0'}".replace(" ", "")
            for key in cli_lookup_keys(cod):
                slot = faccab_by_cli_date.setdefault(
                    (key, d),
                    {"impcob": Decimal("0"), "totfac": Decimal("0"), "ticket": ticket},
                )
                slot["impcob"] += cobrado
                slot["totfac"] += facturado

    existing_sales: set[str] = set()
    if has_appointment_id:
        cur.execute(
            """
            SELECT appointment_id FROM public.sales
            WHERE company_id = %s AND appointment_id IS NOT NULL
            """,
            (company_id,),
        )
        existing_sales = {str(r["appointment_id"]) for r in cur.fetchall() if r.get("appointment_id")}

    existing_ticket_numbers: set[str] = set()
    if "ticket_number" in sales_cols:
        cur.execute(
            """
            SELECT ticket_number FROM public.sales
            WHERE company_id = %s AND ticket_number IS NOT NULL
            """,
            (company_id,),
        )
        existing_ticket_numbers = {
            str(r["ticket_number"]) for r in cur.fetchall() if r.get("ticket_number")
        }

    legacy_filter = []
    if "legacy_planinc_id" in apt_cols:
        legacy_filter.append("a.legacy_planinc_id IS NOT NULL")
    if has_legacy_idplan:
        legacy_filter.append("NULLIF(btrim(a.legacy_idplan::text), '') IS NOT NULL")
    if not legacy_filter:
        sys.exit("agenda_appointments no tiene columnas legacy; nada que promover.")

    cur.execute(
        f"""
        SELECT
          a.id,
          a.customer_id,
          a.status,
          a.start_time,
          {"a.appointment_date," if has_appointment_date else ""}
          a.legacy_planinc_id,
          {"a.legacy_idplan," if has_legacy_idplan else ""}
          COALESCE(NULLIF(btrim(a.legacy_codcli::text), ''), NULLIF(btrim(c.legacy_codcli::text), '')) AS legacy_codcli,
          c.name AS customer_name
        FROM public.agenda_appointments a
        LEFT JOIN public.customers c ON c.id = a.customer_id
        WHERE a.company_id = %s
          AND ({' OR '.join(legacy_filter)})
        ORDER BY a.start_time
        """,
        (company_id,),
    )
    appointments = cur.fetchall()

    cur.execute(
        """
        SELECT appointment_id, kind, label, notes, article_id
        FROM public.appointment_items
        WHERE appointment_id = ANY(%s::uuid[])
        """,
        ([str(a["id"]) for a in appointments],),
    )
    items_by_apt: dict[str, list] = {}
    for it in cur.fetchall():
        items_by_apt.setdefault(str(it["appointment_id"]), []).append(dict(it))

    apt_contexts: list[dict] = []
    albcab_groups: dict[tuple[str, str], list[dict]] = defaultdict(list)
    faccab_groups: dict[tuple[str, str], list[dict]] = defaultdict(list)

    for apt in appointments:
        apt_id = str(apt["id"])
        if apt_id in existing_sales:
            continue

        status = str(apt.get("status") or "confirmed").lower()
        if status == "cancelled":
            continue

        apt_date = resolve_apt_date(apt, has_appointment_date)
        if not apt_date:
            continue

        legacy_idplan = str(apt.get("legacy_idplan") or "").strip() if has_legacy_idplan else ""
        legacy_codcli = str(apt.get("legacy_codcli") or "").strip()
        cli_keys = cli_lookup_keys(legacy_codcli)

        raw_items = items_by_apt.get(apt_id, [])
        priced_items = []
        items_total = Decimal("0")
        for it in raw_items:
            qty, unit = parse_pricing_notes(it.get("notes"))
            lt = item_line_total(it.get("kind"), qty, unit, it.get("notes"))
            priced = {**it, "line_total": lt}
            priced_items.append(priced)
            items_total += lt

        ctx = {
            "apt": apt,
            "apt_id": apt_id,
            "status": status,
            "apt_date": apt_date,
            "legacy_idplan": legacy_idplan,
            "legacy_codcli": legacy_codcli,
            "cli_keys": cli_keys,
            "priced_items": priced_items,
            "items_total": items_total,
            "paid_agenda": bool(legacy_idplan and agenda_facturado.get(legacy_idplan)),
        }
        apt_contexts.append(ctx)

        albcab_slot = resolve_pool_slot(cli_keys, apt_date, albcab_by_cli_date)
        if albcab_slot and albcab_by_cli_date[albcab_slot].get("amount", Decimal("0")) > 0:
            albcab_groups[albcab_slot].append(ctx)
            continue

        faccab_slot = resolve_pool_slot(cli_keys, apt_date, faccab_by_cli_date)
        if faccab_slot and faccab_by_cli_date[faccab_slot].get("impcob", Decimal("0")) > 0:
            faccab_groups[faccab_slot].append(ctx)

    albcab_allocation = allocate_shared_cobro(albcab_groups, albcab_by_cli_date, amount_field="amount")
    albcab_billed_allocation = allocate_shared_cobro(albcab_groups, albcab_by_cli_date, amount_field="totfac")
    faccab_allocation = allocate_shared_cobro(faccab_groups, faccab_by_cli_date, amount_field="impcob")
    faccab_billed_allocation = allocate_shared_cobro(faccab_groups, faccab_by_cli_date, amount_field="totfac")

    created = 0
    skipped = 0
    skipped_future = 0
    skipped_after_through = 0
    errors = 0
    batch_size = 500

    for ctx in apt_contexts:
        apt = ctx["apt"]
        apt_id = ctx["apt_id"]
        if apt_id in existing_sales:
            skipped += 1
            continue

        status = ctx["status"]
        apt_date = ctx["apt_date"]
        if apt_date >= no_auto_from:
            skipped_future += 1
            skipped += 1
            continue
        if apt_date > through:
            skipped_after_through += 1
            skipped += 1
            continue
        legacy_idplan = ctx["legacy_idplan"]
        cli_keys = ctx["cli_keys"]
        priced_items = ctx["priced_items"]
        items_total = ctx["items_total"]
        paid_agenda = ctx["paid_agenda"]

        albcab = None
        faccab = None
        albcab_slot = resolve_pool_slot(cli_keys, apt_date, albcab_by_cli_date)
        if albcab_slot:
            albcab = albcab_by_cli_date[albcab_slot]
        faccab_slot = resolve_pool_slot(cli_keys, apt_date, faccab_by_cli_date)
        if faccab_slot:
            faccab = faccab_by_cli_date[faccab_slot]

        paid_albcab = albcab is not None
        paid_faccab = faccab is not None and faccab.get("totfac", Decimal("0")) > 0

        is_past = apt_date < today
        fallback_paid = (
            args.include_fallback
            and status == "confirmed"
            and is_past
            and items_total > 0
        )

        revenue_source = None
        cobrado = Decimal("0")
        facturado = Decimal("0")

        if apt_id in albcab_allocation:
            cobrado, albcab, _slot = albcab_allocation[apt_id]
            facturado = albcab_billed_allocation.get(apt_id, (cobrado, albcab, _slot))[0]
            revenue_source = "albcab_impcob"
        elif apt_id in faccab_allocation:
            cobrado, faccab, _slot = faccab_allocation[apt_id]
            facturado = faccab_billed_allocation.get(apt_id, (cobrado, faccab, _slot))[0]
            revenue_source = "faccab_impcob"
        elif fallback_paid:
            cobrado = items_total
            facturado = items_total
            revenue_source = "fallback_items"
        elif paid_agenda and not albcab and (not faccab or faccab.get("impcob", Decimal("0")) <= 0):
            skipped += 1
            continue
        elif faccab and faccab.get("impcob", Decimal("0")) <= 0:
            skipped += 1
            continue
        elif not (paid_agenda or paid_albcab or paid_faccab or fallback_paid):
            skipped += 1
            continue
        else:
            skipped += 1
            continue

        items_total = cobrado
        if items_total <= 0:
            skipped += 1
            continue

        revenue_meta = {
            "source": revenue_source,
            "cobrado": float(cobrado),
            "facturado": float(facturado) if facturado > 0 else float(cobrado),
            "paid_in_full": paid_in_full(cobrado, facturado) if facturado > 0 else True,
            "shared_cobro": revenue_source in {"albcab_impcob", "faccab_impcob"},
        }

        ticket = f"LEG-{legacy_idplan or apt.get('legacy_planinc_id') or apt_id[:8]}"
        ticket_number = ticket[:64]
        if ticket_number in existing_ticket_numbers:
            skipped += 1
            continue
        customer_id = str(apt["customer_id"]) if apt.get("customer_id") else next(
            (customer_by_legacy.get(k) for k in cli_keys if customer_by_legacy.get(k)),
            None,
        )
        customer_name = str(apt.get("customer_name") or "").strip() or None

        pay_method = "card"
        if company_id == MEDICINA_COMPANY_ID:
            if revenue_source == "albcab_impcob" or (
                revenue_source == "faccab_impcob" and cobrado > 0 and facturado <= cobrado
            ):
                pay_method = "cash"
            elif revenue_source == "fallback_items":
                pay_method = "cash"

        sale_row: dict = {
            "company_id": company_id,
            "ticket_number": ticket_number,
            "total_amount": float(items_total),
            "payment_method": pay_method,
            "status": "completed",
            "created_at": resolve_created_at(apt, apt_date),
        }
        if "customer_name" in sales_cols:
            sale_row["customer_name"] = customer_name
        if has_customer_id and customer_id:
            sale_row["customer_id"] = customer_id
        if has_appointment_id:
            sale_row["appointment_id"] = apt_id
        if has_notes:
            sale_row["notes"] = build_sale_notes(
                apt_id,
                customer_id,
                customer_name,
                apt_date,
                status,
                legacy_idplan or None,
                priced_items,
                revenue_meta,
            )

        cols = list(sale_row.keys())
        vals = [sale_row[c] for c in cols]
        sql = f"INSERT INTO public.sales ({', '.join(cols)}) VALUES ({', '.join(['%s'] * len(cols))})"

        if args.dry_run:
            print(
                f"[dry-run] sale {ticket} apt={apt_id[:8]} total={items_total} "
                f"source={revenue_source} agenda={paid_agenda} faccab={paid_faccab} "
                f"albcab={paid_albcab} fallback={fallback_paid}"
            )
            created += 1
            continue

        try:
            cur.execute("SAVEPOINT sale_insert")
            cur.execute(f"{sql} RETURNING id", vals)
            sale_id = cur.fetchone()["id"]
            cur.execute("SELECT to_regclass('public.sale_items') AS t")
            if cur.fetchone()["t"]:
                for it in priced_items:
                    qty, unit = parse_pricing_notes(it.get("notes"))
                    cur.execute(
                        """
                        INSERT INTO public.sale_items (sale_id, description, quantity, unit_price, total_price)
                        VALUES (%s, %s, %s, %s, %s)
                        """,
                        (
                            sale_id,
                            str(it.get("label") or "Servicio")[:500],
                            float(qty or 1),
                            float(unit),
                            float(it.get("line_total") or 0),
                        ),
                    )
            cur.execute("RELEASE SAVEPOINT sale_insert")
            created += 1
            existing_sales.add(apt_id)
            existing_ticket_numbers.add(ticket_number)
            if not args.dry_run and created % batch_size == 0:
                conn.commit()
                print(f"... {created} tickets creados", file=sys.stderr)
        except Exception as exc:
            cur.execute("ROLLBACK TO SAVEPOINT sale_insert")
            errors += 1
            if errors <= 5:
                print(f"Error insert sale apt={apt_id}: {exc}", file=sys.stderr)
            continue

    if args.dry_run:
        conn.rollback()
    else:
        conn.commit()

    cur.close()
    conn.close()

    print(f"Citas legacy revisadas: {len(appointments)}")
    print(f"Corte: citas <= {through}, sin auto desde {no_auto_from}")
    print(f"Tickets creados: {created}")
    print(f"Omitidas (ya cobradas/sin señal): {skipped}")
    if skipped_future:
        print(f"  · citas hoy o futuras (manual): {skipped_future}")
    if skipped_after_through:
        print(f"  · citas posteriores a --through: {skipped_after_through}")
    if errors:
        print(f"Errores al insertar: {errors}")


if __name__ == "__main__":
    main()
