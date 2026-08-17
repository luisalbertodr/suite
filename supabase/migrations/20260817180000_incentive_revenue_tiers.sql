-- Incentivos v2: tramos por importe (cabina) + leads presentados (recepción).
-- Cabina: ≥2000€ → 4h; cada +500€ → +2h (2500→6h, 3000→8h…). Alternativa: 10€/h en metálico.
-- Recepción (Gemma): tramos por leads de marketing en etapa Presentada (acuden a cita).

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------

ALTER TABLE public.incentive_settings
  ADD COLUMN IF NOT EXISTS revenue_min_eur numeric(12, 2) NOT NULL DEFAULT 2000
    CHECK (revenue_min_eur >= 0),
  ADD COLUMN IF NOT EXISTS revenue_step_eur numeric(12, 2) NOT NULL DEFAULT 500
    CHECK (revenue_step_eur > 0),
  ADD COLUMN IF NOT EXISTS revenue_base_hours numeric(8, 2) NOT NULL DEFAULT 4
    CHECK (revenue_base_hours >= 0),
  ADD COLUMN IF NOT EXISTS revenue_step_hours numeric(8, 2) NOT NULL DEFAULT 2
    CHECK (revenue_step_hours >= 0),
  ADD COLUMN IF NOT EXISTS cash_per_hour numeric(10, 2) NOT NULL DEFAULT 10
    CHECK (cash_per_hour >= 0),
  ADD COLUMN IF NOT EXISTS lead_min_count integer NOT NULL DEFAULT 10
    CHECK (lead_min_count >= 0),
  ADD COLUMN IF NOT EXISTS lead_step_count integer NOT NULL DEFAULT 3
    CHECK (lead_step_count > 0),
  ADD COLUMN IF NOT EXISTS lead_base_hours numeric(8, 2) NOT NULL DEFAULT 4
    CHECK (lead_base_hours >= 0),
  ADD COLUMN IF NOT EXISTS lead_step_hours numeric(8, 2) NOT NULL DEFAULT 2
    CHECK (lead_step_hours >= 0),
  ADD COLUMN IF NOT EXISTS model_version text NOT NULL DEFAULT 'revenue_tiers'
    CHECK (model_version IN ('count_baseline', 'revenue_tiers'));

ALTER TABLE public.incentive_credits
  ADD COLUMN IF NOT EXISTS amount_eur numeric(12, 2),
  ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES public.marketing_leads(id) ON DELETE SET NULL;

ALTER TABLE public.incentive_credits DROP CONSTRAINT IF EXISTS incentive_credits_source_check;
ALTER TABLE public.incentive_credits
  ADD CONSTRAINT incentive_credits_source_check
  CHECK (source IN (
    'sale', 'milestone', 'manual', 'request_consume', 'adjustment',
    'tier', 'lead', 'cash_payout'
  ));

CREATE UNIQUE INDEX IF NOT EXISTS idx_incentive_credits_tier_month
  ON public.incentive_credits (
    company_id,
    employee_id,
    date_trunc('month', occurred_at::timestamp),
    notes
  )
  WHERE source = 'tier';

CREATE UNIQUE INDEX IF NOT EXISTS idx_incentive_credits_lead_once
  ON public.incentive_credits (lead_id)
  WHERE source = 'lead' AND lead_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.incentive_employee_tracks (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.agenda_employees(id) ON DELETE CASCADE,
  track text NOT NULL DEFAULT 'cabina'
    CHECK (track IN ('cabina', 'recepcion', 'none')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (employee_id)
);

CREATE INDEX IF NOT EXISTS idx_incentive_employee_tracks_company
  ON public.incentive_employee_tracks (company_id, track)
  WHERE active;

ALTER TABLE public.incentive_employee_tracks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS incentive_employee_tracks_select ON public.incentive_employee_tracks;
CREATE POLICY incentive_employee_tracks_select ON public.incentive_employee_tracks
  FOR SELECT TO authenticated
  USING (public.user_can_read_incentives(company_id));

DROP POLICY IF EXISTS incentive_employee_tracks_write ON public.incentive_employee_tracks;
CREATE POLICY incentive_employee_tracks_write ON public.incentive_employee_tracks
  FOR ALL TO authenticated
  USING (public.user_can_manage_incentives(company_id))
  WITH CHECK (public.user_can_manage_incentives(company_id));

-- ---------------------------------------------------------------------------
-- Helpers: hours from revenue / leads
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.incentive_hours_from_revenue(
  p_amount numeric,
  p_min_eur numeric,
  p_step_eur numeric,
  p_base_hours numeric,
  p_step_hours numeric
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN coalesce(p_amount, 0) < coalesce(p_min_eur, 2000) THEN 0::numeric
    ELSE coalesce(p_base_hours, 4)
      + floor((coalesce(p_amount, 0) - coalesce(p_min_eur, 2000)) / nullif(coalesce(p_step_eur, 500), 0))
        * coalesce(p_step_hours, 2)
  END;
$$;

CREATE OR REPLACE FUNCTION public.incentive_hours_from_leads(
  p_count integer,
  p_min_count integer,
  p_step_count integer,
  p_base_hours numeric,
  p_step_hours numeric
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN coalesce(p_count, 0) < coalesce(p_min_count, 10) THEN 0::numeric
    ELSE coalesce(p_base_hours, 4)
      + floor((coalesce(p_count, 0) - coalesce(p_min_count, 10))::numeric
          / nullif(coalesce(p_step_count, 3), 0))
        * coalesce(p_step_hours, 2)
  END;
$$;

CREATE OR REPLACE FUNCTION public.incentive_employee_track(
  p_company_id uuid,
  p_employee_id uuid
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (
      SELECT t.track
      FROM public.incentive_employee_tracks t
      WHERE t.employee_id = p_employee_id
        AND t.company_id = p_company_id
        AND t.active
    ),
    'cabina'
  );
$$;

-- ---------------------------------------------------------------------------
-- Recalc monthly tier (cabina by €, recepción by leads)
-- ---------------------------------------------------------------------------

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
    SELECT count(*)::integer INTO v_leads
    FROM public.incentive_credits c
    WHERE c.company_id = p_company_id
      AND c.employee_id = p_employee_id
      AND c.source = 'lead'
      AND c.eligible
      AND c.occurred_at >= v_month_start
      AND c.occurred_at < v_month_end;

    v_hours := public.incentive_hours_from_leads(
      v_leads,
      v_set.lead_min_count,
      v_set.lead_step_count,
      v_set.lead_base_hours,
      v_set.lead_step_hours
    );
    v_notes := 'tier-leads-' || to_char(v_month_start, 'YYYY-MM');
  ELSE
    SELECT coalesce(sum(c.amount_eur * c.share_pct / 100.0), 0) INTO v_amount
    FROM public.incentive_credits c
    WHERE c.company_id = p_company_id
      AND c.employee_id = p_employee_id
      AND c.source = 'sale'
      AND c.eligible
      AND c.occurred_at >= v_month_start
      AND c.occurred_at < v_month_end;

    v_hours := public.incentive_hours_from_revenue(
      v_amount,
      v_set.revenue_min_eur,
      v_set.revenue_step_eur,
      v_set.revenue_base_hours,
      v_set.revenue_step_hours
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

-- ---------------------------------------------------------------------------
-- Credit bono sale (importe; minutos del tramo se recalculan)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.incentive_credit_bono_sale(
  p_bono_id uuid,
  p_shares jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, dunasoft, legacy
AS $$
DECLARE
  v_bono public.bonos;
  v_set public.incentive_settings;
  v_share jsonb;
  v_emp uuid;
  v_pct numeric;
  v_shares jsonb := p_shares;
  v_codemp text;
  v_credited int := 0;
  v_eligible boolean;
  v_precio numeric;
  v_emps uuid[] := ARRAY[]::uuid[];
  v_month date;
BEGIN
  SELECT * INTO v_bono FROM public.bonos WHERE id = p_bono_id;
  IF v_bono.id IS NULL THEN
    RAISE EXCEPTION 'Bono no encontrado';
  END IF;

  v_set := public.incentive_ensure_settings(v_bono.company_id);
  IF NOT v_set.enabled THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'disabled');
  END IF;

  v_precio := coalesce(v_bono.precio_total, 0);
  v_eligible := v_precio >= coalesce(v_set.min_eligible_amount, 100);

  IF v_shares IS NULL OR jsonb_typeof(v_shares) <> 'array' OR jsonb_array_length(v_shares) = 0 THEN
    SELECT nullif(btrim(lb.codemp::text), '') INTO v_codemp
    FROM dunasoft.bonoscli lb
    WHERE public.legacy_codcli_to_bigint(lb.codboncli)
        = public.legacy_codcli_to_bigint(v_bono.legacy_codboncli)
    LIMIT 1;
    IF v_codemp IS NULL THEN
      SELECT nullif(btrim(lb.codemp), '') INTO v_codemp
      FROM legacy.bonoscli lb
      WHERE public.legacy_codcli_to_bigint(lb.codboncli)
          = public.legacy_codcli_to_bigint(v_bono.legacy_codboncli)
      LIMIT 1;
    END IF;
    IF v_codemp IS NOT NULL THEN
      SELECT id INTO v_emp
      FROM public.agenda_employees ae
      WHERE ae.company_id = v_bono.company_id
        AND coalesce(nullif(ltrim(btrim(coalesce(ae.dunasoft_codemp, '')), '0'), ''), '0')
          = coalesce(nullif(ltrim(btrim(v_codemp), '0'), ''), '0')
      ORDER BY ae.is_active DESC NULLS LAST
      LIMIT 1;
    END IF;
    IF v_emp IS NULL THEN
      RETURN jsonb_build_object('ok', true, 'skipped', 'no_employee');
    END IF;
    v_shares := jsonb_build_array(jsonb_build_object('employee_id', v_emp, 'share_pct', 100));
  END IF;

  DELETE FROM public.incentive_credits
  WHERE bono_id = p_bono_id AND source = 'sale';

  FOR v_share IN SELECT * FROM jsonb_array_elements(v_shares)
  LOOP
    v_emp := nullif(v_share->>'employee_id', '')::uuid;
    v_pct := coalesce(nullif(v_share->>'share_pct', '')::numeric, 100);
    IF v_emp IS NULL OR v_pct <= 0 THEN
      CONTINUE;
    END IF;
    IF public.incentive_employee_track(v_bono.company_id, v_emp) <> 'cabina' THEN
      CONTINUE;
    END IF;

    INSERT INTO public.incentive_credits (
      company_id, employee_id, source, bono_id, occurred_at,
      minutes, share_pct, eligible, amount_eur, tier_code, notes, created_by
    ) VALUES (
      v_bono.company_id,
      v_emp,
      'sale',
      p_bono_id,
      v_bono.fecha_compra,
      0,
      v_pct,
      v_eligible,
      v_precio,
      CASE WHEN v_eligible THEN 'R' ELSE 'X' END,
      v_bono.nombre,
      auth.uid()
    );
    v_credited := v_credited + 1;
    v_emps := array_append(v_emps, v_emp);
  END LOOP;

  v_month := date_trunc('month', v_bono.fecha_compra)::date;
  IF v_emps IS NOT NULL THEN
    FOR v_emp IN SELECT DISTINCT unnest(v_emps)
    LOOP
      PERFORM public.incentive_recalc_month_tier(v_bono.company_id, v_emp, v_month);
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'credited', v_credited,
    'eligible', v_eligible,
    'amount_eur', v_precio
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Lead presentada → crédito recepción + recalc tramo
-- ---------------------------------------------------------------------------

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

  v_day := coalesce(v_lead.appointment_at::date, v_lead.updated_at::date, current_date);

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

CREATE OR REPLACE FUNCTION public.incentive_leads_after_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_presentada boolean;
  v_old_presentada boolean;
BEGIN
  IF NEW.stage_id IS NOT DISTINCT FROM OLD.stage_id THEN
    RETURN NEW;
  END IF;
  SELECT coalesce(is_presentada, false) INTO v_new_presentada
  FROM public.marketing_lead_stages WHERE id = NEW.stage_id;
  SELECT coalesce(is_presentada, false) INTO v_old_presentada
  FROM public.marketing_lead_stages WHERE id = OLD.stage_id;
  IF v_new_presentada AND NOT coalesce(v_old_presentada, false) THEN
    PERFORM public.incentive_credit_lead_attendance(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_incentive_leads_after_update ON public.marketing_leads;
CREATE TRIGGER trg_incentive_leads_after_update
  AFTER UPDATE OF stage_id ON public.marketing_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.incentive_leads_after_update();

-- ---------------------------------------------------------------------------
-- Cash payout: convierte horas en dinero (10 €/h por defecto)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.incentive_cash_payout(
  p_company_id uuid,
  p_employee_id uuid,
  p_hours numeric,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_set public.incentive_settings;
  v_balance numeric;
  v_minutes numeric;
  v_euros numeric;
BEGIN
  IF NOT public.user_can_manage_incentives(p_company_id) THEN
    RAISE EXCEPTION 'Sin permiso para abonar incentivos en metálico';
  END IF;
  IF coalesce(p_hours, 0) <= 0 THEN
    RAISE EXCEPTION 'Horas inválidas';
  END IF;
  v_set := public.incentive_ensure_settings(p_company_id);
  v_minutes := round(p_hours * 60, 2);
  v_balance := public.incentive_employee_balance(p_company_id, p_employee_id);
  IF v_balance < v_minutes THEN
    RAISE EXCEPTION 'Saldo insuficiente (% min)', round(v_balance);
  END IF;
  v_euros := round(p_hours * coalesce(v_set.cash_per_hour, 10), 2);

  INSERT INTO public.incentive_credits (
    company_id, employee_id, source, occurred_at,
    minutes, share_pct, eligible, amount_eur, notes, created_by
  ) VALUES (
    p_company_id,
    p_employee_id,
    'cash_payout',
    current_date,
    -v_minutes,
    100,
    false,
    v_euros,
    coalesce(p_notes, 'Abono metálico ' || v_euros::text || ' € (' || v_set.cash_per_hour::text || ' €/h)'),
    auth.uid()
  );

  RETURN jsonb_build_object('ok', true, 'hours', p_hours, 'euros', v_euros, 'minutes', v_minutes);
END;
$$;

-- ---------------------------------------------------------------------------
-- Summaries (modelo tramos)
-- ---------------------------------------------------------------------------

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
  v_month_end date := (date_trunc('month', current_date) + interval '1 month')::date;
  v_track text;
  v_amount numeric := 0;
  v_leads integer := 0;
  v_tier_minutes numeric := 0;
  v_hours numeric := 0;
  v_next_threshold numeric;
  v_history jsonb;
  v_pending jsonb;
BEGIN
  IF NOT public.user_can_read_incentives(p_company_id) THEN
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
    'baseline', v_set.revenue_min_eur,
    'month_eligible', CASE WHEN v_track = 'recepcion' THEN v_leads ELSE round(v_amount) END,
    'next_milestone', NULL,
    'history', v_history,
    'requests', v_pending
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
      coalesce(sum(c.minutes), 0) AS balance_minutes,
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

-- ---------------------------------------------------------------------------
-- Defaults Estética + pistas empleadas
-- ---------------------------------------------------------------------------

UPDATE public.incentive_settings
SET
  model_version = 'revenue_tiers',
  revenue_min_eur = 2000,
  revenue_step_eur = 500,
  revenue_base_hours = 4,
  revenue_step_hours = 2,
  cash_per_hour = 10,
  lead_min_count = 10,
  lead_step_count = 3,
  lead_base_hours = 4,
  lead_step_hours = 2,
  min_eligible_amount = 100,
  updated_at = now()
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';

INSERT INTO public.incentive_settings (
  company_id, model_version,
  revenue_min_eur, revenue_step_eur, revenue_base_hours, revenue_step_hours,
  cash_per_hour, lead_min_count, lead_step_count, lead_base_hours, lead_step_hours,
  min_eligible_amount
)
VALUES (
  '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4', 'revenue_tiers',
  2000, 500, 4, 2,
  10, 10, 3, 4, 2,
  100
)
ON CONFLICT (company_id) DO NOTHING;

-- Cabina: Betha, Marta Loureiro, Mar; recepción: Gemma (IDs Estética prod)
INSERT INTO public.incentive_employee_tracks (company_id, employee_id, track, active) VALUES
  ('5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4', 'f2c3d7c1-9707-4a68-92f9-66a7babf8311', 'cabina', true),
  ('5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4', '69a579a2-5600-460b-a22e-d3a05c2c266a', 'cabina', true),
  ('5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4', '5d6528b5-6ae1-4302-9923-9561557f4aa9', 'cabina', true),
  ('5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4', '0e5081fc-572b-45c3-be5c-22e54280bf85', 'recepcion', true),
  ('5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4', 'b84b3798-5197-4e6e-a71d-ac5d1f4a9246', 'none', true)
ON CONFLICT (employee_id) DO UPDATE
  SET track = EXCLUDED.track,
      active = EXCLUDED.active,
      company_id = EXCLUDED.company_id,
      updated_at = now();

-- Neutralizar créditos tipo A/B del modelo anterior (se recalcularán al imputar)
UPDATE public.incentive_credits c
SET
  minutes = 0,
  amount_eur = coalesce(c.amount_eur, b.precio_total)
FROM public.bonos b
WHERE c.bono_id = b.id
  AND c.source = 'sale'
  AND c.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';

UPDATE public.incentive_credits
SET minutes = 0
WHERE source = 'sale'
  AND company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND minutes <> 0;

DELETE FROM public.incentive_credits
WHERE source = 'milestone'
  AND company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';

GRANT EXECUTE ON FUNCTION public.incentive_hours_from_revenue(numeric, numeric, numeric, numeric, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.incentive_hours_from_leads(integer, integer, integer, numeric, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.incentive_employee_track(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.incentive_recalc_month_tier(uuid, uuid, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.incentive_credit_lead_attendance(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.incentive_cash_payout(uuid, uuid, numeric, text) TO authenticated, service_role;

COMMENT ON COLUMN public.incentive_settings.revenue_min_eur IS
  'Importe mínimo mensual de bonos para empezar a generar horas (cabina).';
COMMENT ON COLUMN public.incentive_settings.revenue_step_eur IS
  'Cada este incremento de € suma revenue_step_hours (p.ej. 500€ → +2h).';
COMMENT ON COLUMN public.incentive_settings.cash_per_hour IS
  'Abono alternativo en metálico por hora no disfrutada.';
COMMENT ON COLUMN public.incentive_settings.lead_min_count IS
  'Mínimo de leads Presentada/mes (recepción) para 4h: más de 9 → 10; cada +3 → +2h.';
