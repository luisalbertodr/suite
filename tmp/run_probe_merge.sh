#!/bin/bash
set -euo pipefail
docker exec -i supabase-db psql -U postgres -d postgres -f - < /tmp/probe_merge_targets.sql
