import struct
from pathlib import Path

def fields(dbf: Path):
    buf = dbf.read_bytes()
    off = 32
    while buf[off] != 0x0D:
        name = buf[off : off + 11].decode("ascii", errors="replace").replace("\x00", "").strip()
        ftype = chr(buf[off + 11])
        flen = buf[off + 16]
        yield name, ftype, flen
        off += 32

for tbl in ("ciecab", "cieentsal"):
    p = Path(rf"C:\Duna\Style-Suite-Test\dbf\{tbl}.dbf")
    print(tbl, list(fields(p)))
