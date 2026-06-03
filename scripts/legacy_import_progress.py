"""Progreso de importación legacy (consola + legacy_import_runs)."""
from __future__ import annotations

import json
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]


def load_dotenv() -> None:
    env_path = ROOT / ".env"
    if not env_path.is_file():
        return
    for line in env_path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = val

try:
    import psycopg2
except ImportError:
    psycopg2 = None  # type: ignore

from legacy_company import get_company_id


def _dsn() -> str:
    return os.environ.get("SUPABASE_DB_URL", "").strip()


def print_progress(index: int, total: int, label: str) -> None:
    pct = int(100 * index / total) if total > 0 else 0
    print(f"[{index}/{total}] ({pct}%) {label}", flush=True)


def create_legacy_import_run(
    *,
    mode: str = "full",
    company_id: str | None = None,
    options: dict[str, Any] | None = None,
    label: str = "sync_dunasoft_from_zero",
) -> str:
    """Inserta fila en legacy_import_runs (conexión Postgres directa)."""
    load_dotenv()
    if not psycopg2:
        raise RuntimeError("pip install psycopg2-binary")
    dsn = _dsn()
    if not dsn:
        raise RuntimeError("Falta SUPABASE_DB_URL")

    cid = company_id or get_company_id()
    run_id = str(uuid.uuid4())
    opts = {"label": label, **(options or {})}

    conn = psycopg2.connect(dsn, connect_timeout=15)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO public.legacy_import_runs (
                  id, company_id, mode, status, options, current_step, started_at
                ) VALUES (
                  %s::uuid, %s::uuid, %s, 'running', %s::jsonb, %s, %s
                )
                """,
                (
                    run_id,
                    cid,
                    mode,
                    json.dumps(opts),
                    "0/? inicio",
                    datetime.now(timezone.utc),
                ),
            )
    finally:
        conn.close()

    print(f"Run ID (ver en Configuración → Importar): {run_id}", file=sys.stderr, flush=True)
    return run_id


def tracker_from_env() -> Any:
    run_id = os.environ.get("LEGACY_IMPORT_RUN_ID", "").strip()
    if not run_id:
        return None
    from legacy_import_run_tracker import RunTracker

    return RunTracker(run_id)


def set_run_progress(run_id: str, index: int, total: int, label: str) -> None:
    if not run_id or not psycopg2 or not _dsn():
        return
    pct = int(100 * index / total) if total > 0 else 0
    step_label = f"{index}/{total} ({pct}%) {label}"
    conn = psycopg2.connect(_dsn(), connect_timeout=15)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE public.legacy_import_runs
                SET current_step = %s
                WHERE id = %s::uuid
                """,
                (step_label[:500], run_id),
            )
    finally:
        conn.close()


def _tunnel_local_url(url: str) -> str:
    for host in ("192.168.99.110", "localhost"):
        needle = f"@{host}:5433"
        if needle in url:
            return url.replace(needle, "@127.0.0.1:5433")
    return url


def _port_open(host: str, port: int) -> bool:
    import socket

    try:
        with socket.create_connection((host, port), timeout=2):
            return True
    except OSError:
        return False


def ensure_db_connection(dsn: str | None = None, tunnel_hint: bool = True) -> str:
    """Comprueba Postgres; opcionalmente abre túnel SSH a 127.0.0.1:5433."""
    load_dotenv()
    url = (dsn or _dsn()).strip()
    if not url:
        raise SystemExit("Falta SUPABASE_DB_URL en .env")

    import psycopg2 as pg

    local_url = _tunnel_local_url(url)

    def try_url(candidate: str, label: str) -> str | None:
        try:
            pg.connect(candidate, connect_timeout=8).close()
            print(f"Conexión Postgres OK ({label})", file=sys.stderr, flush=True)
            return candidate
        except Exception:
            return None

    hit = try_url(url, "directa")
    if hit:
        return hit
    if local_url != url:
        hit = try_url(local_url, "túnel 127.0.0.1")
        if hit:
            return hit

    if not tunnel_hint:
        raise SystemExit(
            "No hay conexión a Postgres. Abra túnel: "
            "ssh -i %USERPROFILE%\\.ssh\\suite_deploy -f -N -L 5433:192.168.208.12:5432 suite-supabase"
        )

    if not _port_open("127.0.0.1", 5433):
        print("Abriendo túnel SSH 127.0.0.1:5433 …", file=sys.stderr, flush=True)
        import subprocess

        ssh_key = os.path.join(os.environ.get("USERPROFILE", ""), ".ssh", "suite_deploy")
        try:
            subprocess.run(
                [
                    "ssh",
                    "-i",
                    ssh_key,
                    "-o",
                    "ConnectTimeout=12",
                    "-o",
                    "BatchMode=yes",
                    "-f",
                    "-N",
                    "-L",
                    "5433:192.168.208.12:5432",
                    "suite-supabase",
                ],
                check=False,
                timeout=20,
                capture_output=True,
            )
        except subprocess.TimeoutExpired:
            print("SSH túnel: timeout. Ejecute el comando ssh manualmente.", file=sys.stderr)

    import time

    for _ in range(8):
        time.sleep(1)
        hit = try_url(local_url, "túnel 127.0.0.1")
        if hit:
            return hit

    raise SystemExit(
        "No se pudo conectar a Postgres.\n"
        "En otra terminal PowerShell:\n"
        "  ssh -i $env:USERPROFILE\\.ssh\\suite_deploy -f -N "
        "-L 5433:192.168.208.12:5432 suite-supabase\n"
        "Luego repita el comando."
    )
