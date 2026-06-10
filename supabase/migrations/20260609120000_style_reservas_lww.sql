-- Last-write-wins: Style push incluye modificado (YYYYMMDDHH24MISS); Suite no pisa si agenda.updated_at es más reciente.

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
  v_employee_id uuid;
  v_style_at timestamptz;
  v_suite_at timestamptz;
BEGIN
  IF v_accion IN ('BAJA', 'BORRAR', 'DELETE') THEN
    SELECT a.id INTO v_appt_id
    FROM public.agenda_appointments a
    WHERE a.company_id = p_company_id AND a.legacy_idplan = p_idplan::text
    LIMIT 1;

  IF v_appt_id IS NOT NULL AND nullif(btrim(coalesce(p_style_modified_at, '')), '') IS NOT NULL THEN
    BEGIN
      v_style_at := to_timestamp(btrim(p_style_modified_at)::double precision);
      SELECT updated_at INTO v_suite_at FROM public.agenda_appointments WHERE id = v_appt_id;
      IF v_suite_at IS NOT NULL AND v_suite_at > v_style_at THEN
        RETURN jsonb_build_object(
          'ok', true, 'skipped', true, 'reason', 'suite_newer',
          'accion', 'BORRAR', 'idplan', p_idplan, 'appointment_id', v_appt_id
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

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
    WHERE company_id = p_company_id AND legacy_idplan = p_idplan::text;

    RETURN jsonb_build_object('ok', true, 'accion', 'BORRAR', 'idplan', p_idplan);
  END IF;

  SELECT a.id INTO v_appt_id
  FROM public.agenda_appointments a
  WHERE a.company_id = p_company_id AND a.legacy_idplan = p_idplan::text
  LIMIT 1;

  IF v_appt_id IS NOT NULL AND nullif(btrim(coalesce(p_style_modified_at, '')), '') IS NOT NULL THEN
    BEGIN
      v_style_at := to_timestamp(btrim(p_style_modified_at)::double precision);
      SELECT updated_at INTO v_suite_at FROM public.agenda_appointments WHERE id = v_appt_id;
      IF v_suite_at IS NOT NULL AND v_suite_at > v_style_at THEN
        RETURN jsonb_build_object(
          'ok', true, 'skipped', true, 'reason', 'suite_newer',
          'accion', v_accion, 'idplan', p_idplan, 'appointment_id', v_appt_id
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  v_employee_id := public.resolve_agenda_employee_for_dunasoft_codemp(p_company_id, p_codemp);

  IF EXISTS (SELECT 1 FROM dunasoft.plan2009 WHERE idplan = p_idplan) THEN
    UPDATE dunasoft.plan2009 SET
      codemp = coalesce(nullif(btrim(p_codemp), ''), codemp),
      codcli = coalesce(nullif(btrim(p_codcli), ''), codcli),
      fecha = coalesce(p_fecha, fecha),
      horini = coalesce(nullif(btrim(p_horini), ''), horini),
      horfin = coalesce(nullif(btrim(p_horfin), ''), horfin),
      texto = left(coalesce(nullif(btrim(p_texto), ''), texto), 250),
      codrec = coalesce(p_codrec, codrec),
      nomcli = coalesce(nullif(btrim(p_nomcli), ''), nomcli),
      tel1cli = coalesce(p_tel1cli, tel1cli),
      colfon = coalesce(p_colfon, colfon),
      collet = coalesce(p_collet, collet),
      facturado = coalesce(p_facturado, facturado)
    WHERE idplan = p_idplan;
  ELSE
    INSERT INTO dunasoft.plan2009 (
      idplan, codemp, codcli, fecha, horini, horfin, texto, codrec,
      nomcli, tel1cli, colfon, collet, facturado, enviar, idusuweb,
      enviadoand, macand, idand, enviadocro, idcro, enviadoadd, idplanrel, codproce, horaman
    ) VALUES (
      p_idplan,
      coalesce(nullif(btrim(p_codemp), ''), '0'),
      coalesce(nullif(btrim(p_codcli), ''), '0'),
      coalesce(p_fecha, current_date),
      coalesce(nullif(btrim(p_horini), ''), '09:00'),
      coalesce(nullif(btrim(p_horfin), ''), '10:00'),
      left(coalesce(p_texto, ''), 250),
      coalesce(p_codrec, ''),
      coalesce(nullif(btrim(p_nomcli), ''), 'Cliente'),
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
      coalesce(nullif(btrim(p_nomcli), ''), 'Cliente'),
      left(coalesce(p_texto, ''), 500),
      coalesce(p_fecha, current_date),
      coalesce(nullif(btrim(p_horini), ''), '09:00'),
      coalesce(nullif(btrim(p_horfin), ''), '10:00'),
      'bg-blue-100 border-blue-300', 'confirmed',
      p_idplan::text, coalesce(nullif(btrim(p_codcli), ''), '0'), coalesce(nullif(btrim(p_codemp), ''), '0')
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
      client_name = coalesce(nullif(btrim(p_nomcli), ''), client_name),
      description = left(coalesce(p_texto, ''), 500),
      appointment_date = coalesce(p_fecha, appointment_date),
      start_time = coalesce(nullif(btrim(p_horini), ''), start_time),
      end_time = coalesce(nullif(btrim(p_horfin), ''), end_time),
      legacy_codcli = coalesce(nullif(btrim(p_codcli), ''), legacy_codcli),
      legacy_codemp = coalesce(nullif(btrim(p_codemp), ''), legacy_codemp),
      updated_at = now()
    WHERE id = v_appt_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'accion', v_accion, 'idplan', p_idplan, 'appointment_id', v_appt_id);
END;
$$;

-- Encolar citas Suite → Style (alineación inicial o re-sync). Solo citas futuras por defecto.
CREATE OR REPLACE FUNCTION public.style_reservas_bootstrap_enqueue(
  p_from_date date DEFAULT current_date,
  p_only_missing_bridge boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, dunasoft
AS $$
DECLARE
  v_company_id uuid := public.get_user_company_id();
  v_user_id uuid := auth.uid();
  v_row record;
  v_queue_id bigint;
  v_count int := 0;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF v_company_id IS NULL THEN RAISE EXCEPTION 'Empresa no resuelta'; END IF;
  IF NOT public.user_has_permission(v_user_id, v_company_id, 'agenda.update') THEN
    RAISE EXCEPTION 'Sin permiso agenda.update';
  END IF;

  FOR v_row IN
    SELECT
      a.id AS appt_id,
      a.legacy_idplan,
      a.client_name,
      a.description,
      a.appointment_date,
      a.start_time,
      a.end_time,
      a.updated_at,
      p.codemp,
      p.codcli,
      p.horfin,
      p.texto,
      p.codrec,
      p.nomcli,
      p.tel1cli,
      p.colfon,
      p.collet,
      p.facturado
    FROM public.agenda_appointments a
    JOIN dunasoft.plan2009 p ON p.idplan = a.legacy_idplan::bigint
    LEFT JOIN public.agenda_dunasoft_bridge b
      ON b.company_id = a.company_id AND b.legacy_idplan = a.legacy_idplan
    WHERE a.company_id = v_company_id
      AND a.legacy_idplan IS NOT NULL
      AND btrim(a.legacy_idplan) <> ''
      AND a.appointment_date >= coalesce(p_from_date, current_date)
      AND a.status <> 'cancelled'
      AND (NOT p_only_missing_bridge OR b.id IS NULL OR b.dbf_status <> 'applied')
  LOOP
    v_queue_id := dunasoft.enqueue_style_reservas(
      v_company_id,
      'update',
      v_row.legacy_idplan::bigint,
      jsonb_build_object(
        'idplan', v_row.legacy_idplan::bigint,
        'codemp', v_row.codemp,
        'codcli', v_row.codcli,
        'nomcli', coalesce(nullif(btrim(v_row.nomcli), ''), v_row.client_name),
        'tel1cli', v_row.tel1cli,
        'fecha', v_row.appointment_date,
        'horini', v_row.start_time,
        'horfin', coalesce(nullif(btrim(v_row.horfin), ''), v_row.end_time),
        'texto', coalesce(v_row.texto, v_row.description),
        'codrec', v_row.codrec,
        'colfon', v_row.colfon,
        'collet', v_row.collet,
        'facturado', coalesce(v_row.facturado, false),
        'planart_memo', dunasoft.build_planart_memo(v_row.legacy_idplan::bigint, v_row.start_time),
        'source', 'bootstrap',
        'suite_updated_at', v_row.updated_at
      ),
      v_row.appt_id
    );

    IF v_queue_id IS NOT NULL THEN
      INSERT INTO public.agenda_dunasoft_bridge (company_id, legacy_idplan, agenda_appointment_id, outbox_id, source, dbf_status)
      VALUES (v_company_id, v_row.legacy_idplan, v_row.appt_id, v_queue_id, 'suite', 'pending')
      ON CONFLICT (company_id, legacy_idplan) DO UPDATE SET
        outbox_id = EXCLUDED.outbox_id,
        dbf_status = 'pending',
        updated_at = now();
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'enqueued', v_count, 'from_date', p_from_date);
END;
$$;

GRANT EXECUTE ON FUNCTION public.style_reservas_bootstrap_enqueue(date, boolean) TO authenticated;
