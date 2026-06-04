import os
from pathlib import Path
import psycopg2
from psycopg2.extras import RealDictCursor

ROOT = Path(__file__).resolve().parents[1]
for line in (ROOT / ".env").read_text().splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1)
        k, v = k.strip(), v.strip().strip('"')
        if k and k not in os.environ:
            os.environ[k] = v

conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
cur = conn.cursor(cursor_factory=RealDictCursor)

for tbl in ("empleados", "emple"):
    cur.execute(
        "SELECT 1 FROM information_schema.tables WHERE table_schema='legacy' AND table_name=%s",
        (tbl,),
    )
    if not cur.fetchone():
        continue
    cur.execute(f"SELECT * FROM legacy.{tbl} LIMIT 3")
    cols = [d.name for d in cur.description]
    print(f"legacy.{tbl} columns sample:", cols[:20])
    cur.execute(
        f"""
        SELECT * FROM legacy.{tbl}
        WHERE lower(coalesce(nomemp::text, '')) LIKE '%beth%'
           OR lower(coalesce(nomemp::text, '')) LIKE '%marta%'
           OR lower(coalesce(ape1emp::text, ape2emp::text, '')) LIKE '%beth%'
           OR lower(coalesce(ape1emp::text, ape2emp::text, '')) LIKE '%marta%'
        """
    )
    rows = cur.fetchall()
    if rows:
        print(f"Matches in legacy.{tbl}:")
        for r in rows:
            print(dict(r))
    else:
        cur.execute(f"SELECT * FROM legacy.{tbl}")
        allr = cur.fetchall()
        for r in allr:
            txt = " ".join(str(v) for v in r.values()).lower()
            if "beth" in txt or "marta" in txt:
                print(f"legacy.{tbl}:", dict(r))

cur.execute(
    """
    SELECT name, dunasoft_codemp FROM agenda_employees
    WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
    ORDER BY name
    """
)
print("\nSuite agenda_employees (estética):")
for r in cur.fetchall():
    print(f"  {r['dunasoft_codemp']!r:6} -> {r['name']}")

conn.close()
