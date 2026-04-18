"""
Genera SQL: tablas legacy adicionales (todo el TXT menos oleada 1).

Uso:
  python scripts/build_legacy_wave2_migration.py > supabase/migrations/20260422140000_legacy_wave2_remaining.sql

Variables:
  STRUCTURA_TXT=ruta\\al\\ESTRUCTURA_COMPLETA_LIPOOUT.txt
"""
from __future__ import annotations

import sys

from legacy_structure import WAVE1_TABLES, load_tables_from_env, pg_table_name


def main() -> None:
    try:
        all_tables = load_tables_from_env()
    except FileNotFoundError as e:
        print(f"-- ERROR: no existe el archivo de estructura: {e}", file=sys.stderr)
        sys.exit(1)

    rest = sorted(t for t in all_tables if t not in WAVE1_TABLES)
    missing_wave1 = [t for t in sorted(WAVE1_TABLES) if t not in all_tables]
    if missing_wave1:
        print(f"-- ERROR: faltan tablas oleada 1 en el TXT: {missing_wave1}", file=sys.stderr)
        sys.exit(1)

    print("-- Oleada 2 legacy: resto de tablas del reporte ESTRUCTURA (incluye TMP, accesos, bancos, baremos, etc.)")
    print("-- Generado por scripts/build_legacy_wave2_migration.py")
    print()
    print("CREATE SCHEMA IF NOT EXISTS legacy;")
    print()
    print(
        "COMMENT ON SCHEMA legacy IS 'Volcado fiel Dunasoft/Style (oleada 1 + 2, resto tablas DBF). "
        "No exponer a API publica sin revision.';"
    )
    print()
    print("REVOKE ALL ON SCHEMA legacy FROM PUBLIC;")
    print("GRANT USAGE ON SCHEMA legacy TO postgres;")
    print("GRANT USAGE ON SCHEMA legacy TO service_role;")
    print()

    for t in rest:
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
