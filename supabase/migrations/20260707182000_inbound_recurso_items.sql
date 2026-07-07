-- Inbound: propagar codrec a appointment_items y legacy_codrec en agenda_appointments

CREATE OR REPLACE FUNCTION dunasoft.sync_appointment_items_from_style(
  p_appointment_id uuid,
  p_company_id uuid,
  p_idplan numeric,
  p_codrec text DEFAULT NULL,
  p_horini text DEFAULT NULL,
  p_horfin text DEFAULT NULL,
  p_texto text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
DECLARE
  v_recurso_id uuid;
  v_planart_count integer;
  v_duration integer;
  v_label text;
BEGIN
  IF p_appointment_id IS NULL OR p_company_id IS NULL OR p_idplan IS NULL THEN
    RETURN;
  END IF;

  v_recurso_id := public.resolve_agenda_recurso_for_dunasoft_codrec(p_company_id, p_codrec);

  SELECT count(*) INTO v_planart_count
  FROM dunasoft.planart pa
  WHERE pa.idplan = p_idplan;

  DELETE FROM public.appointment_items
  WHERE appointment_id = p_appointment_id;

  IF v_planart_count > 0 THEN
    INSERT INTO public.appointment_items (
      appointment_id,
      kind,
      label,
      duration_minutes,
      occupies_time,
      sort_order,
      article_id,
      quantity,
      unit_price,
      bonus_payment_mode,
      recurso_id
    )
    SELECT
      p_appointment_id,
      CASE
        WHEN lower(coalesce(a.article_kind, '')) = 'producto' THEN 'product'
        ELSE 'service'
      END AS kind,
      CASE
        WHEN a.id IS NOT NULL AND nullif(btrim(coalesce(a.descripcion, '')), '') IS NOT NULL THEN
          concat_ws(' - ', nullif(btrim(pa.codart), ''), nullif(btrim(a.descripcion), ''))
        ELSE
          coalesce(nullif(btrim(pa.codart), ''), 'Servicio')
      END AS label,
      CASE
        WHEN lower(coalesce(a.article_kind, '')) = 'producto' THEN 0
        ELSE greatest(coalesce(a.duration_minutes, 30), 0)
      END AS duration_minutes,
      CASE
        WHEN lower(coalesce(a.article_kind, '')) = 'producto' THEN false
        ELSE true
      END AS occupies_time,
      row_number() OVER (
        ORDER BY coalesce(nullif(btrim(pa.hora), ''), '99:99'), nullif(btrim(pa.codart), '')
      ) - 1 AS sort_order,
      a.id AS article_id,
      1 AS quantity,
      greatest(coalesce(a.precio, 0), 0) AS unit_price,
      'none' AS bonus_payment_mode,
      CASE
        WHEN lower(coalesce(a.article_kind, '')) = 'producto' THEN NULL
        ELSE v_recurso_id
      END AS recurso_id
    FROM dunasoft.planart pa
    LEFT JOIN public.articles a
      ON a.company_id = p_company_id
     AND lower(btrim(coalesce(a.codigo, ''))) = lower(btrim(coalesce(pa.codart, '')))
    WHERE pa.idplan = p_idplan;
  ELSE
    v_duration := greatest(public.hhmm_diff_minutes(
      coalesce(nullif(btrim(p_horini), ''), '09:00'),
      coalesce(nullif(btrim(p_horfin), ''), '10:00')
    ), 15);
    v_label := coalesce(
      nullif(btrim(coalesce(p_codrec, '')), ''),
      nullif(btrim(coalesce(p_texto, '')), ''),
      'Servicio'
    );
    INSERT INTO public.appointment_items (
      appointment_id, kind, label, duration_minutes, occupies_time, sort_order,
      quantity, unit_price, bonus_payment_mode, recurso_id
    ) VALUES (
      p_appointment_id, 'service', v_label, v_duration, true, 0,
      1, 0, 'none', v_recurso_id
    );
  END IF;
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
  v_codrec text := btrim(coalesce(p_codrec, ''));
BEGIN
  PERFORM set_config('app.style_sync_inbound', '1', true);

  v_cancelled := dunasoft.cancel_pending_style_reservas_outbound(p_idplan);

  IF v_accion IN ('BAJA', 'BORRAR', 'DELETE') THEN
    SELECT a.id, a.company_id INTO v_appt_id, v_appt_company_id
    FROM public.agenda_appointments a
    JOIN public.agenda_dunasoft_bridge b
      ON b.agenda_appointment_id = a.id
     AND b.company_id = p_company_id
     AND b.legacy_idplan = p_idplan::text
    ORDER BY CASE WHEN a.company_id = p_company_id THEN 0 ELSE 1 END
    LIMIT 1;

    IF v_appt_id IS NULL THEN
      SELECT a.id, a.company_id INTO v_appt_id, v_appt_company_id
      FROM public.agenda_appointments a
      WHERE a.legacy_idplan = p_idplan::text
      ORDER BY CASE WHEN a.company_id = p_company_id THEN 0 ELSE 1 END
      LIMIT 1;
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

  IF v_appt_id IS NULL THEN
    SELECT b.agenda_appointment_id, a.company_id
    INTO v_appt_id, v_appt_company_id
    FROM public.agenda_dunasoft_bridge b
    JOIN public.agenda_appointments a ON a.id = b.agenda_appointment_id
    WHERE b.company_id = p_company_id
      AND b.legacy_idplan = p_idplan::text
    LIMIT 1;
  END IF;

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
      codrec = coalesce(nullif(v_codrec, ''), codrec),
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
      coalesce(v_codrec, ''),
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
      legacy_idplan, legacy_codcli, legacy_codemp, legacy_codrec
    ) VALUES (
      gen_random_uuid(), p_company_id, v_employee_id,
      v_nomcli,
      left(coalesce(nullif(btrim(p_texto), ''), ''), 500),
      coalesce(p_fecha, current_date),
      coalesce(nullif(btrim(p_horini), ''), '09:00'),
      coalesce(nullif(btrim(p_horfin), ''), '10:00'),
      'bg-blue-100 border-blue-300', 'confirmed',
      p_idplan::text, v_codcli, v_codemp, nullif(v_codrec, '')
    )
    RETURNING id INTO v_appt_id;

    INSERT INTO public.agenda_dunasoft_bridge (
      company_id, legacy_idplan, agenda_appointment_id, source, dbf_status,
      segment_index, segment_start_time, segment_end_time
    ) VALUES (
      p_company_id, p_idplan::text, v_appt_id, 'dunasoft', 'applied',
      0, coalesce(nullif(btrim(p_horini), ''), '09:00'), coalesce(nullif(btrim(p_horfin), ''), '10:00')
    )
    ON CONFLICT (company_id, legacy_idplan) DO UPDATE SET
      agenda_appointment_id = EXCLUDED.agenda_appointment_id,
      dbf_status = 'applied',
      segment_index = EXCLUDED.segment_index,
      segment_start_time = EXCLUDED.segment_start_time,
      segment_end_time = EXCLUDED.segment_end_time,
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
      legacy_codrec = coalesce(nullif(v_codrec, ''), legacy_codrec),
      updated_at = now()
    WHERE id = v_appt_id;

    INSERT INTO public.agenda_dunasoft_bridge (
      company_id, legacy_idplan, agenda_appointment_id, source, dbf_status,
      segment_index, segment_start_time, segment_end_time
    ) VALUES (
      p_company_id, p_idplan::text, v_appt_id, 'dunasoft', 'applied',
      coalesce((SELECT max(segment_index) + 1 FROM public.agenda_dunasoft_bridge WHERE agenda_appointment_id = v_appt_id), 0),
      coalesce(nullif(btrim(p_horini), ''), '09:00'),
      coalesce(nullif(btrim(p_horfin), ''), '10:00')
    )
    ON CONFLICT (company_id, legacy_idplan) DO UPDATE SET
      agenda_appointment_id = EXCLUDED.agenda_appointment_id,
      dbf_status = 'applied',
      segment_start_time = EXCLUDED.segment_start_time,
      segment_end_time = EXCLUDED.segment_end_time,
      updated_at = now();
  END IF;

  IF v_appt_id IS NOT NULL THEN
    PERFORM dunasoft.sync_appointment_items_from_style(
      v_appt_id,
      coalesce(v_appt_company_id, p_company_id),
      p_idplan,
      v_codrec,
      p_horini,
      p_horfin,
      p_texto
    );
  END IF;

  IF p_fecha IS NOT NULL THEN
    PERFORM dunasoft.style_merge_consecutive_appointments(p_company_id, p_fecha);
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'accion', v_accion, 'idplan', p_idplan,
    'appointment_id', v_appt_id, 'cancelled_outbound', v_cancelled
  );
END;
$$;
