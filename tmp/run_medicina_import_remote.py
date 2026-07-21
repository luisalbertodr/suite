#!/usr/bin/env python3
"""Bootstrap remoto: lee POSTGRES_PASSWORD y lanza el import."""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ENV_PATH = Path("/root/supabase-project/.env")
CSV = Path("/tmp/medicina_import/Fichas_medicina.csv")
SCRIPT = Path("/tmp/medicina_import/import_medical_aesthetic_history.py")
REPORT = Path("/tmp/medicina_import/report.json")
COMPANY = "5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4"  # Lipoout: clientes reales de las fichas


def load_password() -> str:
    for line in ENV_PATH.read_text(encoding="utf-8", errors="ignore").splitlines():
        if line.startswith("POSTGRES_PASSWORD="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("POSTGRES_PASSWORD not found")


def main() -> int:
    pw = load_password()
    # Conectar a la IP del contenedor (127.0.0.1:5432 en el host es otro servicio/proxy).
    import subprocess

    ip = subprocess.check_output(
        ["docker", "inspect", "-f", "{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}", "supabase-db"],
        text=True,
    ).strip()
    if not ip:
        raise SystemExit("No IP for supabase-db")
    url = f"postgresql://postgres:{pw}@{ip}:5432/postgres"
    apply = "--apply" in sys.argv
    cmd = [
        sys.executable,
        str(SCRIPT),
        "--csv",
        str(CSV),
        "--company-id",
        COMPANY,
        "--database-url",
        url,
        "--report",
        str(REPORT),
    ]
    if apply:
        cmd.append("--apply")
    print("running", "apply" if apply else "dry-run", flush=True)
    return subprocess.call(cmd)


if __name__ == "__main__":
    raise SystemExit(main())
