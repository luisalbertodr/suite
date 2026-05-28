"""
Asigna billing_company_id de estética a todas las familias y artículos del tenant operativo.

Los recursos/cabinas de agenda no tienen empresa emisora (son operativos compartidos).

Variables (.env):
  SUPABASE_DB_URL
  LEGACY_COMPANY_ID / PROMOTE_COMPANY_ID  — tenant operativo (catálogo)
  ESTETICA_BILLING_COMPANY_ID             — emisor estética (default: mismo que tenant)

Uso:
  python scripts/assign_billing_estetica.py
  python scripts/assign_billing_estetica.py --dry-run
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

try:
    import psycopg2
except ImportError:
    print("pip install psycopg2-binary", file=sys.stderr)
    raise

from legacy_company import DEFAULT_COMPANY_ID, get_company_id

ROOT = Path(__file__).resolve().parents[1]

# María del Mar Lamas Pernas (estética / tenant operativo por defecto)
DEFAULT_ESTETICA_ID = DEFAULT_COMPANY_ID


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


def column_exists(cur, table: str, column: str) -> bool:
    cur.execute(
        """
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = %s
          AND column_name = %s
        """,
        (table, column),
    )
    return cur.fetchone() is not None


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser(description="Asigna emisor estética a familias y artículos")
    ap.add_argument(
        "--company-id",
        default=get_company_id(),
        help=f"Tenant operativo del catálogo (default: {DEFAULT_COMPANY_ID})",
    )
    ap.add_argument(
        "--billing-company-id",
        default=os.environ.get("ESTETICA_BILLING_COMPANY_ID", DEFAULT_ESTETICA_ID).strip(),
        help="UUID empresa emisora estética",
    )
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    url = os.environ.get("SUPABASE_DB_URL", "").strip()
    if not url:
        sys.exit("Falta SUPABASE_DB_URL en .env")

    conn = psycopg2.connect(url)
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, name, short_name FROM public.companies WHERE id = %s",
                (args.billing_company_id,),
            )
            billing_row = cur.fetchone()
            if not billing_row:
                sys.exit(f"No existe la empresa emisora {args.billing_company_id}")

            cur.execute("SELECT id, name FROM public.companies WHERE id = %s", (args.company_id,))
            host_row = cur.fetchone()
            if not host_row:
                sys.exit(f"No existe el tenant operativo {args.company_id}")

            billing_label = billing_row[2] or billing_row[1]
            host_label = host_row[1]
            print(f"Tenant operativo: {host_label} ({args.company_id})")
            print(f"Emisor estética:  {billing_label} ({args.billing_company_id})")

            if not column_exists(cur, "article_families", "billing_company_id"):
                sys.exit(
                    "Falta la columna article_families.billing_company_id. "
                    "Aplica la migración 20260515120000_work_center_split_billing.sql"
                )
            if not column_exists(cur, "articles", "billing_company_id"):
                sys.exit(
                    "Falta la columna articles.billing_company_id. "
                    "Aplica la migración 20260515120000_work_center_split_billing.sql"
                )

            cur.execute(
                "SELECT COUNT(*) FROM public.article_families WHERE company_id = %s",
                (args.company_id,),
            )
            families_total = cur.fetchone()[0]
            cur.execute(
                "SELECT COUNT(*) FROM public.articles WHERE company_id = %s",
                (args.company_id,),
            )
            articles_total = cur.fetchone()[0]
            cur.execute(
                "SELECT COUNT(*) FROM public.recursos WHERE company_id = %s",
                (args.company_id,),
            )
            recursos_total = cur.fetchone()[0]
            cur.execute(
                "SELECT COUNT(*) FROM public.cabinas WHERE company_id = %s",
                (args.company_id,),
            )
            cabinas_total = cur.fetchone()[0]

            print(f"Familias: {families_total} · Artículos: {articles_total}")
            print(f"Recursos agenda: {recursos_total} · Cabinas: {cabinas_total} (sin emisor; compartidos)")

            if args.dry_run:
                cur.execute(
                    """
                    SELECT COUNT(*) FROM public.article_families
                    WHERE company_id = %s
                      AND (billing_company_id IS DISTINCT FROM %s)
                    """,
                    (args.company_id, args.billing_company_id),
                )
                families_to_update = cur.fetchone()[0]
                cur.execute(
                    """
                    SELECT COUNT(*) FROM public.articles
                    WHERE company_id = %s
                      AND (billing_company_id IS DISTINCT FROM %s)
                    """,
                    (args.company_id, args.billing_company_id),
                )
                articles_to_update = cur.fetchone()[0]
                print(f"[dry-run] Familias a actualizar: {families_to_update}")
                print(f"[dry-run] Artículos a actualizar: {articles_to_update}")
                conn.rollback()
                return

            cur.execute("ALTER TABLE public.article_families DISABLE TRIGGER USER")
            cur.execute("ALTER TABLE public.articles DISABLE TRIGGER USER")
            try:
                cur.execute(
                    """
                    UPDATE public.article_families
                    SET billing_company_id = %s
                    WHERE company_id = %s
                    """,
                    (args.billing_company_id, args.company_id),
                )
                families_updated = cur.rowcount
                cur.execute(
                    """
                    UPDATE public.articles
                    SET billing_company_id = %s
                    WHERE company_id = %s
                    """,
                    (args.billing_company_id, args.company_id),
                )
                articles_updated = cur.rowcount
            finally:
                cur.execute("ALTER TABLE public.article_families ENABLE TRIGGER USER")
                cur.execute("ALTER TABLE public.articles ENABLE TRIGGER USER")

            conn.commit()
            print(f"Actualizadas {families_updated} familias y {articles_updated} articulos a estetica")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
