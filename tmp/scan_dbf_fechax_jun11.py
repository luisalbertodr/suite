import os, sys
from pathlib import Path
from collections import Counter

ROOT = Path(__file__).resolve().parents[1]
for line in (ROOT / ".env").read_text(encoding="utf-8", errors="replace").splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"'))

sys.path.insert(0, str(ROOT / "scripts"))
from legacy_dbf_import_wave1 import iter_legacy_dbf_records, LenientFieldParser
from dbfread import DBF

def norm_date(v):
    s = str(v or "").strip()
    if len(s) == 8 and s.isdigit():
        return f"{s[:4]}-{s[4:6]}-{s[6:8]}"
    if len(s) >= 10 and s[4] == "-":
        return s[:10]
    return None

path = Path(os.environ["LEGACY_DBF_DIR"]) / "PLANINC.DBF"
dbf = DBF(str(path), encoding="cp1252", parserclass=LenientFieldParser, ignore_missing_memofile=True, char_decode_errors="replace")

target = "2026-06-11"
by_fechax = []
by_fecha = []
for rec in iter_legacy_dbf_records(dbf):
    r = {k.lower(): v for k, v in rec.items()}
    fx = norm_date(r.get("fechax"))
    f = norm_date(r.get("fecha"))
    if fx == target:
        by_fechax.append(r)
    if f == target:
        by_fecha.append(r)

print(f"DBF fechax={target}: {len(by_fechax)}")
print(f"DBF fecha={target}: {len(by_fecha)}")
print("Por codempx (fechax day):")
print(Counter(str(r.get("codempx") or r.get("codemp") or "").strip() for r in by_fechax))
for r in sorted(by_fechax, key=lambda x: str(x.get("horinix") or x.get("horini") or "")):
    print(
        f"  {str(r.get('horinix') or r.get('horini') or '')[:5]} codemp={r.get('codemp')} codempx={r.get('codempx')} "
        f"idplan={r.get('idplan')} idplaninc={r.get('idplaninc')} {str(r.get('nomcli') or '')[:35]}"
    )
