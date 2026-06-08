"""Compare DBF row count vs actual dunasoft table count (not sync_meta)."""
import os
from pathlib import Path

for line in Path(".env").read_text(encoding="utf-8").splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"'))

from dbfread import DBF
import psycopg2

DBF_DIR = Path(r"C:\Duna\260603-Style-Dunasoft\dbf")
CRITICAL = [
    "plan2009", "planinc", "planart", "faccab", "faclin", "faclintmp",
    "cobros", "carcli", "clientes", "bonoscli", "bonosart2", "codpos",
    "sms", "presencia", "planinc", "clicon", "clilopd",
]

conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"], connect_timeout=30)
cur = conn.cursor()

print(f"{'TABLA':16} {'DBF':>10} {'PG real':>10} {'META':>10} {'PÉRDIDA':>10}")
print("-" * 62)
total_loss = 0
for t in CRITICAL:
    path = DBF_DIR / f"{t.upper()}.DBF"
    if not path.exists():
        continue
    dbf = DBF(str(path), encoding="latin1", ignore_missing_memofile=True)
    dbf_n = sum(1 for _ in dbf)
    cur.execute(f'SELECT COUNT(*) FROM dunasoft."{t}"')
    pg_n = cur.fetchone()[0]
    cur.execute("SELECT row_count_dbf FROM dunasoft.sync_meta WHERE table_name = %s", (t,))
    row = cur.fetchone()
    meta = row[0] if row else None
    loss = dbf_n - pg_n
    total_loss += max(0, loss)
    flag = "!!!" if loss > 0 else "OK"
    print(f"{t:16} {dbf_n:10} {pg_n:10} {str(meta):>10} {loss:10} {flag}")

conn.close()
print(f"\nFilas perdidas (muestra crítica): {total_loss}")
