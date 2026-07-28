#!/usr/bin/env python3
"""Repara campos de texto en DBF Style que contienen UTF-8 multi-byte en vez de CP1252.

Causa típica: JSON inbound escrito en UTF-8 + VFP FILETOSTR ANSI → REPLACE deja
bytes C3 B1 (UTF-8 de ñ) en el campo; Style muestra «Ã±».

Uso:
  python scripts/repair_style_dbf_utf8_fields.py --dry-run
  python scripts/repair_style_dbf_utf8_fields.py
  python scripts/repair_style_dbf_utf8_fields.py --dbf "\\\\192.168.99.16\\c$\\Style-Dunasoft\\dbf\\clientes.dbf"
"""
from __future__ import annotations

import argparse
import shutil
import struct
import sys
from datetime import datetime
from pathlib import Path

DEFAULT_DBFS = [
    Path(r"\\192.168.99.16\c$\Style-Dunasoft\dbf\clientes.dbf"),
    Path(r"\\192.168.99.16\c$\Style-Dunasoft\dbf\plan2009.dbf"),
]


def parse_fields(data: bytes) -> tuple[int, int, list[tuple[str, str, int, int]]]:
    header_len = struct.unpack_from("<H", data, 8)[0]
    rec_len = struct.unpack_from("<H", data, 10)[0]
    fields: list[tuple[str, str, int, int]] = []
    off = 32
    pos = 1
    while data[off] != 0x0D:
        name = data[off : off + 11].split(b"\x00")[0].decode("ascii", "ignore").strip().lower()
        ftype = chr(data[off + 11])
        flen = data[off + 16]
        fields.append((name, ftype, pos, flen))
        pos += flen
        off += 32
    return header_len, rec_len, fields


def looks_like_utf8(raw: bytes) -> bool:
    """Solo UTF-8 occidental típico (C2/C3 + continuation), no bytes sueltos CP1252 (F1=ñ, D1=Ñ)."""
    if not raw:
        return False
    if not any(raw[i] in (0xC2, 0xC3) and i + 1 < len(raw) and (raw[i + 1] & 0xC0) == 0x80 for i in range(len(raw))):
        return False
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        return False
    try:
        encoded = text.encode("cp1252")
    except UnicodeEncodeError:
        return False
    return encoded != raw and len(encoded) <= len(raw)


def fix_field_bytes(raw: bytes) -> bytes | None:
    trimmed = raw.rstrip(b" \x00")
    if not looks_like_utf8(trimmed):
        return None
    text = trimmed.decode("utf-8")
    try:
        encoded = text.encode("cp1252")
    except UnicodeEncodeError:
        encoded = text.encode("cp1252", errors="replace")
    if encoded == trimmed:
        return None
    if len(encoded) > len(raw):
        encoded = encoded[: len(raw)]
    return encoded.ljust(len(raw), b" ")


def repair_dbf(path: Path, *, dry_run: bool) -> dict:
    data = bytearray(path.read_bytes())
    header_len, rec_len, fields = parse_fields(data)
    char_fields = [(n, p, ln) for n, t, p, ln in fields if t == "C"]
    nrec = (len(data) - header_len) // rec_len
    changed_records = 0
    changed_fields = 0
    samples: list[str] = []

    for i in range(nrec):
        rec_off = header_len + i * rec_len
        if data[rec_off] == 0x2A:
            continue
        rec_changed = False
        for name, pos, flen in char_fields:
            start = rec_off + pos
            raw = bytes(data[start : start + flen])
            fixed = fix_field_bytes(raw)
            if fixed is None:
                continue
            if not dry_run:
                data[start : start + flen] = fixed
            rec_changed = True
            changed_fields += 1
            if len(samples) < 12:
                before = raw.rstrip(b" \x00").decode("cp1252", "replace")
                after = fixed.rstrip(b" \x00").decode("cp1252", "replace")
                samples.append(f"{name}: {before!r} -> {after!r}")
        if rec_changed:
            changed_records += 1

    if not dry_run and changed_records:
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup = path.with_suffix(path.suffix + f".bak_utf8_{stamp}")
        shutil.copy2(path, backup)
        path.write_bytes(data)
        backup_name = str(backup)
    else:
        backup_name = None

    return {
        "path": str(path),
        "records": nrec,
        "changed_records": changed_records,
        "changed_fields": changed_fields,
        "backup": backup_name,
        "samples": samples,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dbf", action="append", type=Path, help="Ruta DBF (repetible).")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    paths = args.dbf or DEFAULT_DBFS
    any_missing = False
    for path in paths:
        if not path.exists():
            print(f"NO EXISTE: {path}", file=sys.stderr)
            any_missing = True
            continue
        report = repair_dbf(path, dry_run=args.dry_run)
        mode = "dry-run" if args.dry_run else "apply"
        print(
            mode,
            report["path"],
            f"recs={report['records']}",
            f"changed_recs={report['changed_records']}",
            f"changed_fields={report['changed_fields']}",
            f"backup={report['backup']}",
        )
        for sample in report["samples"]:
            print(" ", sample)
    return 1 if any_missing else 0


if __name__ == "__main__":
    raise SystemExit(main())
