#!/bin/bash
set -euo pipefail
docker exec -i supabase-db psql -U postgres -d postgres <<'SQL' > /tmp/clientes_nuevos.csv
\copy (SELECT name, coalesce(legacy_codcli,'') AS codigo, id::text AS customer_id, coalesce(created_at::text,'') AS created_at FROM public.customers WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4' AND created_at::date >= DATE '2026-07-17' AND (lower(name) IN ('mar lamas pernas','santiago rojo martinez','maria cambon','paqui fernandez') OR lower(name) LIKE '%dabrio%' OR lower(name) LIKE 'paqui fern%') ORDER BY name) TO STDOUT WITH CSV HEADER
SQL
wc -l /tmp/clientes_nuevos.csv
cat /tmp/clientes_nuevos.csv
