-- Tablero incentivos: solo usuario con empleada vinculada; admins ven el equipo.

CREATE OR REPLACE FUNCTION public.user_is_incentive_admin(p_company_id uuid)
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
  IF EXISTS (
    SELECT 1
    FROM public.user_company_roles ucr
    JOIN public.roles r ON r.id = ucr.role_id
    WHERE ucr.user_id = auth.uid()
      AND lower(r.name) IN ('admin', 'superadmin', 'superuser')
      AND (
        ucr.company_id = p_company_id
        OR public.user_can_access_company(p_company_id)
      )
  ) THEN
    RETURN true;
  END IF;
  IF to_regprocedure('public.is_admin()') IS NOT NULL AND public.is_admin() THEN
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.user_can_view_incentive_board(p_company_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp uuid;
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
  IF public.user_is_incentive_admin(p_company_id) THEN
    RETURN true;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.get_effective_user_permissions(auth.uid(), p_company_id) ep
    WHERE (ep.resource = 'incentives_board' AND ep.action = 'read')
       OR (ep.resource = 'incentives' AND ep.action IN ('read', 'manage'))
  ) THEN
    RETURN false;
  END IF;
  v_emp := public.current_user_employee_id();
  RETURN v_emp IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.incentive_employee_board_row(
  p_company_id uuid,
  p_employee_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_set public.incentive_settings;
  v_track text;
  v_name text;
  v_month_start date := date_trunc('month', current_date)::date;
  v_month_end date := (date_trunc('month', current_date) + interval '1 month')::date;
  v_amount numeric := 0;
  v_leads integer := 0;
  v_hours numeric := 0;
  v_next_threshold numeric;
  v_next_hours numeric;
  v_remaining numeric;
  v_balance numeric;
  v_monthly jsonb;
BEGIN
  v_set := public.incentive_ensure_settings(p_company_id);
  v_track := public.incentive_employee_track(p_company_id, p_employee_id);
  SELECT ae.name INTO v_name FROM public.agenda_employees ae WHERE ae.id = p_employee_id;
  v_balance := public.incentive_employee_balance(p_company_id, p_employee_id);

  IF v_track = 'recepcion' THEN
    SELECT count(*)::integer INTO v_leads
    FROM public.incentive_credits
    WHERE company_id = p_company_id AND employee_id = p_employee_id
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
    WHERE company_id = p_company_id AND employee_id = p_employee_id
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
             coalesce(sum(c.amount_eur * c.share_pct / 100.0), 0) AS amount_eur
      FROM public.incentive_credits c
      WHERE c.company_id = p_company_id
        AND c.employee_id = p_employee_id
        AND c.source = 'sale' AND c.eligible
        AND c.occurred_at >= (date_trunc('month', current_date) - interval '5 months')::date
      GROUP BY 1
    ),
    leads AS (
      SELECT date_trunc('month', c.occurred_at)::date AS month,
             count(*)::integer AS leads
      FROM public.incentive_credits c
      WHERE c.company_id = p_company_id
        AND c.employee_id = p_employee_id
        AND c.source = 'lead' AND c.eligible
        AND c.occurred_at >= (date_trunc('month', current_date) - interval '5 months')::date
      GROUP BY 1
    )
    SELECT
      mo.month,
      to_char(mo.month, 'YYYY-MM') AS label,
      coalesce(s.amount_eur, 0)::numeric AS amount_eur,
      coalesce(l.leads, 0)::integer AS leads,
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
  ) m;

  RETURN jsonb_build_object(
    'employee_id', p_employee_id,
    'employee_name', coalesce(v_name, ''),
    'track', v_track,
    'balance_minutes', v_balance,
    'month_amount_eur', v_amount,
    'month_leads', v_leads,
    'month_tier_hours', v_hours,
    'next_threshold', v_next_threshold,
    'next_tier_hours', v_next_hours,
    'remaining_to_next', v_remaining,
    'monthly', v_monthly
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.incentive_board_team(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_set public.incentive_settings;
  v_rows jsonb;
BEGIN
  IF NOT public.user_is_incentive_admin(p_company_id) THEN
    RAISE EXCEPTION 'Sin permiso para ver el equipo de incentivos';
  END IF;
  v_set := public.incentive_ensure_settings(p_company_id);

  SELECT coalesce(jsonb_agg(public.incentive_employee_board_row(p_company_id, ae.id) ORDER BY ae.name), '[]'::jsonb)
    INTO v_rows
  FROM public.agenda_employees ae
  JOIN public.incentive_employee_tracks t ON t.employee_id = ae.id
  WHERE ae.company_id = p_company_id
    AND coalesce(ae.is_active, true)
    AND t.active
    AND t.track IN ('cabina', 'recepcion');

  RETURN jsonb_build_object(
    'ok', true,
    'enabled', v_set.enabled,
    'revenue_min_eur', v_set.revenue_min_eur,
    'revenue_step_eur', v_set.revenue_step_eur,
    'revenue_base_hours', v_set.revenue_base_hours,
    'revenue_step_hours', v_set.revenue_step_hours,
    'cash_per_hour', v_set.cash_per_hour,
    'lead_min_count', v_set.lead_min_count,
    'lead_step_count', v_set.lead_step_count,
    'employees', coalesce(v_rows, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.user_is_incentive_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_can_view_incentive_board(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.incentive_employee_board_row(uuid, uuid) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.incentive_employee_board_row(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.incentive_board_team(uuid) TO authenticated, service_role;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE lower(r.name) = 'recepcion'
  AND p.resource = 'incentives'
  AND p.action = 'read'
ON CONFLICT DO NOTHING;

UPDATE public.incentive_employee_tracks t
SET track = 'none', updated_at = now()
FROM public.agenda_employees ae
WHERE t.employee_id = ae.id
  AND ae.name ILIKE '%delgado%';

COMMENT ON FUNCTION public.user_can_view_incentive_board(uuid) IS
  'Tablero propio: usuario con empleada vinculada. Solo rol admin/superuser ve el equipo.';
