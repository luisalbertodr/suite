import os
from pathlib import Path

for line in Path(".env").read_text(encoding="utf-8").splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"'))

import psycopg2
from psycopg2.extras import RealDictCursor

conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"], connect_timeout=30)
cur = conn.cursor(cursor_factory=RealDictCursor)

cur.execute("SELECT table_name, row_count_dbf, row_count_pg, status FROM dunasoft.sync_meta ORDER BY table_name")
rows = cur.fetchall()

print(f"{'TABLA':18} {'DBF(meta)':>12} {'PG real':>12} {'GAP':>12}")
print("-" * 58)
gaps = []
for r in rows:
    t = r["table_name"]
    dbf = r["row_count_dbf"]
    try:
        cur.execute(f'SELECT COUNT(*)::bigint AS n FROM dunasoft."{t}"')
        pg = cur.fetchone()["n"]
    except Exception as exc:
        conn.rollback()
        pg = None
        print(f"{t:18} ERROR: {exc}")
        continue
    gap = (dbf - pg) if dbf is not None and pg is not None else None
    if gap and gap != 0:
        gaps.append((t, dbf, pg, gap))
        print(f"{t:18} {dbf or 0:12} {pg:12} {gap:12} ***")

print(f"\nTablas con GAP DBF vs PG real: {len(gaps)}")
gaps.sort(key=lambda x: -x[3])
print("\nTop 30 perdidas:")
for t, dbf, pg, gap in gaps[:30]:
    print(f"  {t:18} dbf={dbf:>8} pg={pg:>8} gap={gap:>8}")

conn.close()
