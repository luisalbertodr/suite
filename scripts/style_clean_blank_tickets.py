#!/usr/bin/env python3
"""Limpia tickets TPV en blanco (idticket=0) de FACCABTMP/FACLINTMP en Style."""
from __future__ import annotations

import argparse
import shutil
import struct
from datetime import datetime
from pathlib import Path

DEFAULT_CAB = Path(r"C:\Style-Dunasoft\dbf\FACCABTMP.DBF")
DEFAULT_LIN = Path(r"C:\Style-Dunasoft\dbf\FACLINTMP.DBF")


def parse_fields(data: bytes):
    header_len = struct.unpack_from("<H", data, 8)[0]
    rec_len = struct.unpack_from("<H", data, 10)[0]
    fields = []
    off = 32
    pos = 1
    while off < header_len and data[off] != 0x0D:
        name = data[off : off + 11].split(b"\x00")[0].decode("ascii", "ignore").strip().lower()
        ftype = chr(data[off + 11])
        flen = data[off + 16]
        fields.append((name, ftype, pos, flen))
        pos += flen
        off += 32
    return header_len, rec_len, fields


def field_val(rec: bytes, fields, name: str):
    for n, t, p, ln in fields:
        if n != name:
            continue
        raw = rec[p : p + ln]
        if t in ("N", "F", "B", "Y"):
            s = raw.decode("latin1").strip()
            if not s:
                return 0.0
            try:
                return float(s)
            except ValueError:
                return 0.0
        return raw.decode("latin1", "replace").strip()
    return None


def soft_delete_blanks(path: Path, predicate, dry_run: bool) -> tuple[int, int, list]:
    data = bytearray(path.read_bytes())
    header_len, rec_len, fields = parse_fields(data)
    deleted_mark = 0
    already = 0
    samples = []
    nrec = (len(data) - header_len) // rec_len
    for i in range(nrec):
        off = header_len + i * rec_len
        if data[off] == 0x2A:
            already += 1
            continue
        rec = bytes(data[off : off + rec_len])
        if not predicate(rec, fields):
            continue
        if not dry_run:
            data[off] = 0x2A
        deleted_mark += 1
        if len(samples) < 8:
            samples.append(
                {
                    "recno": i + 1,
                    "idticket": field_val(rec, fields, "idticket"),
                    "codcli": field_val(rec, fields, "codcli"),
                    "totfac": field_val(rec, fields, "totfac"),
                    "lineas": field_val(rec, fields, "lineas"),
                    "codart": field_val(rec, fields, "codart"),
                }
            )
    if not dry_run and deleted_mark:
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup = path.with_suffix(path.suffix + f".bak_blank_{stamp}")
        shutil.copy2(path, backup)
        path.write_bytes(data)
        print(f"backup {backup}")
    return deleted_mark, already, samples


def cab_blank(rec, fields) -> bool:
    idt = field_val(rec, fields, "idticket") or 0
    tot = field_val(rec, fields, "totfac") or 0
    lines = field_val(rec, fields, "lineas") or 0
    return idt == 0 and tot == 0 and lines == 0


def lin_blank(rec, fields) -> bool:
    idt = field_val(rec, fields, "idticket") or 0
    return idt == 0


def summarize(path: Path, kind: str) -> None:
    data = path.read_bytes()
    header_len, rec_len, fields = parse_fields(data)
    active = blank = real = deleted = 0
    reals = []
    for i in range((len(data) - header_len) // rec_len):
        off = header_len + i * rec_len
        if data[off] == 0x2A:
            deleted += 1
            continue
        rec = data[off : off + rec_len]
        active += 1
        idt = field_val(rec, fields, "idticket") or 0
        if kind == "cab":
            tot = field_val(rec, fields, "totfac") or 0
            lines = field_val(rec, fields, "lineas") or 0
            if idt == 0 and tot == 0 and lines == 0:
                blank += 1
            else:
                real += 1
                if len(reals) < 10:
                    reals.append(
                        (
                            i + 1,
                            idt,
                            field_val(rec, fields, "codcli"),
                            tot,
                            lines,
                        )
                    )
        else:
            if idt == 0:
                blank += 1
            else:
                real += 1
    print(f"{path.name}: active={active} deleted={deleted} blank={blank} real={real}")
    if reals:
        print("  real samples:", reals)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cab", type=Path, default=DEFAULT_CAB)
    ap.add_argument("--lin", type=Path, default=DEFAULT_LIN)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()
    if not args.apply and not args.dry_run:
        args.dry_run = True

    print("=== ANTES ===")
    summarize(args.cab, "cab")
    summarize(args.lin, "lin")

    mode = "DRY-RUN" if args.dry_run else "APPLY"
    print(f"=== {mode} cab blanks ===")
    n, _, samples = soft_delete_blanks(args.cab, cab_blank, args.dry_run)
    print(f"cab marked={n} samples={samples}")
    print(f"=== {mode} lin idticket=0 ===")
    n2, _, samples2 = soft_delete_blanks(args.lin, lin_blank, args.dry_run)
    print(f"lin marked={n2} samples={samples2}")

    if not args.dry_run:
        print("=== DESPUÉS ===")
        summarize(args.cab, "cab")
        summarize(args.lin, "lin")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
