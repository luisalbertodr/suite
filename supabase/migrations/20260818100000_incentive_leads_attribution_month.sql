-- Incentivos recepción: imputar presentadas al mes real (cita Meta), no al alta en Suite.
-- Muchos leads de mar/abr 2026 se importaron en may con created_at de Suite; el tablero
-- mostraba 0 en mar/abr aunque hay 31+24 presentadas de esos meses.

CREATE OR REPLACE FUNCTION public.incentive_lead_attribution_at(
  p_appointment_at timestamptz,
  p_external_created_at timestamptz,
  p_created_at timestamptz
)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT coalesce(
    CASE
      WHEN p_appointment_at IS NOT NULL
        AND p_appointment_at::date <> DATE '2026-01-01'
        AND p_appointment_at >= coalesce(p_external_created_at, p_created_at) - interval '1 day'
        AND p_appointment_at < timestamptz '2027-01-01'
      THEN p_appointment_at
    END,
    p_external_created_at,
    p_created_at
  );
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
  SELECT date_trunc(
           'month',
           public.incentive_lead_attribution_at(
             l.appointment_at, l.external_created_at, l.created_at
           )
         )::date AS month,
         count(*)::integer AS leads
  FROM public.marketing_leads l
  JOIN public.marketing_lead_stages s ON s.id = l.stage_id
  WHERE l.company_id = p_company_id
    AND coalesce(s.is_presentada, false)
    AND public.incentive_lead_attribution_at(
          l.appointment_at, l.external_created_at, l.created_at
        ) >= p_from
  GROUP BY 1;
$$;

CREATE OR REPLACE FUNCTION public.incentive_credit_lead_attendance(
  p_lead_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead public.marketing_leads;
  v_stage public.marketing_lead_stages;
  v_set public.incentive_settings;
  v_emp uuid;
  v_day date;
  v_at timestamptz;
BEGIN
  SELECT * INTO v_lead FROM public.marketing_leads WHERE id = p_lead_id;
  IF v_lead.id IS NULL THEN
    RAISE EXCEPTION 'Lead no encontrado';
  END IF;

  SELECT * INTO v_stage FROM public.marketing_lead_stages WHERE id = v_lead.stage_id;
  IF v_stage.id IS NULL OR NOT coalesce(v_stage.is_presentada, false) THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'not_presentada');
  END IF;

  v_set := public.incentive_ensure_settings(v_lead.company_id);
  IF NOT v_set.enabled THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'disabled');
  END IF;

  SELECT t.employee_id INTO v_emp
  FROM public.incentive_employee_tracks t
  WHERE t.company_id = v_lead.company_id
    AND t.track = 'recepcion'
    AND t.active
  ORDER BY t.updated_at DESC
  LIMIT 1;

  IF v_emp IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'no_reception_employee');
  END IF;

  v_at := public.incentive_lead_attribution_at(
    v_lead.appointment_at, v_lead.external_created_at, v_lead.created_at
  );
  v_day := v_at::date;

  IF NOT EXISTS (
    SELECT 1 FROM public.incentive_credits
    WHERE source = 'lead' AND lead_id = v_lead.id
  ) THEN
    INSERT INTO public.incentive_credits (
      company_id, employee_id, source, lead_id, occurred_at,
      minutes, share_pct, eligible, amount_eur, notes, created_by
    ) VALUES (
      v_lead.company_id,
      v_emp,
      'lead',
      v_lead.id,
      v_day,
      0,
      100,
      true,
      1,
      coalesce(nullif(btrim(v_lead.first_name || ' ' || coalesce(v_lead.last_name, '')), ''), 'Lead presentado'),
      auth.uid()
    );
  END IF;

  PERFORM public.incentive_recalc_month_tier(v_lead.company_id, v_emp, date_trunc('month', v_day)::date);

  RETURN jsonb_build_object('ok', true, 'employee_id', v_emp, 'occurred_at', v_day);
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
  v_sales integer := 0;
  v_leads integer := 0;
  v_emp uuid;
  v_month date;
BEGIN
  INSERT INTO public.incentive_credits (
    company_id, employee_id, source, bono_id, occurred_at,
    minutes, share_pct, eligible, amount_eur, notes
  )
  SELECT
    b.company_id,
    coalesce(
      b.sold_by_employee_id,
      public.incentive_match_employee_codemp(
        b.company_id,
        coalesce(nullif(btrim(b.legacy_codemp), ''), public.incentive_bono_seller_codemp(b.legacy_codboncli))
      )
    ),
    'sale',
    b.id,
    b.fecha_compra,
    0,
    100,
    true,
    b.precio_total,
    coalesce(b.nombre, 'Bono')
  FROM public.bonos b
  WHERE b.company_id = p_company_id
    AND b.fecha_compra >= v_from
    AND coalesce(b.precio_total, 0) >= coalesce(
      (SELECT s.min_eligible_amount FROM public.incentive_settings s WHERE s.company_id = p_company_id),
      100
    )
    AND public.incentive_match_employee_codemp(
      b.company_id,
      coalesce(nullif(btrim(b.legacy_codemp), ''), public.incentive_bono_seller_codemp(b.legacy_codboncli))
    ) IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.incentive_credits c
      WHERE c.source = 'sale' AND c.bono_id = b.id
        AND c.employee_id = public.incentive_match_employee_codemp(
          b.company_id,
          coalesce(nullif(btrim(b.legacy_codemp), ''), public.incentive_bono_seller_codemp(b.legacy_codboncli))
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
    public.incentive_lead_attribution_at(
      l.appointment_at, l.external_created_at, l.created_at
    )::date,
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
    AND public.incentive_lead_attribution_at(
          l.appointment_at, l.external_created_at, l.created_at
        ) >= v_from
    AND NOT EXISTS (
      SELECT 1 FROM public.incentive_credits c
      WHERE c.source = 'lead' AND c.lead_id = l.id
    );
  GET DIAGNOSTICS v_leads = ROW_COUNT;

  -- Corregir créditos lead ya existentes con occurred_at = created_at Suite.
  UPDATE public.incentive_credits c
  SET occurred_at = public.incentive_lead_attribution_at(
        l.appointment_at, l.external_created_at, l.created_at
      )::date
  FROM public.marketing_leads l
  WHERE c.source = 'lead'
    AND c.lead_id = l.id
    AND c.company_id = p_company_id
    AND c.occurred_at IS DISTINCT FROM public.incentive_lead_attribution_at(
          l.appointment_at, l.external_created_at, l.created_at
        )::date;

  FOR v_emp, v_month IN
    SELECT t.employee_id, gs::date
    FROM public.incentive_employee_tracks t
    CROSS JOIN generate_series(
      date_trunc('month', current_date) - interval '11 months',
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

GRANT EXECUTE ON FUNCTION public.incentive_lead_attribution_at(timestamptz, timestamptz, timestamptz)
  TO authenticated, service_role;

SELECT public.incentive_backfill_company('5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4');

NOTIFY pgrst, 'reload schema';
