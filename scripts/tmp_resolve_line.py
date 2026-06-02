from pathlib import Path
import psycopg2

E = "5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4"
url = [l.split("=", 1)[1].strip().strip('"') for l in Path(".env").read_text(encoding="utf-8").splitlines() if l.startswith("SUPABASE_DB_URL=")][0]
conn = psycopg2.connect(url)
cur = conn.cursor()
for desc in ("Servicio", "025 - Consulta", "LEG-00061 - SCULPTRA"):
    cur.execute(
        "SELECT public.resolve_line_billing_company_id(%s, %s)",
        (desc, E),
    )
    print(desc, "->", cur.fetchone()[0])
conn.close()
