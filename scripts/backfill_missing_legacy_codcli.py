#!/usr/bin/env python3
"""Asigna legacy_codcli a clientes sin código (misma lógica que el trigger de alta).

Útil tras altas manuales o imports que dejaron legacy_codcli vacío.
Por defecto dry-run; usar --apply para escribir.

Requisitos: SUPABASE_DB_URL
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


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser()
    ap.add_argument("--company-id", default=get_company_id())
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    url = os.environ.get("SUPABASE_DB_URL", "").strip()
    if not url:
        sys.exit("Falta SUPABASE_DB_URL")

    conn = psycopg2.connect(url)
    conn.autocommit = False
    cur = conn.cursor()
    cur.execute(
        """
        SELECT id::text, name
        FROM public.customers
        WHERE company_id = %s::uuid
          AND (legacy_codcli IS NULL OR btrim(legacy_codcli) = '')
        ORDER BY created_at NULLS LAST, id
        """,
        (args.company_id,),
    )
    rows = cur.fetchall()
    print(f"Clientes sin legacy_codcli: {len(rows)}")
    updated = 0
    for cid, name in rows:
        cur.execute("SELECT public.generate_legacy_codcli(%s::uuid)", (args.company_id,))
        code = cur.fetchone()[0]
        cur.execute(
            """
            UPDATE public.customers
            SET legacy_codcli = %s, updated_at = now()
            WHERE id = %s::uuid
            """,
            (code, cid),
        )
        updated += 1
        print(f"  {cid[:8]}… {name!r} -> {code}")

    if not args.apply:
        conn.rollback()
        print(f"--dry-run: {updated} asignaciones simuladas (pasa --apply para escribir)")
        return

    conn.commit()
    print(f"Actualizados: {updated}")


if __name__ == "__main__":
    main()
