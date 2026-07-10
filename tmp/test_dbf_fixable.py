"""Quick probe: how many corrupted rows can be fixed from local plan2009.dbf."""
from __future__ import annotations

import os
import struct
from pathlib import Path

import psycopg2

ROOT = Path(__file__).resolve().parents[1]
ENV = ROOT / ".env"


def load_dotenv() -> None:
    if not ENV.is_file():
        return
    for line in ENV.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"'))


def load_plan2009_dbf(path: Path) -> dict[str, tuple[str, str]]:
    buf = path.read_bytes()
    header_len = int.from_bytes(buf[8:10], "little")
    record_len = int.from_bytes(buf[10:12], "little")
    n_records = int.from_bytes(buf[4:8], "little")
    fields: list[tuple[str, int, int]] = []
    off = 32
    pos = 1
    while buf[off] != 0x0D:
        name = buf[off : off + 11].decode("ascii").replace("\0", "").strip().upper()
        flen = buf[off + 16]
        fields.append((name, pos, flen))
        pos += flen
        off += 32

    def read_field(rec_off: int, field_name: str) -> bytes:
        for name, fpos, flen in fields:
            if name == field_name:
                return buf[rec_off + fpos : rec_off + fpos + flen]
        return b""

    out: dict[str, tuple[str, str]] = {}
    for i in range(n_records):
        rec_off = header_len + i * record_len
        if buf[rec_off] == 0x2A:
            continue
        idplan = read_field(rec_off, "IDPLAN").decode("ascii", errors="replace").strip()
        key = idplan.lstrip("0") or "0"
        texto = read_field(rec_off, "TEXTO").decode("cp1252", errors="replace").replace("\0", "").strip()
        nomcli = read_field(rec_off, "NOMCLI").decode("cp1252", errors="replace").replace("\0", "").strip()
        out[key] = (texto, nomcli)
    return out


def main() -> None:
    load_dotenv()
    dbf = load_plan2009_dbf(Path(os.environ["LEGACY_DBF_DIR"]) / "plan2009.dbf")
    conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
    cur = conn.cursor()
    cur.execute(
        """
        SELECT legacy_idplan, description, client_name
        FROM public.agenda_appointments
        WHERE description LIKE '%' || chr(65533) || '%'
        """
    )
    rows = cur.fetchall()
    fixable = 0
    for legacy_idplan, desc, client in rows:
        key = str(int(str(legacy_idplan).strip())) if str(legacy_idplan or "").strip().isdigit() else ""
        if not key or key not in dbf:
            continue
        texto, nomcli = dbf[key]
        if texto and "\ufffd" not in texto and texto != (desc or ""):
            fixable += 1
    print("rows_with_replacement", len(rows))
    print("fixable_from_local_dbf", fixable)
    conn.close()


if __name__ == "__main__":
    main()
