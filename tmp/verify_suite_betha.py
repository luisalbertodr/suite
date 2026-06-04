import os
from pathlib import Path
import psycopg2
from psycopg2.extras import RealDictCursor

ROOT = Path(__file__).resolve().parents[1]
for line in (ROOT / ".env").read_text(encoding="utf-8", errors="replace").splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"'))

conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
cur = conn.cursor(cursor_factory=RealDictCursor)
cur.execute(
    """
    SELECT a.client_name, a.start_time, a.end_time, a.legacy_idplan
    FROM agenda_appointments a
    JOIN agenda_employees e ON e.id::text = a.employee_id::text
    WHERE a.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
      AND e.dunasoft_codemp = '10'
      AND (a.appointment_date = '2026-06-11' OR a.start_time::text LIKE '2026-06-11%')
    ORDER BY a.start_time
    """
)
rows = cur.fetchall()
print(f"Suite Betha 2026-06-11: {len(rows)} citas")
for r in rows:
    print(f"  {r['start_time']} {r['client_name'][:40]} idplan={r['legacy_idplan']}")
conn.close()
