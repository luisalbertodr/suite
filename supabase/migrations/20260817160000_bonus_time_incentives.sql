-- Incentivos: bolsa de horas libres por venta de bonos (cupo mensual + minutos por tramo).
-- Base operativa (feb-jul 2026, Estética): las tres empleadas productivas venden ~4-7
-- paquetes/mes (mediana ~5). Los personalizados <100 € no cuentan. Por encima del cupo
-- de 4 se acreditan 60 min (tipo A, p.ej. corporal/láser grande) o 30 min (tipo B).

INSERT INTO public.permissions (resource, action, name, description) VALUES
  (
    'incentives',
    'read',
    'Incentivos (bolsa de horas)',
    'Ver la bolsa de horas libres, el progreso mensual y solicitar tiempo'
  ),
  (
    'incentives',
    'manage',
    'Incentivos (administrar)',
    'Configurar reglas, imputar ventas, aprobar solicitudes de horas libres'
  )
ON CONFLICT (resource, action) DO UPDATE
  SET name = EXCLUDED.name,
      description = COALESCE(EXCLUDED.description, public.permissions.description);

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE lower(r.name) IN ('admin', 'manager', 'superadmin', 'employee', 'user')
  AND p.resource = 'incentives'
  AND p.action = 'read'
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE lower(r.name) IN ('admin', 'manager', 'superadmin')
  AND p.resource = 'incentives'
  AND p.action = 'manage'
ON CONFLICT DO NOTHING;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS employee_id uuid REFERENCES public.agenda_employees(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.incentive_settings (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  monthly_baseline_count integer NOT NULL DEFAULT 4
    CHECK (monthly_baseline_count >= 0),
  min_eligible_amount numeric(12, 2) NOT NULL DEFAULT 100
    CHECK (min_eligible_amount >= 0),
  type_a_minutes integer NOT NULL DEFAULT 60 CHECK (type_a_minutes >= 0),
  type_b_minutes integer NOT NULL DEFAULT 30 CHECK (type_b_minutes >= 0),
  type_a_min_amount numeric(12, 2) NOT NULL DEFAULT 450
    CHECK (type_a_min_amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.incentive_bonus_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  article_id uuid REFERENCES public.articles(id) ON DELETE SET NULL,
  bonus_definition_id uuid REFERENCES public.bonus_definitions(id) ON DELETE SET NULL,
  name_pattern text,
  tier_code text NOT NULL DEFAULT 'B' CHECK (tier_code IN ('A', 'B', 'X')),
  minutes_per_sale integer NOT NULL DEFAULT 30 CHECK (minutes_per_sale >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incentive_bonus_rules_company
  ON public.incentive_bonus_rules (company_id, active);

CREATE TABLE IF NOT EXISTS public.incentive_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  eligible_count integer NOT NULL CHECK (eligible_count > 0),
  extra_minutes integer NOT NULL CHECK (extra_minutes >= 0),
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, eligible_count)
);

CREATE TABLE IF NOT EXISTS public.incentive_time_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.agenda_employees(id) ON DELETE CASCADE,
  requested_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  minutes integer NOT NULL CHECK (minutes > 0),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  notes text,
  review_notes text,
  requested_by uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  appointment_id uuid,
  legacy_idplan text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incentive_time_requests_employee
  ON public.incentive_time_requests (company_id, employee_id, status);

CREATE TABLE IF NOT EXISTS public.incentive_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.agenda_employees(id) ON DELETE CASCADE,
  source text NOT NULL
    CHECK (source IN ('sale', 'milestone', 'manual', 'request_consume', 'adjustment')),
  bono_id uuid REFERENCES public.bonos(id) ON DELETE SET NULL,
  sale_id uuid,
  invoice_id uuid,
  request_id uuid REFERENCES public.incentive_time_requests(id) ON DELETE SET NULL,
  occurred_at date NOT NULL DEFAULT CURRENT_DATE,
  minutes numeric(10, 2) NOT NULL,
  share_pct numeric(6, 2) NOT NULL DEFAULT 100 CHECK (share_pct > 0 AND share_pct <= 100),
  eligible boolean NOT NULL DEFAULT true,
  tier_code text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incentive_credits_employee_month
  ON public.incentive_credits (company_id, employee_id, occurred_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_incentive_credits_sale_bono_emp
  ON public.incentive_credits (bono_id, employee_id)
  WHERE source = 'sale' AND bono_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_incentive_credits_milestone_month
  ON public.incentive_credits (
    company_id,
    employee_id,
    date_trunc('month', occurred_at::timestamp),
    notes
  )
  WHERE source = 'milestone';

ALTER TABLE public.incentive_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incentive_bonus_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incentive_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incentive_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incentive_time_requests ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_user_employee_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT employee_id
  FROM public.user_profiles
  WHERE user_id = auth.uid()
    AND employee_id IS NOT NULL
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.user_can_manage_incentives(p_company_id uuid)
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
    WHERE ep.resource = 'incentives' AND ep.action = 'manage'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.user_can_read_incentives(p_company_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.user_can_manage_incentives(p_company_id) THEN
    RETURN true;
  END IF;
  IF auth.uid() IS NULL THEN
    RETURN false;
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
    WHERE ep.resource = 'incentives' AND ep.action = 'read'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.current_user_employee_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_can_manage_incentives(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_can_read_incentives(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS incentive_settings_select ON public.incentive_settings;
CREATE POLICY incentive_settings_select ON public.incentive_settings
  FOR SELECT TO authenticated
  USING (public.user_can_read_incentives(company_id));
DROP POLICY IF EXISTS incentive_settings_write ON public.incentive_settings;
CREATE POLICY incentive_settings_write ON public.incentive_settings
  FOR ALL TO authenticated
  USING (public.user_can_manage_incentives(company_id))
  WITH CHECK (public.user_can_manage_incentives(company_id));

DROP POLICY IF EXISTS incentive_bonus_rules_select ON public.incentive_bonus_rules;
CREATE POLICY incentive_bonus_rules_select ON public.incentive_bonus_rules
  FOR SELECT TO authenticated
  USING (public.user_can_read_incentives(company_id));
DROP POLICY IF EXISTS incentive_bonus_rules_write ON public.incentive_bonus_rules;
CREATE POLICY incentive_bonus_rules_write ON public.incentive_bonus_rules
  FOR ALL TO authenticated
  USING (public.user_can_manage_incentives(company_id))
  WITH CHECK (public.user_can_manage_incentives(company_id));

DROP POLICY IF EXISTS incentive_milestones_select ON public.incentive_milestones;
CREATE POLICY incentive_milestones_select ON public.incentive_milestones
  FOR SELECT TO authenticated
  USING (public.user_can_read_incentives(company_id));
DROP POLICY IF EXISTS incentive_milestones_write ON public.incentive_milestones;
CREATE POLICY incentive_milestones_write ON public.incentive_milestones
  FOR ALL TO authenticated
  USING (public.user_can_manage_incentives(company_id))
  WITH CHECK (public.user_can_manage_incentives(company_id));

DROP POLICY IF EXISTS incentive_credits_select ON public.incentive_credits;
CREATE POLICY incentive_credits_select ON public.incentive_credits
  FOR SELECT TO authenticated
  USING (
    public.user_can_manage_incentives(company_id)
    OR (
      public.user_can_read_incentives(company_id)
      AND employee_id = public.current_user_employee_id()
    )
  );

DROP POLICY IF EXISTS incentive_requests_select ON public.incentive_time_requests;
CREATE POLICY incentive_requests_select ON public.incentive_time_requests
  FOR SELECT TO authenticated
  USING (
    public.user_can_manage_incentives(company_id)
    OR (
      public.user_can_read_incentives(company_id)
      AND employee_id = public.current_user_employee_id()
    )
  );

CREATE OR REPLACE FUNCTION public.incentive_ensure_settings(p_company_id uuid)
RETURNS public.incentive_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.incentive_settings;
BEGIN
  INSERT INTO public.incentive_settings (company_id)
  VALUES (p_company_id)
  ON CONFLICT (company_id) DO NOTHING;
  SELECT * INTO v_row FROM public.incentive_settings WHERE company_id = p_company_id;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.incentive_resolve_rule(
  p_company_id uuid,
  p_nombre text,
  p_precio numeric,
  p_bonus_definition_id uuid DEFAULT NULL,
  p_article_id uuid DEFAULT NULL
)
RETURNS TABLE (tier_code text, minutes integer, eligible boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_set public.incentive_settings;
  v_rule public.incentive_bonus_rules;
  v_precio numeric := coalesce(p_precio, 0);
  v_nombre text := coalesce(p_nombre, '');
BEGIN
  v_set := public.incentive_ensure_settings(p_company_id);

  IF p_article_id IS NOT NULL THEN
    SELECT * INTO v_rule
    FROM public.incentive_bonus_rules r
    WHERE r.company_id = p_company_id AND r.active AND r.article_id = p_article_id
    ORDER BY r.updated_at DESC
    LIMIT 1;
  END IF;

  IF v_rule.id IS NULL AND p_bonus_definition_id IS NOT NULL THEN
    SELECT * INTO v_rule
    FROM public.incentive_bonus_rules r
    WHERE r.company_id = p_company_id AND r.active AND r.bonus_definition_id = p_bonus_definition_id
    ORDER BY r.updated_at DESC
    LIMIT 1;
  END IF;

  IF v_rule.id IS NULL AND nullif(btrim(v_nombre), '') IS NOT NULL THEN
    SELECT * INTO v_rule
    FROM public.incentive_bonus_rules r
    WHERE r.company_id = p_company_id
      AND r.active
      AND nullif(btrim(r.name_pattern), '') IS NOT NULL
      AND v_nombre ILIKE '%' || btrim(r.name_pattern) || '%'
    ORDER BY length(r.name_pattern) DESC, r.updated_at DESC
    LIMIT 1;
  END IF;

  IF v_rule.id IS NOT NULL THEN
    RETURN QUERY SELECT
      v_rule.tier_code,
      v_rule.minutes_per_sale,
      (v_rule.tier_code <> 'X' AND v_precio >= v_set.min_eligible_amount);
    RETURN;
  END IF;

  IF v_precio < v_set.min_eligible_amount THEN
    RETURN QUERY SELECT 'X'::text, 0, false;
    RETURN;
  END IF;

  IF v_precio >= v_set.type_a_min_amount THEN
    RETURN QUERY SELECT 'A'::text, v_set.type_a_minutes, true;
  ELSE
    RETURN QUERY SELECT 'B'::text, v_set.type_b_minutes, true;
  END IF;
END;
$$;

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
  v_rule RECORD;
  v_share jsonb;
  v_emp uuid;
  v_pct numeric;
  v_prior bigint;
  v_award numeric;
  v_shares jsonb := p_shares;
  v_codemp text;
  v_credited int := 0;
  v_ms RECORD;
  v_eligible_now bigint;
BEGIN
  SELECT * INTO v_bono FROM public.bonos WHERE id = p_bono_id;
  IF v_bono.id IS NULL THEN
    RAISE EXCEPTION 'Bono no encontrado';
  END IF;

  v_set := public.incentive_ensure_settings(v_bono.company_id);
  IF NOT v_set.enabled THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'disabled');
  END IF;

  SELECT * INTO v_rule
  FROM public.incentive_resolve_rule(
    v_bono.company_id,
    v_bono.nombre,
    v_bono.precio_total,
    v_bono.bonus_definition_id,
    NULL
  );

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

    SELECT count(*) INTO v_prior
    FROM public.incentive_credits c
    WHERE c.company_id = v_bono.company_id
      AND c.employee_id = v_emp
      AND c.source = 'sale'
      AND c.eligible
      AND date_trunc('month', c.occurred_at) = date_trunc('month', v_bono.fecha_compra);

    v_award := 0;
    IF v_rule.eligible AND v_prior >= v_set.monthly_baseline_count THEN
      v_award := round((v_rule.minutes * v_pct / 100.0)::numeric, 2);
    END IF;

    INSERT INTO public.incentive_credits (
      company_id, employee_id, source, bono_id, occurred_at,
      minutes, share_pct, eligible, tier_code, notes, created_by
    ) VALUES (
      v_bono.company_id,
      v_emp,
      'sale',
      p_bono_id,
      v_bono.fecha_compra,
      v_award,
      v_pct,
      v_rule.eligible,
      v_rule.tier_code,
      v_bono.nombre,
      auth.uid()
    );
    v_credited := v_credited + 1;

    IF v_rule.eligible THEN
      SELECT count(*) INTO v_eligible_now
      FROM public.incentive_credits c
      WHERE c.company_id = v_bono.company_id
        AND c.employee_id = v_emp
        AND c.source = 'sale'
        AND c.eligible
        AND date_trunc('month', c.occurred_at) = date_trunc('month', v_bono.fecha_compra);

      FOR v_ms IN
        SELECT *
        FROM public.incentive_milestones m
        WHERE m.company_id = v_bono.company_id
          AND m.active
          AND m.eligible_count = v_eligible_now
      LOOP
        INSERT INTO public.incentive_credits (
          company_id, employee_id, source, bono_id, occurred_at,
          minutes, share_pct, eligible, notes, created_by
        ) VALUES (
          v_bono.company_id,
          v_emp,
          'milestone',
          p_bono_id,
          v_bono.fecha_compra,
          v_ms.extra_minutes,
          100,
          false,
          'hito-' || v_ms.eligible_count::text,
          auth.uid()
        )
        ON CONFLICT DO NOTHING;
      END LOOP;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'credited', v_credited,
    'tier', v_rule.tier_code,
    'eligible', v_rule.eligible,
    'minutes_each_full', v_rule.minutes
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.incentive_bonos_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('dunasoft.in_style_apply', true) = '1'
     OR TG_OP = 'INSERT' THEN
    PERFORM public.incentive_credit_bono_sale(NEW.id, NULL);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_incentive_bonos_after_insert ON public.bonos;
CREATE TRIGGER trg_incentive_bonos_after_insert
  AFTER INSERT ON public.bonos
  FOR EACH ROW
  EXECUTE FUNCTION public.incentive_bonos_after_insert();

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
  WHERE company_id = p_company_id AND employee_id = p_employee_id;
$$;

CREATE OR REPLACE FUNCTION public.incentive_create_request(
  p_company_id uuid,
  p_requested_date date,
  p_start_time time,
  p_end_time time,
  p_notes text DEFAULT NULL,
  p_employee_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp uuid;
  v_minutes integer;
  v_balance numeric;
  v_pending integer;
  v_id uuid;
BEGIN
  IF NOT public.user_can_read_incentives(p_company_id) THEN
    RAISE EXCEPTION 'Sin permiso de incentivos';
  END IF;
  v_emp := coalesce(p_employee_id, public.current_user_employee_id());
  IF v_emp IS NULL THEN
    RAISE EXCEPTION 'Tu usuario no está vinculado a una empleada de agenda';
  END IF;
  IF p_employee_id IS NOT NULL
     AND p_employee_id IS DISTINCT FROM public.current_user_employee_id()
     AND NOT public.user_can_manage_incentives(p_company_id) THEN
    RAISE EXCEPTION 'Solo puedes solicitar tus propias horas';
  END IF;
  v_minutes := round(extract(epoch FROM (p_end_time - p_start_time)) / 60.0)::integer;
  IF v_minutes <= 0 THEN
    RAISE EXCEPTION 'El tramo horario no es válido';
  END IF;
  v_balance := public.incentive_employee_balance(p_company_id, v_emp);
  SELECT coalesce(sum(minutes), 0) INTO v_pending
  FROM public.incentive_time_requests
  WHERE company_id = p_company_id
    AND employee_id = v_emp
    AND status = 'pending';
  IF v_balance - v_pending < v_minutes THEN
    RAISE EXCEPTION 'Saldo insuficiente (% min disponibles)', round(v_balance - v_pending);
  END IF;

  INSERT INTO public.incentive_time_requests (
    company_id, employee_id, requested_date, start_time, end_time,
    minutes, notes, requested_by
  ) VALUES (
    p_company_id, v_emp, p_requested_date, p_start_time, p_end_time,
    v_minutes, p_notes, auth.uid()
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.incentive_review_request(
  p_request_id uuid,
  p_approve boolean,
  p_review_notes text DEFAULT NULL,
  p_appointment_id uuid DEFAULT NULL,
  p_legacy_idplan text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.incentive_time_requests;
  v_balance numeric;
BEGIN
  SELECT * INTO v_req FROM public.incentive_time_requests WHERE id = p_request_id;
  IF v_req.id IS NULL THEN
    RAISE EXCEPTION 'Solicitud no encontrada';
  END IF;
  IF NOT public.user_can_manage_incentives(v_req.company_id) THEN
    RAISE EXCEPTION 'Sin permiso para aprobar incentivos';
  END IF;
  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'La solicitud ya no está pendiente';
  END IF;

  IF p_approve THEN
    v_balance := public.incentive_employee_balance(v_req.company_id, v_req.employee_id);
    IF v_balance < v_req.minutes THEN
      RAISE EXCEPTION 'Saldo insuficiente para aprobar';
    END IF;
    INSERT INTO public.incentive_credits (
      company_id, employee_id, source, request_id, occurred_at,
      minutes, share_pct, eligible, notes, created_by
    ) VALUES (
      v_req.company_id,
      v_req.employee_id,
      'request_consume',
      v_req.id,
      v_req.requested_date,
      -v_req.minutes,
      100,
      false,
      'Disfrute horas libres',
      auth.uid()
    );
    UPDATE public.incentive_time_requests
    SET status = 'approved',
        review_notes = p_review_notes,
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        appointment_id = coalesce(p_appointment_id, appointment_id),
        legacy_idplan = coalesce(p_legacy_idplan, legacy_idplan),
        updated_at = now()
    WHERE id = p_request_id;
  ELSE
    UPDATE public.incentive_time_requests
    SET status = 'rejected',
        review_notes = p_review_notes,
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        updated_at = now()
    WHERE id = p_request_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'approved', p_approve);
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
  v_eligible bigint;
  v_awarded numeric;
  v_history jsonb;
  v_pending jsonb;
  v_next_ms RECORD;
BEGIN
  IF NOT public.user_can_read_incentives(p_company_id) THEN
    RAISE EXCEPTION 'Sin permiso de incentivos';
  END IF;
  v_emp := public.current_user_employee_id();
  IF public.user_can_manage_incentives(p_company_id) AND v_emp IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'linked', false);
  END IF;
  IF v_emp IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'linked', false);
  END IF;
  v_set := public.incentive_ensure_settings(p_company_id);
  v_balance := public.incentive_employee_balance(p_company_id, v_emp);

  SELECT count(*) FILTER (WHERE source = 'sale' AND eligible),
         coalesce(sum(minutes) FILTER (WHERE occurred_at >= v_month_start), 0)
    INTO v_eligible, v_awarded
  FROM public.incentive_credits
  WHERE company_id = p_company_id AND employee_id = v_emp
    AND occurred_at >= v_month_start;

  SELECT coalesce(jsonb_agg(row_to_json(x) ORDER BY x.occurred_at DESC, x.created_at DESC), '[]'::jsonb)
    INTO v_history
  FROM (
    SELECT id, source, minutes, share_pct, eligible, tier_code, notes, occurred_at, created_at, bono_id
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

  SELECT * INTO v_next_ms
  FROM public.incentive_milestones m
  WHERE m.company_id = p_company_id AND m.active AND m.eligible_count > v_eligible
  ORDER BY m.eligible_count
  LIMIT 1;

  RETURN jsonb_build_object(
    'ok', true,
    'linked', true,
    'employee_id', v_emp,
    'balance_minutes', v_balance,
    'enabled', v_set.enabled,
    'baseline', v_set.monthly_baseline_count,
    'month_eligible', v_eligible,
    'month_awarded_minutes', v_awarded,
    'next_milestone', CASE WHEN v_next_ms.id IS NULL THEN NULL ELSE
      jsonb_build_object('count', v_next_ms.eligible_count, 'extra_minutes', v_next_ms.extra_minutes)
    END,
    'history', v_history,
    'requests', v_pending
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.incentive_admin_overview(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending jsonb;
  v_balances jsonb;
BEGIN
  IF NOT public.user_can_manage_incentives(p_company_id) THEN
    RAISE EXCEPTION 'Sin permiso para administrar incentivos';
  END IF;

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
    SELECT ae.id AS employee_id, ae.name AS employee_name,
           coalesce(sum(c.minutes), 0) AS balance_minutes,
           count(*) FILTER (
             WHERE c.source = 'sale' AND c.eligible
               AND date_trunc('month', c.occurred_at) = date_trunc('month', current_date)
           ) AS month_eligible
    FROM public.agenda_employees ae
    LEFT JOIN public.incentive_credits c
      ON c.employee_id = ae.id AND c.company_id = p_company_id
    WHERE ae.company_id = p_company_id
      AND coalesce(ae.is_active, true) = true
      AND coalesce(nullif(ltrim(btrim(coalesce(ae.dunasoft_codemp, '')), '0'), ''), '0')
            IS DISTINCT FROM '9999999'
      AND upper(btrim(ae.name)) IS DISTINCT FROM 'TPV'
    GROUP BY ae.id, ae.name
  ) x;

  RETURN jsonb_build_object('ok', true, 'pending', v_pending, 'balances', v_balances);
END;
$$;

GRANT EXECUTE ON FUNCTION public.incentive_ensure_settings(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.incentive_resolve_rule(uuid, text, numeric, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.incentive_credit_bono_sale(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.incentive_employee_balance(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.incentive_create_request(uuid, date, time, time, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.incentive_review_request(uuid, boolean, text, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.incentive_my_summary(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.incentive_admin_overview(uuid) TO authenticated, service_role;

-- Semilla: empresa Estética (donde se venden los bonos).
INSERT INTO public.incentive_settings (company_id, monthly_baseline_count, min_eligible_amount)
VALUES ('5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4', 4, 100)
ON CONFLICT (company_id) DO NOTHING;

INSERT INTO public.incentive_milestones (company_id, eligible_count, extra_minutes, active)
VALUES
  ('5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4', 8, 60, false),
  ('5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4', 12, 120, false)
ON CONFLICT DO NOTHING;

INSERT INTO public.incentive_bonus_rules (
  company_id, article_id, bonus_definition_id, name_pattern, tier_code, minutes_per_sale, active
)
SELECT
  '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4',
  a.id,
  a.bonus_definition_id,
  NULL,
  CASE
    WHEN a.precio >= 450 THEN 'A'
    WHEN a.precio >= 100 THEN 'B'
    ELSE 'X'
  END,
  CASE
    WHEN a.precio >= 450 THEN 60
    WHEN a.precio >= 100 THEN 30
    ELSE 0
  END,
  true
FROM public.articles a
WHERE a.article_kind = 'bono'
  AND NOT EXISTS (
    SELECT 1 FROM public.incentive_bonus_rules r
    WHERE r.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
      AND r.article_id = a.id
  );

COMMENT ON TABLE public.incentive_credits IS
  'Bolsa de horas: minutos positivos por venta (sobre cupo) y negativos al disfrutar.';
COMMENT ON COLUMN public.incentive_settings.monthly_baseline_count IS
  'Bonos elegibles del mes que no generan minutos (cupo esperado).';
