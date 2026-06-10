#!/usr/bin/env python3
"""Comprueba que facturación mensual Dunasoft (legacy) = Medicina + Estética en Suite.

Últimos N meses completos (por defecto 5).
"""
from __future__ import annotations

import argparse
import os
import sys
from datetime import date
from decimal import Decimal
from pathlib import Path

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    print("pip install psycopg2-binary", file=sys.stderr)
    raise

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

ESTETICA = "5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4"
MEDICINA = "816af484-92a0-4f65-a5a7-1c907aa4bb3d"

NUM = lambda c: f"COALESCE(NULLIF(regexp_replace(btrim({c}::text), ',', '.', 'g'), '')::numeric, 0)"


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


def month_range(ym: str) -> tuple[str, str]:
    y, m = map(int, ym.split("-"))
    start = f"{y}-{m:02d}-01"
    if m == 12:
        end = f"{y + 1}-01-01"
    else:
        end = f"{y}-{m + 1:02d}-01"
    return start, end


def last_complete_months(n: int, today: date | None = None) -> list[str]:
    today = today or date.today()
    first_this = date(today.year, today.month, 1)
    months: list[str] = []
    y, m = first_this.year, first_this.month
    for _ in range(n):
        m -= 1
        if m < 1:
            m = 12
            y -= 1
        months.append(f"{y}-{m:02d}")
    return list(reversed(months))


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser()
    ap.add_argument("--months", type=int, default=5)
    args = ap.parse_args()

    url = os.environ.get("SUPABASE_DB_URL", "").strip()
    if not url:
        sys.exit("Falta SUPABASE_DB_URL")

    months = last_complete_months(args.months)
    range_start, _ = month_range(months[0])
    _, range_end = month_range(months[-1])

    conn = psycopg2.connect(url)
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("SELECT to_regclass('legacy.faccab') AS t")
    if not cur.fetchone()["t"]:
        sys.exit("No existe legacy.faccab")

    # Dunasoft: facturas serie A no anuladas (convención usada en compare_dunasoft_revenue)
    cur.execute(
        f"""
        SELECT to_char(fecfac::date, 'YYYY-MM') AS ym,
               ROUND(SUM({NUM('totfac')})::numeric, 2) AS total,
               COUNT(*) AS docs
        FROM legacy.faccab
        WHERE btrim(coalesce(serfac::text, '')) = 'A'
          AND fecfac::date >= %s::date AND fecfac::date < %s::date
          AND upper(btrim(coalesce(anulada::text, ''))) NOT IN
              ('S', 'SI', '1', 'T', 'TRUE', 'Y', 'YES', 'X', 'ANULADA', 'A')
        GROUP BY 1
        ORDER BY 1
        """,
        (range_start, range_end),
    )
    duna_by_month = {str(r["ym"]): Decimal(str(r["total"] or 0)) for r in cur.fetchall()}

    # Suite: facturas por billing emisor (catálogo Estética)
    cur.execute(
        f"""
        SELECT to_char(i.issue_date, 'YYYY-MM') AS ym,
               public.resolve_invoice_billing_company_id(i.id, %s::uuid) AS billing_co,
               ROUND(SUM(i.total_amount)::numeric, 2) AS total,
               COUNT(*) AS docs
        FROM public.invoices i
        WHERE i.issue_date >= %s::date AND i.issue_date < %s::date
          AND lower(coalesce(i.status, '')) NOT IN ('cancelled', 'void', 'anulada')
          AND i.company_id IN (%s::uuid, %s::uuid)
        GROUP BY 1, 2
        ORDER BY 1, 2
        """,
        (ESTETICA, range_start, range_end, ESTETICA, MEDICINA),
    )
    inv_by_ym_billing: dict[str, dict[str, Decimal]] = {}
    for r in cur.fetchall():
        ym = str(r["ym"])
        co = str(r["billing_co"])
        inv_by_ym_billing.setdefault(ym, {})[co] = Decimal(str(r["total"] or 0))

    # Suite: TPV / ventas sin factura (created_at) — excluir huérfanas legacy (duplican faccab)
    cur.execute(
        f"""
        SELECT to_char(s.created_at AT TIME ZONE 'Europe/Madrid', 'YYYY-MM') AS ym,
               s.company_id::text AS co,
               ROUND(SUM(s.total_amount)::numeric, 2) AS total,
               COUNT(*) AS docs
        FROM public.sales s
        WHERE s.status = 'completed'
          AND s.invoice_id IS NULL
          AND s.created_at >= %s::timestamptz
          AND s.created_at < %s::timestamptz
          AND s.company_id IN (%s::uuid, %s::uuid)
          AND NOT (
            s.ticket_number LIKE 'LEG-%%'
            OR s.ticket_number ~ '^FAC-[0-9]'
            OR COALESCE(s.notes, '') ILIKE '%%legacy_revenue%%'
            OR COALESCE(s.notes, '') ILIKE '%%Legacy FACCAB%%'
            OR (
              COALESCE(s.notes, '') ILIKE '%%legacy%%'
              AND COALESCE(s.notes, '') ILIKE '%%appointment_id%%'
            )
          )
        GROUP BY 1, 2
        ORDER BY 1, 2
        """,
        (range_start, range_end, ESTETICA, MEDICINA),
    )
    sales_by_ym_co: dict[str, dict[str, Decimal]] = {}
    for r in cur.fetchall():
        ym = str(r["ym"])
        co = str(r["co"])
        sales_by_ym_co.setdefault(ym, {})[co] = Decimal(str(r["total"] or 0))

    print(f"Meses analizados: {', '.join(months)}")
    print(f"Rango: {range_start} .. {range_end} (excl.)")
    print()
    hdr = (
        f"{'Mes':<8} {'Dunasoft':>12} {'Medicina':>12} {'Estética':>12} "
        f"{'M+E':>12} {'Diff':>10} {'OK':>4}"
    )
    print(hdr)
    print("-" * len(hdr))

    # Solo facturas (issue_date) — alineado con dashboard por empresa emisora
    cur.execute(
        f"""
        SELECT to_char(i.issue_date, 'YYYY-MM') AS ym,
               i.company_id::text AS co,
               ROUND(SUM(i.total_amount)::numeric, 2) AS total
        FROM public.invoices i
        WHERE i.issue_date >= %s::date AND i.issue_date < %s::date
          AND lower(coalesce(i.status, '')) NOT IN ('cancelled', 'void', 'anulada')
          AND i.company_id IN (%s::uuid, %s::uuid)
        GROUP BY 1, 2
        """,
        (range_start, range_end, ESTETICA, MEDICINA),
    )
    inv_co_by_ym: dict[str, dict[str, Decimal]] = {}
    for r in cur.fetchall():
        ym = str(r["ym"])
        co = str(r["co"])
        inv_co_by_ym.setdefault(ym, {})[co] = Decimal(str(r["total"] or 0))

    all_ok = True
    for ym in months:
        duna = duna_by_month.get(ym, Decimal("0"))
        med_inv = inv_by_ym_billing.get(ym, {}).get(MEDICINA, Decimal("0"))
        est_inv = inv_by_ym_billing.get(ym, {}).get(ESTETICA, Decimal("0"))
        med_sales = sales_by_ym_co.get(ym, {}).get(MEDICINA, Decimal("0"))
        est_sales = sales_by_ym_co.get(ym, {}).get(ESTETICA, Decimal("0"))
        medicina = med_inv
        estetica = est_inv
        suite_sum = medicina + estetica
        diff = suite_sum - duna
        ok = abs(diff) < Decimal("0.02")
        if not ok:
            all_ok = False
        print(
            f"{ym:<8} {duna:>12.2f} {medicina:>12.2f} {estetica:>12.2f} "
            f"{suite_sum:>12.2f} {diff:>+10.2f} {'Sí' if ok else 'No':>4}"
        )

    print()
    print("Detalle facturas (issue_date) por billing_co:")
    for ym in months:
        inv = inv_by_ym_billing.get(ym, {})
        print(
            f"  {ym}: medicina inv={inv.get(MEDICINA, 0):.2f}  "
            f"estética inv={inv.get(ESTETICA, 0):.2f}"
        )
    print("Detalle ventas TPV sin factura (created_at) — no suman al OK Dunasoft:")
    for ym in months:
        sal = sales_by_ym_co.get(ym, {})
        print(
            f"  {ym}: medicina sales={sal.get(MEDICINA, 0):.2f}  "
            f"estética sales={sal.get(ESTETICA, 0):.2f}"
        )
    print("\nAlternativa: facturas por company_id (emisora en tabla) + mismas ventas:")
    hdr2 = f"{'Mes':<8} {'Dunasoft':>12} {'Med(co)':>12} {'Est(co)':>12} {'Sum':>12} {'Diff':>10}"
    print(hdr2)
    print("-" * len(hdr2))
    for ym in months:
        duna = duna_by_month.get(ym, Decimal("0"))
        med_inv = inv_by_ym_billing.get(ym, {}).get(MEDICINA, Decimal("0"))
        est_inv = inv_by_ym_billing.get(ym, {}).get(ESTETICA, Decimal("0"))
        med_sales = sales_by_ym_co.get(ym, {}).get(MEDICINA, Decimal("0"))
        est_sales = sales_by_ym_co.get(ym, {}).get(ESTETICA, Decimal("0"))
        med_co = inv_co_by_ym.get(ym, {}).get(MEDICINA, Decimal("0")) + med_sales
        est_co = inv_co_by_ym.get(ym, {}).get(ESTETICA, Decimal("0")) + est_sales
        s = med_co + est_co
        print(
            f"{ym:<8} {duna:>12.2f} {med_co:>12.2f} {est_co:>12.2f} {s:>12.2f} {s - duna:>+10.2f}"
        )

    # Legacy albcab (tickets TPV Dunasoft) por si el total Dunasoft incluye albaranes
    cur.execute("SELECT to_regclass('legacy.albcab') AS t")
    if cur.fetchone()["t"]:
        cur.execute(
            f"""
            SELECT to_char(fecha::date, 'YYYY-MM') AS ym,
                   ROUND(SUM({NUM('impcob')})::numeric, 2) AS total
            FROM legacy.albcab
            WHERE fecha::date >= %s::date AND fecha::date < %s::date
              AND {NUM('impcob')} <> 0
            GROUP BY 1 ORDER BY 1
            """,
            (range_start, range_end),
        )
        alb = {str(r["ym"]): Decimal(str(r["total"] or 0)) for r in cur.fetchall()}
        print("\nReferencia legacy.albcab (impcob, tickets):")
        for ym in months:
            print(f"  {ym}: {alb.get(ym, Decimal('0')):.2f}")

    print()
    if all_ok:
        print("RESULTADO: Los últimos meses cuadran (M+E = Dunasoft legacy faccab A).")
    else:
        print("RESULTADO: Hay desfases; revisar importación, billing_co o ventas sin factura.")

    conn.close()


if __name__ == "__main__":
    main()
