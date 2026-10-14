-- F6: garantizar SELECT de Electric sobre el piloto suite_service_status
-- (el GRANT genérico a veces no aplica por ownership/RLS de tablas).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'electric') THEN
    CREATE ROLE electric WITH LOGIN REPLICATION PASSWORD 'electric_suite_change_me';
  END IF;
END$$;

GRANT USAGE ON SCHEMA public TO electric;

DO $$
BEGIN
  IF to_regclass('public.suite_service_status') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON TABLE public.suite_service_status TO electric';
  END IF;
END$$;
