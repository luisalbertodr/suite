-- Validación solape empleado (estilo ValidarNota_Empleados) + estado sync en UI.

CREATE OR REPLACE FUNCTION dunasoft.hhmm_to_minutes(p_hhmm text)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  t text := btrim(coalesce(p_hhmm, ''));
  parts text[];
BEGIN
  IF t = '' THEN RETURN 0; END IF;
  IF t ~ '^\d{3,4}$' THEN
    t := lpad(t, 4, '0');
    RETURN substring(t, 1, 2)::integer * 60 + substring(t, 3, 2)::integer;
  END IF;
  parts := string_to_array(t, ':');
  IF array_length(parts, 1) >= 2 THEN
    RETURN coalesce(parts[1], '0')::integer * 60 + coalesce(parts[2], '0')::integer;
  END IF;
  RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION dunasoft.assert_plan2009_no_overlap(
  p_idplan numeric,
  p_fecha date,
  p_codemp text,
  p_codrec text,
  p_horini text,
  p_horfin text
)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
DECLARE
  v_ini int := dunasoft.hhmm_to_minutes(p_horini);
  v_fin int := dunasoft.hhmm_to_minutes(p_horfin);
  v_codemp text := btrim(coalesce(p_codemp, ''));
  v_codrec text := btrim(coalesce(p_codrec, ''));
BEGIN
  IF v_fin <= v_ini THEN
    RAISE EXCEPTION 'Horario inválido: horfin debe ser posterior a horini';
  END IF;
  IF v_codemp = '' THEN RETURN; END IF;

  IF EXISTS (
    SELECT 1
    FROM dunasoft.plan2009 p
    WHERE p.fecha = p_fecha
      AND (
        ltrim(btrim(p.codemp), '0') = ltrim(v_codemp, '0')
        OR btrim(p.codemp) = v_codemp
      )
      AND (p_idplan IS NULL OR p.idplan IS DISTINCT FROM p_idplan)
      AND coalesce(p.facturado, false) IS NOT TRUE
      AND dunasoft.hhmm_to_minutes(p.horini) < v_fin
      AND dunasoft.hhmm_to_minutes(p.horfin) > v_ini
      AND (
        v_codrec = '' OR btrim(coalesce(p.codrec, '')) = ''
        OR btrim(coalesce(p.codrec, '')) = v_codrec
      )
  ) THEN
    RAISE EXCEPTION 'El empleado ya tiene una cita solapada en ese horario (Style)';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.agenda_dunasoft_sync_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, dunasoft
AS $$
DECLARE
  v_company_id uuid := public.get_user_company_id();
BEGIN
  IF v_company_id IS NULL THEN
    RETURN jsonb_build_object('pending_dbf', 0, 'error_dbf', 0, 'pending_outbox', 0);
  END IF;
  RETURN jsonb_build_object(
    'pending_dbf', (
      SELECT count(*)::int FROM public.agenda_dunasoft_bridge b
      WHERE b.company_id = v_company_id AND b.dbf_status = 'pending'
    ),
    'error_dbf', (
      SELECT count(*)::int FROM public.agenda_dunasoft_bridge b
      WHERE b.company_id = v_company_id AND b.dbf_status = 'error'
    ),
    'pending_outbox', (
      SELECT count(*)::int FROM dunasoft.sync_outbox o
      WHERE o.applied_at IS NULL AND o.table_name = 'plan2009'
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.agenda_dunasoft_sync_status() TO authenticated;

-- Parche create: validar solape antes de reservar idplan
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
  v_colfon numeric := 0;
  v_collet numeric := 0;
  v_outbox_payload jsonb;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF v_company_id IS NULL THEN RAISE EXCEPTION 'Empresa no resuelta'; END IF;
  IF NOT public.user_has_permission(v_user_id, v_company_id, 'agenda.create') THEN
    RAISE EXCEPTION 'Sin permiso agenda.create';
  END IF;
  IF v_codemp = '' OR v_fecha IS NULL OR v_horini = '' OR v_horfin = '' THEN
    RAISE EXCEPTION 'Faltan codemp, fecha, horini u horfin';
  END IF;
  IF v_codcli = '' AND v_nomcli = '' THEN RAISE EXCEPTION 'Indica codcli o nombre de cliente'; END IF;
  IF v_nomcli = '' THEN v_nomcli := v_codcli; END IF;
  IF v_codcli = '' THEN v_codcli := '0'; END IF;

  PERFORM dunasoft.assert_plan2009_no_overlap(NULL, v_fecha, v_codemp, v_codrec, v_horini, v_horfin);

  v_employee_id := public.resolve_agenda_employee_for_dunasoft_codemp(v_company_id, v_codemp);
  IF v_employee_id IS NULL THEN RAISE EXCEPTION 'No hay empleados de agenda en Suite'; END IF;

  IF v_customer_id IS NOT NULL THEN
    SELECT coalesce(nullif(btrim(c.legacy_codcli), ''), v_codcli) INTO v_codcli
    FROM public.customers c WHERE c.id = v_customer_id AND c.company_id = v_company_id;
  END IF;

  SELECT ec.colfon, ec.collet INTO v_colfon, v_collet FROM dunasoft.employee_colors(v_codemp) ec;
  v_idplan := dunasoft.allocate_idplan();

  INSERT INTO dunasoft.plan2009 (
    idplan, codemp, codcli, fecha, horini, horfin, texto, codrec,
    nomcli, tel1cli, colfon, collet, facturado, enviar, idusuweb,
    enviadoand, macand, idand, enviadocro, idcro, enviadoadd, idplanrel, codproce, horaman
  ) VALUES (
    v_idplan, v_codemp, v_codcli, v_fecha, v_horini, v_horfin, coalesce(v_texto, ''), coalesce(v_codrec, ''),
    v_nomcli, coalesce(v_tel1cli, ''), v_colfon, v_collet, false, true, 0,
    false, '', 0, false, 0, false, 0, '', false
  );

  FOR v_i IN 0 .. jsonb_array_length(v_planart) - 1 LOOP
    v_art := v_planart->v_i;
    IF btrim(coalesce(v_art->>'codart', '')) = '' THEN CONTINUE; END IF;
    INSERT INTO dunasoft.planart (idplan, codart, hora, enviar, artcom, artcomrel)
    VALUES (
      v_idplan, btrim(v_art->>'codart'),
      coalesce(nullif(btrim(v_art->>'hora'), ''), v_horini),
      false, false, 0
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

  v_outbox_payload := p_payload || jsonb_build_object(
    'idplan', v_idplan, 'colfon', v_colfon, 'collet', v_collet,
    'planart_memo', dunasoft.build_planart_memo(v_idplan, v_horini),
    'codusu', dunasoft.resolve_dunasoft_codusu(v_user_id, v_company_id, p_payload),
    'requested_by', v_user_id::text, 'source', 'suite-agenda'
  );

  INSERT INTO dunasoft.sync_outbox (
    table_name, operation, payload, correlation_id, suite_appointment_id, idplan_assigned
  ) VALUES (
    'plan2009', 'create', v_outbox_payload, v_appt_id, v_appt_id, v_idplan
  ) RETURNING id INTO v_outbox_id;

  INSERT INTO public.agenda_dunasoft_bridge (
    company_id, legacy_idplan, agenda_appointment_id, outbox_id, source, dbf_status
  ) VALUES (
    v_company_id, v_idplan::text, v_appt_id, v_outbox_id, 'suite', 'pending'
  ) RETURNING id INTO v_bridge_id;

  RETURN jsonb_build_object(
    'appointment_id', v_appt_id, 'legacy_idplan', v_idplan,
    'bridge_id', v_bridge_id, 'outbox_id', v_outbox_id, 'dbf_status', 'pending'
  );
END;
$$;

-- Parche update: validar solape excluyendo idplan actual
CREATE OR REPLACE FUNCTION public.agenda_dual_update(
  p_idplan text,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, dunasoft
AS $$
DECLARE
  v_company_id uuid := public.get_user_company_id();
  v_user_id uuid := auth.uid();
  v_idplan bigint := btrim(p_idplan)::bigint;
  v_old jsonb;
  v_new jsonb;
  v_codemp text;
  v_codcli text;
  v_nomcli text;
  v_tel1cli text;
  v_fecha date;
  v_horini text;
  v_horfin text;
  v_texto text;
  v_codrec text;
  v_planart jsonb;
  v_has_planart boolean := p_payload ? 'planart';
  v_employee_id uuid;
  v_appt_id uuid;
  v_outbox_id bigint;
  v_colfon numeric;
  v_collet numeric;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF NOT public.user_has_permission(v_user_id, v_company_id, 'agenda.update') THEN
    RAISE EXCEPTION 'Sin permiso agenda.update';
  END IF;

  PERFORM dunasoft.assert_plan2009_editable(v_idplan);
  v_old := dunasoft.plan2009_snapshot(v_idplan);

  v_codemp := coalesce(nullif(btrim(p_payload->>'codemp'), ''), v_old->>'codemp');
  v_codcli := coalesce(nullif(btrim(p_payload->>'codcli'), ''), v_old->>'codcli');
  v_nomcli := coalesce(nullif(btrim(p_payload->>'nomcli'), ''), v_old->>'nomcli');
  v_tel1cli := coalesce(p_payload->>'tel1cli', v_old->>'tel1cli');
  v_fecha := coalesce((p_payload->>'fecha')::date, (v_old->>'fecha')::date);
  v_horini := coalesce(nullif(btrim(p_payload->>'horini'), ''), v_old->>'horini');
  v_horfin := coalesce(nullif(btrim(p_payload->>'horfin'), ''), v_old->>'horfin');
  v_texto := left(coalesce(nullif(btrim(p_payload->>'texto'), ''), v_old->>'texto'), 250);
  v_codrec := coalesce(p_payload->>'codrec', v_old->>'codrec');
  IF v_has_planart THEN v_planart := coalesce(p_payload->'planart', '[]'::jsonb); END IF;

  PERFORM dunasoft.assert_plan2009_no_overlap(v_idplan, v_fecha, v_codemp, v_codrec, v_horini, v_horfin);

  SELECT ec.colfon, ec.collet INTO v_colfon, v_collet FROM dunasoft.employee_colors(v_codemp) ec;

  UPDATE dunasoft.plan2009 SET
    codemp = v_codemp, codcli = v_codcli, fecha = v_fecha,
    horini = v_horini, horfin = v_horfin, texto = v_texto, codrec = v_codrec,
    nomcli = v_nomcli, tel1cli = coalesce(v_tel1cli, ''), colfon = v_colfon, collet = v_collet
  WHERE idplan = v_idplan;

  IF v_has_planart THEN PERFORM dunasoft.replace_planart_rows(v_idplan, v_planart, v_horini); END IF;
  v_new := dunasoft.plan2009_snapshot(v_idplan);
  PERFORM dunasoft.insert_planinc_modificar(
    v_idplan, dunasoft.resolve_dunasoft_codusu(v_user_id, v_company_id, p_payload), v_old, v_new
  );

  v_employee_id := public.resolve_agenda_employee_for_dunasoft_codemp(v_company_id, v_codemp);
  SELECT a.id INTO v_appt_id FROM public.agenda_appointments a
  WHERE a.company_id = v_company_id AND a.legacy_idplan = v_idplan::text LIMIT 1;

  IF v_appt_id IS NOT NULL AND v_employee_id IS NOT NULL THEN
    UPDATE public.agenda_appointments SET
      employee_id = v_employee_id, client_name = v_nomcli, description = coalesce(v_texto, ''),
      appointment_date = v_fecha, start_time = v_horini, end_time = v_horfin,
      legacy_codcli = v_codcli, legacy_codemp = v_codemp, updated_at = now()
    WHERE id = v_appt_id;
  END IF;

  INSERT INTO dunasoft.sync_outbox (table_name, operation, payload, suite_appointment_id, idplan_assigned)
  VALUES (
    'plan2009', 'update',
    jsonb_build_object(
      'idplan', v_idplan, 'old', v_old, 'new', v_new,
      'planart', CASE WHEN v_has_planart THEN v_planart ELSE NULL END,
      'codusu', dunasoft.resolve_dunasoft_codusu(v_user_id, v_company_id, p_payload)
    ),
    v_appt_id, v_idplan
  ) RETURNING id INTO v_outbox_id;

  UPDATE public.agenda_dunasoft_bridge
  SET outbox_id = v_outbox_id, dbf_status = 'pending', updated_at = now()
  WHERE company_id = v_company_id AND legacy_idplan = v_idplan::text;

  RETURN jsonb_build_object('legacy_idplan', v_idplan, 'outbox_id', v_outbox_id, 'dbf_status', 'pending');
END;
$$;
