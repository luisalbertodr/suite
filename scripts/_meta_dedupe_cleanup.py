"""One-off: limpia los duplicados creados por la primera sync de Meta.

Reglas:
- Sólo mira leads recientes con source in (meta/facebook/instagram).
- Empareja con leads más antiguos por phone (últimos 9 dígitos) o email.
- Si hay match, copia el external_id de Meta al antiguo (sólo si el antiguo
  no tiene external_id) y borra el nuevo.
- Si no hay match (es un lead Meta realmente nuevo), lo deja tal cual.

Uso: python scripts/_meta_dedupe_cleanup.py [--dry-run]
"""

from __future__ import annotations

import argparse
import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import Optional

import psycopg2
from psycopg2.extras import RealDictCursor


def load_db_url() -> str:
    root = Path(__file__).resolve().parents[1]
    env_path = root / ".env"
    if not env_path.exists():
        raise SystemExit(".env no encontrado en la raíz del repo")
    for line in env_path.read_text(encoding="utf-8").splitlines():
        s = line.strip()
        if s.startswith("SUPABASE_DB_URL="):
            return s.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("SUPABASE_DB_URL no encontrada en .env")


META_SOURCES = ("meta", "facebook", "instagram")
RECENT_INTERVAL = "interval '2 hours'"

PHONE_RE = re.compile(r"\D")


def norm_phone(p: Optional[str]) -> Optional[str]:
    if not p:
        return None
    d = PHONE_RE.sub("", p)
    return d if len(d) >= 7 else None


def norm_email(e: Optional[str]) -> Optional[str]:
    if not e:
        return None
    n = e.strip().lower()
    return n or None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Solo informa, no toca BD")
    args = parser.parse_args()

    db_url = load_db_url()
    with psycopg2.connect(db_url) as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Cargamos los leads recientes (candidatos a duplicado).
            cur.execute(
                f"""
                SELECT id, company_id, source, external_id, phone, email,
                       created_at, stage_id
                FROM public.marketing_leads
                WHERE source = ANY(%s)
                  AND created_at > now() - {RECENT_INTERVAL}
                ORDER BY company_id, created_at
                """,
                (list(META_SOURCES),),
            )
            recent_rows = cur.fetchall()
            if not recent_rows:
                print("Sin leads recientes de Meta. Nada que hacer.")
                return 0

            company_ids = sorted({r["company_id"] for r in recent_rows})
            print(
                f"Encontrados {len(recent_rows)} leads recientes de Meta en "
                f"{len(company_ids)} empresa(s)."
            )

            # Cargamos los leads "antiguos" (todo lo que NO está en la ventana reciente)
            # de las empresas afectadas, para construir el índice de match.
            cur.execute(
                f"""
                SELECT id, company_id, source, external_id, phone, email, created_at,
                       stage_id
                FROM public.marketing_leads
                WHERE company_id = ANY(%s::uuid[])
                  AND (
                    created_at <= now() - {RECENT_INTERVAL}
                    OR source <> ALL(%s)
                  )
                """,
                ([str(c) for c in company_ids], list(META_SOURCES)),
            )
            old_rows = cur.fetchall()
            print(f"Leads antiguos contra los que comparar: {len(old_rows)}")

            # Índices: (company_id, key) -> id_antiguo (el más reciente entre los antiguos).
            phone_idx: dict[tuple[str, str], str] = {}
            phone9_idx: dict[tuple[str, str], str] = {}
            email_idx: dict[tuple[str, str], str] = {}
            ext_idx: dict[tuple[str, str], dict] = {}
            old_by_id: dict[str, dict] = {}

            for o in old_rows:
                old_by_id[o["id"]] = o
                cid = o["company_id"]
                if o["external_id"]:
                    ext_idx[(cid, o["external_id"])] = o
                np = norm_phone(o["phone"])
                if np:
                    phone_idx[(cid, np)] = o["id"]
                    phone9_idx[(cid, np[-9:])] = o["id"]
                ne = norm_email(o["email"])
                if ne:
                    email_idx[(cid, ne)] = o["id"]

            to_delete: list[str] = []
            backfill: list[tuple[str, str]] = []  # (old_id, meta_external_id)
            stats = defaultdict(int)

            for n in recent_rows:
                cid = n["company_id"]
                np = norm_phone(n["phone"])
                ne = norm_email(n["email"])

                match_id: Optional[str] = None
                if np:
                    match_id = (
                        phone_idx.get((cid, np))
                        or phone9_idx.get((cid, np[-9:]))
                    )
                if not match_id and ne:
                    match_id = email_idx.get((cid, ne))

                if match_id:
                    old = old_by_id.get(match_id, {})
                    to_delete.append(n["id"])
                    if n["external_id"] and not old.get("external_id"):
                        backfill.append((match_id, n["external_id"]))
                    stats["dup_found"] += 1
                else:
                    stats["genuine_new"] += 1

            print(
                f"\nResultado del análisis:\n"
                f"  Duplicados detectados (a borrar): {stats['dup_found']}\n"
                f"  Leads realmente nuevos (se conservan): {stats['genuine_new']}\n"
                f"  Backfills de external_id a leads antiguos: {len(backfill)}"
            )

            if args.dry_run:
                print("\n[dry-run] No se realiza ningún cambio.")
                # Muestra hasta 10 ejemplos
                for old_id, ext in backfill[:10]:
                    o = old_by_id.get(old_id, {})
                    print(f"  backfill old={old_id} phone={o.get('phone')} -> ext={ext}")
                return 0

            # Backfill primero (importa antes de borrar para no perder el dato).
            for old_id, ext in backfill:
                cur.execute(
                    """
                    UPDATE public.marketing_leads
                    SET external_id = %s
                    WHERE id = %s AND external_id IS NULL
                    """,
                    (ext, old_id),
                )

            # Borrar los duplicados.
            if to_delete:
                cur.execute(
                    "DELETE FROM public.marketing_leads WHERE id = ANY(%s::uuid[])",
                    ([str(x) for x in to_delete],),
                )

        conn.commit()
    print("\nLimpieza completada.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
