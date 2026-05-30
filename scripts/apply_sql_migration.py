"""Apply a single SQL migration file using SUPABASE_DB_URL from .env."""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load_db_url() -> str:
    env_path = ROOT / ".env"
    for line in env_path.read_text(encoding="utf-8").splitlines():
        if line.startswith("SUPABASE_DB_URL="):
            return line.split("=", 1)[1].strip().strip('"')
    raise SystemExit("SUPABASE_DB_URL not found in .env")


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit("Usage: python scripts/apply_sql_migration.py <path-to.sql>")

    sql_path = Path(sys.argv[1])
    if not sql_path.is_file():
        raise SystemExit(f"File not found: {sql_path}")

    try:
        import psycopg2
    except ImportError:
        import subprocess

        subprocess.check_call([sys.executable, "-m", "pip", "install", "psycopg2-binary", "-q"])
        import psycopg2

    sql = sql_path.read_text(encoding="utf-8")
    conn = psycopg2.connect(load_db_url())
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(sql)
    cur.close()
    conn.close()
    print(f"Applied: {sql_path.name}")


if __name__ == "__main__":
    main()
