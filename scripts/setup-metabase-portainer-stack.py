#!/usr/bin/env python3
"""Create Metabase as a Portainer-managed stack (API) on suite-supabase.

Run on 192.168.99.110 (or via SSH):
  python3 /path/to/setup-metabase-portainer-stack.py

Exposes http://HOST:3030 and expects reverse proxy https://metabase.lipoout.com.
"""
from __future__ import annotations

import json
import os
import secrets
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
STACK_NAME = "metabase"
COMPOSE_DIR = Path("/data/compose/metabase")
PORTAINER_COMPOSE_ROOT = Path("/var/lib/docker/volumes/portainer_data/_data/compose")
SECRETS_FILE = Path("/root/suite-metabase-secrets.env")
SITE_URL = os.environ.get("METABASE_SITE_URL", "https://metabase.lipoout.com")
HOST_PORT = os.environ.get("METABASE_HOST_PORT", "3030")


def load_or_create_secrets() -> dict[str, str]:
    if SECRETS_FILE.exists():
        out: dict[str, str] = {}
        for line in SECRETS_FILE.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip().strip('"').strip("'")
        if out.get("MB_DB_PASS") and out.get("POSTGRES_PASSWORD"):
            print(f"SECRETS_LOADED {SECRETS_FILE}")
            return out
    db_pass = secrets.token_urlsafe(24)
    out = {
        "POSTGRES_PASSWORD": db_pass,
        "MB_DB_PASS": db_pass,
        "MB_ENCRYPTION_SECRET_KEY": secrets.token_urlsafe(32),
    }
    SECRETS_FILE.parent.mkdir(parents=True, exist_ok=True)
    SECRETS_FILE.write_text(
        "\n".join(f"{k}={v}" for k, v in out.items()) + "\n",
        encoding="utf-8",
    )
    os.chmod(SECRETS_FILE, 0o600)
    print(f"SECRETS_CREATED {SECRETS_FILE}")
    return out


def build_compose(secrets: dict[str, str]) -> str:
    return f"""\
services:
  metabase-db:
    image: postgres:16-alpine
    container_name: metabase-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: metabase
      POSTGRES_USER: metabase
      POSTGRES_PASSWORD: {secrets['POSTGRES_PASSWORD']}
    volumes:
      - metabase_pg:/var/lib/postgresql/data
    mem_limit: 512m
    memswap_limit: 512m
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U metabase -d metabase"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 20s
    labels:
      - com.portainer.stack.name=metabase

  metabase:
    image: metabase/metabase:v0.55.10
    container_name: metabase
    restart: unless-stopped
    depends_on:
      metabase-db:
        condition: service_healthy
    ports:
      - "{HOST_PORT}:3000"
    environment:
      MB_DB_TYPE: postgres
      MB_DB_DBNAME: metabase
      MB_DB_PORT: 5432
      MB_DB_USER: metabase
      MB_DB_PASS: {secrets['MB_DB_PASS']}
      MB_DB_HOST: metabase-db
      MB_SITE_URL: {SITE_URL}
      JAVA_TIMEZONE: Europe/Madrid
      TZ: Europe/Madrid
      MB_ENCRYPTION_SECRET_KEY: {secrets['MB_ENCRYPTION_SECRET_KEY']}
    mem_limit: 2g
    memswap_limit: 2g
    healthcheck:
      test: ["CMD-SHELL", "curl -fsS http://127.0.0.1:3000/api/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 10
      start_period: 120s
    labels:
      - com.portainer.stack.name=metabase

volumes:
  metabase_pg:
    name: metabase_pg_data
"""


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


def run(cmd: list[str] | str, check: bool = True) -> subprocess.CompletedProcess:
    print("+", cmd if isinstance(cmd, str) else " ".join(cmd))
    return subprocess.run(
        cmd,
        shell=isinstance(cmd, str),
        check=check,
        text=True,
        capture_output=True,
    )


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


def next_compose_id() -> int:
    ids: list[int] = []
    for root in (PORTAINER_COMPOSE_ROOT, Path("/data/compose")):
        if not root.is_dir():
            continue
        for p in root.iterdir():
            if p.name.isdigit():
                ids.append(int(p.name))
    return (max(ids) + 1) if ids else 120


def write_compose_files(stack_id: int, compose: str) -> Path:
    COMPOSE_DIR.mkdir(parents=True, exist_ok=True)
    compose_path = COMPOSE_DIR / "docker-compose.yml"
    compose_path.write_text(compose, encoding="utf-8")
    pdir = PORTAINER_COMPOSE_ROOT / str(stack_id)
    pdir.mkdir(parents=True, exist_ok=True)
    (pdir / "docker-compose.yml").write_text(compose, encoding="utf-8")
    print(f"COMPOSE_WRITTEN {compose_path} and {pdir}")
    return compose_path


def create_stack(token: str, endpoint_id: int, compose: str) -> dict:
    code, stacks = req("GET", "/api/stacks", token=token)
    if code != 200:
        raise SystemExit(f"STACKS_FAIL:{code}:{stacks}")
    for s in stacks:
        if s.get("Name") == STACK_NAME:
            print(f"STACK_EXISTS id={s.get('Id')} — updating")
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
            print(f"UPDATE:{code2}:{json.dumps(updated)[:800]}")
            if code2 not in (200, 201):
                raise SystemExit(1)
            return updated if isinstance(updated, dict) else {"Id": sid}

    payload = {
        "Name": STACK_NAME,
        "StackFileContent": compose,
        "Env": [],
    }
    # Portainer CE reciente: /api/stacks/create/standalone/string (el ?type=2&method=string da 405).
    path = f"/api/stacks/create/standalone/string?endpointId={endpoint_id}"
    code, created = req("POST", path, payload, token=token, timeout=300)
    print(f"CREATE:{code}:{json.dumps(created)[:800]}")
    if code not in (200, 201):
        # fallback legacy
        path_legacy = f"/api/stacks?type=2&method=string&endpointId={endpoint_id}"
        code, created = req("POST", path_legacy, payload, token=token, timeout=300)
        print(f"CREATE_LEGACY:{code}:{json.dumps(created)[:800]}")
        if code not in (200, 201):
            raise SystemExit(1)
    return created


def wait_healthy(timeout_s: int = 300) -> None:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        r = run(
            f"curl -sS -m 5 -o /dev/null -w '%{{http_code}}' http://127.0.0.1:{HOST_PORT}/api/health || true",
            check=False,
        )
        code = (r.stdout or "").strip()
        st = run(
            "docker ps --filter name=^/metabase$ --format '{{.Status}}'",
            check=False,
        )
        print(f"health={code} status={(st.stdout or '').strip()}")
        if code == "200":
            return
        time.sleep(5)
    raise SystemExit("METABASE_NOT_HEALTHY")


def main() -> int:
    secrets_map = load_or_create_secrets()
    compose = build_compose(secrets_map)
    token = auth()
    code, endpoints = req("GET", "/api/endpoints", token=token)
    if code != 200 or not endpoints:
        raise SystemExit(f"ENDPOINTS_FAIL:{code}:{endpoints}")
    endpoint_id = endpoints[0]["Id"]
    print(f"ENDPOINT_ID={endpoint_id}")

    stack_id_guess = next_compose_id()
    write_compose_files(stack_id_guess, compose)

    created = create_stack(token, endpoint_id, compose)
    sid = created.get("Id")
    print(f"STACK_ID={sid}")
    if sid:
        pdir = PORTAINER_COMPOSE_ROOT / str(sid)
        pdir.mkdir(parents=True, exist_ok=True)
        (pdir / "docker-compose.yml").write_text(compose, encoding="utf-8")

    wait_healthy()
    print(f"DONE: Metabase on :{HOST_PORT} site={SITE_URL}")
    print("Next: nginx proxy metabase.lipoout.com -> 192.168.99.110:3030 + SSL")
    return 0


if __name__ == "__main__":
    sys.exit(main())
