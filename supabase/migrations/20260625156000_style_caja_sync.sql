-- Fase 6: Cierres de caja (ciecab/cieentsal) Style ↔ Suite.
--   Mapeo por numcie; sesión Suite por session_date (UNIQUE company_id, session_date).
--   Validación: total del cierre Style ≈ suma de ventas del día en Suite (alerta en notes, sin bloqueo).

CREATE OR REPLACE FUNCTION dunasoft.style_caja_apply_from_style(
  p_company_id uuid,
  p_accion     text,
  p_numcie     text,
  p_fecha      date,
  p_efectivo   numeric,
  p_tarjeta    numeric,
  p_total      numeric,
  p_sync_version bigint DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
DECLARE
  v_accion text := upper(btrim(coalesce(p_accion, 'UPSERT')));
  v_numcie text := btrim(coalesce(p_numcie, ''));
  v_scale numeric := dunasoft.style_price_scale(p_company_id);
  v_efectivo numeric := coalesce(p_efectivo, 0) * v_scale;
  v_tarjeta numeric := coalesce(p_tarjeta, 0) * v_scale;
  v_total numeric := coalesce(p_total, 0) * v_scale;
  v_session_date date := coalesce(p_fecha, current_date);
  v_session_id uuid;
  v_day_sales numeric;
  v_diff numeric;
  v_notes text := 'Cierre Style ' || v_numcie;
BEGIN
  IF v_numcie = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'numcie vacío');
  END IF;

  PERFORM set_config('dunasoft.in_style_apply', '1', true);

  IF v_accion IN ('DELETE', 'BAJA', 'BORRAR') THEN
    SELECT id INTO v_session_id FROM dunasoft.style_sync_entity_map_session(p_company_id, v_numcie);
    IF v_session_id IS NOT NULL THEN
      UPDATE public.cash_register_sessions SET status = 'cancelled', updated_at = now() WHERE id = v_session_id;
    END IF;
    RETURN jsonb_build_object('ok', true, 'accion', 'DELETE', 'numcie', v_numcie);
  END IF;

  -- Validación: ventas del día en Suite vs total del cierre.
  SELECT COALESCE(SUM(total_amount), 0) INTO v_day_sales
  FROM public.sales
  WHERE company_id = p_company_id
    AND status = 'completed'
    AND created_at::date = v_session_date;
  v_diff := round(v_total - v_day_sales, 2);
  IF abs(v_diff) > 1 THEN
    v_notes := v_notes || ' | aviso descuadre vs ventas Suite: ' || v_diff::text;
  END IF;

  -- Upsert sesión por (company_id, session_date).
  SELECT id INTO v_session_id
  FROM public.cash_register_sessions
  WHERE company_id = p_company_id AND session_date = v_session_date
  LIMIT 1;

  IF v_session_id IS NULL THEN
    INSERT INTO public.cash_register_sessions (
      id, company_id, session_date, status, opened_at, opening_cash,
      closed_at, expected_cash, expected_card, counted_cash, counted_card,
      closing_cash, notes
    ) VALUES (
      gen_random_uuid(), p_company_id, v_session_date, 'closed', now(), 0,
      now(), v_efectivo, v_tarjeta, v_efectivo, v_tarjeta, v_total, v_notes
    )
    RETURNING id INTO v_session_id;
  ELSE
    UPDATE public.cash_register_sessions SET
      status = 'closed',
      closed_at = coalesce(closed_at, now()),
      expected_cash = v_efectivo,
      expected_card = v_tarjeta,
      counted_cash = v_efectivo,
      counted_card = v_tarjeta,
      closing_cash = v_total,
      notes = v_notes,
      updated_at = now()
    WHERE id = v_session_id;
  END IF;

  PERFORM dunasoft.style_map_upsert(p_company_id, 'cash_session', v_numcie, v_session_id, p_sync_version, 'style_to_suite');

  RETURN jsonb_build_object(
    'ok', true, 'accion', 'UPSERT', 'numcie', v_numcie,
    'session_id', v_session_id, 'day_sales', v_day_sales, 'diff', v_diff
  );
END;
$$;

GRANT EXECUTE ON FUNCTION dunasoft.style_caja_apply_from_style(
  uuid, text, text, date, numeric, numeric, numeric, bigint
) TO service_role;

-- Helper: sesión Suite mapeada a un numcie de Style.
CREATE OR REPLACE FUNCTION dunasoft.style_sync_entity_map_session(p_company_id uuid, p_numcie text)
RETURNS TABLE(id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
  SELECT suite_id FROM dunasoft.style_sync_entity_map
  WHERE company_id = p_company_id AND entity_type = 'cash_session' AND style_key = btrim(p_numcie)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION dunasoft.style_sync_entity_map_session(uuid, text) TO service_role;

-- ---------------------------------------------------------------------------
-- Suite → Style (opcional): cierre de caja Suite → ciecab
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cash_session_enqueue_style_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, dunasoft
AS $$
BEGIN
  IF current_setting('dunasoft.in_style_apply', true) = '1' THEN
    RETURN NEW;
  END IF;
  IF NOT dunasoft.entity_sync_enabled(NEW.company_id, 'ciecab') THEN
    RETURN NEW;
  END IF;
  IF NEW.status <> 'closed' THEN
    RETURN NEW;
  END IF;
  -- Si ya hay mapeo (vino de Style) no reenviar.
  IF dunasoft.style_map_style_key(NEW.company_id, 'cash_session', NEW.id) IS NOT NULL THEN
    RETURN NEW;
  END IF;

  PERFORM dunasoft.enqueue_style_entity(
    NEW.company_id, 'cash_session', 'create', NULL, NEW.id,
    jsonb_build_object(
      'fecha', to_char(NEW.session_date, 'YYYY-MM-DD'),
      'efectivo', coalesce(NEW.counted_cash, NEW.expected_cash, 0),
      'tarjeta', coalesce(NEW.counted_card, NEW.expected_card, 0),
      'total', coalesce(NEW.closing_cash, 0)
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cash_session_enqueue_style_sync ON public.cash_register_sessions;
CREATE TRIGGER cash_session_enqueue_style_sync
  AFTER INSERT OR UPDATE ON public.cash_register_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.cash_session_enqueue_style_sync();

INSERT INTO dunasoft.style_sync_cursor (company_id, tabla, enabled)
SELECT id, 'ciecab', false FROM public.companies
ON CONFLICT (company_id, tabla) DO NOTHING;
