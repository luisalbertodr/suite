#!/usr/bin/env python3
"""Marca como borrados (*) en clientes.dbf los codcli indicados (pruebas Suite / merges)."""
from __future__ import annotations

import argparse
import shutil
import struct
from datetime import datetime
from pathlib import Path

DEFAULT_DBF = Path(r"\\192.168.99.16\c$\Style-Dunasoft\dbf\clientes.dbf")


def parse_fields(data: bytes):
    header_len = struct.unpack_from("<H", data, 8)[0]
    rec_len = struct.unpack_from("<H", data, 10)[0]
    fields = []
    off = 32
    pos = 1
    while data[off] != 0x0D:
        name = data[off : off + 11].split(b"\x00")[0].decode("ascii", "ignore").strip().lower()
        flen = data[off + 16]
        fields.append((name, pos, flen))
        pos += flen
        off += 32
    return header_len, rec_len, {n: (p, ln) for n, p, ln in fields}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dbf", type=Path, default=DEFAULT_DBF)
    ap.add_argument("--codes", required=True, help="Códigos separados por coma (numéricos)")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--remap", default="", help="pares old=new separados por coma, p.ej. 9999998=008283")
    args = ap.parse_args()

    want = {int(x.strip()) for x in args.codes.split(",") if x.strip().isdigit()}
    remap: dict[int, str] = {}
    for pair in args.remap.split(","):
        pair = pair.strip()
        if not pair or "=" not in pair:
            continue
        a, b = pair.split("=", 1)
        remap[int(a.strip())] = b.strip()

    data = bytearray(args.dbf.read_bytes())
    header_len, rec_len, fmap = parse_fields(data)
    cpos, clen = fmap["codcli"]
    deleted = 0
    remapped = 0
    samples = []

    for i in range((len(data) - header_len) // rec_len):
        rec_off = header_len + i * rec_len
        if data[rec_off] == 0x2A:
            continue
        raw = bytes(data[rec_off + cpos : rec_off + cpos + clen]).decode("latin1").strip()
        if not raw.isdigit():
            continue
        num = int(raw)
        if num in remap:
            new_code = remap[num].encode("ascii").ljust(clen, b" ")[:clen]
            if not args.dry_run:
                data[rec_off + cpos : rec_off + cpos + clen] = new_code
            remapped += 1
            samples.append(f"remap {raw} -> {remap[num]}")
            continue
        if num in want:
            if not args.dry_run:
                data[rec_off] = 0x2A
            deleted += 1
            if len(samples) < 30:
                samples.append(f"delete {raw}")

    if not args.dry_run and (deleted or remapped):
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup = args.dbf.with_suffix(args.dbf.suffix + f".bak_del_{stamp}")
        shutil.copy2(args.dbf, backup)
        args.dbf.write_bytes(data)
        print("backup", backup)
    print("dry-run" if args.dry_run else "apply", f"deleted={deleted}", f"remapped={remapped}")
    for s in samples:
        print(" ", s)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
