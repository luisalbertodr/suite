-- Ciclo de vida completo cita Dunasoft: plan2009 + planart + planinc (MODIFICAR/BORRAR).
-- Coexistencia Suite ↔ Style durante migración.

CREATE SEQUENCE IF NOT EXISTS dunasoft.idplaninc_seq;

DO $$
DECLARE v_max bigint;
BEGIN
  SELECT COALESCE(MAX(idplaninc::bigint), 0) INTO v_max FROM dunasoft.planinc;
  IF v_max > 0 THEN
    PERFORM setval('dunasoft.idplaninc_seq', v_max, true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION dunasoft.allocate_idplaninc()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
DECLARE v_max bigint; v_next bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('dunasoft.allocate_idplaninc'));
  SELECT COALESCE(MAX(idplaninc::bigint), 0) INTO v_max FROM dunasoft.planinc;
  v_next := GREATEST(v_max, (SELECT last_value FROM dunasoft.idplaninc_seq)) + 1;
  PERFORM setval('dunasoft.idplaninc_seq', v_next, true);
  RETURN v_next;
END;
$$;

CREATE OR REPLACE FUNCTION dunasoft.build_planart_memo(p_idplan numeric, p_fallback_hora text DEFAULT '09:00')
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
  SELECT coalesce(
    string_agg(
      '[' || coalesce(nullif(btrim(pa.hora), ''), p_fallback_hora) || '] ' ||
      btrim(pa.codart) || ' - ' ||
      coalesce(nullif(btrim(a.desart), ''), btrim(pa.codart)),
      E'\n'
      ORDER BY coalesce(nullif(btrim(pa.hora), ''), p_fallback_hora), btrim(pa.codart)
    ),
    ''
  )
  FROM dunasoft.planart pa
  LEFT JOIN dunasoft.articulos a ON btrim(a.codart) = btrim(pa.codart)
  WHERE pa.idplan = p_idplan;
$$;

CREATE OR REPLACE FUNCTION dunasoft.plan2009_snapshot(p_idplan numeric)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
  SELECT jsonb_build_object(
    'idplan', p.idplan,
    'codemp', p.codemp,
    'codcli', p.codcli,
    'fecha', p.fecha,
    'horini', p.horini,
    'horfin', p.horfin,
    'texto', p.texto,
    'codrec', p.codrec,
    'nomcli', p.nomcli,
    'tel1cli', p.tel1cli,
    'colfon', p.colfon,
    'collet', p.collet,
    'facturado', p.facturado,
    'planart_memo', dunasoft.build_planart_memo(p.idplan, coalesce(p.horini, '09:00'))
  )
  FROM dunasoft.plan2009 p
  WHERE p.idplan = p_idplan;
$$;

CREATE OR REPLACE FUNCTION dunasoft.replace_planart_rows(
  p_idplan numeric,
  p_planart jsonb,
  p_horini text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
DECLARE v_art jsonb; v_i int;
BEGIN
  DELETE FROM dunasoft.planart WHERE idplan = p_idplan;
  FOR v_i IN 0 .. jsonb_array_length(coalesce(p_planart, '[]'::jsonb)) - 1 LOOP
    v_art := p_planart->v_i;
    IF btrim(coalesce(v_art->>'codart', '')) = '' THEN CONTINUE; END IF;
    INSERT INTO dunasoft.planart (idplan, codart, hora, enviar, artcom, artcomrel)
    VALUES (
      p_idplan,
      btrim(v_art->>'codart'),
      coalesce(nullif(btrim(v_art->>'hora'), ''), p_horini),
      false,
      false,
      0
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION dunasoft.insert_planinc_modificar(
  p_idplan numeric,
  p_codusu text,
  p_old jsonb,
  p_new jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
DECLARE v_id bigint := dunasoft.allocate_idplaninc();
BEGIN
  INSERT INTO dunasoft.planinc (
    idplaninc, codusu, fechorinc, tipinc, idplan,
    codemp, codcli, fecha, horini, horfin, texto, codrec, nomcli, tel1cli, planart,
    codempx, codclix, fechax, horinix, horfinx, textox, codrecx, nomclix, tel1clix, planartx
  ) VALUES (
    v_id,
    left(coalesce(nullif(btrim(p_codusu), ''), 'SUITE'), 15),
    now(),
    'MODIFICAR',
    p_idplan,
    coalesce(p_old->>'codemp', ''),
    coalesce(p_old->>'codcli', '0'),
    (p_old->>'fecha')::date,
    coalesce(p_old->>'horini', ''),
    coalesce(p_old->>'horfin', ''),
    coalesce(p_old->>'texto', ''),
    coalesce(p_old->>'codrec', ''),
    coalesce(p_old->>'nomcli', ''),
    coalesce(p_old->>'tel1cli', ''),
    coalesce(p_old->>'planart_memo', ''),
    coalesce(p_new->>'codemp', ''),
    coalesce(p_new->>'codcli', '0'),
    (p_new->>'fecha')::date,
    coalesce(p_new->>'horini', ''),
    coalesce(p_new->>'horfin', ''),
    coalesce(p_new->>'texto', ''),
    coalesce(p_new->>'codrec', ''),
    coalesce(p_new->>'nomcli', ''),
    coalesce(p_new->>'tel1cli', ''),
    coalesce(p_new->>'planart_memo', '')
  );
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION dunasoft.insert_planinc_borrar(
  p_idplan numeric,
  p_codusu text,
  p_old jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
DECLARE v_id bigint := dunasoft.allocate_idplaninc();
BEGIN
  INSERT INTO dunasoft.planinc (
    idplaninc, codusu, fechorinc, tipinc, idplan,
    codemp, codcli, fecha, horini, horfin, texto, codrec, nomcli, tel1cli, planart,
    codempx, codclix, fechax, horinix, horfinx, textox, codrecx, nomclix, tel1clix, planartx
  ) VALUES (
    v_id,
    left(coalesce(nullif(btrim(p_codusu), ''), 'SUITE'), 15),
    now(),
    'BORRAR',
    p_idplan,
    coalesce(p_old->>'codemp', ''),
    coalesce(p_old->>'codcli', '0'),
    (p_old->>'fecha')::date,
    coalesce(p_old->>'horini', ''),
    coalesce(p_old->>'horfin', ''),
    coalesce(p_old->>'texto', ''),
    coalesce(p_old->>'codrec', ''),
    coalesce(p_old->>'nomcli', ''),
    coalesce(p_old->>'tel1cli', ''),
    coalesce(p_old->>'planart_memo', ''),
    '', '0', NULL, '', '', '', '', '', ''
  );
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION dunasoft.assert_plan2009_editable(p_idplan numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM dunasoft.plan2009 WHERE idplan = p_idplan) THEN
    RAISE EXCEPTION 'Cita idplan % no encontrada en Dunasoft', p_idplan;
  END IF;
  IF EXISTS (SELECT 1 FROM dunasoft.plan2009 WHERE idplan = p_idplan AND facturado IS TRUE) THEN
    RAISE EXCEPTION 'Cita facturada en Style; no se puede modificar ni borrar';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION dunasoft.resolve_dunasoft_codusu(
  p_user_id uuid,
  p_company_id uuid,
  p_payload jsonb
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_codusu text;
BEGIN
  v_codusu := nullif(btrim(p_payload->>'codusu'), '');
  IF v_codusu IS NOT NULL THEN
    RETURN left(v_codusu, 15);
  END IF;
  SELECT left(coalesce(nullif(btrim(up.display_name), ''), 'SUITE'), 15)
  INTO v_codusu
  FROM public.user_profiles up
  WHERE up.user_id = p_user_id
    AND up.company_id = p_company_id
  LIMIT 1;
  RETURN coalesce(v_codusu, 'SUITE');
END;
$$;

CREATE OR REPLACE FUNCTION dunasoft.employee_colors(p_codemp text)
RETURNS TABLE(colfon numeric, collet numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
  SELECT coalesce(e.colorpf, 0), coalesce(e.colorpl, 0)
  FROM dunasoft.empleados e
  WHERE ltrim(btrim(e.codemp), '0') = ltrim(btrim(p_codemp), '0')
     OR btrim(e.codemp) = btrim(p_codemp)
  LIMIT 1;
$$;

-- Reemplaza create: colores empleado + memo planart en outbox
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

  PERFORM dunasoft.replace_planart_rows(v_idplan, v_planart, v_horini);

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
    'idplan', v_idplan,
    'colfon', v_colfon,
    'collet', v_collet,
    'planart_memo', dunasoft.build_planart_memo(v_idplan, v_horini),
    'codusu', dunasoft.resolve_dunasoft_codusu(v_user_id, v_company_id, p_payload),
    'requested_by', v_user_id::text,
    'source', 'suite-agenda'
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
    'appointment_id', v_appt_id,
    'legacy_idplan', v_idplan,
    'bridge_id', v_bridge_id,
    'outbox_id', v_outbox_id,
    'dbf_status', 'pending'
  );
END;
$$;

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
  IF v_has_planart THEN
    v_planart := coalesce(p_payload->'planart', '[]'::jsonb);
  END IF;

  SELECT ec.colfon, ec.collet INTO v_colfon, v_collet FROM dunasoft.employee_colors(v_codemp) ec;

  UPDATE dunasoft.plan2009 SET
    codemp = v_codemp, codcli = v_codcli, fecha = v_fecha,
    horini = v_horini, horfin = v_horfin, texto = v_texto, codrec = v_codrec,
    nomcli = v_nomcli, tel1cli = coalesce(v_tel1cli, ''), colfon = v_colfon, collet = v_collet
  WHERE idplan = v_idplan;

  IF v_has_planart THEN
    PERFORM dunasoft.replace_planart_rows(v_idplan, v_planart, v_horini);
  END IF;
  v_new := dunasoft.plan2009_snapshot(v_idplan);
  PERFORM dunasoft.insert_planinc_modificar(
    v_idplan,
    dunasoft.resolve_dunasoft_codusu(v_user_id, v_company_id, p_payload),
    v_old,
    v_new
  );

  v_employee_id := public.resolve_agenda_employee_for_dunasoft_codemp(v_company_id, v_codemp);
  SELECT a.id INTO v_appt_id
  FROM public.agenda_appointments a
  WHERE a.company_id = v_company_id AND a.legacy_idplan = v_idplan::text
  LIMIT 1;

  IF v_appt_id IS NOT NULL AND v_employee_id IS NOT NULL THEN
    UPDATE public.agenda_appointments SET
      employee_id = v_employee_id,
      client_name = v_nomcli,
      description = coalesce(v_texto, ''),
      appointment_date = v_fecha,
      start_time = v_horini,
      end_time = v_horfin,
      legacy_codcli = v_codcli,
      legacy_codemp = v_codemp,
      updated_at = now()
    WHERE id = v_appt_id;
  END IF;

  INSERT INTO dunasoft.sync_outbox (table_name, operation, payload, suite_appointment_id, idplan_assigned)
  VALUES (
    'plan2009', 'update',
    jsonb_build_object(
      'idplan', v_idplan,
      'old', v_old,
      'new', v_new,
      'planart', CASE WHEN v_has_planart THEN v_planart ELSE NULL END,
      'codusu', dunasoft.resolve_dunasoft_codusu(v_user_id, v_company_id, p_payload)
    ),
    v_appt_id,
    v_idplan
  ) RETURNING id INTO v_outbox_id;

  UPDATE public.agenda_dunasoft_bridge
  SET outbox_id = v_outbox_id, dbf_status = 'pending', updated_at = now()
  WHERE company_id = v_company_id AND legacy_idplan = v_idplan::text;

  RETURN jsonb_build_object('legacy_idplan', v_idplan, 'outbox_id', v_outbox_id, 'dbf_status', 'pending');
END;
$$;

CREATE OR REPLACE FUNCTION public.agenda_dual_delete(p_idplan text)
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
  v_appt_id uuid;
  v_outbox_id bigint;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF NOT public.user_has_permission(v_user_id, v_company_id, 'agenda.delete') THEN
    RAISE EXCEPTION 'Sin permiso agenda.delete';
  END IF;

  PERFORM dunasoft.assert_plan2009_editable(v_idplan);
  v_old := dunasoft.plan2009_snapshot(v_idplan);

  PERFORM dunasoft.insert_planinc_borrar(
    v_idplan, dunasoft.resolve_dunasoft_codusu(v_user_id, v_company_id, '{}'::jsonb), v_old
  );

  DELETE FROM dunasoft.planart WHERE idplan = v_idplan;
  DELETE FROM dunasoft.plan2009 WHERE idplan = v_idplan;

  SELECT a.id INTO v_appt_id
  FROM public.agenda_appointments a
  WHERE a.company_id = v_company_id AND a.legacy_idplan = v_idplan::text
  LIMIT 1;

  IF v_appt_id IS NOT NULL THEN
    IF public.appointment_has_completed_sale(v_appt_id) THEN
      UPDATE public.agenda_appointments SET status = 'cancelled', updated_at = now() WHERE id = v_appt_id;
    ELSE
      DELETE FROM public.agenda_appointments WHERE id = v_appt_id;
    END IF;
  END IF;

  INSERT INTO dunasoft.sync_outbox (table_name, operation, payload, suite_appointment_id, idplan_assigned)
  VALUES (
    'plan2009', 'delete',
    jsonb_build_object('idplan', v_idplan, 'old', v_old,
      'codusu', dunasoft.resolve_dunasoft_codusu(v_user_id, v_company_id, '{}'::jsonb)),
    v_appt_id,
    v_idplan
  ) RETURNING id INTO v_outbox_id;

  UPDATE public.agenda_dunasoft_bridge
  SET dbf_status = 'pending', outbox_id = v_outbox_id, updated_at = now()
  WHERE company_id = v_company_id AND legacy_idplan = v_idplan::text;

  RETURN jsonb_build_object('legacy_idplan', v_idplan, 'outbox_id', v_outbox_id, 'dbf_status', 'pending');
END;
$$;

GRANT EXECUTE ON FUNCTION public.agenda_dual_update(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agenda_dual_delete(text) TO authenticated;

COMMENT ON FUNCTION public.agenda_dual_update IS
  'Modifica cita en plan2009/planart, registra planinc MODIFICAR, actualiza Suite y encola DBF.';
COMMENT ON FUNCTION public.agenda_dual_delete IS
  'Borra cita: planinc BORRAR, elimina plan2009/planart, cancela/elimina en Suite, encola DBF.';
