#!/usr/bin/env python3
"""Create ElectricSQL sync service as a Portainer stack (F6).

Connects to existing supabase-db with logical replication. Exposes :3060.
Shape access must go through the edge proxy (electric-shape-proxy), not public.

Run on 192.168.99.110:
  python3 /path/to/setup-electric-portainer-stack.py
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

PORTAINER = os.environ.get("PORTAINER_URL", "http://127.0.0.1:9000")
USERS = [
    (os.environ.get("PORTAINER_USER", "admin"), os.environ.get("PORTAINER_PASSWORD", "")),
    ("admin", "Lip0cer#"),
    ("admin", "Lip0cer0"),
    ("luis", "Lip0cer#"),
    ("luis", "Lip0cer0"),
]
STACK_NAME = "electric"
COMPOSE_DIR = Path("/data/compose/electric")
PORTAINER_COMPOSE_ROOT = Path("/var/lib/docker/volumes/portainer_data/_data/compose")
SECRETS_FILE = Path("/root/suite-electric-secrets.env")
HOST_PORT = os.environ.get("ELECTRIC_HOST_PORT", "3060")
DB_CONTAINER = os.environ.get("SUITE_DB_CONTAINER", "supabase-db")


def run(cmd: list[str] | str, check: bool = True) -> subprocess.CompletedProcess:
    print("+", cmd if isinstance(cmd, str) else " ".join(cmd))
    return subprocess.run(
        cmd,
        shell=isinstance(cmd, str),
        check=check,
        text=True,
        capture_output=True,
    )


def req(method: str, path: str, data=None, token: None | str = None, timeout: int = 180):
    url = PORTAINER.rstrip("/") + path
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = None if data is None else json.dumps(data).encode()
    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode(errors="replace")
        try:
            parsed = json.loads(raw) if raw else {}
        except Exception:
            parsed = {"message": raw}
        return e.code, parsed


def auth() -> str:
    for user, password in USERS:
        if not password:
            continue
        code, data = req("POST", "/api/auth", {"Username": user, "Password": password})
        if code == 200 and data.get("jwt"):
            print(f"AUTH_OK user={user}")
            return data["jwt"]
        print(f"AUTH_FAIL user={user} code={code}")
    raise SystemExit("No Portainer credentials worked")


def resolve_database_url() -> str:
    if os.environ.get("ELECTRIC_DATABASE_URL"):
        return os.environ["ELECTRIC_DATABASE_URL"]
    if SECRETS_FILE.exists():
        for line in SECRETS_FILE.read_text(encoding="utf-8").splitlines():
            if line.startswith("ELECTRIC_DATABASE_URL="):
                return line.split("=", 1)[1].strip().strip('"')
    # Pull postgres password from supabase .env
    password = ""
    for candidate in (
        Path("/root/supabase-project/.env"),
        Path("/root/supabase/.env"),
    ):
        if not candidate.is_file():
            continue
        for line in candidate.read_text(encoding="utf-8", errors="ignore").splitlines():
            if line.startswith("POSTGRES_PASSWORD="):
                password = line.split("=", 1)[1].strip().strip('"')
                break
        if password:
            break
    if not password:
        raise SystemExit("POSTGRES_PASSWORD not found; set ELECTRIC_DATABASE_URL")
    # Use docker network hostname of supabase-db
    url = f"postgresql://postgres:{password}@{DB_CONTAINER}:5432/postgres?sslmode=disable"
    SECRETS_FILE.write_text(f"ELECTRIC_DATABASE_URL={url}\n", encoding="utf-8")
    os.chmod(SECRETS_FILE, 0o600)
    print(f"SECRETS_CREATED {SECRETS_FILE}")
    return url


def ensure_logical_replication() -> None:
    sql = """
SELECT setting FROM pg_settings WHERE name = 'wal_level';
"""
    r = run(
        f'docker exec -i {DB_CONTAINER} psql -U postgres -d postgres -tAc "SELECT setting FROM pg_settings WHERE name = \'wal_level\'"',
        check=False,
    )
    wal = (r.stdout or "").strip()
    print(f"wal_level={wal}")
    if wal != "logical":
        print("WARN: wal_level is not logical. Electric requires logical replication.")
        print("Set wal_level=logical on supabase-db and restart Postgres before relying on sync.")
    # Role + grants for pilot table (idempotent)
    setup_sql = r"""
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'electric') THEN
    CREATE ROLE electric WITH LOGIN REPLICATION PASSWORD 'electric_suite_change_me';
  END IF;
END$$;
GRANT USAGE ON SCHEMA public TO electric;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO electric;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO electric;
GRANT SELECT ON public.suite_service_status TO electric;
"""
    r2 = run(
        ["docker", "exec", "-i", DB_CONTAINER, "psql", "-U", "postgres", "-d", "postgres"],
        check=False,
    )
    # feed SQL via stdin
    p = subprocess.run(
        ["docker", "exec", "-i", DB_CONTAINER, "psql", "-U", "postgres", "-d", "postgres"],
        input=setup_sql,
        text=True,
        capture_output=True,
        check=False,
    )
    print(p.stdout or "")
    if p.returncode != 0:
        print(p.stderr or "")
        print("WARN: electric role setup had errors (may already exist)")


def build_compose(database_url: str) -> str:
    # Prefer connecting as postgres for setup simplicity; proxy secures the API.
    # Mask password in logs only — compose file is root-only on host.
    return f"""\
services:
  electric:
    image: electricsql/electric:latest
    container_name: suite-electric
    restart: unless-stopped
    ports:
      - "{HOST_PORT}:3000"
    environment:
      DATABASE_URL: "{database_url}"
      ELECTRIC_INSECURE: "true"
      ELECTRIC_LOG_LEVEL: info
      TZ: Europe/Madrid
    mem_limit: 768m
    memswap_limit: 768m
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:3000/v1/health >/dev/null 2>&1 || curl -fsS http://127.0.0.1:3000/v1/health >/dev/null || exit 1"]
      interval: 20s
      timeout: 8s
      retries: 10
      start_period: 40s
    labels:
      - com.portainer.stack.name=electric
    # Join default bridge / host network of supabase stack via external network if present
    networks:
      - default
      - supabase_default

networks:
  supabase_default:
    external: true
    name: supabase_default
"""


def create_or_update_stack(token: str, endpoint_id: int, compose: str) -> None:
    code, stacks = req("GET", "/api/stacks", token=token)
    if code != 200:
        raise SystemExit(f"STACKS_FAIL:{code}:{stacks}")
    for s in stacks:
        if s.get("Name") == STACK_NAME:
            sid = s["Id"]
            payload = {
                "stackFileContent": compose,
                "env": [],
                "prune": True,
                "pullImage": True,
            }
            code2, updated = req(
                "PUT",
                f"/api/stacks/{sid}?endpointId={endpoint_id}",
                payload,
                token=token,
                timeout=300,
            )
            print(f"UPDATE:{code2}:{json.dumps(updated)[:500]}")
            if code2 not in (200, 201):
                docker_compose_up(compose)
            return
    payload = {"Name": STACK_NAME, "StackFileContent": compose, "Env": []}
    path = f"/api/stacks/create/standalone/string?endpointId={endpoint_id}"
    code, created = req("POST", path, payload, token=token, timeout=300)
    print(f"CREATE:{code}:{json.dumps(created)[:500]}")
    if code not in (200, 201):
        docker_compose_up(compose)


def docker_compose_up(compose: str) -> None:
    COMPOSE_DIR.mkdir(parents=True, exist_ok=True)
    (COMPOSE_DIR / "docker-compose.yml").write_text(compose, encoding="utf-8")
    # If supabase_default network missing, rewrite without it
    r = run("docker network ls --format '{{.Name}}'", check=False)
    nets = (r.stdout or "")
    if "supabase_default" not in nets:
        compose2 = re.sub(
            r"\n    networks:[\s\S]*?\nnetworks:[\s\S]*",
            "\n",
            compose,
        )
        (COMPOSE_DIR / "docker-compose.yml").write_text(compose2, encoding="utf-8")
        print("WARN: supabase_default network missing — Electric on default bridge only")
        # Prefer host gateway URL instead
        print("TIP: set ELECTRIC_DATABASE_URL to host.docker.internal / 172.17.0.1 if needed")
    r2 = run(
        f"cd {COMPOSE_DIR} && docker compose -p electric pull && docker compose -p electric up -d --remove-orphans",
        check=False,
    )
    print(r2.stdout or "")
    print(r2.stderr or "")
    if r2.returncode != 0:
        raise SystemExit(f"DOCKER_COMPOSE_FAIL:{r2.returncode}")


def wait_healthy(timeout_s: int = 240) -> None:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        r = run(
            f"curl -sS -m 5 -o /dev/null -w '%{{http_code}}' http://127.0.0.1:{HOST_PORT}/v1/health || true",
            check=False,
        )
        code = (r.stdout or "").strip()
        print(f"electric_health={code}")
        if code == "200":
            return
        time.sleep(5)
    print("WARN: Electric health not 200 yet — check wal_level and DATABASE_URL")


def main() -> int:
    db_url = resolve_database_url()
    ensure_logical_replication()
    compose = build_compose(db_url)
    COMPOSE_DIR.mkdir(parents=True, exist_ok=True)
    (COMPOSE_DIR / "docker-compose.yml").write_text(compose, encoding="utf-8")

    token = auth()
    code, endpoints = req("GET", "/api/endpoints", token=token)
    if code != 200 or not endpoints:
        raise SystemExit(f"ENDPOINTS_FAIL:{code}:{endpoints}")
    endpoint_id = endpoints[0]["Id"]
    create_or_update_stack(token, endpoint_id, compose)
    wait_healthy()
    print(f"DONE: Electric on :{HOST_PORT}")
    print("Shapes via Edge Function electric-shape-proxy (not public).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
