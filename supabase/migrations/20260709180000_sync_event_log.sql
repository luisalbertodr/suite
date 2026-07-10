-- Log de eventos Style→Suite para Realtime en agenda (sin depender del poll del agente).

CREATE TABLE IF NOT EXISTS dunasoft.sync_event_log (
  id            bigserial PRIMARY KEY,
  company_id    uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  source        text NOT NULL,
  entity        text NOT NULL,
  entity_key    text NOT NULL,
  action        text NOT NULL,
  payload       jsonb,
  sync_version  bigint,
  status        text NOT NULL DEFAULT 'applied',
  created_at    timestamptz NOT NULL DEFAULT now(),
  processed_at  timestamptz
);

CREATE INDEX IF NOT EXISTS sync_event_log_company_entity_created_idx
  ON dunasoft.sync_event_log (company_id, entity, created_at DESC);

CREATE INDEX IF NOT EXISTS sync_event_log_entity_key_idx
  ON dunasoft.sync_event_log (entity, entity_key, created_at DESC);

COMMENT ON TABLE dunasoft.sync_event_log IS
  'Event log Style→Suite; la agenda web se actualiza vía Realtime sin poll del agente.';

CREATE OR REPLACE FUNCTION dunasoft.trg_plan2009_sync_event_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
DECLARE
  v_company_id uuid;
  v_action text;
  v_key text;
  v_payload jsonb;
BEGIN
  IF coalesce(current_setting('app.style_sync_inbound', true), '') <> '1' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_company_id := dunasoft.style_sync_hub_company_id();

  IF TG_OP = 'DELETE' THEN
    v_action := 'DEL';
    v_key := OLD.idplan::text;
    v_payload := jsonb_build_object(
      'idplan', OLD.idplan,
      'fecha', OLD.fecha,
      'codemp', OLD.codemp
    );
  ELSE
    v_action := CASE WHEN TG_OP = 'INSERT' THEN 'INS' ELSE 'UPD' END;
    v_key := NEW.idplan::text;
    v_payload := jsonb_build_object(
      'idplan', NEW.idplan,
      'fecha', NEW.fecha,
      'codemp', NEW.codemp,
      'horini', NEW.horini,
      'horfin', NEW.horfin,
      'codcli', NEW.codcli
    );
  END IF;

  INSERT INTO dunasoft.sync_event_log (
    company_id, source, entity, entity_key, action, payload, status, processed_at
  ) VALUES (
    v_company_id, 'style_apply', 'plan2009', v_key, v_action, v_payload, 'applied', now()
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS plan2009_sync_event_log ON dunasoft.plan2009;
CREATE TRIGGER plan2009_sync_event_log
  AFTER INSERT OR UPDATE OR DELETE ON dunasoft.plan2009
  FOR EACH ROW
  EXECUTE FUNCTION dunasoft.trg_plan2009_sync_event_log();

GRANT SELECT ON dunasoft.sync_event_log TO authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE dunasoft.sync_event_log_id_seq TO service_role;

ALTER TABLE dunasoft.sync_event_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sync_event_log_select_company ON dunasoft.sync_event_log;
CREATE POLICY sync_event_log_select_company ON dunasoft.sync_event_log
  FOR SELECT TO authenticated
  USING (
    company_id = public.get_user_company_id()
    OR company_id = dunasoft.style_sync_hub_company_id()
  );

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'dunasoft'
        AND tablename = 'sync_event_log'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE dunasoft.sync_event_log;
    END IF;
  END IF;
END $$;
