"""
Importa detalle de bonos Dunasoft:
  - BONOSART1.DBF → legacy.bonosart   (plantilla por CODBON)
  - BONOSART2.DBF → legacy.bonosart2  (instancia por CODBONCLI)

El BONOSART.DBF original suele estar vacío; los datos reales están en BONOSART1/2.

Variables:
  SUPABASE_DB_URL
  LEGACY_DBF_DIR  (default: C:\\Users\\OportoW11\\Suite\\APP Lipoout\\dbf)
  LEGACY_DBF_ENCODING=cp1252
  IMPORT_BATCH=bonosart
"""
from __future__ import annotations

import csv
import io
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT / "scripts") not in sys.path:
    sys.path.insert(0, str(ROOT / "scripts"))

from legacy_dbf_import_wave1 import (  # noqa: E402
    cell,
    get_db_url,
    import_one,
    iter_legacy_dbf_records,
    load_dotenv,
)

try:
    from dbfread import DBF, FieldParser
except ImportError:
    print("pip install dbfread psycopg2-binary", file=sys.stderr)
    raise

import psycopg2


class LenientFieldParser(FieldParser):
    def parseD(self, field, data):
        try:
            return super().parseD(field, data)
        except ValueError:
            return None


def _open_dbf(path: Path, encoding: str) -> DBF:
    kw: dict = {
        "encoding": encoding,
        "char_decode_errors": "replace",
        "parserclass": LenientFieldParser,
        "ignore_missing_memofile": True,
    }
    try:
        return DBF(str(path), **kw)
    except TypeError:
        kw.pop("ignore_missing_memofile", None)
        return DBF(str(path), **kw)


def import_bonosart1(cur, legacy_dir: Path, batch: str, encoding: str) -> int:
    path = legacy_dir / "BONOSART1.DBF"
    if not path.is_file():
        print(f"  [omitido] no existe {path}")
        return 0

    print("  leyendo BONOSART1.DBF -> legacy.bonosart ...")
    dbf = _open_dbf(path, encoding)
    field_map = {fn.lower(): fn for fn in dbf.field_names}

    buf = io.StringIO()
    w = csv.writer(buf, delimiter=",", quoting=csv.QUOTE_MINIMAL, lineterminator="\n")
    n = 0
    for rec in iter_legacy_dbf_records(dbf):
        codbon = cell(rec.get(field_map.get("codbon", "CODBON"), ""))
        codart = cell(rec.get(field_map.get("codart", "CODART"), ""))
        if not codbon.strip() or not codart.strip():
            continue
        cant = cell(rec.get(field_map.get("cant", "CANT"), ""))
        cantmax = cell(rec.get(field_map.get("cantmax", "CANTMAX"), ""))
        pvp = cell(rec.get(field_map.get("pvp", "PVP"), ""))
        w.writerow([codbon, codart, cant, cantmax, pvp, batch])
        n += 1

    buf.seek(0)
    cur.execute("TRUNCATE TABLE legacy.bonosart")
    cur.copy_expert(
        "COPY legacy.bonosart (codbon, codart, cant, cantmax, pvpcom, import_batch) "
        "FROM STDIN WITH (FORMAT csv, NULL '')",
        buf,
    )
    return n


def main() -> None:
    load_dotenv()
    legacy_dir = Path(
        os.environ.get("LEGACY_DBF_DIR", r"C:\Users\OportoW11\Suite\APP Lipoout\dbf")
    )
    batch = os.environ.get("IMPORT_BATCH", "bonosart").strip() or "bonosart"
    encoding = os.environ.get("LEGACY_DBF_ENCODING", "cp1252")

    if not legacy_dir.is_dir():
        raise SystemExit(f"No es directorio: {legacy_dir}")

    conn = psycopg2.connect(get_db_url())
    conn.autocommit = False
    cur = conn.cursor()
    try:
        n1 = import_bonosart1(cur, legacy_dir, batch, encoding)
        print(f"   legacy.bonosart <- BONOSART1: {n1} filas")
        n2 = import_one(cur, legacy_dir, "bonosart2", "BONOSART2.DBF", batch, encoding)
        print(f"   legacy.bonosart2 <- BONOSART2: {n2} filas")
        conn.commit()
        cur.execute("SELECT count(*) FROM legacy.bonosart WHERE trim(codbon)='000078'")
        print(f"   comprobación plantilla 000078: {cur.fetchone()[0]} líneas")
        cur.execute("SELECT count(*) FROM legacy.bonosart2 WHERE trim(codboncli)='101289'")
        print(f"   comprobación bono cliente 101289: {cur.fetchone()[0]} líneas")
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()

    print("Listo.")


if __name__ == "__main__":
    main()
