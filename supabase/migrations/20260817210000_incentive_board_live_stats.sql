-- Tablero de incentivos: totales desde bonos/leads reales (no solo incentive_credits).
-- Las gráficas salían a cero porque la tabla de créditos nunca se rellenó con el histórico.

CREATE OR REPLACE FUNCTION public.incentive_bono_seller_codemp(p_legacy_codboncli text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, dunasoft, legacy
AS $$
  SELECT coalesce(
    (
      SELECT nullif(btrim(x.codemp::text), '')
      FROM dunasoft.bonoscli x
      WHERE public.legacy_codcli_to_bigint(x.codboncli)
          = public.legacy_codcli_to_bigint(p_legacy_codboncli)
      LIMIT 1
    ),
    (
      SELECT nullif(btrim(x.codemp::text), '')
      FROM legacy.bonoscli x
      WHERE public.legacy_codcli_to_bigint(x.codboncli)
          = public.legacy_codcli_to_bigint(p_legacy_codboncli)
      LIMIT 1
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.incentive_match_employee_codemp(
  p_company_id uuid,
  p_codemp text
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ae.id
  FROM public.agenda_employees ae
  WHERE ae.company_id = p_company_id
    AND nullif(btrim(p_codemp), '') IS NOT NULL
    AND nullif(btrim(coalesce(ae.dunasoft_codemp, '')), '') IS NOT NULL
    AND coalesce(nullif(ltrim(btrim(ae.dunasoft_codemp), '0'), ''), '0')
      = coalesce(nullif(ltrim(btrim(p_codemp), '0'), ''), '0')
  ORDER BY ae.is_active DESC NULLS LAST
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.incentive_employee_sales_by_month(
  p_company_id uuid,
  p_employee_id uuid,
  p_from date
)
RETURNS TABLE (month date, amount_eur numeric, sales_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH sold AS (
    SELECT
      date_trunc('month', b.fecha_compra)::date AS month,
      b.precio_total,
      public.incentive_match_employee_codemp(
        b.company_id,
        public.incentive_bono_seller_codemp(b.legacy_codboncli)
      ) AS employee_id
    FROM public.bonos b
    WHERE b.company_id = p_company_id
      AND b.fecha_compra >= p_from
      AND coalesce(b.precio_total, 0) >= coalesce(
        (SELECT s.min_eligible_amount FROM public.incentive_settings s WHERE s.company_id = p_company_id),
        100
      )
  )
  SELECT s.month,
         coalesce(sum(s.precio_total), 0)::numeric AS amount_eur,
         count(*)::integer AS sales_count
  FROM sold s
  WHERE s.employee_id = p_employee_id
  GROUP BY 1;
$$;

CREATE OR REPLACE FUNCTION public.incentive_unassigned_sales_by_month(
  p_company_id uuid,
  p_from date
)
RETURNS TABLE (month date, amount_eur numeric, sales_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH sold AS (
    SELECT
      date_trunc('month', b.fecha_compra)::date AS month,
      b.precio_total,
      public.incentive_match_employee_codemp(
        b.company_id,
        public.incentive_bono_seller_codemp(b.legacy_codboncli)
      ) AS employee_id
    FROM public.bonos b
    WHERE b.company_id = p_company_id
      AND b.fecha_compra >= p_from
      AND coalesce(b.precio_total, 0) >= coalesce(
        (SELECT s.min_eligible_amount FROM public.incentive_settings s WHERE s.company_id = p_company_id),
        100
      )
  )
  SELECT s.month,
         coalesce(sum(s.precio_total), 0)::numeric AS amount_eur,
         count(*)::integer AS sales_count
  FROM sold s
  WHERE s.employee_id IS NULL
  GROUP BY 1;
$$;

CREATE OR REPLACE FUNCTION public.incentive_reception_leads_by_month(
  p_company_id uuid,
  p_from date
)
RETURNS TABLE (month date, leads integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT date_trunc('month', l.created_at)::date AS month,
         count(*)::integer AS leads
  FROM public.marketing_leads l
  JOIN public.marketing_lead_stages s ON s.id = l.stage_id
  WHERE l.company_id = p_company_id
    AND coalesce(s.is_presentada, false)
    AND l.created_at >= p_from
  GROUP BY 1;
$$;

CREATE OR REPLACE FUNCTION public.incentive_employee_board_row(
  p_company_id uuid,
  p_employee_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_set public.incentive_settings;
  v_track text;
  v_name text;
  v_month_start date := date_trunc('month', current_date)::date;
  v_from date := (date_trunc('month', current_date) - interval '5 months')::date;
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
    SELECT coalesce(x.leads, 0) INTO v_leads
    FROM public.incentive_reception_leads_by_month(p_company_id, v_month_start) x
    WHERE x.month = v_month_start;
    v_leads := coalesce(v_leads, 0);
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
    SELECT coalesce(x.amount_eur, 0) INTO v_amount
    FROM public.incentive_employee_sales_by_month(p_company_id, p_employee_id, v_month_start) x
    WHERE x.month = v_month_start;
    v_amount := coalesce(v_amount, 0);
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
      SELECT generate_series(v_from, v_month_start, '1 month'::interval)::date AS month
    )
    SELECT
      mo.month,
      to_char(mo.month, 'YYYY-MM') AS label,
      coalesce(s.amount_eur, 0)::numeric AS amount_eur,
      coalesce(s.sales_count, 0)::integer AS sales_count,
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
    LEFT JOIN public.incentive_employee_sales_by_month(p_company_id, p_employee_id, v_from) s
      ON s.month = mo.month
    LEFT JOIN public.incentive_reception_leads_by_month(p_company_id, v_from) l
      ON l.month = mo.month
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
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_set public.incentive_settings;
  v_rows jsonb;
  v_unassigned jsonb;
  v_unassigned_now numeric := 0;
  v_month_start date := date_trunc('month', current_date)::date;
  v_from date := (date_trunc('month', current_date) - interval '5 months')::date;
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

  SELECT coalesce(jsonb_agg(row_to_json(u) ORDER BY u.month), '[]'::jsonb)
    INTO v_unassigned
  FROM (
    WITH months AS (
      SELECT generate_series(v_from, v_month_start, '1 month'::interval)::date AS month
    )
    SELECT
      mo.month,
      to_char(mo.month, 'YYYY-MM') AS label,
      coalesce(s.amount_eur, 0)::numeric AS amount_eur,
      coalesce(s.sales_count, 0)::integer AS sales_count,
      (mo.month = v_month_start) AS is_current
    FROM months mo
    LEFT JOIN public.incentive_unassigned_sales_by_month(p_company_id, v_from) s
      ON s.month = mo.month
  ) u;

  SELECT coalesce(s.amount_eur, 0) INTO v_unassigned_now
  FROM public.incentive_unassigned_sales_by_month(p_company_id, v_month_start) s
  WHERE s.month = v_month_start;
  v_unassigned_now := coalesce(v_unassigned_now, 0);

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
    'unassigned_month_amount_eur', v_unassigned_now,
    'unassigned_monthly', coalesce(v_unassigned, '[]'::jsonb),
    'employees', coalesce(v_rows, '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.incentive_my_summary(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp uuid;
  v_set public.incentive_settings;
  v_balance numeric;
  v_month_start date := date_trunc('month', current_date)::date;
  v_from date := (date_trunc('month', current_date) - interval '5 months')::date;
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
    SELECT coalesce(x.leads, 0) INTO v_leads
    FROM public.incentive_reception_leads_by_month(p_company_id, v_month_start) x
    WHERE x.month = v_month_start;
    v_leads := coalesce(v_leads, 0);
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
  ELSIF v_track = 'none' THEN
    v_amount := 0;
    v_leads := 0;
    v_hours := 0;
    v_next_threshold := v_set.revenue_min_eur;
    v_next_hours := v_set.revenue_base_hours;
    v_remaining := v_set.revenue_min_eur;
  ELSE
    SELECT coalesce(x.amount_eur, 0) INTO v_amount
    FROM public.incentive_employee_sales_by_month(p_company_id, v_emp, v_month_start) x
    WHERE x.month = v_month_start;
    v_amount := coalesce(v_amount, 0);
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
    AND occurred_at >= v_month_start AND occurred_at < (v_month_start + interval '1 month')::date;

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

  SELECT coalesce(jsonb_agg(row_to_json(m) ORDER BY m.month), '[]'::jsonb)
    INTO v_monthly
  FROM (
    WITH months AS (
      SELECT generate_series(v_from, v_month_start, '1 month'::interval)::date AS month
    )
    SELECT
      mo.month,
      to_char(mo.month, 'YYYY-MM') AS label,
      coalesce(s.amount_eur, 0)::numeric AS amount_eur,
      coalesce(s.sales_count, 0)::integer AS sales_count,
      coalesce(l.leads, 0)::integer AS leads,
      0::numeric AS tier_minutes,
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
    LEFT JOIN public.incentive_employee_sales_by_month(p_company_id, v_emp, v_from) s
      ON s.month = mo.month
    LEFT JOIN public.incentive_reception_leads_by_month(p_company_id, v_from) l
      ON l.month = mo.month
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

  RETURN jsonb_build_object(
    'ok', true,
    'track', v_track,
    'month', v_month_start,
    'amount_eur', v_amount,
    'leads', v_leads,
    'hours', v_hours,
    'minutes', v_minutes
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.incentive_backfill_company(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from date := (date_trunc('month', current_date) - interval '11 months')::date;
  v_sales int := 0;
  v_leads int := 0;
  v_emp uuid;
  v_month date;
BEGIN
  INSERT INTO public.incentive_credits (
    company_id, employee_id, source, bono_id, occurred_at,
    minutes, share_pct, eligible, amount_eur, notes
  )
  SELECT
    b.company_id,
    public.incentive_match_employee_codemp(
      b.company_id,
      public.incentive_bono_seller_codemp(b.legacy_codboncli)
    ),
    'sale',
    b.id,
    b.fecha_compra,
    0,
    100,
    true,
    b.precio_total,
    coalesce(nullif(btrim(b.nombre), ''), 'Bono')
  FROM public.bonos b
  WHERE b.company_id = p_company_id
    AND b.fecha_compra >= v_from
    AND coalesce(b.precio_total, 0) >= coalesce(
      (SELECT s.min_eligible_amount FROM public.incentive_settings s WHERE s.company_id = p_company_id),
      100
    )
    AND public.incentive_match_employee_codemp(
      b.company_id,
      public.incentive_bono_seller_codemp(b.legacy_codboncli)
    ) IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.incentive_credits c
      WHERE c.source = 'sale' AND c.bono_id = b.id
        AND c.employee_id = public.incentive_match_employee_codemp(
          b.company_id,
          public.incentive_bono_seller_codemp(b.legacy_codboncli)
        )
    );
  GET DIAGNOSTICS v_sales = ROW_COUNT;

  INSERT INTO public.incentive_credits (
    company_id, employee_id, source, lead_id, occurred_at,
    minutes, share_pct, eligible, amount_eur, notes
  )
  SELECT
    l.company_id,
    t.employee_id,
    'lead',
    l.id,
    l.created_at::date,
    0,
    100,
    true,
    1,
    coalesce(nullif(btrim(l.first_name || ' ' || coalesce(l.last_name, '')), ''), 'Lead presentado')
  FROM public.marketing_leads l
  JOIN public.marketing_lead_stages s ON s.id = l.stage_id
  JOIN public.incentive_employee_tracks t
    ON t.company_id = l.company_id AND t.track = 'recepcion' AND t.active
  WHERE l.company_id = p_company_id
    AND coalesce(s.is_presentada, false)
    AND l.created_at >= v_from
    AND NOT EXISTS (
      SELECT 1 FROM public.incentive_credits c
      WHERE c.source = 'lead' AND c.lead_id = l.id
    );
  GET DIAGNOSTICS v_leads = ROW_COUNT;

  FOR v_emp, v_month IN
    SELECT t.employee_id, gs::date
    FROM public.incentive_employee_tracks t
    CROSS JOIN generate_series(
      date_trunc('month', current_date) - interval '5 months',
      date_trunc('month', current_date),
      '1 month'::interval
    ) gs
    WHERE t.company_id = p_company_id AND t.active AND t.track IN ('cabina', 'recepcion')
  LOOP
    PERFORM public.incentive_recalc_month_tier(p_company_id, v_emp, v_month);
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'sales', v_sales, 'leads', v_leads);
END;
$$;

GRANT EXECUTE ON FUNCTION public.incentive_bono_seller_codemp(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.incentive_match_employee_codemp(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.incentive_employee_sales_by_month(uuid, uuid, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.incentive_unassigned_sales_by_month(uuid, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.incentive_reception_leads_by_month(uuid, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.incentive_employee_board_row(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.incentive_board_team(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.incentive_my_summary(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.incentive_recalc_month_tier(uuid, uuid, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.incentive_backfill_company(uuid) TO service_role;

SELECT public.incentive_backfill_company('5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4');

NOTIFY pgrst, 'reload schema';
