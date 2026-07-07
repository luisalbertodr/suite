SELECT version FROM supabase_migrations.schema_migrations
WHERE version >= '20260701' ORDER BY version;
