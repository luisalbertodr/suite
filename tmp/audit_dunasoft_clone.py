"""Compara DBF local vs schemas legacy/dunasoft en Postgres."""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

try:
    from dbfread import DBF
except ImportError:
    print("pip install dbfread psycopg2-binary", file=sys.stderr)
    raise

import psycopg2
from psycopg2.extras import RealDictCursor

ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / ".env"
DBF_DIR = Path(r"C:\Duna\260603-Style-Dunasoft\dbf")
MIG_DIR = ROOT / "supabase" / "migrations"

AGENDA_CORE = [
    "plan2009",
    "planinc",
    "planart",
    "planificador",
    "obsplan",
    "plansms",
    "plantmp",
    "agenda",
    "agendaart",
    "empleados",
    "recursos",
    "clientes",
    "articulos",
    "festivos",
    "smsauto",
    "smsautoreg",
]

MISSING_FROM_MIGRATIONS = [
    "acuenta",
    "bonosart1",
    "carcli",
    "carpro",
    "cielin",
    "clifamilia",
    "cobros",
    "gaslin",
    "inventario",
    "kits",
    "menus",
    "ofertasart",
    "pagos",
    "rangos",
    "remesas",
    "remrec",
    "resumendia",
    "tallasart",
    "ticketprel",
]


def load_dotenv() -> None:
    if not ENV_PATH.is_file():
        return
    for line in ENV_PATH.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k, v = k.strip(), v.strip().strip('"')
        if k and k not in os.environ:
            os.environ[k] = v


def dbf_count(name: str) -> int | None:
    path = DBF_DIR / f"{name.upper()}.DBF"
    if not path.is_file():
        return None
    try:
        return len(DBF(str(path), ignore_missing_memofile=True, encoding="cp1252"))
    except Exception as exc:
        print(f"  WARN dbf {name}: {exc}")
        return None


def legacy_tables_from_migrations() -> set[str]:
    tables: set[str] = set()
    for p in MIG_DIR.glob("*.sql"):
        text = p.read_text(encoding="utf-8", errors="replace")
        tables.update(re.findall(r"CREATE TABLE IF NOT EXISTS legacy\.(\w+)", text, re.I))
    return tables


def schema_tables(cur, schema: str) -> list[str]:
    cur.execute(
        """
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = %s AND table_type = 'BASE TABLE'
        ORDER BY table_name
        """,
        (schema,),
    )
    return [r["table_name"] for r in cur.fetchall()]


def table_count(cur, schema: str, table: str) -> int | None:
    try:
        cur.execute(f'SELECT COUNT(*) AS n FROM "{schema}"."{table}"')
        return int(cur.fetchone()["n"])
    except Exception as exc:
        conn.rollback()
        print(f"  WARN count {schema}.{table}: {exc}")
        return None


def main() -> None:
    load_dotenv()
    url = os.environ.get("SUPABASE_DB_URL", "").strip()
    if not url:
        raise SystemExit("Falta SUPABASE_DB_URL")

    dbfs = sorted({f.stem.lower() for f in DBF_DIR.glob("*.dbf")})
    legacy_mig = legacy_tables_from_migrations()

    print("=== Archivos DBF locales ===")
    print(f"Directorio: {DBF_DIR}")
    print(f"Tablas DBF (.dbf): {len(dbfs)}")

    print("\n=== Migraciones repo (legacy.*) ===")
    print(f"Tablas definidas: {len(legacy_mig)}")
    missing_mig = sorted(set(dbfs) - legacy_mig)
    print(f"DBF sin migración legacy ({len(missing_mig)}): {', '.join(t.upper() for t in missing_mig)}")

    conn = psycopg2.connect(url, connect_timeout=20)
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute(
        """
        SELECT schema_name FROM information_schema.schemata
        WHERE schema_name IN ('legacy', 'dunasoft')
        ORDER BY 1
        """
    )
    schemas = [r["schema_name"] for r in cur.fetchall()]
    print("\n=== Schemas en Postgres ===")
    print("Presentes:", schemas if schemas else "(ninguno legacy/dunasoft)")

    schema_data: dict[str, list[str]] = {}
    for schema in ("legacy", "dunasoft"):
        if schema not in schemas:
            continue
        schema_data[schema] = schema_tables(cur, schema)
        print(f"{schema}: {len(schema_data[schema])} tablas")

    if "dunasoft" in schema_data and "legacy" in schema_data:
        d_only = sorted(set(schema_data["dunasoft"]) - set(schema_data["legacy"]))
        l_only = sorted(set(schema_data["legacy"]) - set(schema_data["dunasoft"]))
        if d_only:
            print(f"Solo en dunasoft ({len(d_only)}): {', '.join(d_only[:20])}{'...' if len(d_only)>20 else ''}")
        if l_only:
            print(f"Solo en legacy ({len(l_only)}): {', '.join(l_only[:20])}{'...' if len(l_only)>20 else ''}")

    compare_schema = "dunasoft" if "dunasoft" in schema_data else "legacy" if "legacy" in schema_data else None
    if not compare_schema:
        print("\nNo hay datos legacy/dunasoft en Postgres para comparar filas.")
        conn.close()
        return

    pg_tables = set(schema_data[compare_schema])
    dbf_missing_pg = sorted(set(dbfs) - pg_tables)
    pg_missing_dbf = sorted(pg_tables - set(dbfs))

    print(f"\n=== Cobertura DBF vs Postgres ({compare_schema}.*) ===")
    print(f"DBF sin tabla PG ({len(dbf_missing_pg)}): {', '.join(t.upper() for t in dbf_missing_pg)}")
    print(f"Tablas PG sin DBF ({len(pg_missing_dbf)}): {', '.join(pg_missing_dbf)}")

    print(f"\n=== Conteo filas: DBF vs {compare_schema}.* (tablas clave agenda + maestros) ===")
    sample = sorted(set(AGENDA_CORE + [t for t in dbfs if t in pg_tables][:15]))
    mismatches = []
    for t in sample:
        if t not in pg_tables:
            continue
        dc = dbf_count(t)
        pc = table_count(cur, compare_schema, t)
        ok = dc is not None and pc is not None and dc == pc
        flag = "OK" if ok else "DIFF"
        print(f"  {flag:4} {t:16} dbf={dc!s:>8}  pg={pc!s:>8}")
        if not ok and dc is not None and pc is not None:
            mismatches.append((t, dc, pc))

    print(f"\n=== Conteo todas las tablas importables ({compare_schema}) ===")
    zero_pg = []
    diff_all = []
    for t in sorted(pg_tables):
        if t not in dbfs:
            continue
        dc = dbf_count(t)
        pc = table_count(cur, compare_schema, t)
        if pc == 0:
            zero_pg.append(t)
        if dc is not None and pc is not None and dc != pc:
            diff_all.append((t, dc, pc))

    print(f"Tablas con 0 filas en PG pero DBF existe: {len(zero_pg)}")
    if zero_pg[:15]:
        print("  ej:", ", ".join(zero_pg[:15]))
    print(f"Desfase de conteo (dbf != pg): {len(diff_all)}")
    for t, dc, pc in diff_all[:25]:
        print(f"  {t:16} dbf={dc:>8} pg={pc:>8} delta={pc-dc:+d}")
    if len(diff_all) > 25:
        print(f"  ... y {len(diff_all)-25} más")

    print("\n=== Tablas DBF ausentes en migraciones (impacto funcional) ===")
    for t in MISSING_FROM_MIGRATIONS:
        note = ""
        if t == "cobros":
            note = " — cobros TPV/caja"
        elif t == "pagos":
            note = " — pagos proveedor"
        elif t in ("carcli", "carpro"):
            note = " — carrito cliente/proveedor"
        elif t == "clifamilia":
            note = " — familiares del cliente"
        elif t == "gaslin":
            note = " — líneas gastos"
        elif t == "ofertasart":
            note = " — artículos en ofertas"
        elif t == "ticketprel":
            note = " — líneas ticket precuenta"
        print(f"  {t.upper()}{note}")

    conn.close()


if __name__ == "__main__":
    main()
