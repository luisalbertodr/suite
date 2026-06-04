"""
Auditoría dry-run de tickets/facturas TPV por empresa fiscal.

Clasifica cada ticket por las líneas de `sale_items` usando:
  article.billing_company_id -> article_families.billing_company_id -> company_id del ticket.

No modifica datos. Imprime resumen y ejemplos de tickets/facturas dudosos.
"""
from __future__ import annotations

import argparse
import os
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass
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
DEFAULT_CATALOG = "5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4"


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


@dataclass
class SaleAudit:
    sale_id: str
    ticket_number: str
    sale_company_id: str
    target_company_id: str
    total_amount: Decimal
    invoice_id: str | None
    invoice_number: str | None
    verifactu_status: str | None
    mixed: bool
    missing_article_lines: int
    ambiguous_lines: int


def qmoney(v) -> Decimal:
    return Decimal(str(v or 0)).quantize(Decimal("0.01"))


def classify_sales(cur, *, through: date, catalog_company_id: str) -> list[SaleAudit]:
    cur.execute(
        """
        WITH line_targets AS (
          SELECT
            s.id AS sale_id,
            COALESCE(
              a.billing_company_id,
              af.billing_company_id,
              s.company_id,
              %s::uuid
            ) AS target_company_id,
            si.total_price,
            si.article_id,
            CASE
              WHEN si.article_id IS NULL THEN 1
              WHEN a.id IS NULL THEN 1
              ELSE 0
            END AS ambiguous
          FROM public.sales s
          LEFT JOIN public.sale_items si ON si.sale_id = s.id
          LEFT JOIN public.articles a ON a.id = si.article_id
          LEFT JOIN public.article_families af
            ON af.company_id = COALESCE(a.company_id, %s::uuid)
           AND af.name = a.familia
          WHERE s.status = 'completed'
            AND s.created_at::date <= %s
        ),
        dominant AS (
          SELECT DISTINCT ON (sale_id)
            sale_id,
            target_company_id,
            SUM(COALESCE(total_price, 0)) AS amount
          FROM line_targets
          GROUP BY sale_id, target_company_id
          ORDER BY sale_id, amount DESC
        ),
        line_stats AS (
          SELECT
            sale_id,
            COUNT(DISTINCT target_company_id) FILTER (WHERE target_company_id IS NOT NULL) AS target_count,
            COUNT(*) FILTER (WHERE article_id IS NULL) AS missing_article_lines,
            SUM(ambiguous) AS ambiguous_lines
          FROM line_targets
          GROUP BY sale_id
        )
        SELECT
          s.id::text AS sale_id,
          s.ticket_number,
          s.company_id::text AS sale_company_id,
          COALESCE(d.target_company_id, s.company_id, %s::uuid)::text AS target_company_id,
          s.total_amount,
          s.invoice_id::text,
          i.number AS invoice_number,
          i.verifactu_status,
          COALESCE(ls.target_count, 0) > 1 AS mixed,
          COALESCE(ls.missing_article_lines, 0) AS missing_article_lines,
          COALESCE(ls.ambiguous_lines, 0) AS ambiguous_lines
        FROM public.sales s
        LEFT JOIN dominant d ON d.sale_id = s.id
        LEFT JOIN line_stats ls ON ls.sale_id = s.id
        LEFT JOIN public.invoices i ON i.id = s.invoice_id
        WHERE s.status = 'completed'
          AND s.created_at::date <= %s
        ORDER BY s.created_at, s.ticket_number
        """,
        (catalog_company_id, catalog_company_id, through, catalog_company_id, through),
    )
    return [
        SaleAudit(
            sale_id=r["sale_id"],
            ticket_number=r["ticket_number"] or "",
            sale_company_id=r["sale_company_id"],
            target_company_id=r["target_company_id"],
            total_amount=qmoney(r["total_amount"]),
            invoice_id=r["invoice_id"],
            invoice_number=r["invoice_number"],
            verifactu_status=r["verifactu_status"],
            mixed=bool(r["mixed"]),
            missing_article_lines=int(r["missing_article_lines"] or 0),
            ambiguous_lines=int(r["ambiguous_lines"] or 0),
        )
        for r in cur.fetchall()
    ]


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser()
    parser.add_argument("--through", default=date.today().isoformat())
    parser.add_argument("--catalog-company-id", default=DEFAULT_CATALOG)
    parser.add_argument("--examples", type=int, default=20)
    args = parser.parse_args()

    dsn = os.environ.get("SUPABASE_DB_URL", "").strip()
    if not dsn:
        sys.exit("Falta SUPABASE_DB_URL en .env")

    conn = psycopg2.connect(dsn, cursor_factory=RealDictCursor)
    try:
        cur = conn.cursor()
        sales = classify_sales(cur, through=date.fromisoformat(args.through), catalog_company_id=args.catalog_company_id)
    finally:
        conn.close()

    totals = Counter()
    amount_by_target: defaultdict[str, Decimal] = defaultdict(lambda: Decimal("0.00"))
    for sale in sales:
        totals["sales"] += 1
        totals["wrong_company"] += int(sale.sale_company_id != sale.target_company_id)
        totals["mixed"] += int(sale.mixed)
        totals["missing_article"] += int(sale.missing_article_lines > 0)
        totals["ambiguous"] += int(sale.ambiguous_lines > 0)
        totals["with_invoice"] += int(bool(sale.invoice_id))
        totals["verifactu_touched"] += int((sale.verifactu_status or "") in {"sent", "accepted"})
        amount_by_target[sale.target_company_id or "SIN_EMPRESA"] += sale.total_amount

    print("=== Auditoría TPV Medicina/Estética ===")
    print(f"Hasta fecha: {args.through}")
    print(f"Tickets completados: {totals['sales']}")
    print(f"Tickets con empresa incorrecta: {totals['wrong_company']}")
    print(f"Tickets mixtos: {totals['mixed']}")
    print(f"Tickets con líneas sin article_id: {totals['missing_article']}")
    print(f"Tickets ambiguos: {totals['ambiguous']}")
    print(f"Tickets con factura: {totals['with_invoice']}")
    print(f"Tickets con factura Verifactu enviada/aceptada: {totals['verifactu_touched']}")
    print("\nImporte por empresa objetivo:")
    for company_id, amount in sorted(amount_by_target.items(), key=lambda item: item[0]):
        print(f"  {company_id}: {amount}")

    flagged = [
        s for s in sales
        if s.sale_company_id != s.target_company_id or s.mixed or s.missing_article_lines or s.verifactu_status in {"sent", "accepted"}
    ]
    print(f"\nEjemplos de tickets a revisar ({min(len(flagged), args.examples)}/{len(flagged)}):")
    for sale in flagged[: args.examples]:
        print(
            f"  {sale.ticket_number or sale.sale_id[:8]} sale_co={sale.sale_company_id} "
            f"target={sale.target_company_id} total={sale.total_amount} mixed={sale.mixed} "
            f"missing_article={sale.missing_article_lines} invoice={sale.invoice_number or '-'} "
            f"vf={sale.verifactu_status or '-'}"
        )


if __name__ == "__main__":
    main()
