-- F6 ElectricSQL: logical replication prerequisites on Suite Postgres.
-- Apply on supabase-db (prefer deploy-migration.ps1 or psql inside container).
-- Electric also needs wal_level=logical (supabase typically already has it).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'electric') THEN
    CREATE ROLE electric WITH LOGIN REPLICATION PASSWORD 'electric_suite_change_me';
  END IF;
END$$;

GRANT USAGE ON SCHEMA public TO electric;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO electric;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO electric;

-- Pilot shape table (service monitor status)
GRANT SELECT ON TABLE public.suite_service_status TO electric;

COMMENT ON ROLE electric IS 'F6 ElectricSQL sync role (REPLICATION); change password after create';
