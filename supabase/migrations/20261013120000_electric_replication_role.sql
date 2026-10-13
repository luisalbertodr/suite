-- F6 ElectricSQL: rol con REPLICATION + SELECT (piloto suite_service_status).
-- wal_level=logical debe estar activo en supabase-db (revisar si Electric no arranca).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'electric') THEN
    CREATE ROLE electric WITH LOGIN REPLICATION PASSWORD 'electric_suite_change_me';
  END IF;
END$$;

GRANT USAGE ON SCHEMA public TO electric;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO electric;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO electric;

DO $$
BEGIN
  IF to_regclass('public.suite_service_status') IS NOT NULL THEN
    GRANT SELECT ON TABLE public.suite_service_status TO electric;
  END IF;
END$$;

COMMENT ON ROLE electric IS 'F6 ElectricSQL sync role; rotate password after first deploy';
