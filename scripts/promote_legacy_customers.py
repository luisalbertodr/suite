"""
Promociona legacy.clientes → public.customers (insert + update).

Campos:
  codcli      → legacy_codcli
  nomcli+ape1 → name
  tel1cli     → phone_home
  tel2cli     → phone_mobile
  COALESCE(tel2,tel1) → phone
  email       → email
  dnicli      → tax_id
  dircli      → address_street
  codposcli   → address_postal_code
  pobcli      → address_city
  procli      → address_state
  pais        → address_country
  percon      → contact_person
  obscli      → notes

Match fila existente (en orden):
  1. legacy_codcli exacto o sin ceros a la izquierda
  2. nombre completo único (solo si hay un solo cliente con ese nombre)

Evita violar customers_company_phone_norm_uidx al actualizar teléfonos.

Requisitos: SUPABASE_DB_URL, legacy.clientes importado.

Uso:
  python scripts/promote_legacy_customers.py
  python scripts/promote_legacy_customers.py --dry-run
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
    from psycopg2.extras import execute_batch
except ImportError:
    print("pip install psycopg2-binary", file=sys.stderr)
    raise

from legacy_company import DEFAULT_COMPANY_ID, get_company_id

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


def blank(v: object) -> str | None:
    s = str(v or "").strip()
    return s if s else None


def norm_codcli_key(cod: str) -> str:
    s = cod.strip()
    return s.lstrip("0") or "0"


def norm_name(name: str) -> str:
    return re.sub(r"\s+", " ", name.strip().lower())


def build_legacy_name(nom: object, ape1: object) -> str:
    parts = [blank(nom), blank(ape1)]
    return " ".join(p for p in parts if p)


def map_phones(tel1: object, tel2: object) -> tuple[str | None, str | None, str | None]:
    t1 = blank(tel1)
    t2 = blank(tel2)
    phone = t2 or t1
    return t1, t2, phone


def is_obsolete(flag: object) -> bool:
    s = str(flag or "").strip().lower()
    return s in ("1", "true", "si", "s", "x")


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--company-id",
        default=get_company_id(),
        help=f"UUID empresa (default: {DEFAULT_COMPANY_ID})",
    )
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    url = os.environ.get("SUPABASE_DB_URL", "").strip()
    if not url:
        sys.exit("Falta SUPABASE_DB_URL")

    conn = psycopg2.connect(url)
    conn.autocommit = False
    cur = conn.cursor()

    cur.execute(
        """
        SELECT
          codcli, nomcli, ape1cli, tel1cli, tel2cli,
          email, dnicli, dircli, codposcli, pobcli, procli, pais,
          percon, obscli, obsoleto
        FROM legacy.clientes
        WHERE NULLIF(btrim(codcli), '') IS NOT NULL
        ORDER BY codcli
        """
    )
    legacy_rows = cur.fetchall()

    cur.execute(
        """
        SELECT id, name, legacy_codcli
        FROM public.customers
        WHERE company_id = %s::uuid
        """,
        (args.company_id,),
    )
    existing = cur.fetchall()

    by_legacy_exact: dict[str, str] = {}
    by_legacy_norm: dict[str, str] = {}
    by_name: dict[str, list[str]] = {}

    for cid, name, legacy_cod in existing:
        sid = str(cid)
        lc = blank(legacy_cod)
        if lc:
            by_legacy_exact[lc] = sid
            by_legacy_norm[norm_codcli_key(lc)] = sid
        nk = norm_name(str(name or ""))
        if nk:
            by_name.setdefault(nk, []).append(sid)

    cur.execute(
        """
        SELECT phone_norm, id::text FROM public.customers
        WHERE company_id = %s::uuid AND phone_norm IS NOT NULL
        """,
        (args.company_id,),
    )
    phone_norm_owner: dict[str, str] = {str(pn): cid for pn, cid in cur.fetchall()}

    def phone_norm_for(home: str | None, mobile: str | None, phone: str | None) -> str | None:
        cur.execute(
            "SELECT public.customer_primary_phone_last9(%s, %s, %s)",
            (phone, mobile, home),
        )
        row = cur.fetchone()
        return row[0] if row and row[0] else None

    updates: list[tuple] = []
    inserts: list[tuple] = []
    skipped_phone = 0

    for row in legacy_rows:
        codcli = blank(row[0])
        if not codcli or is_obsolete(row[14]):
            continue

        name = build_legacy_name(row[1], row[2])
        if not name:
            continue

        phone_home, phone_mobile, phone = map_phones(row[3], row[4])
        notes = blank(row[13])
        email = blank(row[5])
        tax_id = blank(row[6])
        street = blank(row[7])
        postal = blank(row[8])
        city = blank(row[9])
        state = blank(row[10])
        country = blank(row[11]) or "España"
        contact = blank(row[12])

        target_id = by_legacy_exact.get(codcli) or by_legacy_norm.get(norm_codcli_key(codcli))
        if not target_id:
            ids = by_name.get(norm_name(name), [])
            if len(ids) == 1:
                target_id = ids[0]

        new_norm = phone_norm_for(phone_home, phone_mobile, phone)
        apply_phones = bool(new_norm or phone_home or phone_mobile or phone)

        if target_id:
            if new_norm and new_norm in phone_norm_owner and phone_norm_owner[new_norm] != target_id:
                apply_phones = False
                skipped_phone += 1
                phone_home = phone_mobile = phone = None

            updates.append(
                (
                    codcli,
                    name,
                    email,
                    tax_id,
                    street,
                    postal,
                    city,
                    state,
                    country,
                    contact,
                    notes,
                    apply_phones,
                    phone_home,
                    phone_mobile,
                    phone,
                    target_id,
                )
            )
            if apply_phones and new_norm:
                phone_norm_owner[new_norm] = target_id
            by_legacy_exact[codcli] = target_id
            by_legacy_norm[norm_codcli_key(codcli)] = target_id
        else:
            if new_norm and new_norm in phone_norm_owner:
                skipped_phone += 1
                phone_home = phone_mobile = phone = None
                new_norm = None

            new_id = str(uuid.uuid4())
            inserts.append(
                (
                    new_id,
                    args.company_id,
                    codcli,
                    name,
                    email,
                    tax_id,
                    street,
                    postal,
                    city,
                    state,
                    country,
                    contact,
                    notes,
                    phone_home,
                    phone_mobile,
                    phone,
                )
            )
            if new_norm:
                phone_norm_owner[new_norm] = new_id
            by_legacy_exact[codcli] = new_id
            by_legacy_norm[norm_codcli_key(codcli)] = new_id
            by_name.setdefault(norm_name(name), []).append(new_id)

    update_sql = """
    UPDATE public.customers SET
      legacy_codcli = %s,
      name = %s,
      email = COALESCE(%s, email),
      tax_id = COALESCE(%s, tax_id),
      address_street = COALESCE(%s, address_street),
      address_postal_code = COALESCE(%s, address_postal_code),
      address_city = COALESCE(%s, address_city),
      address_state = COALESCE(%s, address_state),
      address_country = COALESCE(%s, address_country),
      contact_person = COALESCE(%s, contact_person),
      notes = CASE
        WHEN %s IS NULL THEN notes
        WHEN notes IS NULL OR btrim(notes) = '' THEN %s
        WHEN position(lower(%s) in lower(notes)) > 0 THEN notes
        ELSE notes || E'\\n' || %s
      END,
      phone_home = CASE WHEN %s THEN %s ELSE phone_home END,
      phone_mobile = CASE WHEN %s THEN %s ELSE phone_mobile END,
      phone = CASE WHEN %s THEN %s ELSE phone END,
      updated_at = now()
    WHERE id = %s::uuid
    """

    update_params = []
    for u in updates:
        (
            codcli,
            name,
            email,
            tax_id,
            street,
            postal,
            city,
            state,
            country,
            contact,
            notes,
            apply_phones,
            ph_home,
            ph_mobile,
            ph,
            tid,
        ) = u
        update_params.append(
            (
                codcli,
                name,
                email,
                tax_id,
                street,
                postal,
                city,
                state,
                country,
                contact,
                notes,
                notes,
                notes,
                notes,
                apply_phones,
                ph_home,
                apply_phones,
                ph_mobile,
                apply_phones,
                ph,
                tid,
            )
        )

    insert_sql = """
    INSERT INTO public.customers (
      id, company_id, legacy_codcli, name, email, tax_id,
      address_street, address_postal_code, address_city, address_state, address_country,
      contact_person, notes, phone_home, phone_mobile, phone
    ) VALUES (
      %s::uuid, %s::uuid, %s, %s, %s, %s,
      %s, %s, %s, %s, %s,
      %s, %s, %s, %s, %s
    )
    """

    print(f"Filas legacy.clientes: {len(legacy_rows)}")
    print(f"Clientes existentes: {len(existing)}")
    print(f"Actualizaciones: {len(updates)}")
    print(f"Inserciones: {len(inserts)}")
    print(f"Teléfonos omitidos por duplicado: {skipped_phone}")

    if args.dry_run:
        conn.rollback()
        print("--dry-run: sin cambios.")
        cur.close()
        conn.close()
        return

    if update_params:
        execute_batch(cur, update_sql, update_params, page_size=500)
    if inserts:
        execute_batch(cur, insert_sql, inserts, page_size=500)

    conn.commit()
    print(f"OK: {len(updates)} actualizados, {len(inserts)} insertados.")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
