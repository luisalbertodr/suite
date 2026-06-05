"""
Reasigna facturas (y ventas vinculadas) a la empresa emisora correcta
según el billing_company_id del artículo referenciado en cada línea.

Uso:
  python scripts/migrate_invoice_billing_companies.py --dry-run
  python scripts/migrate_invoice_billing_companies.py
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("pip install psycopg2-binary", file=sys.stderr)
    raise

ROOT = Path(__file__).resolve().parents[1]

DEFAULT_CATALOG = "5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4"  # María del Mar / estética
DEFAULT_MEDICINA = "816af484-92a0-4f65-a5a7-1c907aa4bb3d"


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


def count_invoices_to_medicina(cur, catalog_id: str, medicina_id: str) -> tuple[int, float]:
    cur.execute(
        """
        SELECT COUNT(*)::int, COALESCE(SUM(i.total_amount), 0)::float
        FROM invoices i
        WHERE i.company_id = %s::uuid
          AND public.resolve_invoice_billing_company_id(i.id, %s::uuid) = %s::uuid
        """,
        (catalog_id, catalog_id, medicina_id),
    )
    row = cur.fetchone()
    return int(row[0]), float(row[1])


def fetch_invoice_ids_to_medicina(cur, catalog_id: str, medicina_id: str) -> list[str]:
    cur.execute(
        """
        SELECT i.id::text
        FROM invoices i
        WHERE i.company_id = %s::uuid
          AND public.resolve_invoice_billing_company_id(i.id, %s::uuid) = %s::uuid
        ORDER BY i.issue_date, i.id
        """,
        (catalog_id, catalog_id, medicina_id),
    )
    return [str(row[0]) for row in cur.fetchall()]


def move_invoices_to_medicina(
    cur,
    conn,
    catalog_id: str,
    medicina_id: str,
    *,
    batch_size: int = 100,
) -> int:
    ids = fetch_invoice_ids_to_medicina(cur, catalog_id, medicina_id)
    if not ids:
        return 0
    moved = 0
    for start in range(0, len(ids), batch_size):
        chunk = ids[start : start + batch_size]
        cur.execute(
            """
            UPDATE invoices
            SET company_id = %s::uuid,
                number = 'TMP-MIG-' || replace(id::text, '-', ''),
                updated_at = now()
            WHERE id = ANY(%s::uuid[])
            """,
            (medicina_id, chunk),
        )
        moved += cur.rowcount
        conn.commit()
        if (start + batch_size) % 500 == 0 or start + batch_size >= len(ids):
            print(f"  facturas {min(start + batch_size, len(ids))}/{len(ids)}", flush=True)
    return moved


def move_linked_sales(cur, catalog_id: str, medicina_id: str) -> int:
    cur.execute(
        """
        UPDATE sales s
        SET company_id = %s::uuid
        FROM invoices i
        WHERE s.invoice_id = i.id
          AND i.company_id = %s::uuid
          AND s.company_id = %s::uuid
          AND NOT EXISTS (
            SELECT 1 FROM sales s2
            WHERE s2.company_id = %s::uuid
              AND s2.ticket_number = s.ticket_number
              AND s2.id <> s.id
          )
        """,
        (medicina_id, medicina_id, catalog_id, medicina_id),
    )
    return cur.rowcount


def reset_verifactu_state(cur, company_ids: list[str], dry_run: bool) -> None:
    cols = [
        "verifactu_status",
        "verifactu_hash",
        "verifactu_qr",
        "verifactu_qr_code",
        "verifactu_csv",
        "verifactu_sent_at",
        "verifactu_response_message",
        "verifactu_huella",
        "verifactu_numero_registro",
        "verifactu_fecha_hora_huella",
    ]
    cur.execute(
        """
        SELECT column_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name='invoices'
        """
    )
    existing = {r[0] for r in cur.fetchall()}
    sets = ["verifactu_status = 'pending'"]
    for c in cols[1:]:
        if c in existing:
            sets.append(f"{c} = NULL")
    sql = f"""
        UPDATE invoices
        SET {', '.join(sets)}
        WHERE company_id = ANY(%s::uuid[])
    """
    if dry_run:
        cur.execute(
            "SELECT count(*) FROM invoices WHERE company_id = ANY(%s::uuid[])",
            (company_ids,),
        )
        print(f"[dry-run] Reset Verifactu en {cur.fetchone()[0]} facturas")
        return
    cur.execute(sql, (company_ids,))
    print(f"Verifactu reseteado en {cur.rowcount} facturas")

    for table in ("verifactu_queue", "verifactu_xml_documents"):
        cur.execute(
            "SELECT to_regclass(%s)",
            (f"public.{table}",),
        )
        if not cur.fetchone()[0]:
            continue
        if dry_run:
            cur.execute(
                f"SELECT count(*) FROM {table} WHERE company_id = ANY(%s::uuid[])",
                (company_ids,),
            )
            print(f"[dry-run] Borraría {cur.fetchone()[0]} filas de {table}")
        else:
            cur.execute(
                f"DELETE FROM {table} WHERE company_id = ANY(%s::uuid[])",
                (company_ids,),
            )
            print(f"Eliminadas {cur.rowcount} filas de {table}")


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--catalog-company-id", default=DEFAULT_CATALOG)
    parser.add_argument("--medicina-company-id", default=DEFAULT_MEDICINA)
    args = parser.parse_args()

    db_url = os.environ.get("SUPABASE_DB_URL")
    if not db_url:
        sys.exit("Falta SUPABASE_DB_URL en .env")

    conn = psycopg2.connect(db_url)
    conn.autocommit = False
    cur = conn.cursor()

    # Asegurar funciones SQL (por si la migración aún no se aplicó vía supabase)
    sql_fn = (ROOT / "supabase/migrations/20260531200000_work_center_invoice_fiscal_split.sql").read_text(
        encoding="utf-8"
    )
    # Solo las funciones (primer bloque hasta RLS)
    fn_block = sql_fn.split("-- 3. RLS facturas")[0]
    if not args.dry_run:
        cur.execute(fn_block)

    catalog_id = args.catalog_company_id
    medicina_id = args.medicina_company_id
    wc_companies = [catalog_id, medicina_id]

    print("Contando facturas en Estética que deben ir a Medicina…")
    pending_count, pending_amount = count_invoices_to_medicina(cur, catalog_id, medicina_id)
    print(f"Facturas a mover a medicina: {pending_count} ({pending_amount:.2f} EUR)")

    if args.dry_run:
        reset_verifactu_state(cur, wc_companies, dry_run=True)
        conn.rollback()
        print("(dry-run: sin cambios)")
        return

    print("Resolviendo IDs a mover (puede tardar)…", flush=True)
    moved = move_invoices_to_medicina(cur, conn, catalog_id, medicina_id)
    sales_moved = move_linked_sales(cur, catalog_id, medicina_id)
    print(f"Facturas movidas a medicina: {moved}")
    print(f"Ventas TPV reasignadas: {sales_moved}")

    if moved:
        print("Renumerando facturas Medicina (evita solapes F{YYYY}-…)…", flush=True)
        import subprocess
        import sys

        ren = subprocess.run(
            [
                sys.executable,
                str(ROOT / "scripts" / "rebuild_legacy_invoices_sequential.py"),
                "--apply",
                "--company-id",
                medicina_id,
                "--scope",
                "company",
            ],
            cwd=str(ROOT),
            env=os.environ.copy(),
        )
        if ren.returncode != 0:
            raise SystemExit(f"Renumeración Medicina falló (código {ren.returncode})")

    reset_verifactu_state(cur, wc_companies, dry_run=False)

    conn.commit()
    print("Commit final OK.", flush=True)
    cur.execute(
        "SELECT company_id, count(*) FROM invoices WHERE company_id = ANY(%s::uuid[]) GROUP BY 1",
        (wc_companies,),
    )
    print("Distribución final:", cur.fetchall())
    conn.close()
    print("Migración completada.")


if __name__ == "__main__":
    main()
