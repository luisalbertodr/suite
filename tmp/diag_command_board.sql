SELECT version FROM supabase_migrations.schema_migrations
WHERE version LIKE '%command_board%' ORDER BY version;

SELECT id FROM companies LIMIT 1 \gset

SELECT public.dashboard_command_board_stats(
  :'id'::uuid,
  :'id'::uuid,
  '2026-07-01'::date,
  '2026-07-10'::date
);
