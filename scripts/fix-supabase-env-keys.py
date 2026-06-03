#!/usr/bin/env python3
"""Sincroniza JWT_SECRET, ANON_KEY y SERVICE_ROLE_KEY en .env con Kong/Auth en ejecución."""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path


def run(*args: str) -> str:
    return subprocess.check_output(list(args), text=True).strip()


def extract_kong_key(kong_yml: str, username: str) -> str:
    lines = kong_yml.splitlines()
    for i, line in enumerate(lines):
        if f"username: {username}" in line:
            for j in range(i, min(i + 8, len(lines))):
                if "key:" in lines[j]:
                    return lines[j].split("key:", 1)[1].strip()
    raise RuntimeError(f"No se encontró key para consumer {username}")


def main() -> int:
    env_path = Path(sys.argv[1] if len(sys.argv) > 1 else "/root/supabase-project/.env")
    kong_yml = run("docker", "exec", "supabase-kong", "cat", "/home/kong/kong.yml")
    anon = extract_kong_key(kong_yml, "anon")
    srk = extract_kong_key(kong_yml, "service_role")
    jwt = run("docker", "exec", "supabase-auth", "printenv", "GOTRUE_JWT_SECRET")

    if not anon or not srk or not jwt:
        print("ERROR: claves vacías", file=sys.stderr)
        return 1

    text = env_path.read_text() if env_path.exists() else ""
    lines = text.splitlines()
    updates = {"JWT_SECRET": jwt, "ANON_KEY": anon, "SERVICE_ROLE_KEY": srk}
    out: list[str] = []
    seen: set[str] = set()
    for line in lines:
        m = re.match(r"^([A-Z_]+)=", line)
        if m and m.group(1) in updates:
            k = m.group(1)
            out.append(f"{k}={updates[k]}")
            seen.add(k)
        else:
            out.append(line)
    for k, v in updates.items():
        if k not in seen:
            out.append(f"{k}={v}")
    env_path.write_text("\n".join(out) + "\n")
    print(f"OK {env_path}: anon={len(anon)} srk={len(srk)} jwt={len(jwt)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
