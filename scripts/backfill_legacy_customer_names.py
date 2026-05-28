"""
Rellena public.customers.name con nomcli + ape1cli desde legacy.clientes.
"""
from __future__ import annotations

import os
from pathlib import Path

import psycopg2

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
        k = k.strip()
        v = v.strip().strip('"')
        if k and k not in os.environ:
            os.environ[k] = v


def main() -> None:
    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_URL", "").strip()
    company_id = get_company_id()
    if not db_url:
        raise SystemExit("Falta SUPABASE_DB_URL")

    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    cur.execute(
        """
        UPDATE public.customers c
        SET name = full_name, updated_at = now()
        FROM (
          SELECT
            trim(codcli) AS codcli,
            trim(
              concat_ws(
                ' ',
                nullif(trim(nomcli), ''),
                nullif(trim(ape1cli), '')
              )
            ) AS full_name
          FROM legacy.clientes
          WHERE trim(coalesce(codcli, '')) <> ''
        ) lc
        WHERE c.company_id = %s
          AND trim(c.legacy_codcli) = lc.codcli
          AND lc.full_name <> ''
          AND c.name IS DISTINCT FROM lc.full_name
        """,
        (company_id,),
    )
    print("Nombres actualizados:", cur.rowcount)
    conn.commit()
    conn.close()


if __name__ == "__main__":
    main()
