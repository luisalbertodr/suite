"""Compara facturación Suite vs Dunasoft legacy (Ene-Mar)."""
from __future__ import annotations

import os
import sys
from decimal import Decimal
from pathlib import Path

import psycopg2
from psycopg2.extras import RealDictCursor

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from legacy_company import get_company_id

DUNASOFT = {
    "2026-01": Decimal("15218.23"),
    "2026-02": Decimal("16455.00"),
    "2026-03": Decimal("12229.69"),
}


def load_dotenv() -> None:
    env = ROOT / ".env"
    if not env.is_file():
        return
    for line in env.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        if k.strip() and k.strip() not in os.environ:
            os.environ[k.strip()] = v.strip().strip('"')


def safe_num(expr: str) -> str:
    return f"COALESCE(NULLIF(regexp_replace(btrim({expr}::text), ',', '.', 'g'), '')::numeric, 0)"


def main() -> None:
    load_dotenv()
    company = get_company_id()
    conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
    cur = conn.cursor(cursor_factory=RealDictCursor)

    print(f"Empresa Suite: {company}\n")
    print("=" * 72)
    print(f"{'Mes':<10} {'Dunasoft':>12} {'Suite issue':>12} {'Suite+TPV':>12} {'Desfase':>12}")
    print("=" * 72)

    for ym, dunasoft_total in DUNASOFT.items():
        y, m = ym.split("-")
        month_start = f"{y}-{m}-01"
        if m == "12":
            month_end = f"{int(y)+1}-01-01"
        else:
            month_end = f"{y}-{int(m)+1:02d}-01"

        cur.execute(
            """
            SELECT COUNT(*) AS c, COALESCE(SUM(total_amount), 0) AS s
            FROM invoices
            WHERE company_id = %s
              AND issue_date >= %s::date
              AND issue_date < %s::date
              AND lower(coalesce(status, '')) NOT IN ('cancelled', 'void', 'anulada')
            """,
            (company, month_start, month_end),
        )
        inv = cur.fetchone()

        cur.execute(
            """
            SELECT COUNT(*) AS c, COALESCE(SUM(total_amount), 0) AS s
            FROM sales
            WHERE company_id = %s
              AND status = 'completed'
              AND invoice_id IS NULL
              AND created_at >= %s::timestamptz
              AND created_at < %s::timestamptz
            """,
            (company, month_start, month_end),
        )
        tpv = cur.fetchone()

        suite_issue = Decimal(str(inv["s"]))
        suite_total = suite_issue + Decimal(str(tpv["s"]))
        diff = suite_total - dunasoft_total
        print(
            f"{ym:<10} {dunasoft_total:>12.2f} {suite_issue:>12.2f} {suite_total:>12.2f} {diff:>+12.2f}"
        )

    print("\n--- Suite: facturas por issue_date (detalle mes) ---")
    for ym in DUNASOFT:
        y, m = ym.split("-")
        ms = f"{y}-{m}-01"
        me = f"{y}-{int(m)+1:02d}-01" if m != "12" else f"{int(y)+1}-01-01"
        cur.execute(
            """
            SELECT COUNT(*) c, MIN(issue_date) min_d, MAX(issue_date) max_d,
                   ROUND(SUM(total_amount)::numeric, 2) total
            FROM invoices WHERE company_id=%s
              AND issue_date >= %s::date AND issue_date < %s::date
            """,
            (company, ms, me),
        )
        print(ym, dict(cur.fetchone()))

    print("\n--- Suite: facturas por created_at (bug antiguo dashboard) ---")
    for ym in DUNASOFT:
        y, m = ym.split("-")
        ms = f"{y}-{m}-01"
        me = f"{y}-{int(m)+1:02d}-01" if m != "12" else f"{int(y)+1}-01-01"
        cur.execute(
            """
            SELECT COUNT(*) c, ROUND(SUM(total_amount)::numeric, 2) total
            FROM invoices WHERE company_id=%s
              AND created_at >= %s::timestamptz AND created_at < %s::timestamptz
            """,
            (company, ms, me),
        )
        print(ym, dict(cur.fetchone()))

    # Legacy Dunasoft sources
    cur.execute("SELECT to_regclass('legacy.faccab') AS t")
    has_faccab = cur.fetchone()["t"]
    cur.execute("SELECT to_regclass('legacy.albcab') AS t")
    has_albcab = cur.fetchone()["t"]

    if has_faccab:
        cur.execute(
            """
            SELECT column_name FROM information_schema.columns
            WHERE table_schema='legacy' AND table_name='faccab'
            ORDER BY ordinal_position
            """
        )
        faccab_cols = {r["column_name"] for r in cur.fetchall()}
        print("\nlegacy.faccab cols sample:", sorted(faccab_cols)[:20])

        date_col = next(
            (c for c in ("fecfac", "fecha", "fecalta", "date") if c in faccab_cols),
            None,
        )
        total_col = next(
            (c for c in ("total", "imptot", "totfac", "importe") if c in faccab_cols),
            None,
        )
        anul_col = next((c for c in ("anulada", "anulado", "estado") if c in faccab_cols), None)

        if date_col and total_col:
            anul_filter = ""
            if anul_col:
                anul_filter = f"""
                  AND upper(btrim(coalesce({anul_col}::text, ''))) NOT IN
                      ('S','SI','1','T','TRUE','Y','YES','X','ANULADA','A')
                """
            print(f"\n--- Legacy faccab por mes ({date_col}, {total_col}) ---")
            for ym in DUNASOFT:
                y, m = ym.split("-")
                ms = f"{y}-{m}-01"
                me = f"{y}-{int(m)+1:02d}-01" if m != "12" else f"{int(y)+1}-01-01"
                cur.execute(
                    f"""
                    SELECT COUNT(*) c, ROUND(SUM({safe_num(total_col)})::numeric, 2) total
                    FROM legacy.faccab
                    WHERE {date_col}::date >= %s::date AND {date_col}::date < %s::date
                    {anul_filter}
                    """,
                    (ms, me),
                )
                print(ym, dict(cur.fetchone()))

    if has_albcab:
        cur.execute(
            """
            SELECT column_name FROM information_schema.columns
            WHERE table_schema='legacy' AND table_name='albcab'
            """
        )
        albcab_cols = {r["column_name"] for r in cur.fetchall()}
        print("\nlegacy.albcab cols:", sorted(albcab_cols))

        date_col = next((c for c in ("fecha", "fecalb", "fecfac") if c in albcab_cols), None)
        total_col = next((c for c in ("total", "impcob", "totimpbas") if c in albcab_cols), None)
        anul_col = next((c for c in ("anulada", "anulado") if c in albcab_cols), None)

        if date_col and total_col:
            anul_filter = ""
            if anul_col:
                anul_filter = f"""
                  AND upper(btrim(coalesce({anul_col}::text, ''))) NOT IN
                      ('S','SI','1','T','TRUE','Y','YES','X')
                """
            print(f"\n--- Legacy albcab (tickets TPV) por mes ({date_col}, {total_col}) ---")
            for ym in DUNASOFT:
                y, m = ym.split("-")
                ms = f"{y}-{m}-01"
                me = f"{y}-{int(m)+1:02d}-01" if m != "12" else f"{int(y)+1}-01-01"
                cur.execute(
                    f"""
                    SELECT COUNT(*) c, ROUND(SUM({safe_num(total_col)})::numeric, 2) total
                    FROM legacy.albcab
                    WHERE {date_col}::date >= %s::date AND {date_col}::date < %s::date
                    {anul_filter}
                    """,
                    (ms, me),
                )
                print(ym, dict(cur.fetchone()))

    # Duplicados: sales vs invoices same month created_at
    print("\n--- Posible doble conteo: sales con/sin invoice_id ---")
    for ym in DUNASOFT:
        y, m = ym.split("-")
        ms = f"{y}-{m}-01"
        me = f"{y}-{int(m)+1:02d}-01" if m != "12" else f"{int(y)+1}-01-01"
        cur.execute(
            """
            SELECT
              COUNT(*) FILTER (WHERE invoice_id IS NOT NULL) with_inv,
              COUNT(*) FILTER (WHERE invoice_id IS NULL) without_inv,
              ROUND(SUM(total_amount) FILTER (WHERE invoice_id IS NOT NULL)::numeric, 2) sum_with,
              ROUND(SUM(total_amount) FILTER (WHERE invoice_id IS NULL)::numeric, 2) sum_without
            FROM sales
            WHERE company_id=%s AND status='completed'
              AND created_at >= %s::timestamptz AND created_at < %s::timestamptz
            """,
            (company, ms, me),
        )
        print(ym, dict(cur.fetchone()))

    # Import batch analysis
    print("\n--- Facturas importadas en lote (created_at >> issue_date) ---")
    for ym in DUNASOFT:
        y, m = ym.split("-")
        ms = f"{y}-{m}-01"
        me = f"{y}-{int(m)+1:02d}-01" if m != "12" else f"{int(y)+1}-01-01"
        cur.execute(
            """
            SELECT COUNT(*) c, ROUND(COALESCE(SUM(total_amount),0)::numeric, 2) total
            FROM invoices
            WHERE company_id=%s
              AND issue_date >= %s::date AND issue_date < %s::date
              AND created_at >= '2026-04-01'::timestamptz
            """,
            (company, ms, me),
        )
        print(f"{ym} issue en mes, created abr+:", dict(cur.fetchone()))

    conn.close()


def probe_legacy_totals() -> None:
    load_dotenv()
    conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
    cur = conn.cursor(cursor_factory=RealDictCursor)
    months = ["2026-01", "2026-02", "2026-03"]

    def q(sql: str, params: tuple) -> dict:
        cur.execute(sql, params)
        return dict(cur.fetchone())

    print("\n=== Legacy faccab variantes ===")
    variants = [
        ("totfac (todas)", "totfac", ""),
        ("totfac sin anulada", "totfac", "AND upper(btrim(coalesce(anulada::text,''))) NOT IN ('S','SI','1','T','TRUE','Y','YES','X')"),
        ("totfac solo anulada", "totfac", "AND upper(btrim(coalesce(anulada::text,''))) IN ('S','SI','1','T','TRUE','Y','YES','X')"),
        ("totimpbas", "totimpbas", ""),
        ("impcob1+impcob2", "impcob1", "WITH imp AS (SELECT COALESCE(NULLIF(regexp_replace(btrim(impcob1::text),',','.','g'),'')::numeric,0)+COALESCE(NULLIF(regexp_replace(btrim(impcob2::text),',','.','g'),'')::numeric,0) AS v FROM legacy.faccab WHERE fecfac::date >= %s AND fecfac::date < %s) SELECT COUNT(*) c, ROUND(SUM(v)::numeric,2) t FROM imp"),
    ]

    for label, col, extra in variants[:4]:
        print(f"\n{label}:")
        for ym in months:
            y, m = ym.split("-")
            ms, me = f"{y}-{m}-01", f"{y}-{int(m)+1:02d}-01"
            cur.execute(
                f"""
                SELECT COUNT(*) c,
                  ROUND(SUM(COALESCE(NULLIF(regexp_replace(btrim({col}::text),',','.','g'),'')::numeric,0))::numeric,2) t
                FROM legacy.faccab
                WHERE fecfac::date >= %s::date AND fecfac::date < %s::date {extra}
                """,
                (ms, me),
            )
            r = dict(cur.fetchone())
            print(f"  {ym}: {r['t']} € ({r['c']} docs) | Dunasoft {DUNASOFT[ym]} | diff {float(r['t'] or 0) - float(DUNASOFT[ym]):+.2f}")

    print("\n=== albcab (tickets) ===")
    for col in ("impcob", "total", "totimpbas"):
        print(f"\nalbcab.{col}:")
        for ym in months:
            y, m = ym.split("-")
            ms, me = f"{y}-{m}-01", f"{y}-{int(m)+1:02d}-01"
            cur.execute(
                f"""
                SELECT COUNT(*) c,
                  ROUND(SUM(COALESCE(NULLIF(regexp_replace(btrim({col}::text),',','.','g'),'')::numeric,0))::numeric,2) t
                FROM legacy.albcab
                WHERE fecha::date >= %s::date AND fecha::date < %s::date
                  AND COALESCE(NULLIF(regexp_replace(btrim({col}::text),',','.','g'),'')::numeric,0) <> 0
                """,
                (ms, me),
            )
            r = dict(cur.fetchone())
            print(f"  {ym}: {r}")

    print("\n=== Suite sales origen (appointments legacy) ===")
    company = get_company_id()
    for ym in months:
        y, m = ym.split("-")
        ms, me = f"{y}-{m}-01", f"{y}-{int(m)+1:02d}-01"
        cur.execute(
            """
            SELECT COUNT(*) c, ROUND(COALESCE(SUM(s.total_amount),0)::numeric,2) t
            FROM sales s
            WHERE s.company_id=%s AND s.status='completed'
              AND s.appointment_id IS NOT NULL
              AND s.created_at >= %s::timestamptz AND s.created_at < %s::timestamptz
            """,
            (company, ms, me),
        )
        print(f"  {ym} sales from appointments:", dict(cur.fetchone()))

        cur.execute(
            """
            SELECT COUNT(*) c, ROUND(COALESCE(SUM(i.total_amount),0)::numeric,2) t
            FROM invoices i
            JOIN sales s ON s.invoice_id = i.id
            WHERE i.company_id=%s
              AND i.issue_date >= %s::date AND i.issue_date < %s::date
              AND s.appointment_id IS NOT NULL
            """,
            (company, ms, me),
        )
        print(f"  {ym} invoices from appt sales:", dict(cur.fetchone()))

    print("\n=== Conteo faccab vs Suite invoices ===")
    for ym in months:
        y, m = ym.split("-")
        ms, me = f"{y}-{m}-01", f"{y}-{int(m)+1:02d}-01"
        cur.execute(
            """
            SELECT COUNT(*) c FROM legacy.faccab
            WHERE fecfac::date >= %s::date AND fecfac::date < %s::date
              AND upper(btrim(coalesce(anulada::text,''))) NOT IN ('S','SI','1','T','TRUE','Y','YES','X')
            """,
            (ms, me),
        )
        fc = cur.fetchone()["c"]
        cur.execute(
            """
            SELECT COUNT(*) c FROM invoices
            WHERE company_id=%s AND issue_date >= %s::date AND issue_date < %s::date
            """,
            (company, ms, me),
        )
        inv = cur.fetchone()["c"]
        print(f"  {ym}: faccab={fc} suite_invoices={inv} diff={fc-inv}")

    conn.close()


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "--legacy":
        probe_legacy_totals()
    else:
        main()
        probe_legacy_totals()
