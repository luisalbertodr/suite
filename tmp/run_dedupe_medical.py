#!/usr/bin/env python3
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ENV_PATH = Path("/root/supabase-project/.env")
SCRIPT = Path("/tmp/dedupe_medical_historial.py")
REPORT = Path("/tmp/dedupe_medical_historial_report.json")


def load_password() -> str:
    for line in ENV_PATH.read_text(encoding="utf-8", errors="ignore").splitlines():
        if line.startswith("POSTGRES_PASSWORD="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("POSTGRES_PASSWORD not found")


def main() -> int:
    apply = "--apply" in sys.argv
    pw = load_password()
    ip = subprocess.check_output(
        [
            "docker",
            "inspect",
            "-f",
            "{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}",
            "supabase-db",
        ],
        text=True,
    ).strip()
    url = f"postgresql://postgres:{pw}@{ip}:5432/postgres"
    cmd = [
        "python3",
        str(SCRIPT),
        "--database-url",
        url,
        "--report",
        str(REPORT),
        "--apply" if apply else "--dry-run",
    ]
    print("Running:", SCRIPT.name, "--apply" if apply else "--dry-run")
    return subprocess.call(cmd)


if __name__ == "__main__":
    raise SystemExit(main())
