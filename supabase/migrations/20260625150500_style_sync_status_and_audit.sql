-- Fase 0: observabilidad del canal ampliado.
--   * style_sync_agent_status devuelve también lag/errores por entidad (style_sync_cursor)
--     y el pendiente de style_sync_outbox.
--   * style_sync_baseline_audit reporta cobertura de mapeos (legacy_codcli/legacy_codart)
--     para decidir si hace falta un backfill antes de activar el sync en tiempo real.

CREATE OR REPLACE FUNCTION public.style_sync_agent_status(p_company_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, dunasoft
AS $$
DECLARE
  v_company_id uuid := COALESCE(p_company_id, public.get_user_company_id());
  v_row dunasoft.style_sync_agent_state%ROWTYPE;
  v_pending_inbound bigint;
  v_pending_outbox bigint;
  v_cursors jsonb;
BEGIN
  IF v_company_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'company_id requerido');
  END IF;

  IF NOT (
    v_company_id = public.get_user_company_id()
    OR public.company_in_user_work_center(v_company_id)
    OR public.is_admin()
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT * INTO v_row
  FROM dunasoft.style_sync_agent_state
  WHERE company_id = v_company_id;

  SELECT count(*)::bigint INTO v_pending_inbound
  FROM dunasoft.style_reservas_queue q
  WHERE q.company_id = v_company_id AND q.delivered_at IS NULL;

  SELECT count(*)::bigint INTO v_pending_outbox
  FROM dunasoft.style_sync_outbox o
  WHERE o.company_id = v_company_id AND o.delivered_at IS NULL;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'tabla', c.tabla,
           'enabled', c.enabled,
           'last_id', c.last_id,
           'last_ok_at', c.last_ok_at,
           'last_lag_ms', c.last_lag_ms,
           'errors', c.errors,
           'last_error', c.last_error,
           'last_error_at', c.last_error_at,
           'pending', c.pending
         ) ORDER BY c.tabla), '[]'::jsonb)
  INTO v_cursors
  FROM dunasoft.style_sync_cursor c
  WHERE c.company_id = v_company_id;

  RETURN jsonb_build_object(
    'ok', true,
    'company_id', v_company_id,
    'last_cola_id', COALESCE(v_row.last_cola_id, 0),
    'updated_at', v_row.updated_at,
    'last_outbound_ok_at', v_row.last_outbound_ok_at,
    'last_inbound_ok_at', v_row.last_inbound_ok_at,
    'outbound_errors', COALESCE(v_row.outbound_errors, 0),
    'inbound_errors', COALESCE(v_row.inbound_errors, 0),
    'last_outbound_lag_ms', v_row.last_outbound_lag_ms,
    'last_inbound_lag_ms', v_row.last_inbound_lag_ms,
    'inbound_worker_status', COALESCE(v_row.inbound_worker_status, 'unknown'),
    'inbound_worker_last_seen_at', v_row.inbound_worker_last_seen_at,
    'inbound_worker_alert_message', v_row.inbound_worker_alert_message,
    'agent_last_tick_at', v_row.agent_last_tick_at,
    'agent_version', v_row.agent_version,
    'worker_version', v_row.worker_version,
    'last_error', v_row.last_error,
    'last_error_at', v_row.last_error_at,
    'pending_inbound_queue', v_pending_inbound,
    'pending_outbox', v_pending_outbox,
    'entity_cursors', v_cursors
  );
END;
$$;

COMMENT ON FUNCTION public.style_sync_agent_status(uuid) IS
  'Estado del agente Style sync v2: cola citas, lag, worker, errores y cursores por entidad.';

GRANT EXECUTE ON FUNCTION public.style_sync_agent_status(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Auditoría de baseline: ¿están los maestros alineados para activar el sync?
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.style_sync_baseline_audit(p_company_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, dunasoft, legacy
AS $$
DECLARE
  v_company_id uuid := COALESCE(p_company_id, public.get_user_company_id());
  v_customers_total bigint;
  v_customers_no_codcli bigint;
  v_articles_total bigint;
  v_articles_no_codart bigint;
  v_appts_orphan_codcli bigint;
  v_legacy_clientes bigint := NULL;
  v_legacy_articulos bigint := NULL;
BEGIN
  IF v_company_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'company_id requerido');
  END IF;

  IF NOT (
    v_company_id = public.get_user_company_id()
    OR public.company_in_user_work_center(v_company_id)
    OR public.is_admin()
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT count(*), count(*) FILTER (WHERE legacy_codcli IS NULL OR btrim(legacy_codcli) = '')
  INTO v_customers_total, v_customers_no_codcli
  FROM public.customers WHERE company_id = v_company_id;

  SELECT count(*), count(*) FILTER (WHERE legacy_codart IS NULL OR btrim(legacy_codart) = '')
  INTO v_articles_total, v_articles_no_codart
  FROM public.articles WHERE company_id = v_company_id;

  SELECT count(*) INTO v_appts_orphan_codcli
  FROM public.agenda_appointments a
  WHERE a.company_id = v_company_id
    AND a.legacy_codcli IS NOT NULL
    AND btrim(a.legacy_codcli) NOT IN ('', '0')
    AND NOT EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.company_id = v_company_id
        AND public.legacy_codcli_to_bigint(c.legacy_codcli)
            = public.legacy_codcli_to_bigint(a.legacy_codcli)
    );

  IF to_regclass('legacy.clientes') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM legacy.clientes WHERE NULLIF(btrim(codcli::text), '''') IS NOT NULL'
      INTO v_legacy_clientes;
  END IF;
  IF to_regclass('legacy.articulos') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM legacy.articulos WHERE NULLIF(btrim(codart::text), '''') IS NOT NULL'
      INTO v_legacy_articulos;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'company_id', v_company_id,
    'customers_total', v_customers_total,
    'customers_without_codcli', v_customers_no_codcli,
    'articles_total', v_articles_total,
    'articles_without_codart', v_articles_no_codart,
    'appointments_orphan_codcli', v_appts_orphan_codcli,
    'legacy_clientes', v_legacy_clientes,
    'legacy_articulos', v_legacy_articulos,
    'needs_backfill',
      (v_customers_no_codcli > 0)
      OR (v_articles_no_codart > 0)
      OR (v_appts_orphan_codcli > 0)
      OR (v_legacy_clientes IS NOT NULL AND v_legacy_clientes > v_customers_total)
  );
END;
$$;

COMMENT ON FUNCTION public.style_sync_baseline_audit(uuid) IS
  'Cobertura de mapeos legacy_codcli/legacy_codart y citas con codcli huérfano antes de activar sync RT.';

GRANT EXECUTE ON FUNCTION public.style_sync_baseline_audit(uuid) TO authenticated;
