from pathlib import Path
import struct

p = Path(r"\\192.168.99.16\c$\Style-Dunasoft\dbf\clientes.dbf")
data = p.read_bytes()
hl = struct.unpack_from("<H", data, 8)[0]
rl = struct.unpack_from("<H", data, 10)[0]
fields = []
off = 32
pos = 1
while data[off] != 0x0D:
    name = data[off : off + 11].split(b"\x00")[0].decode("ascii", "ignore").strip().lower()
    ftype = chr(data[off + 11])
    flen = data[off + 16]
    fields.append((name, ftype, pos, flen))
    pos += flen
    off += 32
fmap = {n: (p0, ln) for n, t, p0, ln in fields}
for i in range((len(data) - hl) // rl):
    rec = memoryview(data)[hl + i * rl : hl + (i + 1) * rl]
    if rec[0] == 0x2A:
        continue
    cpos, clen = fmap["codcli"]
    cod = bytes(rec[cpos : cpos + clen]).decode("latin1").strip()
    if cod != "000006":
        continue
    for fn in ("nomcli", "ape1cli", "pais", "procli"):
        p0, ln = fmap[fn]
        raw = bytes(rec[p0 : p0 + ln]).rstrip(b" \x00")
        print(fn, raw.hex(), repr(raw.decode("cp1252")))
    break
