#!/bin/bash
set -e
COMPOSE=/root/supabase-project/docker-compose.yml
python3 <<'PY'
from pathlib import Path
p = Path("/root/supabase-project/docker-compose.yml")
lines = p.read_text().splitlines()
out = []
for line in lines:
    if "IMMICH_BASE_URL" in line and "IMMICH_API_KEY" in line:
        out.append("      IMMICH_BASE_URL: ${IMMICH_BASE_URL}")
        out.append("      IMMICH_API_KEY: ${IMMICH_API_KEY}")
    elif line.strip().startswith("IMMICH_"):
        continue
    else:
        out.append(line)
p.write_text("\n".join(out) + "\n")
PY
cd /root/supabase-project
docker compose up -d functions
sleep 3
docker exec supabase-edge-functions printenv IMMICH_BASE_URL
