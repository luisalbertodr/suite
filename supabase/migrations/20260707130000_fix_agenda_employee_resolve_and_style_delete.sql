-- Fix crear cita en Suite (resolve empleado por dunasoft_codemp + hub fallback)
-- Fix borrar/modificar desde Style (buscar cita por legacy_idplan sin exigir company_id = hub)

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
  v_hub uuid := dunasoft.style_sync_hub_company_id();
BEGIN
  IF v_codemp = '' THEN
    RETURN NULL;
  END IF;

  -- 1) Match directo dunasoft_codemp en agenda_employees (empresa del usuario)
  SELECT ae.id INTO v_employee_id
  FROM public.agenda_employees ae
  WHERE ae.company_id = p_company_id
    AND coalesce(ae.is_active, true)
    AND (
      ltrim(btrim(coalesce(ae.dunasoft_codemp, '')), '0') = ltrim(v_codemp, '0')
      OR btrim(coalesce(ae.dunasoft_codemp, '')) = v_codemp
    )
  ORDER BY ae.agenda_sort_order NULLS LAST, ae.name
  LIMIT 1;

  IF v_employee_id IS NOT NULL THEN
    RETURN v_employee_id;
  END IF;

  -- 2) Join dunasoft.empleados (legacy)
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

  -- 3) Cualquier empleado activo de la empresa del usuario
  SELECT ae.id INTO v_employee_id
  FROM public.agenda_employees ae
  WHERE ae.company_id = p_company_id
    AND coalesce(ae.is_active, true)
  ORDER BY ae.agenda_sort_order NULLS LAST, ae.name
  LIMIT 1;

  IF v_employee_id IS NOT NULL THEN
    RETURN v_employee_id;
  END IF;

  -- 4) Hub Style (instancia única): mismo codemp en empresa anfitriona
  IF v_hub IS NOT NULL AND v_hub IS DISTINCT FROM p_company_id THEN
    SELECT ae.id INTO v_employee_id
    FROM public.agenda_employees ae
    WHERE ae.company_id = v_hub
      AND coalesce(ae.is_active, true)
      AND (
        ltrim(btrim(coalesce(ae.dunasoft_codemp, '')), '0') = ltrim(v_codemp, '0')
        OR btrim(coalesce(ae.dunasoft_codemp, '')) = v_codemp
      )
    ORDER BY ae.agenda_sort_order NULLS LAST, ae.name
    LIMIT 1;

    IF v_employee_id IS NOT NULL THEN
      RETURN v_employee_id;
    END IF;

    SELECT ae.id INTO v_employee_id
    FROM public.agenda_employees ae
    WHERE ae.company_id = v_hub
      AND coalesce(ae.is_active, true)
    ORDER BY ae.agenda_sort_order NULLS LAST, ae.name
    LIMIT 1;
  END IF;

  RETURN v_employee_id;
END;
$$;

CREATE OR REPLACE FUNCTION dunasoft.style_reservas_apply_from_style(
  p_company_id uuid,
  p_accion text,
  p_idplan numeric,
  p_codemp text,
  p_codcli text,
  p_fecha date,
  p_horini text,
  p_horfin text,
  p_texto text,
  p_codrec text,
  p_nomcli text,
  p_tel1cli text,
  p_facturado boolean,
  p_servicios text,
  p_colfon numeric,
  p_collet numeric,
  p_style_modified_at text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
DECLARE
  v_accion text := upper(btrim(coalesce(p_accion, '')));
  v_appt_id uuid;
  v_appt_company_id uuid;
  v_employee_id uuid;
  v_codemp text;
  v_codcli text;
  v_nomcli text;
  v_existing record;
  v_cancelled integer;
BEGIN
  PERFORM set_config('app.style_sync_inbound', '1', true);

  v_cancelled := dunasoft.cancel_pending_style_reservas_outbound(p_idplan);

  IF v_accion IN ('BAJA', 'BORRAR', 'DELETE') THEN
    -- idplan es único en Style; la cita Suite puede estar en la empresa del usuario, no solo en el hub.
    SELECT a.id, a.company_id INTO v_appt_id, v_appt_company_id
    FROM public.agenda_appointments a
    WHERE a.legacy_idplan = p_idplan::text
    ORDER BY CASE WHEN a.company_id = p_company_id THEN 0 ELSE 1 END
    LIMIT 1;

    DELETE FROM dunasoft.planart WHERE idplan = p_idplan;
    DELETE FROM dunasoft.plan2009 WHERE idplan = p_idplan;

    IF v_appt_id IS NOT NULL THEN
      IF public.appointment_has_completed_sale(v_appt_id) THEN
        UPDATE public.agenda_appointments SET status = 'cancelled', updated_at = now() WHERE id = v_appt_id;
      ELSE
        DELETE FROM public.agenda_appointments WHERE id = v_appt_id;
      END IF;
    END IF;

    UPDATE public.agenda_dunasoft_bridge
    SET dbf_status = 'applied', updated_at = now()
    WHERE legacy_idplan = p_idplan::text;

    RETURN jsonb_build_object(
      'ok', true, 'accion', 'BORRAR', 'idplan', p_idplan,
      'appointment_id', v_appt_id,
      'cancelled_outbound', v_cancelled
    );
  END IF;

  SELECT codemp, codcli, nomcli INTO v_existing
  FROM dunasoft.plan2009 WHERE idplan = p_idplan;

  v_codemp := dunasoft.style_code_or_keep(p_codemp, v_existing.codemp);
  v_codcli := dunasoft.style_code_or_keep(p_codcli, v_existing.codcli);
  v_nomcli := coalesce(nullif(btrim(p_nomcli), ''), nullif(btrim(v_existing.nomcli), ''), 'Cliente');

  SELECT a.id, a.company_id INTO v_appt_id, v_appt_company_id
  FROM public.agenda_appointments a
  WHERE a.legacy_idplan = p_idplan::text
  ORDER BY CASE WHEN a.company_id = p_company_id THEN 0 ELSE 1 END
  LIMIT 1;

  v_employee_id := public.resolve_agenda_employee_for_dunasoft_codemp(
    coalesce(v_appt_company_id, p_company_id),
    v_codemp
  );

  IF EXISTS (SELECT 1 FROM dunasoft.plan2009 WHERE idplan = p_idplan) THEN
    UPDATE dunasoft.plan2009 SET
      codemp = v_codemp,
      codcli = v_codcli,
      fecha = coalesce(p_fecha, fecha),
      horini = coalesce(nullif(btrim(p_horini), ''), horini),
      horfin = coalesce(nullif(btrim(p_horfin), ''), horfin),
      texto = coalesce(nullif(nullif(btrim(p_texto), ''), ''), texto),
      codrec = coalesce(p_codrec, codrec),
      nomcli = v_nomcli,
      tel1cli = coalesce(nullif(btrim(p_tel1cli), ''), tel1cli),
      colfon = coalesce(p_colfon, colfon),
      collet = coalesce(p_collet, collet),
      facturado = coalesce(p_facturado, facturado),
      enviadoand = false
    WHERE idplan = p_idplan;
  ELSE
    INSERT INTO dunasoft.plan2009 (
      idplan, codemp, codcli, fecha, horini, horfin, texto, codrec,
      nomcli, tel1cli, colfon, collet, facturado, enviar, idusuweb,
      enviadoand, macand, idand, enviadocro, idcro, enviadoadd, idplanrel, codproce, horaman
    ) VALUES (
      p_idplan,
      v_codemp,
      v_codcli,
      coalesce(p_fecha, current_date),
      coalesce(nullif(btrim(p_horini), ''), '09:00'),
      coalesce(nullif(btrim(p_horfin), ''), '10:00'),
      left(coalesce(nullif(btrim(p_texto), ''), ''), 250),
      coalesce(p_codrec, ''),
      v_nomcli,
      coalesce(p_tel1cli, ''),
      coalesce(p_colfon, 0),
      coalesce(p_collet, 0),
      coalesce(p_facturado, false),
      false, 0, true, '', 0, false, 0, false, 0, '', false
    );
  END IF;

  PERFORM dunasoft.style_reservas_parse_servicios(p_servicios, p_idplan, p_horini);

  IF v_appt_id IS NULL AND v_employee_id IS NOT NULL THEN
    INSERT INTO public.agenda_appointments (
      id, company_id, employee_id, client_name, description,
      appointment_date, start_time, end_time, color, status,
      legacy_idplan, legacy_codcli, legacy_codemp
    ) VALUES (
      gen_random_uuid(), p_company_id, v_employee_id,
      v_nomcli,
      left(coalesce(nullif(btrim(p_texto), ''), ''), 500),
      coalesce(p_fecha, current_date),
      coalesce(nullif(btrim(p_horini), ''), '09:00'),
      coalesce(nullif(btrim(p_horfin), ''), '10:00'),
      'bg-blue-100 border-blue-300', 'confirmed',
      p_idplan::text, v_codcli, v_codemp
    )
    RETURNING id INTO v_appt_id;

    INSERT INTO public.agenda_dunasoft_bridge (company_id, legacy_idplan, agenda_appointment_id, source, dbf_status)
    VALUES (p_company_id, p_idplan::text, v_appt_id, 'dunasoft', 'applied')
    ON CONFLICT (company_id, legacy_idplan) DO UPDATE SET
      agenda_appointment_id = EXCLUDED.agenda_appointment_id,
      dbf_status = 'applied',
      updated_at = now();
  ELSIF v_appt_id IS NOT NULL AND v_employee_id IS NOT NULL THEN
    UPDATE public.agenda_appointments SET
      employee_id = v_employee_id,
      client_name = v_nomcli,
      description = left(coalesce(nullif(btrim(p_texto), ''), description), 500),
      appointment_date = coalesce(p_fecha, appointment_date),
      start_time = coalesce(nullif(btrim(p_horini), ''), start_time),
      end_time = coalesce(nullif(btrim(p_horfin), ''), end_time),
      legacy_codcli = v_codcli,
      legacy_codemp = v_codemp,
      updated_at = now()
    WHERE id = v_appt_id;

    UPDATE public.agenda_dunasoft_bridge
    SET dbf_status = 'applied', error_message = NULL, updated_at = now()
    WHERE legacy_idplan = p_idplan::text;
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'accion', v_accion, 'idplan', p_idplan,
    'appointment_id', v_appt_id, 'cancelled_outbound', v_cancelled
  );
END;
$$;
