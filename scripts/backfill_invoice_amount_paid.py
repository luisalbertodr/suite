"""
Rellena invoices.amount_paid desde paid_status, sales y legacy.faccab (impcob).

Requisitos: SUPABASE_DB_URL

Uso:
  python scripts/backfill_invoice_amount_paid.py
  python scripts/backfill_invoice_amount_paid.py --dry-run
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

ROOT = Path(__file__).resolve().parents[1]

BACKFILL_SQL = """
-- Pagadas al 100 %
UPDATE public.invoices i
SET amount_paid = COALESCE(i.total_amount, 0)
WHERE (i.paid_status IS TRUE OR lower(coalesce(i.status, '')) = 'paid')
  AND COALESCE(i.amount_paid, 0) < COALESCE(i.total_amount, 0) - 0.005;

-- Desde venta vinculada
UPDATE public.invoices i
SET amount_paid = LEAST(COALESCE(s.amount_paid, 0), COALESCE(i.total_amount, 0))
FROM public.sales s
WHERE s.invoice_id = i.id
  AND COALESCE(s.amount_paid, 0) > 0
  AND COALESCE(i.amount_paid, 0) < COALESCE(s.amount_paid, 0) - 0.005;

-- Legacy FACCAB rebuild (JSON key)
WITH rebuilt AS (
  SELECT i.id, (substring(i.notes FROM '"key":\\s*"([^"]+)"')) AS fac_key
  FROM public.invoices i
  WHERE i.notes LIKE 'Legacy FACCAB rebuild ·%%'
    AND substring(i.notes FROM '"key":\\s*"([^"]+)"') IS NOT NULL
),
faccab_cob AS (
  SELECT b.id AS invoice_id,
    LEAST(
      COALESCE(NULLIF(regexp_replace(btrim(f.impcob1::text), ',', '.', 'g'), '')::numeric, 0)
      + COALESCE(NULLIF(regexp_replace(btrim(f.impcob2::text), ',', '.', 'g'), '')::numeric, 0),
      (SELECT COALESCE(total_amount, 0) FROM public.invoices WHERE id = b.id)
    ) AS cobrado
  FROM rebuilt b
  JOIN legacy.faccab f ON (
    COALESCE(NULLIF(btrim(f.serfac::text), ''), 'A') = split_part(b.fac_key, '|', 1)
    AND btrim(f.ejefac::text) = split_part(b.fac_key, '|', 2)
    AND btrim(f.numfac::text) = split_part(b.fac_key, '|', 3)
  )
)
UPDATE public.invoices i SET amount_paid = fc.cobrado
FROM faccab_cob fc
WHERE i.id = fc.invoice_id
  AND fc.cobrado > COALESCE(i.amount_paid, 0) + 0.005;

-- Legacy sin cita
WITH sin_cita AS (
  SELECT i.id,
    trim(split_part(replace(i.notes, 'Factura legacy sin cita · key ', ''), '|', 1)) AS codcli,
    trim(split_part(replace(i.notes, 'Factura legacy sin cita · key ', ''), '|', 2)) AS fecfac,
    trim(split_part(replace(i.notes, 'Factura legacy sin cita · key ', ''), '|', 3)) AS numfac
  FROM public.invoices i
  WHERE i.notes LIKE 'Factura legacy sin cita · key %%'
),
faccab_cob AS (
  SELECT s.id AS invoice_id,
    LEAST(
      COALESCE(NULLIF(regexp_replace(btrim(f.impcob1::text), ',', '.', 'g'), '')::numeric, 0)
      + COALESCE(NULLIF(regexp_replace(btrim(f.impcob2::text), ',', '.', 'g'), '')::numeric, 0),
      (SELECT COALESCE(total_amount, 0) FROM public.invoices WHERE id = s.id)
    ) AS cobrado
  FROM sin_cita s
  JOIN legacy.faccab f ON (
    btrim(f.codcli::text) IN (s.codcli, ltrim(s.codcli, '0'), lpad(ltrim(s.codcli, '0'), 6, '0'))
    AND f.fecfac::text LIKE s.fecfac || '%%'
    AND btrim(f.numfac::text) = s.numfac
    AND COALESCE(NULLIF(btrim(f.serfac::text), ''), 'A') IN ('', 'A')
  )
)
UPDATE public.invoices i SET amount_paid = fc.cobrado
FROM faccab_cob fc
WHERE i.id = fc.invoice_id
  AND fc.cobrado > COALESCE(i.amount_paid, 0) + 0.005;
"""


def load_dotenv() -> None:
    env = ROOT / ".env"
    if not env.is_file():
        return
    for line in env.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"'))


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    dsn = os.environ.get("SUPABASE_DB_URL", "").strip()
    if not dsn:
        sys.exit("Falta SUPABASE_DB_URL")

    conn = psycopg2.connect(dsn)
    conn.autocommit = False
    cur = conn.cursor()
    cur.execute(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_schema='public' AND table_name='invoices' AND column_name='amount_paid'"
    )
    if not cur.fetchone():
        sys.exit("Falta columna amount_paid (aplica migración 20260604170000).")

    if args.dry_run:
        print("Ejecutaría backfill SQL (5 pasos).")
        conn.close()
        return

    for stmt in [s.strip() for s in BACKFILL_SQL.split(";") if s.strip()]:
        cur.execute(stmt)
        print(f"OK: {cur.rowcount} filas · {stmt[:60]}…")
    conn.commit()
    print("Backfill amount_paid completado.")
    conn.close()


if __name__ == "__main__":
    main()
