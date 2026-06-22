-- RPC de estado del agente Style sync v2 para la UI Suite.

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
  WHERE q.delivered_at IS NULL;

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
    'pending_inbound_queue', v_pending_inbound
  );
END;
$$;

COMMENT ON FUNCTION public.style_sync_agent_status(uuid) IS
  'Estado operativo del agente Style sync v2 (cola, lag, worker, errores).';

GRANT EXECUTE ON FUNCTION public.style_sync_agent_status(uuid) TO authenticated;
