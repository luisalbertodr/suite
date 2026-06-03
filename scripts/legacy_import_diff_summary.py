"""
Resumen rápido: filas en DBF local vs legacy.* en Postgres (tras import).
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

try:
    from dbfread import DBF
except ImportError:
    print("pip install dbfread psycopg2-binary", file=sys.stderr)
    raise

try:
    import psycopg2
except ImportError:
    print("pip install psycopg2-binary", file=sys.stderr)
    raise

ROOT = Path(__file__).resolve().parents[1]
KEY_TABLES = [
    ("clientes", "CLIENTES.DBF"),
    ("empleados", "EMPLEADOS.DBF"),
    ("articulos", "ARTICULOS.DBF"),
    ("planinc", "PLANINC.DBF"),
    ("faccab", "FACCAB.DBF"),
    ("faclin", "FACLIN.DBF"),
    ("bonoscli", "BONOSCLI.DBF"),
    ("familia1", "FAMILIA1.DBF"),
]


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


def count_dbf(path: Path, encoding: str, quick: bool) -> int | None:
    if not path.is_file():
        return None
    if quick:
        return None  # evita escanear PLANINC/FACCAB (GB) en cada diff
    try:
        dbf = DBF(str(path), encoding=encoding, ignore_missing_memofile=True)
        return sum(1 for _ in dbf)
    except Exception as exc:
        print(f"  [dbf error] {path.name}: {exc}")
        return None


def main() -> None:
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--quick",
        action="store_true",
        help="No contar filas DBF (solo legacy.* en Postgres)",
    )
    args = ap.parse_args()

    load_dotenv()
    dbf_dir = Path(
        os.environ.get("LEGACY_DBF_DIR", r"C:\Users\OportoW11\Suite\Dunasoft\dbf"),
    )
    encoding = os.environ.get("LEGACY_DBF_ENCODING", "cp1252")
    url = os.environ.get("SUPABASE_DB_URL", "").strip()
    if not url:
        sys.exit("Falta SUPABASE_DB_URL")

    conn = psycopg2.connect(url)
    cur = conn.cursor()

    print(f"DBF dir: {dbf_dir}")
    if args.quick:
        print("(modo rápido: tamaño DBF local, sin contar filas)")
    print(f"{'Tabla':<12} {'DBF local':>14} {'legacy.*':>12} {'Nota':>10}")
    print("-" * 52)

    for table, dbf_name in KEY_TABLES:
        path = dbf_dir / dbf_name
        if args.quick and path.is_file():
            mb = path.stat().st_size / (1024 * 1024)
            local_s = f"{mb:.1f} MB"
            local_n = None
        else:
            local_n = count_dbf(path, encoding, args.quick)
            local_s = str(local_n) if local_n is not None else "—"
        try:
            cur.execute(f"SELECT COUNT(*) FROM legacy.{table}")
            legacy_n = cur.fetchone()[0]
        except Exception:
            legacy_n = None
            conn.rollback()

        legacy_s = str(legacy_n) if legacy_n is not None else "—"
        note = ""
        if local_n is not None and legacy_n is not None:
            note = f"{local_n - legacy_n:+d}"
        print(f"{table:<12} {local_s:>14} {legacy_s:>12} {note:>10}")

    cur.execute("SELECT COUNT(*) FROM public.customers WHERE legacy_codcli IS NOT NULL")
    print(f"\nClientes Suite con legacy_codcli: {cur.fetchone()[0]}")
    cur.execute("SELECT COUNT(*) FROM public.customers WHERE birth_date IS NOT NULL")
    print(f"Clientes con birth_date: {cur.fetchone()[0]}")
    cur.execute(
        "SELECT COUNT(*) FROM public.agenda_appointments WHERE legacy_planinc_id IS NOT NULL"
    )
    print(f"Citas legacy en agenda: {cur.fetchone()[0]}")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
