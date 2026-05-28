"""Diagnóstico de ingresos mensuales (fetchPeriodRevenue)."""
from __future__ import annotations

import os
import sys
from pathlib import Path

import psycopg2

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from legacy_company import get_company_id


def load_dotenv() -> None:
    env = ROOT / ".env"
    if not env.is_file():
        return
    for line in env.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k = k.strip()
        v = v.strip().strip('"')
        if k and k not in os.environ:
            os.environ[k] = v


def main() -> None:
    load_dotenv()
    url = os.environ.get("SUPABASE_DB_URL", "").strip()
    if not url:
        sys.exit("Falta SUPABASE_DB_URL")

    company = get_company_id()
    month_start = "2026-05-01"
    month_end = "2026-05-31 23:59:59"

    conn = psycopg2.connect(url)
    cur = conn.cursor()

    print(f"Empresa: {company}")
    print(f"Periodo: {month_start} .. {month_end}\n")

    cur.execute(
        """
        SELECT COUNT(*), COALESCE(SUM(total_amount), 0)
        FROM invoices
        WHERE company_id = %s
          AND created_at >= %s::timestamptz
          AND created_at <= %s::timestamptz
        """,
        (company, month_start, month_end),
    )
    print("Facturas (filtro created_at — como el dashboard):", cur.fetchone())

    cur.execute(
        """
        SELECT COUNT(*), COALESCE(SUM(total_amount), 0)
        FROM invoices
        WHERE company_id = %s
          AND issue_date >= %s::date
          AND issue_date <= %s::date
        """,
        (company, month_start, "2026-05-31"),
    )
    print("Facturas (filtro issue_date — fecha real):", cur.fetchone())

    cur.execute(
        """
        SELECT COUNT(*), COALESCE(SUM(total_amount), 0)
        FROM sales
        WHERE company_id = %s
          AND status = 'completed'
          AND created_at >= %s::timestamptz
          AND created_at <= %s::timestamptz
          AND invoice_id IS NULL
        """,
        (company, month_start, month_end),
    )
    print("TPV sin factura (created_at):", cur.fetchone())

    cur.execute(
        """
        SELECT COUNT(*), COALESCE(SUM(total_amount), 0)
        FROM sales
        WHERE company_id = %s
          AND status = 'completed'
          AND created_at >= %s::timestamptz
          AND created_at <= %s::timestamptz
        """,
        (company, month_start, month_end),
    )
    print("TPV todos (created_at):", cur.fetchone())

    inv_sum = cur.execute(
        """
        SELECT COALESCE(SUM(total_amount),0) FROM invoices
        WHERE company_id=%s AND created_at >= %s::timestamptz AND created_at <= %s::timestamptz
        """,
        (company, month_start, month_end),
    )
    cur.execute(
        """
        SELECT COALESCE(SUM(total_amount),0) FROM sales
        WHERE company_id=%s AND status='completed'
          AND created_at >= %s::timestamptz AND created_at <= %s::timestamptz
          AND invoice_id IS NULL
        """,
        (company, month_start, month_end),
    )
    sales_no_inv = cur.fetchone()[0]
    cur.execute(
        """
        SELECT COALESCE(SUM(total_amount),0) FROM invoices
        WHERE company_id=%s AND created_at >= %s::timestamptz AND created_at <= %s::timestamptz
        """,
        (company, month_start, month_end),
    )
    inv_total = cur.fetchone()[0]
    print(f"\nTotal dashboard (inv+tpv): {float(inv_total)+float(sales_no_inv):.2f}")

    print("\n--- Top 15 facturas mayo (created_at) ---")
    cur.execute(
        """
        SELECT number, issue_date, created_at::date, total_amount, status
        FROM invoices
        WHERE company_id = %s
          AND created_at >= %s::timestamptz
          AND created_at <= %s::timestamptz
        ORDER BY total_amount DESC NULLS LAST
        LIMIT 15
        """,
        (company, month_start, month_end),
    )
    for r in cur.fetchall():
        print(r)

    print("\n--- Facturas por mes (created_at) ---")
    cur.execute(
        """
        SELECT date_trunc('month', created_at)::date, COUNT(*), ROUND(SUM(total_amount)::numeric, 2)
        FROM invoices WHERE company_id = %s
        GROUP BY 1 ORDER BY 1 DESC LIMIT 10
        """,
        (company,),
    )
    for r in cur.fetchall():
        print(r)

    print("\n--- Ventas TPV por mes ---")
    cur.execute(
        """
        SELECT date_trunc('month', created_at)::date, COUNT(*), ROUND(SUM(total_amount)::numeric, 2)
        FROM sales WHERE company_id = %s AND status = 'completed'
        GROUP BY 1 ORDER BY 1 DESC LIMIT 10
        """,
        (company,),
    )
    for r in cur.fetchall():
        print(r)

    print("\n--- Facturas legacy? (issue_date antigua, created_at mayo) ---")
    cur.execute(
        """
        SELECT COUNT(*), ROUND(COALESCE(SUM(total_amount),0)::numeric, 2)
        FROM invoices
        WHERE company_id = %s
          AND created_at >= %s::timestamptz
          AND created_at <= %s::timestamptz
          AND issue_date < %s::date
        """,
        (company, month_start, month_end, month_start),
    )
    print("count, sum:", cur.fetchone())

    print("\n--- Muestra facturas importadas (issue_date << created_at) ---")
    cur.execute(
        """
        SELECT number, issue_date, created_at::date, total_amount
        FROM invoices
        WHERE company_id = %s
          AND created_at >= %s::timestamptz
          AND created_at <= %s::timestamptz
          AND issue_date < '2020-01-01'
        ORDER BY total_amount DESC
        LIMIT 8
        """,
        (company, month_start, month_end),
    )
    for r in cur.fetchall():
        print(r)

    conn.close()


if __name__ == "__main__":
    main()
