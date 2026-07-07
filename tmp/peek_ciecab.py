#!/usr/bin/env python3
import json
import struct
from pathlib import Path

dbf = Path(r"C:\Duna\Style-Suite-Test\dbf\ciecab.dbf")
buf = dbf.read_bytes()
header_len = struct.unpack_from("<H", buf, 8)[0]
record_len = struct.unpack_from("<H", buf, 10)[0]
n_records = struct.unpack_from("<I", buf, 4)[0]
off = 32
fields = []
pos = 1
while buf[off] != 0x0D:
    name = buf[off : off + 11].decode("ascii", errors="replace").replace("\x00", "").strip()
    flen = buf[off + 16]
    ftype = chr(buf[off + 11])
    fields.append((name, pos, flen, ftype))
    pos += flen
    off += 32
out = Path(__file__).with_suffix(".out.txt")
lines = [f"fields: {', '.join(f'{f[0]}({f[3]})' for f in fields)}", f"records: {n_records}"]

targets = {b"4505", b"4504", b"4503", b"4502", b"4501"}
rec_off = header_len
for i in range(n_records):
    rec = buf[rec_off : rec_off + record_len]
    if rec[0:1] == b"*":
        rec_off += record_len
        continue
    numcie = rec[fields[0][1] : fields[0][1] + fields[0][2]].decode("ascii", errors="replace").strip()
    if numcie.encode() in targets or numcie in {"4505", "4504", "4503", "4502", "4501"}:
        row = {}
        for name, p, fl, _ft in fields:
            raw = rec[p : p + fl].decode("ascii", errors="replace").strip()
            row[name] = raw
        lines.append(f"{numcie} {json.dumps(row, ensure_ascii=True)}")
    rec_off += record_len

out.write_text("\n".join(lines), encoding="utf-8")
print("wrote", out)
