-- Horas de incentivo hasta el 31-ago-2026: orientación, marcadas consumidas.
-- El saldo efectivo (solicitar / metálico) empieza el 1-sep-2026.
-- El recálculo de tramos sigue actualizando créditos de mar–ago para las gráficas.

CREATE OR REPLACE FUNCTION public.incentive_effective_start_date()
RETURNS date
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT DATE '2026-09-01';
$$;

CREATE OR REPLACE FUNCTION public.incentive_orientation_end_date()
RETURNS date
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT DATE '2026-08-31';
$$;

CREATE OR REPLACE FUNCTION public.incentive_employee_balance(
  p_company_id uuid,
  p_employee_id uuid
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(sum(minutes), 0)
  FROM public.incentive_credits
  WHERE company_id = p_company_id
    AND employee_id = p_employee_id
    AND occurred_at >= public.incentive_effective_start_date();
$$;

CREATE OR REPLACE FUNCTION public.incentive_employee_orientation_minutes(
  p_company_id uuid,
  p_employee_id uuid
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(sum(minutes) FILTER (WHERE minutes > 0), 0)
  FROM public.incentive_credits
  WHERE company_id = p_company_id
    AND employee_id = p_employee_id
    AND source = 'tier'
    AND occurred_at <= public.incentive_orientation_end_date();
$$;

-- Ajuste negativo = horas de orientación consumidas (se actualiza si agosto sigue creciendo).
CREATE OR REPLACE FUNCTION public.incentive_sync_orientation_consumed(
  p_company_id uuid,
  p_employee_id uuid
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sum numeric := 0;
BEGIN
  SELECT coalesce(sum(minutes), 0) INTO v_sum
  FROM public.incentive_credits
  WHERE company_id = p_company_id
    AND employee_id = p_employee_id
    AND source = 'tier'
    AND occurred_at <= public.incentive_orientation_end_date()
    AND minutes > 0;

  DELETE FROM public.incentive_credits
  WHERE company_id = p_company_id
    AND employee_id = p_employee_id
    AND source = 'adjustment'
    AND notes = 'consumed-orientation-until-2026-08-31';

  IF v_sum > 0 THEN
    INSERT INTO public.incentive_credits (
      company_id, employee_id, source, occurred_at,
      minutes, share_pct, eligible, amount_eur, notes
    ) VALUES (
      p_company_id,
      p_employee_id,
      'adjustment',
      public.incentive_orientation_end_date(),
      -v_sum,
      100,
      false,
      0,
      'consumed-orientation-until-2026-08-31'
    );
  END IF;

  RETURN v_sum;
END;
$$;

CREATE OR REPLACE FUNCTION public.incentive_recalc_month_tier(
  p_company_id uuid,
  p_employee_id uuid,
  p_month date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_set public.incentive_settings;
  v_track text;
  v_month_start date := date_trunc('month', p_month)::date;
  v_month_end date := (date_trunc('month', p_month) + interval '1 month')::date;
  v_amount numeric := 0;
  v_leads integer := 0;
  v_hours numeric := 0;
  v_minutes numeric := 0;
  v_notes text;
  v_effective boolean;
BEGIN
  v_set := public.incentive_ensure_settings(p_company_id);
  IF NOT v_set.enabled THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'disabled');
  END IF;

  v_track := public.incentive_employee_track(p_company_id, p_employee_id);
  IF v_track = 'none' THEN
    DELETE FROM public.incentive_credits
    WHERE company_id = p_company_id
      AND employee_id = p_employee_id
      AND source = 'tier'
      AND occurred_at >= v_month_start
      AND occurred_at < v_month_end;
    PERFORM public.incentive_sync_orientation_consumed(p_company_id, p_employee_id);
    RETURN jsonb_build_object('ok', true, 'skipped', 'track_none');
  END IF;

  IF v_track = 'recepcion' THEN
    SELECT coalesce(x.leads, 0) INTO v_leads
    FROM public.incentive_reception_leads_by_month(p_company_id, v_month_start) x
    WHERE x.month = v_month_start;
    v_leads := coalesce(v_leads, 0);
    v_hours := public.incentive_hours_from_leads(
      v_leads, v_set.lead_min_count, v_set.lead_step_count,
      v_set.lead_base_hours, v_set.lead_step_hours
    );
    v_notes := 'tier-leads-' || to_char(v_month_start, 'YYYY-MM');
  ELSE
    SELECT coalesce(x.amount_eur, 0) INTO v_amount
    FROM public.incentive_employee_sales_by_month(p_company_id, p_employee_id, v_month_start) x
    WHERE x.month = v_month_start;
    v_amount := coalesce(v_amount, 0);
    v_hours := public.incentive_hours_from_revenue(
      v_amount, v_set.revenue_min_eur, v_set.revenue_step_eur,
      v_set.revenue_base_hours, v_set.revenue_step_hours
    );
    v_notes := 'tier-revenue-' || to_char(v_month_start, 'YYYY-MM');
  END IF;

  v_minutes := round(v_hours * 60, 2);
  v_effective := v_month_start >= public.incentive_effective_start_date();

  DELETE FROM public.incentive_credits
  WHERE company_id = p_company_id
    AND employee_id = p_employee_id
    AND source = 'tier'
    AND occurred_at >= v_month_start
    AND occurred_at < v_month_end;

  IF v_minutes > 0 THEN
    INSERT INTO public.incentive_credits (
      company_id, employee_id, source, occurred_at,
      minutes, share_pct, eligible, amount_eur, notes, created_by
    ) VALUES (
      p_company_id,
      p_employee_id,
      'tier',
      v_month_start,
      v_minutes,
      100,
      false,
      CASE WHEN v_track = 'recepcion' THEN v_leads ELSE v_amount END,
      v_notes,
      auth.uid()
    );
  END IF;

  PERFORM public.incentive_sync_orientation_consumed(p_company_id, p_employee_id);

  RETURN jsonb_build_object(
    'ok', true,
    'track', v_track,
    'month', v_month_start,
    'amount_eur', v_amount,
    'leads', v_leads,
    'hours', v_hours,
    'minutes', CASE WHEN v_effective THEN v_minutes ELSE 0 END,
    'orientation_minutes', CASE WHEN v_effective THEN 0 ELSE v_minutes END,
    'effective', v_effective
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.incentive_admin_overview(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending jsonb;
  v_balances jsonb;
  v_set public.incentive_settings;
  v_month_start date := date_trunc('month', current_date)::date;
  v_month_end date := (date_trunc('month', current_date) + interval '1 month')::date;
BEGIN
  IF NOT public.user_can_manage_incentives(p_company_id) THEN
    RAISE EXCEPTION 'Sin permiso para administrar incentivos';
  END IF;
  v_set := public.incentive_ensure_settings(p_company_id);

  SELECT coalesce(jsonb_agg(row_to_json(x) ORDER BY x.created_at), '[]'::jsonb)
    INTO v_pending
  FROM (
    SELECT r.id, r.employee_id, ae.name AS employee_name,
           r.requested_date, r.start_time, r.end_time, r.minutes,
           r.status, r.notes, r.created_at
    FROM public.incentive_time_requests r
    JOIN public.agenda_employees ae ON ae.id = r.employee_id
    WHERE r.company_id = p_company_id AND r.status = 'pending'
    ORDER BY r.created_at
  ) x;

  SELECT coalesce(jsonb_agg(row_to_json(x) ORDER BY x.balance_minutes DESC, x.employee_name), '[]'::jsonb)
    INTO v_balances
  FROM (
    SELECT
      ae.id AS employee_id,
      ae.name AS employee_name,
      coalesce(t.track, 'cabina') AS track,
      public.incentive_employee_balance(p_company_id, ae.id) AS balance_minutes,
      public.incentive_employee_orientation_minutes(p_company_id, ae.id) AS orientation_minutes,
      coalesce(sum(c.amount_eur * c.share_pct / 100.0) FILTER (
        WHERE c.source = 'sale' AND c.eligible
          AND c.occurred_at >= v_month_start AND c.occurred_at < v_month_end
      ), 0) AS month_amount_eur,
      count(*) FILTER (
        WHERE c.source = 'lead' AND c.eligible
          AND c.occurred_at >= v_month_start AND c.occurred_at < v_month_end
      ) AS month_leads,
      coalesce(sum(c.minutes) FILTER (
        WHERE c.source = 'tier'
          AND c.occurred_at >= v_month_start AND c.occurred_at < v_month_end
      ), 0) AS month_tier_minutes
    FROM public.agenda_employees ae
    LEFT JOIN public.incentive_employee_tracks t ON t.employee_id = ae.id
    LEFT JOIN public.incentive_credits c
      ON c.employee_id = ae.id AND c.company_id = p_company_id
    WHERE ae.company_id = p_company_id
      AND coalesce(ae.is_active, true) = true
      AND coalesce(nullif(ltrim(btrim(coalesce(ae.dunasoft_codemp, '')), '0'), ''), '0')
            IS DISTINCT FROM '9999999'
      AND upper(btrim(ae.name)) IS DISTINCT FROM 'TPV'
    GROUP BY ae.id, ae.name, t.track
  ) x;

  RETURN jsonb_build_object(
    'ok', true,
    'pending', v_pending,
    'balances', v_balances,
    'settings', jsonb_build_object(
      'revenue_min_eur', v_set.revenue_min_eur,
      'revenue_step_eur', v_set.revenue_step_eur,
      'revenue_base_hours', v_set.revenue_base_hours,
      'revenue_step_hours', v_set.revenue_step_hours,
      'cash_per_hour', v_set.cash_per_hour,
      'lead_min_count', v_set.lead_min_count,
      'lead_step_count', v_set.lead_step_count
    )
  );
END;
$$;

-- Cerrar saldo pre-septiembre ahora (idempotente: sync borra y reescribe el ajuste).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT c.company_id, c.employee_id
    FROM public.incentive_credits c
    WHERE c.source = 'tier'
      AND c.occurred_at <= DATE '2026-08-31'
      AND c.minutes > 0
  LOOP
    PERFORM public.incentive_sync_orientation_consumed(r.company_id, r.employee_id);
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.incentive_effective_start_date() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.incentive_orientation_end_date() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.incentive_employee_orientation_minutes(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.incentive_sync_orientation_consumed(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.incentive_employee_balance(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.incentive_recalc_month_tier(uuid, uuid, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.incentive_admin_overview(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
