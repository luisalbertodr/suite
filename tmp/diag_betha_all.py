import os, sys
from pathlib import Path
from collections import Counter

ROOT = Path(__file__).resolve().parents[1]
for line in (ROOT / ".env").read_text().splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"'))

import psycopg2
from psycopg2.extras import RealDictCursor

sys.path.insert(0, str(ROOT / "scripts"))
from promote_legacy_planinc_to_agenda import (
    effective_planinc_date,
    effective_planinc_time,
    planinc_row_sort_key,
    norm_idplan,
    exclude_tipinc_set,
)

conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
cur = conn.cursor(cursor_factory=RealDictCursor)
cur.execute("SELECT * FROM legacy.planinc")
all_rows = cur.fetchall()

betha = [r for r in all_rows if str(r.get("codemp") or "").strip().lstrip("0") == "10"]
print("Total filas planinc codemp 10 (Betha):", len(betha))

ex = exclude_tipinc_set()
winners = {}
for r in betha:
    d = effective_planinc_date(r)
    if not d:
        continue
    ip = norm_idplan(r.get("idplan"))
    wk = (d, ip or f"pi:{r.get('idplaninc')}")
    sk = planinc_row_sort_key(r)
    if winners.get(wk) is None or sk > winners[wk][0]:
        winners[wk] = (sk, r)

by_date = Counter()
kept_by_date = Counter()
drop_by_date = Counter()
for (d, _ip), (sk, r) in winners.items():
    by_date[d] += 1
    tip = str(r.get("tipinc") or "").strip().upper()
    if tip in ex:
        drop_by_date[d] += 1
    else:
        kept_by_date[d] += 1

print("Jun 2026 Betha idplans (winner):")
for (d, ip), (sk, r) in sorted(winners.items()):
    if not d.startswith("2026-06"):
        continue
    tip = str(r.get("tipinc") or "").strip().upper()
    st = "DROP" if tip in ex else "KEEP"
    print(
        f"  {st} {d} {ip} {effective_planinc_time(r,'horini')} tipinc={r.get('tipinc')} {str(r.get('nomcli') or '')[:30]}"
    )

print("\nJun 2026 counts: winners", sum(1 for (d,_) in winners if d.startswith("2026-06")))
print("  kept", sum(kept_by_date[d] for d in kept_by_date if d.startswith("2026-06")))
print("  dropped BORRAR", sum(drop_by_date[d] for d in drop_by_date if d.startswith("2026-06")))

# Compare DBF file mtime
dbf = Path(os.environ.get("LEGACY_DBF_DIR", "")) / "PLANINC.DBF"
if dbf.is_file():
    import datetime
    mt = datetime.datetime.fromtimestamp(dbf.stat().st_mtime)
    print(f"\nPLANINC.DBF local mtime: {mt}")

cur.execute(
    "SELECT max(imported_at), import_batch FROM legacy.planinc GROUP BY import_batch ORDER BY max(imported_at) DESC LIMIT 3"
)
print("Import batches planinc:", cur.fetchall())

for cod in ("10", "9"):
    cur.execute(
        """
        SELECT count(*)::int AS n FROM agenda_appointments a
        JOIN agenda_employees e ON e.id::text = a.employee_id::text
        WHERE a.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
          AND e.dunasoft_codemp = %s
          AND (a.start_time::text LIKE '2026-06%%' OR a.appointment_date::text LIKE '2026-06%%')
        """,
        (cod,),
    )
    print(f"Suite codemp {cod} citas junio 2026:", cur.fetchone()["n"])

conn.close()
