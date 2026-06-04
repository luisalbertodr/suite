"""Simula conteo Betha 2026-06-11 con fuente plan2009."""
import os, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
for line in (ROOT / ".env").read_text(encoding="utf-8", errors="replace").splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"'))

import psycopg2
from psycopg2.extras import RealDictCursor

sys.path.insert(0, str(ROOT / "scripts"))
from promote_legacy_planinc_to_agenda import (
    norm_date,
    norm_idplan,
    exclude_tipinc_set,
    planinc_enrichment_by_idplan,
    build_segments_from_plan2009,
    get_company_id,
)

company_id = get_company_id()
conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
cur = conn.cursor(cursor_factory=RealDictCursor)

cur.execute("SELECT id, dunasoft_codemp FROM agenda_employees WHERE company_id = %s", (company_id,))
emp_map = {}
fallback = None
for e in cur.fetchall():
    c = str(e.get("dunasoft_codemp") or "").strip()
    if c:
        emp_map[c.lstrip("0") or "0"] = str(e["id"])
        emp_map[c] = str(e["id"])
    if str(e.get("name") or "").lower() == "sin asignar":
        fallback = str(e["id"])

cur.execute("SELECT * FROM legacy.planinc")
planinc = cur.fetchall()
enrich = planinc_enrichment_by_idplan(planinc, exclude_tipinc_set())
cur.execute("SELECT * FROM legacy.plan2009")
p09 = cur.fetchall()
segs = build_segments_from_plan2009(p09, enrich, emp_map, fallback)

betha_id = emp_map.get("10")
target = "2026-06-11"
betha_day = [s for s in segs if s["date"] == target and s["employee_id"] == betha_id]
print(f"Citas Betha (codemp 10) {target} con plan2009: {len(betha_day)}")
for s in sorted(betha_day, key=lambda x: x["start_time"]):
    print(f"  {s['start_time']}-{s['end_time']} {s['client_name'][:40]} idplan={s['idplan']}")

conn.close()
