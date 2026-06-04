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

path = Path(os.environ["LEGACY_DBF_DIR"]) / "PLANINC.DBF"
dbf = DBF(str(path), encoding="cp1252", parserclass=LenientFieldParser, ignore_missing_memofile=True, char_decode_errors="replace")

target = "2026-06-11"
afternoon = {"14:00", "14:15", "14:30", "14:45", "15:00", "15:15", "15:30", "15:45", "16:00", "16:15", "16:30", "16:45", "17:00", "17:15", "17:30", "17:45", "18:00", "18:15", "18:30", "18:45", "19:00", "19:15", "19:30", "19:45", "20:00", "20:15", "20:30", "20:45"}

needles = ["maria dolores eiras", "ana fernandez", "maria isabel martinez", "raquel lema", "raquel casais", "azlyn"]

print("=== codemp/codempx 10, hora tarde, cualquier fecha jun 2026 ===")
for rec in iter_legacy_dbf_records(dbf):
    r = {k.lower(): v for k, v in rec.items()}
    ce = str(r.get("codemp") or "").strip().lstrip("0")
    cex = str(r.get("codempx") or "").strip().lstrip("0")
    if ce != "10" and cex != "10":
        continue
    fx = norm_date(r.get("fechax"))
    f = norm_date(r.get("fecha"))
    d = fx or f
    if not d or not d.startswith("2026-06"):
        continue
    h = hhmm(r.get("horinix") or r.get("horini"))
    if h not in afternoon:
        continue
    nom = str(r.get("nomcli") or "").lower()
    print(
        f"  {d} {h} codemp={r.get('codemp')} codempx={r.get('codempx')} fecha={norm_date(r.get('fecha'))} "
        f"fechax={norm_date(r.get('fechax'))} idplan={r.get('idplan')} tipinc={r.get('tipinc')} {str(r.get('nomcli') or '')[:40]}"
    )

print("\n=== Clientes captura: cualquier registro jun 2026 ===")
for rec in iter_legacy_dbf_records(dbf):
    r = {k.lower(): v for k, v in rec.items()}
    nom = str(r.get("nomcli") or "").lower()
    if not any(n in nom for n in needles):
        continue
    fx = norm_date(r.get("fechax"))
    f = norm_date(r.get("fecha"))
    d = fx or f
    if not d or not d.startswith("2026-06"):
        continue
    print(
        f"  {d} {hhmm(r.get('horinix') or r.get('horini'))} codemp={r.get('codemp')} codempx={r.get('codempx')} "
        f"fecha={norm_date(r.get('fecha'))} fechax={norm_date(r.get('fechax'))} idplan={r.get('idplan')} {str(r.get('nomcli') or '')[:40]}"
    )
