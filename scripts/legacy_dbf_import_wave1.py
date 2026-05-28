"""
Importa DBF al esquema `legacy` (tablas creadas por migraciones SQL oleada 1 + 2).

Requisitos:
  pip install dbfread psycopg2-binary

Variables (o en .env del repo):
  SUPABASE_DB_URL=postgresql://...
  LEGACY_DBF_DIR=E:\\dbf
  IMPORT_BATCH=mi-lote-2026-04-20   (opcional)
  LEGACY_IMPORT_SCOPE=wave1|all   (por defecto wave1)
    - wave1: solo las 8 tablas iniciales (clientes, empleados, …).
    - all: todas las tablas en legacy.* que tengan import_batch/imported_at (tras migración wave2).

Uso:
  python scripts/legacy_dbf_import_wave1.py

Notas:
  - LEGACY_DBF_ENCODING: por defecto cp1252 (Windows español). Si tildes/ñ salen mal (DÝaz, A±on), prueba latin-1 o cp850.
  - Visual FoxPro: algunas filas activas empiezan con 0x00 (no solo espacio); dbfread las omitiría — aquí se leen igual.
  - Campos tipo fecha (D) con bytes nulos: se tratan como vacíos en lugar de fallar toda la fila.
  - Filas que sigan fallando al parsear se omiten y se cuenta aviso.
  - LEGACY_IGNORE_MISSING_MEMO=1 (por defecto) si falta el .fpt del memo.
  - Cada tabla hace COMMIT al terminar para no perder el lote si falla la siguiente.
  - Archivos muy grandes: si dbfread es lento, exportar con ogr2ogr a CSV y usar psql \\copy.
"""
from __future__ import annotations

import csv
import io
import os
import sys
from pathlib import Path

try:
    from dbfread import DBF, FieldParser
except ImportError:
    print("Instala dependencias: pip install dbfread psycopg2-binary", file=sys.stderr)
    raise

import psycopg2

from legacy_structure import WAVE1_IMPORT_ORDER

ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / ".env"

# Prefijos de registro "activo" en DBF (FoxPro a veces usa 0x00; dbfread solo acepta espacio).
_ACTIVE_RECORD_SEPS = (b" ", b"\x00")


class LenientFieldParser(FieldParser):
    """No abortar un registro por un campo corrupto (\\x00 en D, N, etc.)."""

    def parse(self, field, data):
        try:
            return super().parse(field, data)
        except Exception:
            return None


def iter_legacy_dbf_records(dbf: DBF):
    """Itera registros activos como dbfread, pero incluye filas con prefijo 0x00."""
    with open(dbf.filename, mode="rb") as infile, dbf._open_memofile() as memofile:
        field_parser = LenientFieldParser(dbf, memofile)
        parse = field_parser.parse
        infile.seek(dbf.header.headerlen, 0)
        read = infile.read
        skip_record = dbf._skip_record
        while True:
            sep = read(1)
            if sep in _ACTIVE_RECORD_SEPS:
                items = [(field.name, parse(field, read(field.length))) for field in dbf.fields]
                yield dbf.recfactory(items)
            elif sep in (b"\x1a", b""):
                break
            else:
                skip_record(infile)


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


def get_db_url() -> str:
    u = os.environ.get("SUPABASE_DB_URL", "").strip()
    if not u:
        raise SystemExit("Falta SUPABASE_DB_URL (en entorno o .env)")
    return u


def legacy_tables_for_import(cur) -> list[str]:
    """Tablas del esquema legacy listas para COPY (tienen columnas de control del import)."""
    cur.execute(
        """
        SELECT c.table_name
        FROM information_schema.tables c
        WHERE c.table_schema = 'legacy'
          AND c.table_type = 'BASE TABLE'
          AND EXISTS (
            SELECT 1 FROM information_schema.columns x
            WHERE x.table_schema = 'legacy' AND x.table_name = c.table_name
              AND x.column_name = 'import_batch'
          )
          AND EXISTS (
            SELECT 1 FROM information_schema.columns x
            WHERE x.table_schema = 'legacy' AND x.table_name = c.table_name
              AND x.column_name = 'imported_at'
          )
        ORDER BY c.table_name
        """
    )
    return [r[0] for r in cur.fetchall()]


def table_columns(cur, table: str) -> list[str]:
    cur.execute(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'legacy' AND table_name = %s
        ORDER BY ordinal_position
        """,
        (table,),
    )
    cols = [r[0] for r in cur.fetchall()]
    return [c for c in cols if c not in ("import_batch", "imported_at")]


def cell(v) -> str:
    """Texto seguro para COPY UTF-8: Postgres rechaza el byte NUL (0x00)."""
    if v is None:
        s = ""
    elif isinstance(v, (bytes, bytearray)):
        s = v.decode("latin-1", errors="replace")
    else:
        s = str(v)
    s = s.replace("\x00", "").replace("\u0000", "")
    return s.encode("utf-8", errors="replace").decode("utf-8")


def import_one(
    cur,
    legacy_dir: Path,
    table: str,
    dbf_name: str,
    batch: str,
    encoding: str,
) -> int:
    path = legacy_dir / dbf_name
    if not path.is_file():
        print(f"  [omitido] no existe {path}")
        return 0

    cols = table_columns(cur, table)
    if not cols:
        print(f"  [error] sin columnas en legacy.{table} (¿migración aplicada?)")
        return 0

    print(f"  leyendo {dbf_name} …")
    ignore_memo = os.environ.get("LEGACY_IGNORE_MISSING_MEMO", "1").strip() not in ("0", "false", "no")
    dbf_kw: dict = {
        "encoding": encoding,
        "char_decode_errors": "replace",
        "parserclass": LenientFieldParser,
    }
    if ignore_memo:
        dbf_kw["ignore_missing_memofile"] = True
    try:
        dbf = DBF(str(path), **dbf_kw)
    except TypeError:
        dbf_kw.pop("ignore_missing_memofile", None)
        dbf = DBF(str(path), **dbf_kw)
    field_map = {fn.lower(): fn for fn in dbf.field_names}

    buf = io.StringIO()
    w = csv.writer(buf, delimiter=",", quoting=csv.QUOTE_MINIMAL, lineterminator="\n")
    n = 0
    skipped = 0
    it = iter_legacy_dbf_records(dbf)
    while True:
        try:
            rec = next(it)
        except StopIteration:
            break
        except Exception as exc:
            skipped += 1
            if skipped <= 12:
                print(f"    [fila omitida] {type(exc).__name__}: {exc}")
            continue
        row = []
        for c in cols:
            fn = field_map.get(c)
            val = rec.get(fn, "") if fn else ""
            row.append(cell(val))
        row.append(batch)
        w.writerow(row)
        n += 1
        if n % 50000 == 0:
            print(f"    … {n} filas")
    if skipped:
        print(f"    … omitidas {skipped} filas (registros corruptos o borrados en DBF)")

    buf.seek(0)
    colnames = cols + ["import_batch"]
    sql = f"COPY legacy.{table} ({', '.join(colnames)}) FROM STDIN WITH (FORMAT csv, NULL '')"
    cur.execute("TRUNCATE TABLE legacy." + table + " CASCADE")
    cur.copy_expert(sql, buf)
    return n


def main() -> None:
    load_dotenv()
    legacy_dir = Path(os.environ.get("LEGACY_DBF_DIR", r"E:\dbf"))
    scope = os.environ.get("LEGACY_IMPORT_SCOPE", "wave1").strip().lower()
    batch = os.environ.get("IMPORT_BATCH", "wave1").strip() or "wave1"
    # CP1252 suele ser el de Visual FoxPro / Windows ES; CP850 era MS-DOS.
    encoding = os.environ.get("LEGACY_DBF_ENCODING", "cp1252")

    only_tables: list[str] = []
    if len(sys.argv) > 1:
        for arg in sys.argv[1:]:
            if arg.startswith("--only="):
                only_tables = [t.strip().lower() for t in arg.split("=", 1)[1].split(",") if t.strip()]

    if not legacy_dir.is_dir():
        raise SystemExit(f"No es directorio: {legacy_dir}")

    if scope not in ("wave1", "all"):
        raise SystemExit("LEGACY_IMPORT_SCOPE debe ser wave1 o all")

    conn = psycopg2.connect(get_db_url())
    conn.autocommit = False
    cur = conn.cursor()
    if only_tables:
        import_pairs = [(t, f"{t.upper()}.DBF") for t in only_tables]
    elif scope == "wave1":
        import_pairs: list[tuple[str, str]] = list(WAVE1_IMPORT_ORDER)
    else:
        names = legacy_tables_for_import(cur)
        import_pairs = [(t, f"{t.upper()}.DBF") for t in names]

    total = 0
    try:
        for table, dbf_name in import_pairs:
            print(f"→ legacy.{table} <= {dbf_name}")
            n = import_one(cur, legacy_dir, table, dbf_name, batch, encoding)
            print(f"   {n} filas")
            total += n
            conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()

    print(f"Listo. Total filas importadas (suma por tabla): {total}")


if __name__ == "__main__":
    main()
