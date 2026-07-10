#!/bin/bash
docker exec supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SQL'
SELECT version FROM supabase_migrations.schema_migrations
WHERE version LIKE '%command_board%' ORDER BY version;

SELECT id FROM companies LIMIT 1 \gset
\echo company :id

SELECT public.dashboard_command_board_stats(
  :'id'::uuid,
  :'id'::uuid,
  '2026-07-01'::date,
  '2026-07-10'::date
);
SQL
