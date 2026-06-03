"""
Rellena public.customers.birth_date desde legacy.clientes.fecnac (Dunasoft).

Opcional: reimportar CLIENTES.DBF antes (--dbf-dir).

Requisitos: SUPABASE_DB_URL, legacy.clientes con fecnac.

Uso:
  python scripts/backfill_customer_birth_dates.py
  python scripts/backfill_customer_birth_dates.py --dbf-dir "C:\\Users\\OportoW11\\Suite\\Dunasoft\\dbf"
  python scripts/backfill_customer_birth_dates.py --dry-run
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

try:
    import psycopg2
    from psycopg2.extras import execute_batch
except ImportError:
    print("pip install psycopg2-binary", file=sys.stderr)
    raise

from legacy_birth_date import parse_fecnac_to_ymd
from legacy_company import get_company_id

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


def reimport_clientes_dbf(dbf_dir: Path, encoding: str) -> None:
    from legacy_dbf_import_wave1 import import_one

    for name in ("CLIENTES.DBF", "clientes.dbf", "clientes.BAK"):
        if (dbf_dir / name).is_file():
            dbf_name = name
            break
    else:
        raise SystemExit(f"No se encontró CLIENTES.DBF en {dbf_dir}")

    url = os.environ.get("SUPABASE_DB_URL", "").strip()
    if not url:
        raise SystemExit("Falta SUPABASE_DB_URL")
    batch = os.environ.get("IMPORT_BATCH", "birth-date-backfill").strip() or "birth-date-backfill"
    conn = psycopg2.connect(url)
    conn.autocommit = False
    cur = conn.cursor()
    try:
        n = import_one(cur, dbf_dir, "clientes", dbf_name, batch, encoding)
        conn.commit()
        print(f"OK: legacy.clientes reimportado ({n} filas) desde {dbf_dir / dbf_name}")
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser()
    ap.add_argument("--company-id", default=get_company_id())
    ap.add_argument(
        "--dbf-dir",
        default=os.environ.get(
            "LEGACY_DBF_DIR",
            r"C:\Users\OportoW11\Suite\Dunasoft\dbf",
        ),
        help="Si se indica, reimporta CLIENTES.DBF antes del backfill",
    )
    ap.add_argument("--skip-dbf", action="store_true", help="No reimportar DBF")
    ap.add_argument("--encoding", default=os.environ.get("LEGACY_DBF_ENCODING", "cp1252"))
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if not args.skip_dbf and args.dbf_dir:
        reimport_clientes_dbf(Path(args.dbf_dir), args.encoding)

    url = os.environ.get("SUPABASE_DB_URL", "").strip()
    if not url:
        sys.exit("Falta SUPABASE_DB_URL")

    conn = psycopg2.connect(url)
    conn.autocommit = False
    cur = conn.cursor()

    cur.execute(
        """
        SELECT c.id::text, c.legacy_codcli, l.fecnac, c.birth_date::text
        FROM public.customers c
        JOIN legacy.clientes l ON (
          l.codcli = c.legacy_codcli
          OR ltrim(l.codcli, '0') = ltrim(c.legacy_codcli, '0')
        )
        WHERE c.company_id = %s::uuid
          AND NULLIF(btrim(l.fecnac), '') IS NOT NULL
        """,
        (args.company_id,),
    )
    rows = cur.fetchall()

    updates: list[tuple[str, str]] = []
    skipped_parse = 0
    skipped_has_date = 0

    for cid, _cod, fecnac, existing in rows:
        ymd = parse_fecnac_to_ymd(fecnac)
        if not ymd:
            skipped_parse += 1
            continue
        if existing and str(existing)[:10] == ymd:
            skipped_has_date += 1
            continue
        updates.append((ymd, cid))

    print(f"Filas legacy con fecnac enlazadas: {len(rows)}")
    print(f"Actualizaciones birth_date: {len(updates)}")
    print(f"Omitidas (parseo fallido): {skipped_parse}")
    print(f"Omitidas (ya correctas): {skipped_has_date}")

    if args.dry_run:
        conn.rollback()
        print("--dry-run: sin cambios.")
        return

    if updates:
        execute_batch(
            cur,
            """
            UPDATE public.customers
            SET birth_date = %s::date, updated_at = now()
            WHERE id = %s::uuid
            """,
            updates,
            page_size=500,
        )
    conn.commit()
    print("OK.")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
