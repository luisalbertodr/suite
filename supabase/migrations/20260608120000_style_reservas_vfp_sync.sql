-- Canal único Style ↔ Suite vía protocolo stylegetreservas / stylereservas (VFP + Edge Function).
-- Sustituye dunasoft.sync_outbox para plan2009 cuando Style tira del pull HTTP.

CREATE TABLE IF NOT EXISTS public.style_reservas_sync_config (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  sync_token text NOT NULL UNIQUE,
  macand text NOT NULL DEFAULT 'SUITE-STYLE',
  sync_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dunasoft.style_reservas_queue (
  id bigserial PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  operation text NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
  idplan numeric NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  suite_appointment_id uuid,
  delivered_at timestamptz,
  style_ack_idplan numeric,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS style_reservas_queue_pending_idx
  ON dunasoft.style_reservas_queue (company_id, created_at)
  WHERE delivered_at IS NULL;

CREATE OR REPLACE FUNCTION dunasoft.enqueue_style_reservas(
  p_company_id uuid,
  p_operation text,
  p_idplan numeric,
  p_payload jsonb,
  p_suite_appointment_id uuid DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
DECLARE
  v_id bigint;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.style_reservas_sync_config c
    WHERE c.company_id = p_company_id AND c.sync_enabled
  ) THEN
    RETURN NULL;
  END IF;

  INSERT INTO dunasoft.style_reservas_queue (
    company_id, operation, idplan, payload, suite_appointment_id
  ) VALUES (
    p_company_id, p_operation, p_idplan, coalesce(p_payload, '{}'::jsonb), p_suite_appointment_id
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION dunasoft.style_reservas_resolve_company(p_sync_token text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, dunasoft
AS $$
  SELECT company_id
  FROM public.style_reservas_sync_config
  WHERE sync_token = btrim(p_sync_token)
    AND sync_enabled
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION dunasoft.style_reservas_parse_servicios(p_servicios text, p_idplan numeric, p_horini text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
DECLARE
  v_line text;
  v_codart text;
  v_hora text;
  v_pos int;
BEGIN
  DELETE FROM dunasoft.planart WHERE idplan = p_idplan;
  IF coalesce(btrim(p_servicios), '') = '' THEN
    RETURN;
  END IF;

  FOR v_line IN
    SELECT btrim(x) FROM unnest(regexp_split_to_array(p_servicios, E'[\\r\\n]+')) AS x
    WHERE btrim(x) <> ''
  LOOP
    IF v_line ~ '^\\[' THEN
      v_hora := substring(v_line from '^\\[([^\\]]+)\\]');
      v_codart := btrim(split_part(regexp_replace(v_line, '^\\[[^\\]]+\\]\\s*', ''), '-', 1));
    ELSE
      IF length(v_line) >= 10 THEN
        v_codart := btrim(left(v_line, length(v_line) - 5));
        v_hora := btrim(right(v_line, 5));
      ELSE
        v_codart := btrim(v_line);
        v_hora := coalesce(nullif(btrim(p_horini), ''), '09:00');
      END IF;
    END IF;
    IF btrim(v_codart) = '' THEN CONTINUE; END IF;
    INSERT INTO dunasoft.planart (idplan, codart, hora, enviar, artcom, artcomrel)
    VALUES (p_idplan, btrim(v_codart), coalesce(nullif(btrim(v_hora), ''), p_horini), false, false, 0);
  END LOOP;
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
  p_collet numeric
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
BEGIN
  IF v_accion IN ('BAJA', 'BORRAR', 'DELETE') THEN
    SELECT a.id INTO v_appt_id
    FROM public.agenda_appointments a
    WHERE a.company_id = p_company_id AND a.legacy_idplan = p_idplan::text
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
    WHERE company_id = p_company_id AND legacy_idplan = p_idplan::text;

    RETURN jsonb_build_object('ok', true, 'accion', 'BORRAR', 'idplan', p_idplan);
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

  SELECT a.id INTO v_appt_id
  FROM public.agenda_appointments a
  WHERE a.company_id = p_company_id AND a.legacy_idplan = p_idplan::text
  LIMIT 1;

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

CREATE OR REPLACE FUNCTION dunasoft.style_reservas_ack(
  p_company_id uuid,
  p_idand bigint,
  p_idplan numeric,
  p_macand text,
  p_ok boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
DECLARE
  v_row dunasoft.style_reservas_queue%ROWTYPE;
BEGIN
  SELECT * INTO v_row
  FROM dunasoft.style_reservas_queue
  WHERE id = p_idand AND company_id = p_company_id AND delivered_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cola no encontrada o ya confirmada');
  END IF;

  IF p_ok THEN
    UPDATE dunasoft.style_reservas_queue
    SET delivered_at = now(), style_ack_idplan = p_idplan, error = NULL
    WHERE id = p_idand;

    UPDATE public.agenda_dunasoft_bridge
    SET dbf_status = 'applied', error_message = NULL, updated_at = now()
    WHERE company_id = p_company_id
      AND legacy_idplan = coalesce(p_idplan, v_row.idplan)::text;
  ELSE
    UPDATE dunasoft.style_reservas_queue
    SET error = 'Style reservaok=NO'
    WHERE id = p_idand;

    UPDATE public.agenda_dunasoft_bridge
    SET dbf_status = 'error', error_message = 'Style reservaok=NO', updated_at = now()
    WHERE company_id = p_company_id
      AND legacy_idplan = v_row.idplan::text;
  END IF;

  RETURN jsonb_build_object('ok', p_ok, 'idand', p_idand, 'idplan', p_idplan);
END;
$$;

-- Reemplazar encolado sync_outbox → style_reservas_queue en RPCs dual-write
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
  v_queue_id bigint;
  v_planart jsonb := coalesce(p_payload->'planart', '[]'::jsonb);
  v_art jsonb;
  v_i int;
  v_colfon numeric;
  v_collet numeric;
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
    v_nomcli, coalesce(v_tel1cli, ''), v_colfon, v_collet, false, false, 0,
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
    'codemp', v_codemp,
    'codcli', v_codcli,
    'nomcli', v_nomcli,
    'tel1cli', v_tel1cli,
    'fecha', v_fecha,
    'horini', v_horini,
    'horfin', v_horfin,
    'texto', v_texto,
    'codrec', v_codrec,
    'facturado', false,
    'requested_by', v_user_id::text,
    'source', 'suite-agenda'
  );

  v_queue_id := dunasoft.enqueue_style_reservas(v_company_id, 'create', v_idplan, v_outbox_payload, v_appt_id);

  INSERT INTO public.agenda_dunasoft_bridge (
    company_id, legacy_idplan, agenda_appointment_id, outbox_id, source, dbf_status
  ) VALUES (
    v_company_id, v_idplan::text, v_appt_id, v_queue_id, 'suite', 'pending'
  )
  RETURNING id INTO v_bridge_id;

  RETURN jsonb_build_object(
    'appointment_id', v_appt_id,
    'legacy_idplan', v_idplan,
    'bridge_id', v_bridge_id,
    'queue_id', v_queue_id,
    'dbf_status', 'pending'
  );
END;
$$;

-- agenda_dual_update / delete: mismo patrón (solo fragmento de encolado)
CREATE OR REPLACE FUNCTION public.agenda_dual_update(p_idplan text, p_payload jsonb)
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
  v_queue_id bigint;
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

  SELECT ec.colfon, ec.collet INTO v_colfon, v_collet FROM dunasoft.employee_colors(v_codemp) ec;

  UPDATE dunasoft.plan2009 SET
    codemp = v_codemp, codcli = v_codcli, fecha = v_fecha,
    horini = v_horini, horfin = v_horfin, texto = v_texto, codrec = v_codrec,
    nomcli = v_nomcli, tel1cli = coalesce(v_tel1cli, ''), colfon = v_colfon, collet = v_collet,
    enviadoand = false
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

  v_queue_id := dunasoft.enqueue_style_reservas(
    v_company_id, 'update', v_idplan,
    jsonb_build_object(
      'idplan', v_idplan, 'old', v_old, 'new', v_new,
      'codemp', v_codemp, 'codcli', v_codcli, 'nomcli', v_nomcli, 'tel1cli', v_tel1cli,
      'fecha', v_fecha, 'horini', v_horini, 'horfin', v_horfin, 'texto', v_texto, 'codrec', v_codrec,
      'colfon', v_colfon, 'collet', v_collet,
      'planart_memo', dunasoft.build_planart_memo(v_idplan, v_horini),
      'facturado', coalesce((v_new->>'facturado')::boolean, false),
      'planart', CASE WHEN v_has_planart THEN v_planart ELSE NULL END,
      'codusu', dunasoft.resolve_dunasoft_codusu(v_user_id, v_company_id, p_payload)
    ),
    v_appt_id
  );

  UPDATE public.agenda_dunasoft_bridge
  SET outbox_id = v_queue_id, dbf_status = 'pending', updated_at = now()
  WHERE company_id = v_company_id AND legacy_idplan = v_idplan::text;

  RETURN jsonb_build_object('legacy_idplan', v_idplan, 'queue_id', v_queue_id, 'dbf_status', 'pending');
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
  v_queue_id bigint;
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

  SELECT a.id INTO v_appt_id FROM public.agenda_appointments a
  WHERE a.company_id = v_company_id AND a.legacy_idplan = v_idplan::text LIMIT 1;

  IF v_appt_id IS NOT NULL THEN
    IF public.appointment_has_completed_sale(v_appt_id) THEN
      UPDATE public.agenda_appointments SET status = 'cancelled', updated_at = now() WHERE id = v_appt_id;
    ELSE
      DELETE FROM public.agenda_appointments WHERE id = v_appt_id;
    END IF;
  END IF;

  v_queue_id := dunasoft.enqueue_style_reservas(
    v_company_id, 'delete', v_idplan,
    jsonb_build_object('idplan', v_idplan, 'old', v_old,
      'codusu', dunasoft.resolve_dunasoft_codusu(v_user_id, v_company_id, '{}'::jsonb)),
    v_appt_id
  );

  UPDATE public.agenda_dunasoft_bridge
  SET dbf_status = 'pending', outbox_id = v_queue_id, updated_at = now()
  WHERE company_id = v_company_id AND legacy_idplan = v_idplan::text;

  RETURN jsonb_build_object('legacy_idplan', v_idplan, 'queue_id', v_queue_id, 'dbf_status', 'pending');
END;
$$;

-- Token inicial (copiar a SuiteSync.cfg en la VM Style)
INSERT INTO public.style_reservas_sync_config (company_id, sync_token, macand)
VALUES (
  '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid,
  encode(gen_random_bytes(24), 'hex'),
  'STYLE-VM'
)
ON CONFLICT (company_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.style_reservas_resolve_company(p_sync_token text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$ SELECT dunasoft.style_reservas_resolve_company(p_sync_token); $$;

CREATE OR REPLACE FUNCTION public.style_reservas_apply_from_style(
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
  p_collet numeric
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
  SELECT dunasoft.style_reservas_apply_from_style(
    p_company_id, p_accion, p_idplan, p_codemp, p_codcli, p_fecha,
    p_horini, p_horfin, p_texto, p_codrec, p_nomcli, p_tel1cli,
    p_facturado, p_servicios, p_colfon, p_collet
  );
$$;

CREATE OR REPLACE FUNCTION public.style_reservas_ack(
  p_company_id uuid,
  p_idand bigint,
  p_idplan numeric,
  p_macand text,
  p_ok boolean
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
  SELECT dunasoft.style_reservas_ack(p_company_id, p_idand, p_idplan, p_macand, p_ok);
$$;

GRANT SELECT ON public.style_reservas_sync_config TO authenticated;
GRANT EXECUTE ON FUNCTION public.style_reservas_resolve_company(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.style_reservas_apply_from_style TO service_role;
GRANT EXECUTE ON FUNCTION public.style_reservas_ack TO service_role;

GRANT SELECT, INSERT, UPDATE ON dunasoft.style_reservas_queue TO service_role;
GRANT USAGE, SELECT ON SEQUENCE dunasoft.style_reservas_queue_id_seq TO service_role;

COMMENT ON TABLE dunasoft.style_reservas_queue IS
  'Cola Suite→Style consumida por stylegetreservas (canal VFP, sin sync_outbox Python).';
