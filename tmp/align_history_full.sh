#!/bin/bash
# Alinea histórico completo (< 2026) con Dunasoft faccab serie A.
set -euo pipefail

REMOTE=/tmp/suite-align-202606041530
LOG=/tmp/align_history_full.log
exec > >(tee -a "$LOG") 2>&1

echo "=== Inicio $(date -Iseconds) ==="

# 1) Purga legacy importada pre-2026 por año (2010-2017 ya reducido)
for y in $(seq 2018 2025); do
  bash /tmp/purge_legacy_history_loop.sh "${y}-01-01" "$((y+1))-01-01"
done

# 2) Ventas LEG/legacy pre-2026
docker exec -i supabase-db psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
DELETE FROM public.sale_items si
USING public.sales s
WHERE si.sale_id = s.id
  AND s.company_id IN (
    '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid,
    '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
  )
  AND s.created_at < TIMESTAMPTZ '2026-01-01'
  AND (s.ticket_number LIKE 'LEG-%' OR COALESCE(s.notes, '') ILIKE '%legacy%');
DELETE FROM public.sales s
WHERE s.company_id IN (
    '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid,
    '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
  )
  AND s.created_at < TIMESTAMPTZ '2026-01-01'
  AND (s.ticket_number LIKE 'LEG-%' OR COALESCE(s.notes, '') ILIKE '%legacy%');
SQL

# 3) Rebuild faccab serie A por año
PGPASS=$(docker exec supabase-db printenv POSTGRES_PASSWORD)
DBIP=$(docker inspect -f "{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}" supabase-db)
export SUPABASE_DB_URL="postgresql://postgres:${PGPASS}@${DBIP}:5432/postgres"
export PYTHONUNBUFFERED=1

for y in $(seq 2012 2025); do
  echo "=== Rebuild $y ==="
  python3 "$REMOTE/rebuild_legacy_faccab_invoices.py" \
    --apply \
    --from-date "${y}-01-01" \
    --to-date "$((y+1))-01-01" \
    --create-placeholder-customers
done

# 4) Purga duplicados other pre-2026 por año
for y in $(seq 2012 2025); do
  bash /tmp/purge_other_history_loop.sh "${y}-01-01" "$((y+1))-01-01"
done

echo "=== Resumen legacy restante ==="
docker exec supabase-db psql -U postgres -tAc \
  "SELECT COUNT(*) FROM invoices WHERE issue_date < '2026-01-01' AND (notes ILIKE '%legacy%' OR number LIKE 'LEG-%')"

echo "=== Fin $(date -Iseconds) ==="
