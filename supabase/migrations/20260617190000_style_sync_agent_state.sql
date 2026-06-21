-- Track agent progress without writing DBF from Docker.
-- Each company processes cola_sincro rows with id > last_cola_id.

CREATE TABLE IF NOT EXISTS dunasoft.style_sync_agent_state (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  last_cola_id bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION dunasoft.style_sync_agent_state_touch()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS style_sync_agent_state_touch ON dunasoft.style_sync_agent_state;
CREATE TRIGGER style_sync_agent_state_touch
BEFORE UPDATE ON dunasoft.style_sync_agent_state
FOR EACH ROW EXECUTE FUNCTION dunasoft.style_sync_agent_state_touch();

GRANT SELECT, INSERT, UPDATE ON dunasoft.style_sync_agent_state TO service_role;

