import os
from pathlib import Path
import psycopg2

ROOT = Path(__file__).resolve().parents[1]
for line in (ROOT / ".env").read_text(encoding="utf-8", errors="replace").splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"'))

conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
cur = conn.cursor()
cur.execute(
    """
    SELECT count(*) FROM legacy.plan2009 p
    WHERE btrim(p.idplan) <> ''
      AND NOT EXISTS (
        SELECT 1 FROM legacy.planinc i WHERE btrim(i.idplan) = btrim(p.idplan)
      )
    """
)
print("Citas solo en PLAN2009 (sin ninguna fila PLANINC):", cur.fetchone()[0])
cur.execute(
    """
    SELECT count(*) FROM legacy.plan2009 p
    WHERE btrim(p.idplan) <> ''
      AND NOT EXISTS (
        SELECT 1 FROM legacy.planinc i WHERE btrim(i.idplan) = btrim(p.idplan)
      )
      AND btrim(p.fecha) LIKE '2026-%'
    """
)
print("  de 2026:", cur.fetchone()[0])
conn.close()
