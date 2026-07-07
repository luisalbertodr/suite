-- Bridge multi-idplan y fusión de citas consecutivas Style → Suite

ALTER TABLE public.agenda_appointments
  ADD COLUMN IF NOT EXISTS legacy_codrec text,
  ADD COLUMN IF NOT EXISTS merged_from_style boolean NOT NULL DEFAULT false;

ALTER TABLE public.agenda_dunasoft_bridge
  ADD COLUMN IF NOT EXISTS segment_index integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS segment_start_time text,
  ADD COLUMN IF NOT EXISTS segment_end_time text;

COMMENT ON COLUMN public.agenda_dunasoft_bridge.segment_index IS
  'Índice del tramo dentro de una cita Suite fusionada (0..N).';

CREATE OR REPLACE FUNCTION public.hhmm_diff_minutes(p_from text, p_to text)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  fh int;
  fm int;
  th int;
  tm int;
BEGIN
  fh := split_part(coalesce(p_from, '0:0'), ':', 1)::int;
  fm := split_part(coalesce(p_from, '0:0'), ':', 2)::int;
  th := split_part(coalesce(p_to, '0:0'), ':', 1)::int;
  tm := split_part(coalesce(p_to, '0:0'), ':', 2)::int;
  RETURN (th * 60 + tm) - (fh * 60 + fm);
END;
$$;

CREATE OR REPLACE FUNCTION dunasoft.append_appointment_items_from_style(
  p_appointment_id uuid,
  p_company_id uuid,
  p_idplan numeric,
  p_codrec text DEFAULT NULL,
  p_horini text DEFAULT NULL,
  p_horfin text DEFAULT NULL,
  p_texto text DEFAULT NULL,
  p_sort_offset integer DEFAULT 0
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
DECLARE
  v_recurso_id uuid;
  v_planart_count integer;
  v_duration integer;
  v_label text;
  v_inserted integer := 0;
BEGIN
  IF p_appointment_id IS NULL OR p_company_id IS NULL OR p_idplan IS NULL THEN
    RETURN 0;
  END IF;

  v_recurso_id := public.resolve_agenda_recurso_for_dunasoft_codrec(p_company_id, p_codrec);

  SELECT count(*) INTO v_planart_count
  FROM dunasoft.planart pa
  WHERE pa.idplan = p_idplan;

  IF v_planart_count > 0 THEN
    INSERT INTO public.appointment_items (
      appointment_id, kind, label, duration_minutes, occupies_time, sort_order,
      article_id, quantity, unit_price, bonus_payment_mode, recurso_id
    )
    SELECT
      p_appointment_id,
      CASE WHEN lower(coalesce(a.article_kind, '')) = 'producto' THEN 'product' ELSE 'service' END,
      CASE
        WHEN a.id IS NOT NULL AND nullif(btrim(coalesce(a.descripcion, '')), '') IS NOT NULL THEN
          concat_ws(' - ', nullif(btrim(pa.codart), ''), nullif(btrim(a.descripcion), ''))
        ELSE coalesce(nullif(btrim(pa.codart), ''), 'Servicio')
      END,
      CASE WHEN lower(coalesce(a.article_kind, '')) = 'producto' THEN 0 ELSE greatest(coalesce(a.duration_minutes, 30), 0) END,
      CASE WHEN lower(coalesce(a.article_kind, '')) = 'producto' THEN false ELSE true END,
      p_sort_offset + row_number() OVER (
        ORDER BY coalesce(nullif(btrim(pa.hora), ''), '99:99'), nullif(btrim(pa.codart), '')
      ) - 1,
      a.id, 1, greatest(coalesce(a.precio, 0), 0), 'none',
      CASE WHEN lower(coalesce(a.article_kind, '')) = 'producto' THEN NULL ELSE v_recurso_id END
    FROM dunasoft.planart pa
    LEFT JOIN public.articles a
      ON a.company_id = p_company_id
     AND lower(btrim(coalesce(a.codigo, ''))) = lower(btrim(coalesce(pa.codart, '')))
    WHERE pa.idplan = p_idplan;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
  ELSE
    v_duration := greatest(public.hhmm_diff_minutes(
      coalesce(nullif(btrim(p_horini), ''), '09:00'),
      coalesce(nullif(btrim(p_horfin), ''), '10:00')
    ), 15);
    v_label := coalesce(nullif(btrim(coalesce(p_codrec, '')), ''), nullif(btrim(coalesce(p_texto, '')), ''), 'Servicio');
    INSERT INTO public.appointment_items (
      appointment_id, kind, label, duration_minutes, occupies_time, sort_order,
      quantity, unit_price, bonus_payment_mode, recurso_id
    ) VALUES (
      p_appointment_id, 'service', v_label, v_duration, true, p_sort_offset,
      1, 0, 'none', v_recurso_id
    );
    v_inserted := 1;
  END IF;

  RETURN v_inserted;
END;
$$;

CREATE OR REPLACE FUNCTION dunasoft.style_merge_consecutive_appointments(
  p_company_id uuid,
  p_date date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
DECLARE
  v_chain record;
  v_target_id uuid;
  v_source_id uuid;
  v_segment_idx integer;
  v_merged_count integer := 0;
  v_deleted_count integer := 0;
BEGIN
  IF p_company_id IS NULL OR p_date IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'company/date required');
  END IF;

  PERFORM set_config('app.style_sync_inbound', '1', true);

  FOR v_chain IN
    WITH day_rows AS (
      SELECT
        p.idplan,
        p.codemp,
        p.codcli,
        p.horini,
        p.horfin,
        p.texto,
        p.codrec,
        p.facturado,
        a.id AS appt_id,
        a.employee_id,
        coalesce(nullif(ltrim(btrim(coalesce(p.codcli, '')), '0'), ''), '0') AS codcli_norm
      FROM dunasoft.plan2009 p
      JOIN public.agenda_appointments a
        ON a.company_id = p_company_id
       AND (
         a.legacy_idplan = p.idplan::text
         OR EXISTS (
           SELECT 1 FROM public.agenda_dunasoft_bridge b
           WHERE b.company_id = p_company_id
             AND b.agenda_appointment_id = a.id
             AND b.legacy_idplan = p.idplan::text
         )
       )
      WHERE p.fecha = p_date
        AND coalesce(a.merged_from_style, false) = false
        AND NOT coalesce(p.facturado, false)
    ),
    ordered AS (
      SELECT
        *,
        lag(horfin) OVER (
          PARTITION BY codemp, codcli_norm, employee_id
          ORDER BY horini, idplan
        ) AS prev_horfin
      FROM day_rows
    ),
    marked AS (
      SELECT
        *,
        CASE
          WHEN prev_horfin IS NULL THEN 1
          WHEN public.hhmm_diff_minutes(prev_horfin, horini) > 2 THEN 1
          ELSE 0
        END AS chain_break
      FROM ordered
    ),
    grouped AS (
      SELECT
        *,
        sum(chain_break) OVER (
          PARTITION BY codemp, codcli_norm, employee_id
          ORDER BY horini, idplan
        ) AS chain_id
      FROM marked
    ),
    chains AS (
      SELECT
        codemp,
        codcli_norm,
        employee_id,
        chain_id,
        count(*) AS chain_size,
        min(horini) AS chain_horini,
        max(horfin) AS chain_horfin,
        array_agg(idplan ORDER BY horini, idplan) AS idplans,
        array_agg(appt_id ORDER BY horini, idplan) AS appt_ids
      FROM grouped
      GROUP BY codemp, codcli_norm, employee_id, chain_id
      HAVING count(*) > 1
    )
    SELECT * FROM chains
  LOOP
    v_target_id := v_chain.appt_ids[1];

    UPDATE public.agenda_appointments SET
      start_time = v_chain.chain_horini,
      end_time = v_chain.chain_horfin,
      legacy_idplan = v_chain.idplans[1]::text,
      merged_from_style = true,
      updated_at = now()
    WHERE id = v_target_id;

    DELETE FROM public.appointment_items WHERE appointment_id = v_target_id;

    FOR i IN 1 .. array_length(v_chain.idplans, 1) LOOP
      PERFORM dunasoft.append_appointment_items_from_style(
        v_target_id,
        p_company_id,
        v_chain.idplans[i],
        (SELECT codrec FROM dunasoft.plan2009 WHERE idplan = v_chain.idplans[i]),
        (SELECT horini FROM dunasoft.plan2009 WHERE idplan = v_chain.idplans[i]),
        (SELECT horfin FROM dunasoft.plan2009 WHERE idplan = v_chain.idplans[i]),
        (SELECT texto FROM dunasoft.plan2009 WHERE idplan = v_chain.idplans[i]),
        (SELECT count(*)::int FROM public.appointment_items WHERE appointment_id = v_target_id)
      );

      INSERT INTO public.agenda_dunasoft_bridge (
        company_id, legacy_idplan, agenda_appointment_id, source, dbf_status,
        segment_index, segment_start_time, segment_end_time
      )
      SELECT
        p_company_id,
        v_chain.idplans[i]::text,
        v_target_id,
        'dunasoft',
        'applied',
        i - 1,
        p.horini,
        p.horfin
      FROM dunasoft.plan2009 p
      WHERE p.idplan = v_chain.idplans[i]
      ON CONFLICT (company_id, legacy_idplan) DO UPDATE SET
        agenda_appointment_id = EXCLUDED.agenda_appointment_id,
        segment_index = EXCLUDED.segment_index,
        segment_start_time = EXCLUDED.segment_start_time,
        segment_end_time = EXCLUDED.segment_end_time,
        dbf_status = 'applied',
        updated_at = now();
    END LOOP;

    FOR i IN 2 .. array_length(v_chain.appt_ids, 1) LOOP
      v_source_id := v_chain.appt_ids[i];
      IF v_source_id IS DISTINCT FROM v_target_id
         AND NOT public.appointment_has_completed_sale(v_source_id) THEN
        DELETE FROM public.agenda_appointments WHERE id = v_source_id;
        v_deleted_count := v_deleted_count + 1;
      END IF;
    END LOOP;

    v_merged_count := v_merged_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'date', p_date,
    'merged_chains', v_merged_count,
    'deleted_appointments', v_deleted_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION dunasoft.style_merge_consecutive_appointments(uuid, date) TO service_role;
