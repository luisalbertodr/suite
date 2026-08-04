"""
Vincula agenda_appointments.customer_id desde legacy_codcli / client_name → customers.

Para citas ya importadas sin customer_id (solo legacy_codcli / client_name).
Excluye fichas "Paciente InBody …" y prioriza coincidencia por nombre.

Requisitos: SUPABASE_DB_URL (en .env o entorno)

Uso:
  python scripts/link_agenda_customer_ids.py
  python scripts/link_agenda_customer_ids.py --dry-run
  python scripts/link_agenda_customer_ids.py --fix-wrong
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

INBODY_PLACEHOLDER_RE = r"^paciente[[:space:]]+in[[:space:]]*body"


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


LINK_BY_NAME_SQL = f"""
UPDATE public.agenda_appointments AS a
SET customer_id = pick.customer_id
FROM (
  SELECT DISTINCT ON (a2.id)
    a2.id AS appointment_id,
    c.id AS customer_id
  FROM public.agenda_appointments AS a2
  INNER JOIN public.customers AS c
    ON c.company_id = a2.company_id
   AND c.archived_at IS NULL
   AND NOT (c.name ~* '{INBODY_PLACEHOLDER_RE}')
   AND lower(btrim(c.name)) = lower(btrim(a2.client_name))
  WHERE a2.company_id = %s::uuid
    AND a2.customer_id IS NULL
    AND NULLIF(btrim(a2.client_name), '') IS NOT NULL
  ORDER BY a2.id, c.updated_at DESC
) AS pick
WHERE a.id = pick.appointment_id
"""

LINK_BY_CODCLI_SQL = f"""
UPDATE public.agenda_appointments AS a
SET customer_id = pick.customer_id
FROM (
  SELECT DISTINCT ON (a2.id)
    a2.id AS appointment_id,
    c.id AS customer_id
  FROM public.agenda_appointments AS a2
  INNER JOIN public.customers AS c
    ON c.company_id = a2.company_id
   AND c.archived_at IS NULL
   AND NOT (c.name ~* '{INBODY_PLACEHOLDER_RE}')
   AND NULLIF(btrim(c.legacy_codcli), '') IS NOT NULL
   AND (
     btrim(a2.legacy_codcli) = btrim(c.legacy_codcli)
     OR NULLIF(ltrim(btrim(a2.legacy_codcli), '0'), '') = NULLIF(ltrim(btrim(c.legacy_codcli), '0'), '')
   )
  WHERE a2.company_id = %s::uuid
    AND a2.customer_id IS NULL
    AND NULLIF(btrim(a2.legacy_codcli), '') IS NOT NULL
    AND btrim(a2.legacy_codcli) NOT IN ('0')
  ORDER BY
    a2.id,
    CASE
      WHEN NULLIF(btrim(a2.client_name), '') IS NOT NULL
       AND lower(btrim(c.name)) = lower(btrim(a2.client_name)) THEN 0
      ELSE 1
    END,
    c.updated_at DESC
) AS pick
WHERE a.id = pick.appointment_id
"""

FIX_WRONG_SQL = """
UPDATE public.agenda_appointments AS a
SET
  customer_id = public.resolve_agenda_customer_id(
    a.company_id,
    a.legacy_codcli,
    a.client_name,
    a.customer_id
  ),
  updated_at = now()
FROM public.customers AS wrong_c
WHERE a.company_id = %s::uuid
  AND a.customer_id = wrong_c.id
  AND wrong_c.name ~* %s
"""

COUNT_ELIGIBLE_SQL = f"""
SELECT count(*)::bigint
FROM public.agenda_appointments AS a
WHERE a.company_id = %s::uuid
  AND a.customer_id IS NULL
  AND (
    (
      NULLIF(btrim(a.client_name), '') IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.customers AS c
        WHERE c.company_id = a.company_id
          AND c.archived_at IS NULL
          AND NOT (c.name ~* '{INBODY_PLACEHOLDER_RE}')
          AND lower(btrim(c.name)) = lower(btrim(a.client_name))
      )
    )
    OR (
      NULLIF(btrim(a.legacy_codcli), '') IS NOT NULL
      AND btrim(a.legacy_codcli) NOT IN ('0')
      AND EXISTS (
        SELECT 1
        FROM public.customers AS c
        WHERE c.company_id = a.company_id
          AND c.archived_at IS NULL
          AND NOT (c.name ~* '{INBODY_PLACEHOLDER_RE}')
          AND NULLIF(btrim(c.legacy_codcli), '') IS NOT NULL
          AND (
            btrim(a.legacy_codcli) = btrim(c.legacy_codcli)
            OR NULLIF(ltrim(btrim(a.legacy_codcli), '0'), '') = NULLIF(ltrim(btrim(c.legacy_codcli), '0'), '')
          )
      )
    )
  )
"""


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser()
    ap.add_argument("--company-id", default=get_company_id(), help=f"UUID empresa (default: {DEFAULT_COMPANY_ID})")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument(
        "--fix-wrong",
        action="store_true",
        help="Re-enlaza citas con customer_id apuntando a placeholder InBody",
    )
    args = ap.parse_args()

    url = os.environ.get("SUPABASE_DB_URL", "").strip()
    if not url:
        sys.exit("Falta SUPABASE_DB_URL")

    conn = psycopg2.connect(url)
    conn.autocommit = True
    cur = conn.cursor()

    if args.dry_run:
        cur.execute(COUNT_ELIGIBLE_SQL, [args.company_id])
        print(f"Citas sin customer_id vinculables: {cur.fetchone()[0]}")
        if args.fix_wrong:
            cur.execute(
                """
                SELECT count(*)::bigint
                FROM public.agenda_appointments AS a
                INNER JOIN public.customers AS c ON c.id = a.customer_id
                WHERE a.company_id = %s::uuid
                  AND c.name ~* %s
                """,
                [args.company_id, INBODY_PLACEHOLDER_RE],
            )
            print(f"Citas con enlace erróneo a placeholder: {cur.fetchone()[0]}")
        cur.close()
        conn.close()
        return

    cur.execute(COUNT_ELIGIBLE_SQL, [args.company_id])
    eligible = cur.fetchone()[0]

    cur.execute(LINK_BY_NAME_SQL, [args.company_id])
    by_name = cur.rowcount
    cur.execute(LINK_BY_CODCLI_SQL, [args.company_id])
    by_codcli = cur.rowcount

    fixed_wrong = 0
    if args.fix_wrong:
        cur.execute(FIX_WRONG_SQL, [args.company_id, INBODY_PLACEHOLDER_RE])
        fixed_wrong = cur.rowcount

    print(f"Citas vinculables (estimado): {eligible}")
    print(f"Filas actualizadas por nombre: {by_name}")
    print(f"Filas actualizadas por codcli: {by_codcli}")
    if args.fix_wrong:
        print(f"Enlaces erróneos corregidos: {fixed_wrong}")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
