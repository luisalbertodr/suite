"""Probe DB connectivity and run import via working DSN."""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))


def load_url() -> str:
    for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
        if line.startswith("SUPABASE_DB_URL="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("SUPABASE_DB_URL missing")


def main() -> int:
    import psycopg2

    base = load_url()
    candidates = [base]
    if ":5433/" in base:
        candidates.append(base.replace(":5433/", ":5432/"))
    if "@192.168.99.110:" in base:
        candidates.append(base.replace("@192.168.99.110:", "@127.0.0.1:").replace(":5433/", ":15432/"))

    working = None
    for url in candidates:
        hostport = url.split("@")[-1].split("/")[0]
        try:
            conn = psycopg2.connect(url, connect_timeout=5)
            conn.close()
            print("OK", hostport)
            working = url
            break
        except Exception as exc:
            print("FAIL", hostport, type(exc).__name__)

    if not working:
        print("No DB connection. Start SSH tunnel if needed:", file=sys.stderr)
        print('  ssh -N -L 15432:127.0.0.1:5432 suite-supabase', file=sys.stderr)
        return 2

    os.environ["SUPABASE_DB_URL"] = working
    # Re-exec import
    from import_medical_aesthetic_history import main as import_main

    sys.argv = [
        "import_medical_aesthetic_history.py",
        "--database-url",
        working,
        *sys.argv[1:],
    ]
    return import_main()


if __name__ == "__main__":
    raise SystemExit(main())
