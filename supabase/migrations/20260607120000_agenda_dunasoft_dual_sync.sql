-- Coexistencia Suite ↔ Dunasoft: escritura dual segura (PG instantáneo + cola DBF).

-- Secuencia idplan reservada por Suite (siempre > MAX existente).
CREATE SEQUENCE IF NOT EXISTS dunasoft.idplan_seq;

DO $$
DECLARE
  v_max bigint;
BEGIN
  SELECT COALESCE(MAX(idplan::bigint), 0) INTO v_max FROM dunasoft.plan2009;
  IF v_max > 0 THEN
    PERFORM setval('dunasoft.idplan_seq', v_max, true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION dunasoft.allocate_idplan()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
DECLARE
  v_max bigint;
  v_next bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('dunasoft.allocate_idplan'));
  SELECT COALESCE(MAX(idplan::bigint), 0) INTO v_max FROM dunasoft.plan2009;
  v_next := GREATEST(v_max, (SELECT last_value FROM dunasoft.idplan_seq)) + 1;
  PERFORM setval('dunasoft.idplan_seq', v_next, true);
  RETURN v_next;
END;
$$;

-- Puente de correlación idplan ↔ agenda_appointments
CREATE TABLE IF NOT EXISTS public.agenda_dunasoft_bridge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  legacy_idplan text NOT NULL,
  agenda_appointment_id uuid REFERENCES public.agenda_appointments(id) ON DELETE SET NULL,
  outbox_id bigint,
  source text NOT NULL CHECK (source IN ('suite', 'dunasoft')),
  dbf_status text NOT NULL DEFAULT 'pending'
    CHECK (dbf_status IN ('pending', 'applied', 'error', 'skipped')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS agenda_dunasoft_bridge_company_idplan_uidx
  ON public.agenda_dunasoft_bridge (company_id, legacy_idplan);

CREATE INDEX IF NOT EXISTS agenda_dunasoft_bridge_appointment_idx
  ON public.agenda_dunasoft_bridge (agenda_appointment_id)
  WHERE agenda_appointment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS agenda_dunasoft_bridge_dbf_pending_idx
  ON public.agenda_dunasoft_bridge (dbf_status, created_at)
  WHERE dbf_status = 'pending';

ALTER TABLE public.agenda_dunasoft_bridge ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agenda_dunasoft_bridge_select ON public.agenda_dunasoft_bridge;
CREATE POLICY agenda_dunasoft_bridge_select ON public.agenda_dunasoft_bridge
  FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());

-- Ampliar outbox para correlación
ALTER TABLE dunasoft.sync_outbox
  ADD COLUMN IF NOT EXISTS correlation_id uuid,
  ADD COLUMN IF NOT EXISTS suite_appointment_id uuid,
  ADD COLUMN IF NOT EXISTS idplan_assigned numeric;

CREATE INDEX IF NOT EXISTS sync_outbox_pending_idx
  ON dunasoft.sync_outbox (created_at)
  WHERE applied_at IS NULL;

-- Resolver empleado Suite desde codemp Dunasoft
CREATE OR REPLACE FUNCTION public.resolve_agenda_employee_for_dunasoft_codemp(
  p_company_id uuid,
  p_codemp text
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, dunasoft
AS $$
DECLARE
  v_codemp text := btrim(coalesce(p_codemp, ''));
  v_employee_id uuid;
BEGIN
  IF v_codemp = '' THEN
    RETURN NULL;
  END IF;

  SELECT ae.id INTO v_employee_id
  FROM public.agenda_employees ae
  INNER JOIN dunasoft.empleados de ON (
    ltrim(btrim(de.codemp), '0') = ltrim(v_codemp, '0')
    OR btrim(de.codemp) = v_codemp
  )
  WHERE ae.company_id = p_company_id
    AND coalesce(ae.is_active, true)
  ORDER BY ae.agenda_sort_order NULLS LAST, ae.name
  LIMIT 1;

  IF v_employee_id IS NOT NULL THEN
    RETURN v_employee_id;
  END IF;

  SELECT ae.id INTO v_employee_id
  FROM public.agenda_employees ae
  WHERE ae.company_id = p_company_id
    AND coalesce(ae.is_active, true)
  ORDER BY ae.agenda_sort_order NULLS LAST, ae.name
  LIMIT 1;

  RETURN v_employee_id;
END;
$$;

-- Crear cita en Suite + dunasoft.plan2009 (+ planart) + outbox DBF
CREATE OR REPLACE FUNCTION public.agenda_dual_create(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, dunasoft
AS $$
DECLARE
  v_company_id uuid := public.get_user_company_id();
  v_user_id uuid := auth.uid();
  v_codemp text := btrim(coalesce(p_payload->>'codemp', ''));
  v_codcli text := btrim(coalesce(p_payload->>'codcli', ''));
  v_nomcli text := btrim(coalesce(p_payload->>'nomcli', ''));
  v_tel1cli text := btrim(coalesce(p_payload->>'tel1cli', ''));
  v_fecha date := (p_payload->>'fecha')::date;
  v_horini text := btrim(coalesce(p_payload->>'horini', ''));
  v_horfin text := btrim(coalesce(p_payload->>'horfin', ''));
  v_texto text := left(btrim(coalesce(p_payload->>'texto', '')), 250);
  v_codrec text := btrim(coalesce(p_payload->>'codrec', ''));
  v_customer_id uuid := nullif(btrim(p_payload->>'customer_id'), '')::uuid;
  v_employee_id uuid;
  v_idplan bigint;
  v_appt_id uuid := gen_random_uuid();
  v_bridge_id uuid;
  v_outbox_id bigint;
  v_planart jsonb := coalesce(p_payload->'planart', '[]'::jsonb);
  v_art jsonb;
  v_i int;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Empresa no resuelta';
  END IF;
  IF NOT public.user_has_permission(v_user_id, v_company_id, 'agenda.create') THEN
    RAISE EXCEPTION 'Sin permiso agenda.create';
  END IF;
  IF v_codemp = '' OR v_fecha IS NULL OR v_horini = '' OR v_horfin = '' THEN
    RAISE EXCEPTION 'Faltan codemp, fecha, horini u horfin';
  END IF;
  IF v_codcli = '' AND v_nomcli = '' THEN
    RAISE EXCEPTION 'Indica codcli o nombre de cliente';
  END IF;
  IF v_nomcli = '' THEN
    v_nomcli := v_codcli;
  END IF;
  IF v_codcli = '' THEN
    v_codcli := '0';
  END IF;

  v_employee_id := public.resolve_agenda_employee_for_dunasoft_codemp(v_company_id, v_codemp);
  IF v_employee_id IS NULL THEN
    RAISE EXCEPTION 'No hay empleados de agenda configurados en Suite';
  END IF;

  IF v_customer_id IS NOT NULL THEN
    SELECT coalesce(nullif(btrim(c.legacy_codcli), ''), v_codcli)
    INTO v_codcli
    FROM public.customers c
    WHERE c.id = v_customer_id
      AND c.company_id = v_company_id;
  END IF;

  v_idplan := dunasoft.allocate_idplan();

  INSERT INTO dunasoft.plan2009 (
    idplan, codemp, codcli, fecha, horini, horfin, texto, codrec,
    nomcli, tel1cli, colfon, collet, facturado, enviar, idusuweb,
    enviadoand, macand, idand, enviadocro, idcro, enviadoadd, idplanrel, codproce, horaman
  ) VALUES (
    v_idplan, v_codemp, v_codcli, v_fecha, v_horini, v_horfin, coalesce(v_texto, ''), coalesce(v_codrec, ''),
    v_nomcli, coalesce(v_tel1cli, ''), 0, 0, false, true, 0,
    false, '', 0, false, 0, false, 0, '', false
  );

  FOR v_i IN 0 .. jsonb_array_length(v_planart) - 1 LOOP
    v_art := v_planart->v_i;
    IF btrim(coalesce(v_art->>'codart', '')) = '' THEN
      CONTINUE;
    END IF;
    INSERT INTO dunasoft.planart (idplan, codart, hora, enviar, artcom, artcomrel)
    VALUES (
      v_idplan,
      btrim(v_art->>'codart'),
      coalesce(nullif(btrim(v_art->>'hora'), ''), v_horini),
      false,
      false,
      0
    );
  END LOOP;

  INSERT INTO public.agenda_appointments (
    id, company_id, employee_id, client_name, description,
    appointment_date, start_time, end_time, color, status,
    legacy_idplan, legacy_codcli, legacy_codemp, customer_id
  ) VALUES (
    v_appt_id, v_company_id, v_employee_id, v_nomcli, coalesce(v_texto, ''),
    v_fecha, v_horini, v_horfin, 'bg-blue-100 border-blue-300', 'confirmed',
    v_idplan::text, v_codcli, v_codemp, v_customer_id
  );

  INSERT INTO dunasoft.sync_outbox (
    table_name, operation, payload, correlation_id, suite_appointment_id, idplan_assigned
  ) VALUES (
    'plan2009',
    'create',
    p_payload || jsonb_build_object(
      'idplan', v_idplan,
      'requested_by', v_user_id::text,
      'source', 'suite-agenda'
    ),
    v_appt_id,
    v_appt_id,
    v_idplan
  )
  RETURNING id INTO v_outbox_id;

  INSERT INTO public.agenda_dunasoft_bridge (
    company_id, legacy_idplan, agenda_appointment_id, outbox_id, source, dbf_status
  ) VALUES (
    v_company_id, v_idplan::text, v_appt_id, v_outbox_id, 'suite', 'pending'
  )
  RETURNING id INTO v_bridge_id;

  RETURN jsonb_build_object(
    'appointment_id', v_appt_id,
    'legacy_idplan', v_idplan,
    'bridge_id', v_bridge_id,
    'outbox_id', v_outbox_id,
    'dbf_status', 'pending'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.agenda_dual_create(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_agenda_employee_for_dunasoft_codemp(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.agenda_dual_create(jsonb) IS
  'Coexistencia: crea cita en agenda_appointments + dunasoft.plan2009 y encola escritura DBF (sync_outbox).';

COMMENT ON TABLE public.agenda_dunasoft_bridge IS
  'Correlación idplan Dunasoft ↔ cita Suite durante migración dual.';
