import os
from pathlib import Path
import psycopg2

ROOT = Path(__file__).resolve().parents[1]
for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"'))
conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
cur = conn.cursor()
cur.execute(
    """
    SELECT number, count(*) FROM public.invoices
    WHERE number LIKE 'TMP-%' AND company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
    GROUP BY number HAVING count(*) > 1 LIMIT 10
    """
)
dups = cur.fetchall()
print("duplicate TMP numbers:", len(dups), dups[:5])
cur.execute(
    "SELECT count(*) FROM public.invoices WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4' AND number NOT LIKE 'TMP-%' AND number NOT LIKE 'F____-_____'"
)
# simpler
cur.execute(
    """
    SELECT count(*) FROM public.invoices
    WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
      AND number NOT LIKE 'TMP-%' AND number !~ '^F[0-9]{4}-'
    """
)
print("still non-tmp non-F:", cur.fetchone()[0])
conn.close()
