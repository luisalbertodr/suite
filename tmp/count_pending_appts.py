import re
from pathlib import Path
from datetime import date
import psycopg2
from psycopg2.extras import RealDictCursor

ROOT = Path(__file__).resolve().parents[1]
for line in (ROOT / ".env").read_text().splitlines():
    if line.startswith("SUPABASE_DB_URL="):
        db = re.sub(r"@[^/:]+:\d+/", "@127.0.0.1:15432/", line.split("=", 1)[1].strip().strip('"').strip("'"))

EST = "5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4"
conn = psycopg2.connect(db, cursor_factory=RealDictCursor)
cur = conn.cursor()
q = """
WITH hs AS (
  SELECT DISTINCT appointment_id FROM sales
  WHERE status='completed' AND appointment_id IS NOT NULL
)
SELECT COUNT(*) n FROM agenda_appointments a
LEFT JOIN hs ON hs.appointment_id = a.id
WHERE a.company_id = %s
  AND COALESCE(a.appointment_date, a.start_time::date) BETWEEN %s AND %s
  AND COALESCE(a.status, 'confirmed') <> 'cancelled'
  AND a.customer_id IS NOT NULL
  AND hs.appointment_id IS NULL
"""
for label, dfrom in [("2026", "2026-01-01"), ("may-jun", "2026-05-01"), ("jun1-3", "2026-06-01")]:
    cur.execute(q, (EST, dfrom, date(2026, 6, 3)))
    print(label, cur.fetchone())
conn.close()
