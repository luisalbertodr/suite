DO $$
DECLARE
  v_company_id uuid;
  v_row record;
  v_queue_id bigint;
  v_count int := 0;
BEGIN
  SELECT company_id INTO v_company_id FROM public.style_reservas_sync_config LIMIT 1;
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'No style_reservas_sync_config';
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
      p.codemp, p.codcli, p.horfin, p.texto, p.codrec, p.nomcli, p.tel1cli,
      p.colfon, p.collet, p.facturado
    FROM public.agenda_appointments a
    JOIN dunasoft.plan2009 p ON p.idplan = a.legacy_idplan::bigint
    WHERE a.company_id = v_company_id
      AND a.legacy_idplan IS NOT NULL AND btrim(a.legacy_idplan) <> ''
      AND a.appointment_date >= current_date
      AND a.status <> 'cancelled'
  LOOP
    v_queue_id := dunasoft.enqueue_style_reservas(
      v_company_id, 'update', v_row.legacy_idplan::bigint,
      jsonb_build_object(
        'idplan', v_row.legacy_idplan::bigint,
        'codemp', v_row.codemp, 'codcli', v_row.codcli,
        'nomcli', coalesce(nullif(btrim(v_row.nomcli), ''), v_row.client_name),
        'tel1cli', v_row.tel1cli,
        'fecha', v_row.appointment_date,
        'horini', v_row.start_time,
        'horfin', coalesce(nullif(btrim(v_row.horfin), ''), v_row.end_time),
        'texto', coalesce(v_row.texto, v_row.description),
        'codrec', v_row.codrec,
        'colfon', v_row.colfon, 'collet', v_row.collet,
        'facturado', coalesce(v_row.facturado, false),
        'planart_memo', dunasoft.build_planart_memo(v_row.legacy_idplan::bigint, v_row.start_time),
        'source', 'bootstrap', 'suite_updated_at', v_row.updated_at
      ),
      v_row.appt_id
    );
    IF v_queue_id IS NOT NULL THEN
      INSERT INTO public.agenda_dunasoft_bridge (company_id, legacy_idplan, agenda_appointment_id, outbox_id, source, dbf_status)
      VALUES (v_company_id, v_row.legacy_idplan, v_row.appt_id, v_queue_id, 'suite', 'pending')
      ON CONFLICT (company_id, legacy_idplan) DO UPDATE SET
        outbox_id = EXCLUDED.outbox_id, dbf_status = 'pending', updated_at = now();
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RAISE NOTICE 'Bootstrap encoladas: %', v_count;
END $$;

SELECT count(*) AS pending_queue FROM dunasoft.style_reservas_queue WHERE delivered_at IS NULL;
