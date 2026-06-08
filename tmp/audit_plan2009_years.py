from collections import Counter
from datetime import datetime
from pathlib import Path
import os

from dbfread import DBF
import psycopg2
from psycopg2.extras import RealDictCursor

for line in Path(".env").read_text(encoding="utf-8").splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"'))

dbf_path = r"C:\Duna\260603-Style-Dunasoft\dbf\PLAN2009.DBF"
years = Counter()
total = 0
for rec in DBF(dbf_path, encoding="cp1252", ignore_missing_memofile=True):
    total += 1
    f = rec.get("FECHA") or rec.get("fecha")
    if isinstance(f, datetime):
        years[f.year] += 1
    elif f:
        s = str(f).strip()
        if len(s) >= 4:
            years[s[:4]] += 1

print("DBF plan2009 total:", total)
print("DBF por año (top 10):", years.most_common(10))

conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"], connect_timeout=20)
cur = conn.cursor(cursor_factory=RealDictCursor)
cur.execute(
    """
    SELECT EXTRACT(YEAR FROM fecha)::int AS y, COUNT(*) AS n
    FROM dunasoft.plan2009
    GROUP BY 1 ORDER BY 1 DESC LIMIT 10
    """
)
print("PG por año:", cur.fetchall())

cur.execute(
    """
    SELECT COUNT(DISTINCT idplan) AS distinct_idplan,
           COUNT(*) AS rows
    FROM dunasoft.plan2009
    """
)
print("PG idplan distinct:", cur.fetchone())

conn.close()
