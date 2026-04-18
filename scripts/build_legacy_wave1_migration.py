"""
Genera SQL de migración: esquema legacy + tablas oleada 1 (columnas TEXT desde ESTRUCTURA_COMPLETA_LIPOOUT.txt).

Uso:
  python scripts/build_legacy_wave1_migration.py > supabase/migrations/20260420120000_legacy_wave1.sql

Variables opcionales:
  STRUCTURA_TXT=ruta\\al\\ESTRUCTURA_COMPLETA_LIPOOUT.txt  (por defecto E:\\APP Lipoout\\dbf\\...)
"""
from __future__ import annotations

import sys

from legacy_structure import WAVE1_IMPORT_ORDER, WAVE1_TABLES, load_tables_from_env, pg_table_name


def main() -> None:
    try:
        all_tables = load_tables_from_env()
    except FileNotFoundError as e:
        print(f"-- ERROR: no existe el archivo de estructura: {e}", file=sys.stderr)
        sys.exit(1)

    missing = [t for t in sorted(WAVE1_TABLES) if t not in all_tables]
    if missing:
        print(f"-- ERROR: tablas no encontradas en el TXT: {missing}", file=sys.stderr)
        sys.exit(1)

    wave1_ordered = [rel.upper() for rel, _ in WAVE1_IMPORT_ORDER]

    print("-- Oleada 1 legacy: maestros + agenda + planinc + bonos cliente + facturas (sin TMP)")
    print("-- Generado por scripts/build_legacy_wave1_migration.py")
    print()
    print("CREATE SCHEMA IF NOT EXISTS legacy;")
    print()
    print("COMMENT ON SCHEMA legacy IS 'Volcado fiel Dunasoft/Style (oleada 1). No exponer a API publica sin revision.';")
    print()
    print("REVOKE ALL ON SCHEMA legacy FROM PUBLIC;")
    print("GRANT USAGE ON SCHEMA legacy TO postgres;")
    print("GRANT USAGE ON SCHEMA legacy TO service_role;")
    print()

    for t in wave1_ordered:
        cols = all_tables[t]
        rel = pg_table_name(t)
        col_sql = ",\n  ".join([f"{c} text" for c in cols])
        print(f"CREATE TABLE IF NOT EXISTS legacy.{rel} (")
        print(f"  {col_sql},")
        print("  import_batch text NOT NULL DEFAULT '',")
        print("  imported_at timestamptz NOT NULL DEFAULT now()")
        print(");")
        print()
        print(f"CREATE INDEX IF NOT EXISTS idx_legacy_{rel}_imported_at ON legacy.{rel} (imported_at);")
        print()


if __name__ == "__main__":
    main()
