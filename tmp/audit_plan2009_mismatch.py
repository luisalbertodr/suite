"""Audit agenda_appointments vs live plan2009.dbf."""
from __future__ import annotations

import csv
import io
import struct
import subprocess
from pathlib import Path

ROOT = Path(r"\\192.168.99.16\c$\Style-Dunasoft\dbf")
SSH_KEY = Path.home() / ".ssh" / "suite_deploy"


def decode_cp1252(raw: bytes) -> str:
    return raw.decode("cp1252", errors="replace").replace("\0", "").strip()


def load_plan2009() -> dict[str, dict[str, str]]:
    buf = (ROOT / "PLAN2009.DBF").read_bytes()
    hl = int.from_bytes(buf[8:10], "little")
    rl = int.from_bytes(buf[10:12], "little")
    n = int.from_bytes(buf[4:8], "little")
    fields: list[tuple[str, int, int]] = []
    off = 32
    pos = 1
    while buf[off] != 0x0D:
        name = buf[off : off + 11].decode("ascii").replace("\0", "").strip().upper()
        flen = buf[off + 16]
        fields.append((name, pos, flen))
        pos += flen
        off += 32

    def rf(rec_off: int, field_name: str) -> bytes:
        for name, fpos, flen in fields:
            if name == field_name:
                return buf[rec_off + fpos : rec_off + fpos + flen]
        return b""

    def fecha_iso(raw: bytes) -> str:
        s = decode_cp1252(raw)
        if len(s) == 8 and s.isdigit():
            return f"{s[:4]}-{s[4:6]}-{s[6:8]}"
        return s[:10]

    out: dict[str, dict[str, str]] = {}
    for i in range(n):
        rec_off = hl + i * rl
        if buf[rec_off] == 0x2A:
            continue
        idplan = decode_cp1252(rf(rec_off, "IDPLAN")).lstrip("0") or "0"
        out[idplan] = {
            "fecha": fecha_iso(rf(rec_off, "FECHA")),
            "horini": decode_cp1252(rf(rec_off, "HORINI"))[:5],
            "horfin": decode_cp1252(rf(rec_off, "HORFIN"))[:5],
            "nomcli": decode_cp1252(rf(rec_off, "NOMCLI")),
            "texto": decode_cp1252(rf(rec_off, "TEXTO")),
            "codemp": decode_cp1252(rf(rec_off, "CODEMP")),
            "codcli": decode_cp1252(rf(rec_off, "CODCLI")),
        }
    return out


def fetch_suite_rows() -> list[list[str]]:
    sql = """
COPY (
  SELECT coalesce(legacy_idplan, ''),
         appointment_date::text,
         left(start_time, 5),
         left(end_time, 5),
         coalesce(client_name, ''),
         coalesce(description, '')
  FROM public.agenda_appointments
  WHERE legacy_idplan IS NOT NULL AND btrim(legacy_idplan) <> ''
) TO STDOUT WITH (FORMAT csv, DELIMITER E'\\t', QUOTE '"', ESCAPE '"');
"""
    cmd = [
        "ssh",
        "-i",
        str(SSH_KEY),
        "-o",
        "BatchMode=yes",
        "suite-supabase",
        "docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1",
    ]
    proc = subprocess.run(cmd, input=sql.encode("utf-8"), capture_output=True)
    proc.check_returncode()
    return list(csv.reader(io.StringIO(proc.stdout.decode("utf-8")), delimiter="\t", quotechar='"'))


def main() -> None:
    dbf = load_plan2009()
    rows = fetch_suite_rows()
    date_mismatch = name_mismatch = text_mismatch = missing_dbf = 0
    jul9_wrong: list[str] = []
    for parts in rows:
        if len(parts) < 6:
            continue
        idplan = parts[0].lstrip("0") or "0"
        if idplan not in dbf:
            missing_dbf += 1
            continue
        d = dbf[idplan]
        if parts[1] != d["fecha"]:
            date_mismatch += 1
            if parts[1] == "2026-07-09" and d["fecha"] != "2026-07-09":
                jul9_wrong.append(idplan)
        if parts[4] != d["nomcli"] and d["nomcli"]:
            name_mismatch += 1
        if parts[5] != d["texto"] and d["texto"]:
            text_mismatch += 1

    print("suite rows", len(rows), "dbf", len(dbf))
    print("date_mismatch", date_mismatch)
    print("name_mismatch", name_mismatch)
    print("text_mismatch", text_mismatch)
    print("missing_dbf", missing_dbf)
    print("on suite jul9 but style other date", len(jul9_wrong), jul9_wrong[:20])
    for idplan in ("112351", "110914", "112190"):
        if idplan in dbf:
            s = next((p for p in rows if (p[0].lstrip("0") or "0") == idplan), None)
            print(idplan, "suite", s[1:6] if s else None, "dbf", dbf[idplan])


if __name__ == "__main__":
    main()
