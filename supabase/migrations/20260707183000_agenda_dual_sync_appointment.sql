-- Export Suite → Style: divide cita multi-segmento en varias filas plan2009

CREATE OR REPLACE FUNCTION public.agenda_dual_sync_appointment(p_appointment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, dunasoft
AS $$
DECLARE
  v_company_id uuid := public.get_user_company_id();
  v_user_id uuid := auth.uid();
  v_appt record;
  v_codemp text;
  v_codcli text;
  v_nomcli text;
  v_tel1cli text;
  v_item record;
  v_cursor_time text;
  v_seg_start text;
  v_seg_end text;
  v_seg_recurso uuid;
  v_seg_codrec text;
  v_seg_colfon integer;
  v_seg_collet integer;
  v_seg_items jsonb := '[]'::jsonb;
  v_idplan bigint;
  v_bridge_id uuid;
  v_queue_id bigint;
  v_segment_index integer := 0;
  v_created_idplans bigint[] := ARRAY[]::bigint[];
  v_existing_idplans text[];
  v_planart jsonb;
  v_art jsonb;
  v_i integer;
  v_result jsonb := '[]'::jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  IF NOT public.user_has_permission(v_user_id, v_company_id, 'agenda.update') THEN
    RAISE EXCEPTION 'Sin permiso agenda.update';
  END IF;

  SELECT
    a.id,
    a.company_id,
    a.employee_id,
    a.client_name,
    a.description,
    a.appointment_date,
    a.start_time,
    a.end_time,
    a.legacy_codcli,
    a.legacy_codemp,
    a.legacy_idplan,
    a.customer_id,
    c.legacy_codcli AS customer_legacy_codcli,
    c.phone AS customer_phone,
    ae.dunasoft_codemp
  INTO v_appt
  FROM public.agenda_appointments a
  LEFT JOIN public.customers c ON c.id = a.customer_id
  LEFT JOIN public.agenda_employees ae ON ae.id = a.employee_id
  WHERE a.id = p_appointment_id
    AND a.company_id = v_company_id;

  IF v_appt.id IS NULL THEN
    RAISE EXCEPTION 'Cita no encontrada';
  END IF;

  v_codemp := coalesce(nullif(btrim(v_appt.dunasoft_codemp), ''), nullif(btrim(v_appt.legacy_codemp), ''), '01');
  v_codcli := coalesce(
    nullif(btrim(v_appt.customer_legacy_codcli), ''),
    nullif(btrim(v_appt.legacy_codcli), ''),
    '0'
  );
  v_nomcli := coalesce(nullif(btrim(v_appt.client_name), ''), 'Cliente');
  v_tel1cli := coalesce(nullif(btrim(v_appt.customer_phone), ''), '');

  PERFORM set_config('app.style_sync_inbound', '1', true);

  v_cursor_time := v_appt.start_time;
  v_seg_start := v_cursor_time;
  v_seg_recurso := NULL;

  FOR v_item IN
    SELECT
      ai.*,
      art.codigo AS article_codigo
    FROM public.appointment_items ai
    LEFT JOIN public.articles art ON art.id = ai.article_id
    WHERE ai.appointment_id = p_appointment_id
    ORDER BY ai.sort_order, ai.created_at
  LOOP
    IF NOT coalesce(v_item.occupies_time, false) OR coalesce(v_item.duration_minutes, 0) <= 0 THEN
      CONTINUE;
    END IF;

    IF v_seg_recurso IS NOT NULL
       AND v_seg_recurso IS DISTINCT FROM v_item.recurso_id
       AND v_seg_items <> '[]'::jsonb THEN
      -- flush previous segment
      v_seg_end := v_cursor_time;
      SELECT b.legacy_idplan::bigint INTO v_idplan
      FROM public.agenda_dunasoft_bridge b
      WHERE b.company_id = v_company_id
        AND b.agenda_appointment_id = p_appointment_id
        AND b.segment_index = v_segment_index
      LIMIT 1;

      IF v_idplan IS NULL THEN
        v_idplan := dunasoft.allocate_idplan();
      END IF;

      SELECT r.dunasoft_codrec INTO v_seg_codrec
      FROM public.recursos r WHERE r.id = v_seg_recurso;
      v_seg_codrec := coalesce(nullif(btrim(v_seg_codrec), ''), '');
      SELECT ec.colfon, ec.collet INTO v_seg_colfon, v_seg_collet
      FROM dunasoft.employee_colors(v_codemp) ec;

      IF EXISTS (SELECT 1 FROM dunasoft.plan2009 WHERE idplan = v_idplan) THEN
        PERFORM dunasoft.assert_plan2009_editable(v_idplan);
        UPDATE dunasoft.plan2009 SET
          codemp = v_codemp, codcli = v_codcli, fecha = v_appt.appointment_date,
          horini = v_seg_start, horfin = v_seg_end,
          texto = left(coalesce(v_appt.description, ''), 250),
          codrec = v_seg_codrec, nomcli = v_nomcli, tel1cli = v_tel1cli,
          colfon = coalesce(v_seg_colfon, 0), collet = coalesce(v_seg_collet, 0),
          enviadoand = false
        WHERE idplan = v_idplan;
      ELSE
        INSERT INTO dunasoft.plan2009 (
          idplan, codemp, codcli, fecha, horini, horfin, texto, codrec,
          nomcli, tel1cli, colfon, collet, facturado, enviar, idusuweb,
          enviadoand, macand, idand, enviadocro, idcro, enviadoadd, idplanrel, codproce, horaman
        ) VALUES (
          v_idplan, v_codemp, v_codcli, v_appt.appointment_date, v_seg_start, v_seg_end,
          left(coalesce(v_appt.description, ''), 250), v_seg_codrec,
          v_nomcli, coalesce(v_tel1cli, ''), coalesce(v_seg_colfon, 0), coalesce(v_seg_collet, 0),
          false, true, 0, false, '', 0, false, 0, false, 0, '', false
        );
      END IF;

      PERFORM dunasoft.replace_planart_rows(v_idplan, v_seg_items, v_seg_start);

      v_queue_id := dunasoft.enqueue_style_reservas(
        v_company_id, 'update', v_idplan,
        jsonb_build_object(
          'idplan', v_idplan,
          'codemp', v_codemp, 'codcli', v_codcli, 'nomcli', v_nomcli, 'tel1cli', v_tel1cli,
          'fecha', v_appt.appointment_date, 'horini', v_seg_start, 'horfin', v_seg_end,
          'texto', left(coalesce(v_appt.description, ''), 250), 'codrec', v_seg_codrec,
          'colfon', coalesce(v_seg_colfon, 0), 'collet', coalesce(v_seg_collet, 0),
          'planart_memo', dunasoft.build_planart_memo(v_idplan, v_seg_start),
          'facturado', false,
          'planart', v_seg_items,
          'codusu', dunasoft.resolve_dunasoft_codusu(v_user_id, v_company_id, '{}'::jsonb)
        ),
        p_appointment_id
      );

      INSERT INTO public.agenda_dunasoft_bridge (
        company_id, legacy_idplan, agenda_appointment_id, outbox_id, source, dbf_status,
        segment_index, segment_start_time, segment_end_time
      ) VALUES (
        v_company_id, v_idplan::text, p_appointment_id, v_queue_id, 'suite', 'pending',
        v_segment_index, v_seg_start, v_seg_end
      )
      ON CONFLICT (company_id, legacy_idplan) DO UPDATE SET
        agenda_appointment_id = EXCLUDED.agenda_appointment_id,
        outbox_id = EXCLUDED.outbox_id,
        segment_index = EXCLUDED.segment_index,
        segment_start_time = EXCLUDED.segment_start_time,
        segment_end_time = EXCLUDED.segment_end_time,
        dbf_status = 'pending',
        updated_at = now();

      v_created_idplans := array_append(v_created_idplans, v_idplan);
      v_result := v_result || jsonb_build_array(jsonb_build_object('idplan', v_idplan, 'horini', v_seg_start, 'horfin', v_seg_end));
      v_segment_index := v_segment_index + 1;
      v_seg_start := v_cursor_time;
      v_seg_items := '[]'::jsonb;
    END IF;

    v_seg_recurso := v_item.recurso_id;
    v_seg_end := to_char(
      (v_appt.appointment_date + v_cursor_time::time)
      + make_interval(mins => greatest(v_item.duration_minutes, 0)),
      'HH24:MI'
    );
    v_cursor_time := v_seg_end;

    IF nullif(btrim(coalesce(v_item.article_codigo, '')), '') IS NOT NULL THEN
      v_seg_items := v_seg_items || jsonb_build_array(
        jsonb_build_object(
          'codart', btrim(v_item.article_codigo),
          'hora', v_seg_start,
          'desart', coalesce(v_item.label, '')
        )
      );
    END IF;
  END LOOP;

  -- flush last segment (or whole appointment if no time items)
  IF v_seg_items = '[]'::jsonb THEN
    v_seg_start := v_appt.start_time;
    v_seg_end := v_appt.end_time;
    SELECT r.dunasoft_codrec INTO v_seg_codrec
    FROM public.recursos r WHERE r.id = v_seg_recurso;
    v_seg_codrec := coalesce(nullif(btrim(v_seg_codrec), ''), nullif(btrim(v_appt.description), ''), '');
  ELSE
    v_seg_codrec := coalesce((SELECT r.dunasoft_codrec FROM public.recursos r WHERE r.id = v_seg_recurso), '');
  END IF;

  SELECT b.legacy_idplan::bigint INTO v_idplan
  FROM public.agenda_dunasoft_bridge b
  WHERE b.company_id = v_company_id
    AND b.agenda_appointment_id = p_appointment_id
    AND b.segment_index = v_segment_index
  LIMIT 1;
  IF v_idplan IS NULL THEN
    v_idplan := coalesce(nullif(btrim(v_appt.legacy_idplan), '')::bigint, dunasoft.allocate_idplan());
  END IF;

  SELECT ec.colfon, ec.collet INTO v_seg_colfon, v_seg_collet
  FROM dunasoft.employee_colors(v_codemp) ec;

  IF EXISTS (SELECT 1 FROM dunasoft.plan2009 WHERE idplan = v_idplan) THEN
    PERFORM dunasoft.assert_plan2009_editable(v_idplan);
    UPDATE dunasoft.plan2009 SET
      codemp = v_codemp, codcli = v_codcli, fecha = v_appt.appointment_date,
      horini = v_seg_start, horfin = v_seg_end,
      texto = left(coalesce(v_appt.description, ''), 250),
      codrec = coalesce(v_seg_codrec, ''), nomcli = v_nomcli, tel1cli = v_tel1cli,
      colfon = coalesce(v_seg_colfon, 0), collet = coalesce(v_seg_collet, 0),
      enviadoand = false
    WHERE idplan = v_idplan;
  ELSE
    INSERT INTO dunasoft.plan2009 (
      idplan, codemp, codcli, fecha, horini, horfin, texto, codrec,
      nomcli, tel1cli, colfon, collet, facturado, enviar, idusuweb,
      enviadoand, macand, idand, enviadocro, idcro, enviadoadd, idplanrel, codproce, horaman
    ) VALUES (
      v_idplan, v_codemp, v_codcli, v_appt.appointment_date, v_seg_start, v_seg_end,
      left(coalesce(v_appt.description, ''), 250), coalesce(v_seg_codrec, ''),
      v_nomcli, coalesce(v_tel1cli, ''), coalesce(v_seg_colfon, 0), coalesce(v_seg_collet, 0),
      false, true, 0, false, '', 0, false, 0, false, 0, '', false
    );
  END IF;

  IF v_seg_items <> '[]'::jsonb THEN
    PERFORM dunasoft.replace_planart_rows(v_idplan, v_seg_items, v_seg_start);
  END IF;

  v_queue_id := dunasoft.enqueue_style_reservas(
    v_company_id, 'update', v_idplan,
    jsonb_build_object(
      'idplan', v_idplan,
      'codemp', v_codemp, 'codcli', v_codcli, 'nomcli', v_nomcli, 'tel1cli', v_tel1cli,
      'fecha', v_appt.appointment_date, 'horini', v_seg_start, 'horfin', v_seg_end,
      'texto', left(coalesce(v_appt.description, ''), 250), 'codrec', coalesce(v_seg_codrec, ''),
      'colfon', coalesce(v_seg_colfon, 0), 'collet', coalesce(v_seg_collet, 0),
      'planart_memo', dunasoft.build_planart_memo(v_idplan, v_seg_start),
      'facturado', false,
      'planart', CASE WHEN v_seg_items <> '[]'::jsonb THEN v_seg_items ELSE NULL END,
      'codusu', dunasoft.resolve_dunasoft_codusu(v_user_id, v_company_id, '{}'::jsonb)
    ),
    p_appointment_id
  );

  INSERT INTO public.agenda_dunasoft_bridge (
    company_id, legacy_idplan, agenda_appointment_id, outbox_id, source, dbf_status,
    segment_index, segment_start_time, segment_end_time
  ) VALUES (
    v_company_id, v_idplan::text, p_appointment_id, v_queue_id, 'suite', 'pending',
    v_segment_index, v_seg_start, v_seg_end
  )
  ON CONFLICT (company_id, legacy_idplan) DO UPDATE SET
    agenda_appointment_id = EXCLUDED.agenda_appointment_id,
    outbox_id = EXCLUDED.outbox_id,
    segment_index = EXCLUDED.segment_index,
    segment_start_time = EXCLUDED.segment_start_time,
    segment_end_time = EXCLUDED.segment_end_time,
    dbf_status = 'pending',
    updated_at = now();

  v_created_idplans := array_append(v_created_idplans, v_idplan);

  UPDATE public.agenda_appointments SET
    legacy_idplan = v_idplan::text,
    legacy_codemp = v_codemp,
    legacy_codcli = v_codcli,
    legacy_codrec = coalesce(v_seg_codrec, legacy_codrec),
    start_time = v_appt.start_time,
    end_time = v_appt.end_time,
    updated_at = now()
  WHERE id = p_appointment_id;

  -- Remove orphaned bridge segments / plan2009 rows no longer represented
  SELECT array_agg(b.legacy_idplan) INTO v_existing_idplans
  FROM public.agenda_dunasoft_bridge b
  WHERE b.company_id = v_company_id
    AND b.agenda_appointment_id = p_appointment_id
    AND b.legacy_idplan::bigint <> ALL (v_created_idplans);

  IF v_existing_idplans IS NOT NULL THEN
    FOR v_i IN 1 .. coalesce(array_length(v_existing_idplans, 1), 0) LOOP
      IF NOT coalesce((
        SELECT facturado FROM dunasoft.plan2009 WHERE idplan = v_existing_idplans[v_i]::bigint
      ), false) THEN
        PERFORM public.agenda_dual_delete(v_existing_idplans[v_i]);
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'appointment_id', p_appointment_id,
    'segments', v_result || jsonb_build_array(jsonb_build_object('idplan', v_idplan, 'horini', v_seg_start, 'horfin', v_seg_end)),
    'dbf_status', 'pending'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.agenda_dual_sync_appointment(uuid) TO authenticated;
