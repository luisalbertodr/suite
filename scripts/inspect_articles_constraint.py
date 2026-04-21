import os
from pathlib import Path

import psycopg2

root = Path(__file__).resolve().parents[1]
env = root / ".env"
if env.exists():
    for line in env.read_text(encoding="utf-8", errors="replace").splitlines():
        s = line.strip()
        if not s or s.startswith("#") or "=" not in s:
            continue
        k, v = s.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"'))

url = os.environ.get("SUPABASE_DB_URL", "").strip()
if not url:
    raise SystemExit("Falta SUPABASE_DB_URL")

conn = psycopg2.connect(url)
cur = conn.cursor()
cur.execute(
    """
    select conname, pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.articles'::regclass
      and conname like '%tipo_producto%'
    """
)
for row in cur.fetchall():
    print(row)
cur.close()
conn.close()
