import os, sys
from pathlib import Path
from collections import Counter

ROOT = Path(__file__).resolve().parents[1]
for line in (ROOT / ".env").read_text().splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1)
        k, v = k.strip(), v.strip().strip('"')
        if k and k not in os.environ:
            os.environ[k] = v

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
COMPANY = "5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4"

conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
cur = conn.cursor(cursor_factory=RealDictCursor)
cur.execute("SELECT * FROM legacy.planinc")
rows = cur.fetchall()
day = [r for r in rows if effective_planinc_date(r) == TARGET]
print("Total filas planinc dia", TARGET, len(day))
print("Top codemp:", Counter(str(r.get("codemp") or "").strip() for r in day).most_common(15))

c10 = [r for r in day if str(r.get("codemp") or "").strip().lstrip("0") == "10"]
print("Filas codemp 10:", len(c10))
for r in sorted(c10, key=lambda x: (norm_idplan(x.get("idplan")) or "", planinc_row_sort_key(x))):
    print(
        " ",
        r.get("idplaninc"),
        "idplan",
        r.get("idplan"),
        "tipinc",
        r.get("tipinc"),
        effective_planinc_time(r, "horini"),
        str(r.get("nomcli") or "")[:35],
    )

winners = {}
for r in day:
    if str(r.get("codemp") or "").strip().lstrip("0") != "10":
        continue
    ip = norm_idplan(r.get("idplan"))
    sk = planinc_row_sort_key(r)
    wk = f"idplan:{ip}" if ip else f"pi:{r.get('idplaninc')}"
    if winners.get(wk) is None or sk > winners[wk][0]:
        winners[wk] = (sk, r)

ex = exclude_tipinc_set()
print("Distinct idplans codemp10:", len(winners))
for wk, (sk, r) in sorted(winners.items()):
    tip = str(r.get("tipinc") or "").strip().upper()
    st = "DROP" if tip in ex else "KEEP"
    print(" ", st, wk, "tipinc", r.get("tipinc"), effective_planinc_time(r, "horini"), str(r.get("nomcli") or "")[:30])

cur.execute(
    """
    SELECT e.name, e.dunasoft_codemp, count(*)::int AS n
    FROM agenda_appointments a
    JOIN agenda_employees e ON e.id::text = a.employee_id::text
    WHERE a.company_id = %s
      AND (a.appointment_date = %s OR a.start_time::text LIKE %s)
    GROUP BY e.name, e.dunasoft_codemp
    ORDER BY n DESC
    LIMIT 25
    """,
    (COMPANY, TARGET, f"{TARGET}%"),
)
print("Suite citas por empleado:")
for r in cur.fetchall():
    print(" ", dict(r))

cur.execute(
    """
    SELECT name, dunasoft_codemp FROM agenda_employees
    WHERE company_id = %s
      AND (
        btrim(dunasoft_codemp) IN ('09', '9', '10', '09', '010')
        OR ltrim(btrim(dunasoft_codemp), '0') IN ('9', '10')
      )
    ORDER BY dunasoft_codemp
    """,
    (COMPANY,),
)
print("Empleados codemp 9/10:")
for r in cur.fetchall():
    print(" ", dict(r))

print("Detalle filas del dia:")
for r in sorted(day, key=lambda x: (str(x.get("codemp")), effective_planinc_time(x, "horini"))):
    print(
        r.get("idplaninc"),
        "codemp",
        r.get("codemp"),
        "idplan",
        r.get("idplan"),
        r.get("tipinc"),
        effective_planinc_time(r, "horini"),
        str(r.get("nomcli") or "")[:30],
    )

# Global drop stats that day
all_win = {}
for r in day:
    ip = norm_idplan(r.get("idplan"))
    if not ip:
        continue
    sk = planinc_row_sort_key(r)
    wk = f"idplan:{ip}"
    if all_win.get(wk) is None or sk > all_win[wk][0]:
        all_win[wk] = (sk, r)
drops = sum(1 for sk, r in all_win.values() if str(r.get("tipinc") or "").strip().upper() in ex)
print(f"Idplans unicos dia: {len(all_win)}, descartados BORRAR: {drops}")

conn.close()
