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
    flen = data[off + 16]
    fields.append((name, pos, flen))
    pos += flen
    off += 32
fmap = {n: (p0, ln) for n, p0, ln in fields}
print("fields", [n for n, _, _ in fields[:8]])
want_nums = set(range(10000000, 10000007)) | {10000008, 10000017, 10000068, 330, 2243, 7897, 9999998, 9999999}
found = []
max6 = 0
for i in range((len(data) - hl) // rl):
    rec = data[hl + i * rl : hl + (i + 1) * rl]
    if rec[0:1] == b"*":
        continue
    cpos, clen = fmap["codcli"]
    cod_full = rec[cpos : cpos + clen].decode("latin1").strip()
    if not cod_full.isdigit():
        continue
    num = int(cod_full)
    if num < 1_000_000:
        max6 = max(max6, num)
    if num in want_nums:
        nom = rec[fmap["nomcli"][0] : fmap["nomcli"][0] + fmap["nomcli"][1]].decode("cp1252", "replace").strip()
        ape = rec[fmap["ape1cli"][0] : fmap["ape1cli"][0] + fmap["ape1cli"][1]].decode("cp1252", "replace").strip()
        found.append((cod_full, nom, ape))
print("max6", max6)
print("found", found)
