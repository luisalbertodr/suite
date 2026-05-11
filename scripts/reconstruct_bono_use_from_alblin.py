"""
Borrador: inserta filas en public.bono_uso a partir de líneas de albarán legacy
que referencian codboncli, agregando source_table = 'alblin' y source_legacy_key.

Requisitos:
  - legacy.alblin (o equivalente) con artículo/cantidad y codboncli
  - legacy.albcab (o albarán cabecera) con fecha
  - public.bonos.legacy_codboncli informado (promote_legacy_bonoscli)
  - Migración con columnas bono_uso.source_table, source_legacy_key, article_id, quantity

Variables: SUPABASE_DB_URL, LEGACY_COMPANY_ID, LEGACY_DRY_RUN, opcional ABLIN_CODBONCLI=campo
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import psycopg2

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


def table_exists(cur, schema: str, name: str) -> bool:
    cur.execute(
        """
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = %s AND table_name = %s
        """,
        (schema, name),
    )
    return cur.fetchone() is not None


def main() -> int:
    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_URL", "").strip()
    company_id = os.environ.get("LEGACY_COMPANY_ID", "").strip()
    dry = os.environ.get("LEGACY_DRY_RUN", "0").lower() in ("1", "true", "si", "yes")
    if not db_url or not company_id:
        print("Faltan SUPABASE_DB_URL o LEGACY_COMPANY_ID", file=sys.stderr)
        return 1

    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    try:
        for sch, name in (("legacy", "alblin"), ("legacy", "alblinlin")):
            if table_exists(cur, sch, name):
                print(
                    f"Encontrada tabla {sch}.{name}. "
                    "Ajusta el SQL de este script al esquema real (columnas codbon, fecha, codart, cant, etc.) "
                    "y vuelve a ejecutar. Este archivo es un esqueleto seguro, no modifica la BD mientras"
                    f" falle la detección de columnas."
                )
        print(
            "Paso 1: migración 20260425240000 aplicada (bono_uso.source_*).\n"
            "Paso 2: mapea legacy_codboncli -> bonos.id y alblin.fecha + líneas a artículo/cantidad.\n"
            "Paso 3: INSERT bono_id, fecha, article_id, quantity, source_table, source_legacy_key; "
            "respetar cap sesiones_usadas y marcar en bonos.data_quality si hay dudas."
        )
        if dry:
            conn.rollback()
        else:
            conn.rollback()
    finally:
        cur.close()
        conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
