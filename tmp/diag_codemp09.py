import os, sys
from pathlib import Path
from collections import defaultdict

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

TARGET = "2026-06-11"
conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
cur = conn.cursor(cursor_factory=RealDictCursor)
cur.execute("SELECT * FROM legacy.planinc")
rows = [r for r in cur.fetchall() if effective_planinc_date(r) == TARGET]

ex = exclude_tipinc_set()
by_idplan = defaultdict(list)
for r in rows:
    if str(r.get("codemp") or "").strip().lstrip("0") != "9":
        continue
    ip = norm_idplan(r.get("idplan"))
    by_idplan[ip or f"pi:{r.get('idplaninc')}"].append(r)

print("codemp 09 (Marta Loureiro) idplans:")
for ip, rs in sorted(by_idplan.items()):
    rs.sort(key=planinc_row_sort_key)
    winner = rs[-1]
    tip = str(winner.get("tipinc") or "").strip().upper()
    st = "DROP" if tip in ex else "KEEP"
    print(f"  {st} {ip} winner planinc={winner.get('idplaninc')} tipinc={winner.get('tipinc')} {effective_planinc_time(winner,'horini')} {str(winner.get('nomcli') or '')[:35]}")
    if len(rs) > 1:
        for r in rs[:-1]:
            print(f"      hist planinc={r.get('idplaninc')} tipinc={r.get('tipinc')}")

cur.execute(
    """
    SELECT a.client_name, a.start_time, a.legacy_idplan, a.legacy_planinc_id
    FROM agenda_appointments a
    JOIN agenda_employees e ON e.id::text = a.employee_id::text
    WHERE a.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
      AND e.dunasoft_codemp = '9'
      AND (a.appointment_date = %s OR a.start_time::text LIKE %s)
    ORDER BY a.start_time
    """,
    (TARGET, f"{TARGET}%"),
)
print("\nSuite citas Marta (codemp 9):")
for r in cur.fetchall():
    print(" ", dict(r))

conn.close()
