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
from promote_legacy_planinc_to_agenda import effective_planinc_date, planinc_row_sort_key, norm_idplan
import psycopg2
from psycopg2.extras import RealDictCursor

def norm_date(v):
    s = str(v or "").strip()
    if len(s) == 8 and s.isdigit():
        return f"{s[:4]}-{s[4:6]}-{s[6:8]}"
    if len(s) >= 10 and s[4] == "-":
        return s[:10]
    return None

target = "2026-06-11"
path = Path(os.environ["LEGACY_DBF_DIR"]) / "PLAN2009.DBF"
dbf = DBF(str(path), encoding="cp1252", parserclass=LenientFieldParser, ignore_missing_memofile=True, char_decode_errors="replace")
plan2009 = []
for rec in iter_legacy_dbf_records(dbf):
    r = {k.lower(): v for k, v in rec.items()}
    if norm_date(r.get("fecha")) != target:
        continue
    plan2009.append(r)

conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
cur = conn.cursor(cursor_factory=RealDictCursor)
cur.execute("SELECT * FROM legacy.planinc")
planinc = cur.fetchall()

winners = {}
for r in planinc:
    ip = norm_idplan(r.get("idplan"))
    if not ip:
        continue
    sk = planinc_row_sort_key(r)
    if winners.get(ip) is None or sk > winners[ip][0]:
        winners[ip] = (sk, r)

print(f"PLAN2009 citas {target}: {len(plan2009)}")
print(f"{'idplan':<8} {'hora':<11} {'codemp':<6} cliente -> planinc winner date / tipinc")
for p in sorted(plan2009, key=lambda x: str(x.get("horini") or "")):
    ip = str(p.get("idplan") or "").strip()
    w = winners.get(ip)
    if w:
        _sk, wr = w
        wd = effective_planinc_date(wr)
        tip = wr.get("tipinc")
        status = "OK" if wd == target and str(tip).upper() != "BORRAR" else "MISS"
    else:
        wd = None
        tip = None
        status = "NO_PLANINC"
    print(
        f"{status:<10} {ip:<8} {str(p.get('horini'))[:5]}-{str(p.get('horfin'))[:5]} "
        f"codemp={p.get('codemp')} {str(p.get('nomcli') or '')[:28]:<28} "
        f"-> winner {wd} tipinc={tip}"
    )

missing = []
for p in plan2009:
    ip = str(p.get("idplan") or "").strip()
    w = winners.get(ip)
    if not w:
        missing.append((ip, p, "no_winner"))
        continue
    _sk, wr = w
    wd = effective_planinc_date(wr)
    tip = str(wr.get("tipinc") or "").strip().upper()
    if wd != target or tip == "BORRAR":
        missing.append((ip, p, f"winner_{wd}_{tip}"))

print(f"\nCitas en PLAN2009 del dia que NO se importarian bien desde PLANINC: {len(missing)}")
conn.close()
