-- Emitir sync_event_log también en escrituras Suite (agenda_dual_*), no solo Style→Suite.
-- Unifica Realtime para que otras pestañas/dock refresquen sin depender solo de invalidateQueries local.

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
  v_source text;
BEGIN
  v_company_id := dunasoft.style_sync_hub_company_id();
  IF v_company_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF coalesce(current_setting('app.style_sync_inbound', true), '') = '1' THEN
    v_source := 'style_apply';
  ELSE
    v_source := 'suite_dual';
  END IF;

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
    v_company_id, v_source, 'plan2009', v_key, v_action, v_payload, 'applied', now()
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION dunasoft.trg_plan2009_sync_event_log() IS
  'Log Realtime plan2009: Style inbound (style_apply) y Suite dual-write (suite_dual).';
