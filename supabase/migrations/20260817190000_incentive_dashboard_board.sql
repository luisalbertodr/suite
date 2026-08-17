-- Bloque de incentivos en Dashboard: permiso propio + totales mensuales.

INSERT INTO public.permissions (resource, action, name, description) VALUES
  (
    'incentives_board',
    'read',
    'Incentivos (tablero en Inicio)',
    'Ver en el Dashboard el progreso mensual de incentivos, totales por mes y tramo siguiente'
  )
ON CONFLICT (resource, action) DO UPDATE
  SET name = EXCLUDED.name,
      description = COALESCE(EXCLUDED.description, public.permissions.description);

-- En principio para todos los roles
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE p.resource = 'incentives_board'
  AND p.action = 'read'
ON CONFLICT DO NOTHING;

-- Quien ya tenía incentives.read hereda el tablero
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT DISTINCT rp.role_id, p_new.id
FROM public.role_permissions rp
JOIN public.permissions p_old
  ON p_old.id = rp.permission_id
 AND p_old.resource = 'incentives'
 AND p_old.action = 'read'
JOIN public.permissions p_new
  ON p_new.resource = 'incentives_board'
 AND p_new.action = 'read'
ON CONFLICT DO NOTHING;

INSERT INTO public.user_permissions (user_id, company_id, permission_id)
SELECT DISTINCT up.user_id, up.company_id, p_new.id
FROM public.user_permissions up
JOIN public.permissions p_old
  ON p_old.id = up.permission_id
 AND p_old.resource IN ('incentives', 'dashboard')
 AND p_old.action = 'read'
JOIN public.permissions p_new
  ON p_new.resource = 'incentives_board'
 AND p_new.action = 'read'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.user_permissions up2
  WHERE up2.user_id = up.user_id
    AND up2.company_id = up.company_id
    AND up2.permission_id = p_new.id
);

CREATE OR REPLACE FUNCTION public.user_can_view_incentive_board(p_company_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  IF to_regprocedure('public.current_user_is_superuser()') IS NOT NULL
     AND public.current_user_is_superuser() THEN
    RETURN true;
  END IF;
  IF NOT (
    p_company_id = public.get_user_company_id()
    OR public.user_can_access_company(p_company_id)
    OR public.company_in_user_work_center(p_company_id)
  ) THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1
    FROM public.get_effective_user_permissions(auth.uid(), p_company_id) ep
    WHERE (ep.resource = 'incentives_board' AND ep.action = 'read')
       OR (ep.resource = 'incentives' AND ep.action IN ('read', 'manage'))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.incentive_my_summary(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp uuid;
  v_set public.incentive_settings;
  v_balance numeric;
  v_month_start date := date_trunc('month', current_date)::date;
  v_month_end date := (date_trunc('month', current_date) + interval '1 month')::date;
  v_track text;
  v_amount numeric := 0;
  v_leads integer := 0;
  v_tier_minutes numeric := 0;
  v_hours numeric := 0;
  v_next_threshold numeric;
  v_next_hours numeric;
  v_remaining numeric;
  v_history jsonb;
  v_pending jsonb;
  v_monthly jsonb;
BEGIN
  IF NOT public.user_can_view_incentive_board(p_company_id)
     AND NOT public.user_can_read_incentives(p_company_id) THEN
    RAISE EXCEPTION 'Sin permiso de incentivos';
  END IF;
  v_emp := public.current_user_employee_id();
  IF v_emp IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'linked', false);
  END IF;
  v_set := public.incentive_ensure_settings(p_company_id);
  v_balance := public.incentive_employee_balance(p_company_id, v_emp);
  v_track := public.incentive_employee_track(p_company_id, v_emp);

  IF v_track = 'recepcion' THEN
    SELECT count(*)::integer INTO v_leads
    FROM public.incentive_credits
    WHERE company_id = p_company_id AND employee_id = v_emp
      AND source = 'lead' AND eligible
      AND occurred_at >= v_month_start AND occurred_at < v_month_end;
    v_hours := public.incentive_hours_from_leads(
      v_leads, v_set.lead_min_count, v_set.lead_step_count,
      v_set.lead_base_hours, v_set.lead_step_hours
    );
    IF v_leads < v_set.lead_min_count THEN
      v_next_threshold := v_set.lead_min_count;
    ELSE
      v_next_threshold := v_set.lead_min_count
        + (floor((v_leads - v_set.lead_min_count)::numeric / v_set.lead_step_count) + 1)
          * v_set.lead_step_count;
    END IF;
    v_next_hours := public.incentive_hours_from_leads(
      v_next_threshold::integer, v_set.lead_min_count, v_set.lead_step_count,
      v_set.lead_base_hours, v_set.lead_step_hours
    );
    v_remaining := greatest(0, v_next_threshold - v_leads);
  ELSE
    SELECT coalesce(sum(amount_eur * share_pct / 100.0), 0) INTO v_amount
    FROM public.incentive_credits
    WHERE company_id = p_company_id AND employee_id = v_emp
      AND source = 'sale' AND eligible
      AND occurred_at >= v_month_start AND occurred_at < v_month_end;
    v_hours := public.incentive_hours_from_revenue(
      v_amount, v_set.revenue_min_eur, v_set.revenue_step_eur,
      v_set.revenue_base_hours, v_set.revenue_step_hours
    );
    IF v_amount < v_set.revenue_min_eur THEN
      v_next_threshold := v_set.revenue_min_eur;
    ELSE
      v_next_threshold := v_set.revenue_min_eur
        + (floor((v_amount - v_set.revenue_min_eur) / v_set.revenue_step_eur) + 1)
          * v_set.revenue_step_eur;
    END IF;
    v_next_hours := public.incentive_hours_from_revenue(
      v_next_threshold, v_set.revenue_min_eur, v_set.revenue_step_eur,
      v_set.revenue_base_hours, v_set.revenue_step_hours
    );
    v_remaining := greatest(0, v_next_threshold - v_amount);
  END IF;

  SELECT coalesce(sum(minutes), 0) INTO v_tier_minutes
  FROM public.incentive_credits
  WHERE company_id = p_company_id AND employee_id = v_emp
    AND source = 'tier'
    AND occurred_at >= v_month_start AND occurred_at < v_month_end;

  SELECT coalesce(jsonb_agg(row_to_json(x) ORDER BY x.occurred_at DESC, x.created_at DESC), '[]'::jsonb)
    INTO v_history
  FROM (
    SELECT id, source, minutes, share_pct, eligible, tier_code, notes,
           occurred_at, created_at, bono_id, amount_eur, lead_id
    FROM public.incentive_credits
    WHERE company_id = p_company_id AND employee_id = v_emp
    ORDER BY occurred_at DESC, created_at DESC
    LIMIT 40
  ) x;

  SELECT coalesce(jsonb_agg(row_to_json(x) ORDER BY x.requested_date, x.start_time), '[]'::jsonb)
    INTO v_pending
  FROM (
    SELECT id, requested_date, start_time, end_time, minutes, status, notes, review_notes
    FROM public.incentive_time_requests
    WHERE company_id = p_company_id AND employee_id = v_emp
      AND status IN ('pending', 'approved')
      AND requested_date >= current_date - 7
    ORDER BY requested_date DESC
    LIMIT 20
  ) x;

  -- Totales por mes (últimos 6 meses, incluido el actual)
  SELECT coalesce(jsonb_agg(row_to_json(m) ORDER BY m.month), '[]'::jsonb)
    INTO v_monthly
  FROM (
    WITH months AS (
      SELECT generate_series(
        date_trunc('month', current_date) - interval '5 months',
        date_trunc('month', current_date),
        '1 month'::interval
      )::date AS month
    ),
    sales AS (
      SELECT date_trunc('month', c.occurred_at)::date AS month,
             coalesce(sum(c.amount_eur * c.share_pct / 100.0), 0) AS amount_eur,
             count(*)::integer AS sales_count
      FROM public.incentive_credits c
      WHERE c.company_id = p_company_id
        AND c.employee_id = v_emp
        AND c.source = 'sale'
        AND c.eligible
        AND c.occurred_at >= (date_trunc('month', current_date) - interval '5 months')::date
      GROUP BY 1
    ),
    leads AS (
      SELECT date_trunc('month', c.occurred_at)::date AS month,
             count(*)::integer AS leads
      FROM public.incentive_credits c
      WHERE c.company_id = p_company_id
        AND c.employee_id = v_emp
        AND c.source = 'lead'
        AND c.eligible
        AND c.occurred_at >= (date_trunc('month', current_date) - interval '5 months')::date
      GROUP BY 1
    ),
    tiers AS (
      SELECT date_trunc('month', c.occurred_at)::date AS month,
             coalesce(sum(c.minutes), 0) AS tier_minutes
      FROM public.incentive_credits c
      WHERE c.company_id = p_company_id
        AND c.employee_id = v_emp
        AND c.source = 'tier'
        AND c.occurred_at >= (date_trunc('month', current_date) - interval '5 months')::date
      GROUP BY 1
    )
    SELECT
      mo.month,
      to_char(mo.month, 'YYYY-MM') AS label,
      coalesce(s.amount_eur, 0)::numeric AS amount_eur,
      coalesce(s.sales_count, 0)::integer AS sales_count,
      coalesce(l.leads, 0)::integer AS leads,
      coalesce(t.tier_minutes, 0)::numeric AS tier_minutes,
      CASE
        WHEN v_track = 'recepcion' THEN public.incentive_hours_from_leads(
          coalesce(l.leads, 0),
          v_set.lead_min_count, v_set.lead_step_count,
          v_set.lead_base_hours, v_set.lead_step_hours
        )
        ELSE public.incentive_hours_from_revenue(
          coalesce(s.amount_eur, 0),
          v_set.revenue_min_eur, v_set.revenue_step_eur,
          v_set.revenue_base_hours, v_set.revenue_step_hours
        )
      END AS tier_hours,
      (mo.month = v_month_start) AS is_current
    FROM months mo
    LEFT JOIN sales s ON s.month = mo.month
    LEFT JOIN leads l ON l.month = mo.month
    LEFT JOIN tiers t ON t.month = mo.month
  ) m;

  RETURN jsonb_build_object(
    'ok', true,
    'linked', true,
    'employee_id', v_emp,
    'balance_minutes', v_balance,
    'enabled', v_set.enabled,
    'track', v_track,
    'model', 'revenue_tiers',
    'revenue_min_eur', v_set.revenue_min_eur,
    'revenue_step_eur', v_set.revenue_step_eur,
    'revenue_base_hours', v_set.revenue_base_hours,
    'revenue_step_hours', v_set.revenue_step_hours,
    'cash_per_hour', v_set.cash_per_hour,
    'lead_min_count', v_set.lead_min_count,
    'lead_step_count', v_set.lead_step_count,
    'month_amount_eur', v_amount,
    'month_leads', v_leads,
    'month_tier_hours', v_hours,
    'month_awarded_minutes', v_tier_minutes,
    'next_threshold', v_next_threshold,
    'next_tier_hours', v_next_hours,
    'remaining_to_next', v_remaining,
    'baseline', v_set.revenue_min_eur,
    'month_eligible', CASE WHEN v_track = 'recepcion' THEN v_leads ELSE round(v_amount) END,
    'next_milestone', NULL,
    'history', v_history,
    'requests', v_pending,
    'monthly', v_monthly
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.user_can_view_incentive_board(uuid) TO authenticated, service_role;
