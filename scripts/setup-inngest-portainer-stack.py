#!/usr/bin/env python3
"""Create Inngest + suite-jobs as a Portainer stack on suite-supabase (F5).

Copies suite-jobs/ into /data/compose/inngest/, builds the worker image, and
registers the stack. Dashboard: http://HOST:8288

Run on 192.168.99.110 (or via SSH):
  python3 /path/to/setup-inngest-portainer-stack.py
"""
from __future__ import annotations

import json
import os
import secrets
import shutil
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
STACK_NAME = "inngest"
COMPOSE_DIR = Path("/data/compose/inngest")
PORTAINER_COMPOSE_ROOT = Path("/var/lib/docker/volumes/portainer_data/_data/compose")
SECRETS_FILE = Path("/root/suite-inngest-secrets.env")
HOST_PORT = os.environ.get("INNGEST_HOST_PORT", "8288")
JOBS_PORT = os.environ.get("SUITE_JOBS_HOST_PORT", "3100")
SUPABASE_URL = os.environ.get("SUITE_SUPABASE_URL", "https://supabase.lipoout.com")

# Repo root when script lives in scripts/; override with SUITE_REPO_ROOT
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = Path(os.environ.get("SUITE_REPO_ROOT", str(SCRIPT_DIR.parent)))
SUITE_JOBS_SRC = REPO_ROOT / "suite-jobs"


def load_or_create_secrets() -> dict[str, str]:
    if SECRETS_FILE.exists():
        out: dict[str, str] = {}
        for line in SECRETS_FILE.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip().strip('"').strip("'")
        if out.get("INNGEST_EVENT_KEY") and out.get("INNGEST_SIGNING_KEY"):
            print(f"SECRETS_LOADED {SECRETS_FILE}")
            return out
    out = {
        "INNGEST_EVENT_KEY": secrets.token_hex(16),
        "INNGEST_SIGNING_KEY": secrets.token_hex(32),
        "SERVICE_MONITOR_CRON_SECRET": os.environ.get("SERVICE_MONITOR_CRON_SECRET", ""),
        "SUITE_SUPABASE_ANON_KEY": os.environ.get("SUITE_SUPABASE_ANON_KEY", ""),
    }
    # Try pull anon from supabase .env if empty
    for candidate in (
        Path("/root/supabase-project/.env"),
        Path("/root/supabase/.env"),
    ):
        if not candidate.is_file() or out["SUITE_SUPABASE_ANON_KEY"]:
            continue
        for line in candidate.read_text(encoding="utf-8", errors="ignore").splitlines():
            if line.startswith("ANON_KEY="):
                out["SUITE_SUPABASE_ANON_KEY"] = line.split("=", 1)[1].strip().strip('"')
            if line.startswith("SERVICE_MONITOR_CRON_SECRET=") and not out["SERVICE_MONITOR_CRON_SECRET"]:
                out["SERVICE_MONITOR_CRON_SECRET"] = line.split("=", 1)[1].strip().strip('"')
    SECRETS_FILE.parent.mkdir(parents=True, exist_ok=True)
    SECRETS_FILE.write_text(
        "\n".join(f"{k}={v}" for k, v in out.items()) + "\n",
        encoding="utf-8",
    )
    os.chmod(SECRETS_FILE, 0o600)
    print(f"SECRETS_CREATED {SECRETS_FILE}")
    return out


def build_compose(secrets: dict[str, str]) -> str:
    event_key = secrets["INNGEST_EVENT_KEY"]
    signing_key = secrets["INNGEST_SIGNING_KEY"]
    cron_secret = secrets.get("SERVICE_MONITOR_CRON_SECRET", "")
    anon = secrets.get("SUITE_SUPABASE_ANON_KEY", "")
    return f"""\
services:
  inngest:
    image: inngest/inngest:v1.11.5
    container_name: suite-inngest
    restart: unless-stopped
    command:
      - inngest
      - start
      - --event-key={event_key}
      - --signing-key={signing_key}
      - --sdk-url=http://suite-jobs:3100/api/inngest
      - --poll-interval=30
      - --sqlite-dir=/data
      - --port=8288
    ports:
      - "{HOST_PORT}:8288"
    volumes:
      - inngest_data:/data
    environment:
      INNGEST_EVENT_KEY: "{event_key}"
      INNGEST_SIGNING_KEY: "{signing_key}"
      TZ: Europe/Madrid
    mem_limit: 512m
    memswap_limit: 512m
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:8288/health >/dev/null 2>&1 || curl -fsS http://127.0.0.1:8288/health >/dev/null || exit 1"]
      interval: 20s
      timeout: 8s
      retries: 8
      start_period: 40s
    labels:
      - com.portainer.stack.name=inngest
    depends_on:
      - suite-jobs

  suite-jobs:
    build:
      context: ./suite-jobs
      dockerfile: Dockerfile
    image: suite-jobs:local
    container_name: suite-jobs
    restart: unless-stopped
    ports:
      - "{JOBS_PORT}:3100"
    environment:
      PORT: "3100"
      INNGEST_EVENT_KEY: "{event_key}"
      INNGEST_SIGNING_KEY: "{signing_key}"
      INNGEST_DEV: "0"
      INNGEST_BASE_URL: http://inngest:8288
      SUITE_SUPABASE_URL: "{SUPABASE_URL}"
      SUITE_SUPABASE_ANON_KEY: "{anon}"
      SERVICE_MONITOR_CRON_SECRET: "{cron_secret}"
      SUITE_HEALTH_CRON: "*/5 * * * *"
      SUITE_WA_QUEUE_CRON: "off"
      TZ: Europe/Madrid
    mem_limit: 256m
    memswap_limit: 256m
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:3100/health >/dev/null 2>&1 || curl -fsS http://127.0.0.1:3100/health >/dev/null || exit 1"]
      interval: 20s
      timeout: 5s
      retries: 8
      start_period: 30s
    labels:
      - com.portainer.stack.name=inngest

volumes:
  inngest_data:
    name: suite_inngest_data
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


def sync_suite_jobs() -> None:
    if not SUITE_JOBS_SRC.is_dir():
        raise SystemExit(f"SUITE_JOBS_MISSING {SUITE_JOBS_SRC}")
    dest = COMPOSE_DIR / "suite-jobs"
    COMPOSE_DIR.mkdir(parents=True, exist_ok=True)
    if dest.exists():
        shutil.rmtree(dest)
    shutil.copytree(
        SUITE_JOBS_SRC,
        dest,
        ignore=shutil.ignore_patterns("node_modules", "dist", ".git"),
    )
    print(f"SUITE_JOBS_COPIED -> {dest}")


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
                timeout=600,
            )
            print(f"UPDATE:{code2}:{json.dumps(updated)[:800]}")
            if code2 not in (200, 201):
                # Portainer may not build remote context; fall back to docker compose
                print("PORTAINER_UPDATE_FAILED — docker compose fallback")
                return {"Id": sid, "fallback": True}
            return updated if isinstance(updated, dict) else {"Id": sid}

    payload = {
        "Name": STACK_NAME,
        "StackFileContent": compose,
        "Env": [],
    }
    path = f"/api/stacks/create/standalone/string?endpointId={endpoint_id}"
    code, created = req("POST", path, payload, token=token, timeout=600)
    print(f"CREATE:{code}:{json.dumps(created)[:800]}")
    if code not in (200, 201):
        print("PORTAINER_CREATE_FAILED — docker compose fallback")
        return {"fallback": True}
    return created


def docker_compose_up(compose: str) -> None:
    COMPOSE_DIR.mkdir(parents=True, exist_ok=True)
    (COMPOSE_DIR / "docker-compose.yml").write_text(compose, encoding="utf-8")
    r = run(
        f"cd {COMPOSE_DIR} && docker compose -p inngest build --pull && docker compose -p inngest up -d --remove-orphans",
        check=False,
    )
    print(r.stdout or "")
    print(r.stderr or "")
    if r.returncode != 0:
        raise SystemExit(f"DOCKER_COMPOSE_FAIL:{r.returncode}")


def wait_healthy(timeout_s: int = 300) -> None:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        r = run(
            f"curl -sS -m 5 -o /dev/null -w '%{{http_code}}' http://127.0.0.1:{JOBS_PORT}/health || true",
            check=False,
        )
        jobs = (r.stdout or "").strip()
        r2 = run(
            f"curl -sS -m 5 -o /dev/null -w '%{{http_code}}' http://127.0.0.1:{HOST_PORT}/ || true",
            check=False,
        )
        ui = (r2.stdout or "").strip()
        print(f"jobs_health={jobs} inngest_ui={ui}")
        if jobs == "200":
            return
        time.sleep(5)
    raise SystemExit("INNGEST_JOBS_NOT_HEALTHY")


def main() -> int:
    secrets_map = load_or_create_secrets()
    sync_suite_jobs()
    compose = build_compose(secrets_map)
    (COMPOSE_DIR / "docker-compose.yml").write_text(compose, encoding="utf-8")

    token = auth()
    code, endpoints = req("GET", "/api/endpoints", token=token)
    if code != 200 or not endpoints:
        raise SystemExit(f"ENDPOINTS_FAIL:{code}:{endpoints}")
    endpoint_id = endpoints[0]["Id"]
    print(f"ENDPOINT_ID={endpoint_id}")

    created = create_stack(token, endpoint_id, compose)
    if created.get("fallback") or not created.get("Id"):
        docker_compose_up(compose)
    else:
        # Still ensure build context exists under Portainer compose id
        sid = created.get("Id")
        if sid:
            pdir = PORTAINER_COMPOSE_ROOT / str(sid)
            pdir.mkdir(parents=True, exist_ok=True)
            (pdir / "docker-compose.yml").write_text(compose, encoding="utf-8")
            dest = pdir / "suite-jobs"
            if dest.exists():
                shutil.rmtree(dest)
            shutil.copytree(
                COMPOSE_DIR / "suite-jobs",
                dest,
                ignore=shutil.ignore_patterns("node_modules", "dist"),
            )
            docker_compose_up(compose)

    wait_healthy()
    print(f"DONE: Inngest UI :{HOST_PORT}  suite-jobs :{JOBS_PORT}")
    print(f"Secrets: {SECRETS_FILE}")
    print("Next: optional nginx inngest.lipoout.com -> 192.168.99.110:8288")
    return 0


if __name__ == "__main__":
    sys.exit(main())
