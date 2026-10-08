-- Read-only role for Metabase → Suite Postgres (run as supabase_admin / postgres).
-- Does NOT grant auth schema secrets; only public business tables.
-- Password: set via ALTER ROLE after first create, store outside git.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'metabase_ro') THEN
    CREATE ROLE metabase_ro LOGIN PASSWORD 'CHANGE_ME_ON_SERVER';
  END IF;
END $$;

GRANT CONNECT ON DATABASE postgres TO metabase_ro;
GRANT USAGE ON SCHEMA public TO metabase_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO metabase_ro;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO metabase_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO metabase_ro;

-- Metabase connection (from Metabase container / host network):
-- Host: host.docker.internal OR 172.17.0.1 OR supabase-db (if on same docker network)
-- Port: 5432
-- Database: postgres
-- User: metabase_ro
-- SSL: disable (LAN)
