"""Ejecuta un fichero .sql contra SUPABASE_DB_URL (lee .env si hace falta)."""
import os
import sys
from pathlib import Path

import psycopg2

ROOT = Path(__file__).resolve().parents[1]


def load_dotenv() -> None:
    p = ROOT / ".env"
    if not p.is_file():
        return
    for line in p.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k, v = k.strip(), v.strip().strip('"')
        if k and k not in os.environ:
            os.environ[k] = v


def main() -> None:
    load_dotenv()
    if len(sys.argv) < 2:
        print("Uso: python scripts/apply_sql_migration.py supabase/migrations/archivo.sql", file=sys.stderr)
        sys.exit(1)
    sql_path = ROOT / sys.argv[1]
    url = os.environ.get("SUPABASE_DB_URL", "").strip()
    if not url:
        raise SystemExit("Falta SUPABASE_DB_URL")
    sql = sql_path.read_text(encoding="utf-8")
    conn = psycopg2.connect(url)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(sql)
    cur.close()
    conn.close()
    print("OK:", sql_path)


if __name__ == "__main__":
    main()
