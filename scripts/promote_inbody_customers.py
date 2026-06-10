"""
Crea fichas customers para inbody_user_id sin customer_id y re-vincula mediciones.

Usa legacy.clientes para el nombre cuando el DNI coincide.

Uso:
  python scripts/promote_inbody_customers.py
  python scripts/promote_inbody_customers.py --dry-run
  python scripts/promote_inbody_customers.py --source lookinbody_dbbackup_csv
"""
from __future__ import annotations

import argparse
import os
import re
import sys
import uuid
from pathlib import Path

try:
    import psycopg2
except ImportError:
    print("pip install psycopg2-binary", file=sys.stderr)
    raise

from legacy_company import get_company_id

ROOT = Path(__file__).resolve().parents[1]
SPANISH_DNI_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE"


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


def dni_match_keys(value: object) -> list[str]:
    raw = re.sub(r"[\s\-.]", "", str(value or ""))
    s = raw.upper()
    if not s:
        return []
    keys = {s, raw}
    m = re.match(r"^(\d{7,8})([A-Z])?$", s)
    if m:
        num = m.group(1).zfill(8)
        keys.add(num)
        stripped = num.lstrip("0") or "0"
        keys.add(stripped)
        keys.add(stripped.zfill(8))
    m = re.match(r"^([XYZ]\d{7})([A-Z])?$", s)
    if m:
        keys.add(m.group(1))
    return list(keys)


def load_customer_map(cur, company_id: str) -> dict[str, str]:
    cur.execute(
        """
        SELECT id, tax_id
        FROM public.customers
        WHERE company_id = %s::uuid AND tax_id IS NOT NULL AND btrim(tax_id) <> ''
        """,
        (company_id,),
    )
    out: dict[str, str] = {}
    for cid, tax_id in cur.fetchall():
        for key in dni_match_keys(tax_id):
            if key not in out:
                out[key] = str(cid)
    return out


def find_customer_id(user_id: object, lookup: dict[str, str]) -> str | None:
    for key in dni_match_keys(user_id):
        cid = lookup.get(key)
        if cid:
            return cid
    return None


def norm_tax_id(value: object) -> str:
    return re.sub(r"[\s\-.]", "", str(value or "")).upper()


def complete_spanish_dni(user_id: str) -> str:
    norm = norm_tax_id(user_id)
    if re.fullmatch(r"\d{7,8}", norm):
        num = int(norm.zfill(8))
        return f"{norm.zfill(8)}{SPANISH_DNI_LETTERS[num % 23]}"
    return norm


def legacy_name(cur, tax_id: str) -> str | None:
    cur.execute(
        """
        SELECT nullif(trim(concat_ws(' ', nullif(trim(nomcli), ''), nullif(trim(ape1cli), ''))), '')
        FROM legacy.clientes
        WHERE nullif(btrim(dnicli), '') IS NOT NULL
          AND (
            lower(regexp_replace(dnicli, '[\\s\\-.]', '', 'g'))
              = lower(regexp_replace(%s, '[\\s\\-.]', '', 'g'))
            OR regexp_replace(dnicli, '\\D', '', 'g') = regexp_replace(%s, '\\D', '', 'g')
          )
        ORDER BY length(trim(concat_ws(' ', nomcli, ape1cli))) DESC
        LIMIT 1
        """,
        (tax_id, tax_id),
    )
    row = cur.fetchone()
    return row[0] if row and row[0] else None


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(description="Crear customers desde InBody sin ficha")
    parser.add_argument("--company-id", default=get_company_id())
    parser.add_argument("--source", default=None, help="Filtrar inbody_measurements.source")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    db_url = os.environ.get("SUPABASE_DB_URL")
    if not db_url:
        print("Falta SUPABASE_DB_URL", file=sys.stderr)
        sys.exit(1)

    conn = psycopg2.connect(db_url)
    try:
        with conn.cursor() as cur:
            customer_map = load_customer_map(cur, args.company_id)

            sql = """
                SELECT DISTINCT inbody_user_id
                FROM public.inbody_measurements
                WHERE company_id = %s::uuid
                  AND customer_id IS NULL
                  AND nullif(btrim(inbody_user_id), '') IS NOT NULL
            """
            params: list[object] = [args.company_id]
            if args.source:
                sql += " AND source = %s"
                params.append(args.source)
            cur.execute(sql, params)
            user_ids = [row[0] for row in cur.fetchall()]

            created = 0
            linked = 0
            for user_id in user_ids:
                tax_id = complete_spanish_dni(user_id)
                existing = find_customer_id(user_id, customer_map) or find_customer_id(tax_id, customer_map)
                if existing:
                    linked += 1
                    if not args.dry_run:
                        cur.execute(
                            """
                            UPDATE public.inbody_measurements
                            SET customer_id = %s::uuid, updated_at = now()
                            WHERE company_id = %s::uuid
                              AND customer_id IS NULL
                              AND inbody_user_id = %s
                            """,
                            (existing, args.company_id, user_id),
                        )
                    continue

                name = legacy_name(cur, tax_id) or f"Paciente InBody {tax_id}"
                new_id = str(uuid.uuid4())
                if args.dry_run:
                    print(f"CREATE {tax_id} -> {name}")
                    created += 1
                    continue

                cur.execute(
                    """
                    INSERT INTO public.customers (id, company_id, name, tax_id)
                    VALUES (%s::uuid, %s::uuid, %s, %s)
                    ON CONFLICT DO NOTHING
                    RETURNING id
                    """,
                    (new_id, args.company_id, name, tax_id.lower()),
                )
                row = cur.fetchone()
                if row:
                    cid = str(row[0])
                    created += 1
                else:
                    cur.execute(
                        """
                        SELECT id FROM public.customers
                        WHERE company_id = %s::uuid AND lower(tax_id) = lower(%s)
                        LIMIT 1
                        """,
                        (args.company_id, tax_id),
                    )
                    found = cur.fetchone()
                    if not found:
                        continue
                    cid = str(found[0])
                    linked += 1

                for key in dni_match_keys(user_id):
                    customer_map[key] = cid
                for key in dni_match_keys(tax_id):
                    customer_map[key] = cid

                cur.execute(
                    """
                    UPDATE public.inbody_measurements
                    SET customer_id = %s::uuid, updated_at = now()
                    WHERE company_id = %s::uuid
                      AND customer_id IS NULL
                      AND inbody_user_id = %s
                    """,
                    (cid, args.company_id, user_id),
                )

            if not args.dry_run:
                conn.commit()
            print(f"Usuarios InBody sin ficha: {len(user_ids)}")
            print(f"Fichas creadas: {created}, vinculadas: {linked}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
