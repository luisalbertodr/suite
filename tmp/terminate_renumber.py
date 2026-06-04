import os
from pathlib import Path
import psycopg2

ROOT = Path(__file__).resolve().parents[1]
for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"'))
conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
conn.autocommit = True
cur = conn.cursor()
for pid in (258981,):
    cur.execute("SELECT pg_terminate_backend(%s)", (pid,))
    print(pid, cur.fetchone())
cur.execute(
    "SELECT count(*) FROM public.invoices WHERE number LIKE 'TMP-%'"
)
print("TMP invoices:", cur.fetchone()[0])
conn.close()
