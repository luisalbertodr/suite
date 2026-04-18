"""Lee SUPABASE_DB_URL del .env en la raíz del repo y comprueba la conexión a Postgres."""
from pathlib import Path

import psycopg2

root = Path(__file__).resolve().parents[1]
env_path = root / ".env"
url = None
for line in env_path.read_text(encoding="utf-8").splitlines():
    s = line.strip()
    if s.startswith("SUPABASE_DB_URL="):
        url = s.split("=", 1)[1].strip().strip('"')
        break
if not url:
    raise SystemExit("SUPABASE_DB_URL no encontrada en .env")

conn = psycopg2.connect(url)
cur = conn.cursor()
cur.execute("select current_database(), inet_server_addr(), inet_server_port()")
db, addr, port = cur.fetchone()
cur.execute("select version()")
ver = cur.fetchone()[0].split(",")[0]
cur.close()
conn.close()
print("Conexion OK")
print("DB:", db, "servidor:", addr, "puerto interno:", port)
print(ver)
