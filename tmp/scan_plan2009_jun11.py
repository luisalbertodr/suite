import os, sys
from pathlib import Path

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

def hhmm(v):
    s = str(v or "").strip()
    if len(s) >= 5 and s[2] == ":":
        return s[:5]
    if len(s) == 4 and s.isdigit():
        return f"{s[:2]}:{s[2:]}"
    return s[:5] if s else ""

for name in ("PLAN2009.DBF", "PLANTMP.DBF"):
    path = Path(os.environ["LEGACY_DBF_DIR"]) / name
    if not path.is_file():
        print(f"Missing {path}")
        continue
    dbf = DBF(str(path), encoding="cp1252", parserclass=LenientFieldParser, ignore_missing_memofile=True, char_decode_errors="replace")
    print(f"\n=== {name} fields: {dbf.field_names[:25]}... total {len(dbf.fields)} ===")
    target = "2026-06-11"
    hits = []
    n = 0
    for rec in iter_legacy_dbf_records(dbf):
        n += 1
        r = {k.lower(): v for k, v in rec.items()}
        # try common date field names
        d = None
        for fk in ("fecha", "fechax", "fechac", "dia"):
            d = norm_date(r.get(fk))
            if d:
                break
        if d != target:
            continue
        ce = str(r.get("codemp") or "").strip()
        cex = str(r.get("codempx") or "").strip()
        hits.append(r)
    print(f"Records scanned: {n}, fecha {target}: {len(hits)}")
    for r in sorted(hits, key=lambda x: hhmm(x.get("horinix") or x.get("horini"))):
        print(
            f"  {hhmm(r.get('horinix') or r.get('horini'))}-{hhmm(r.get('horfinx') or r.get('horfin'))} "
            f"codemp={r.get('codemp')} codempx={r.get('codempx')} idplan={r.get('idplan')} "
            f"{str(r.get('nomcli') or r.get('nombre') or '')[:40]}"
        )
