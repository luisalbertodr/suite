-- Fix Style → appointment_items pricing:
-- 1) planart.codart often has HH:MM glued (e.g. LPG17:15); strip before match
-- 2) Suite articles keep Style code in legacy_codart; codigo is often LEG-<codart>
-- Previous join on articles.codigo = planart.codart left article_id NULL → unit_price 0

CREATE OR REPLACE FUNCTION dunasoft.normalize_planart_codart(p_codart text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT nullif(
    btrim(
      CASE
        WHEN btrim(coalesce(p_codart, '')) ~ '\d{1,2}:\d{2}$'
          THEN regexp_replace(btrim(p_codart), '\d{1,2}:\d{2}$', '')
        ELSE btrim(coalesce(p_codart, ''))
      END
    ),
    ''
  );
$$;

COMMENT ON FUNCTION dunasoft.normalize_planart_codart(text) IS
  'Limpia codart de planart: quita HH:MM pegado al final (artefacto Style/DBF).';

CREATE OR REPLACE FUNCTION dunasoft.resolve_article_id_from_style_codart(
  p_company_id uuid,
  p_codart text
)
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT a.id
  FROM public.articles a
  WHERE a.company_id = p_company_id
    AND nullif(btrim(coalesce(p_codart, '')), '') IS NOT NULL
    AND (
      btrim(coalesce(a.legacy_codart, '')) = btrim(p_codart)
      OR lower(btrim(coalesce(a.codigo, ''))) = lower(btrim(p_codart))
      OR btrim(coalesce(a.codigo, '')) = 'LEG-' || btrim(p_codart)
    )
  ORDER BY
    CASE
      WHEN btrim(coalesce(a.legacy_codart, '')) = btrim(p_codart) THEN 0
      WHEN lower(btrim(coalesce(a.codigo, ''))) = lower(btrim(p_codart)) THEN 1
      ELSE 2
    END,
    a.updated_at DESC NULLS LAST
  LIMIT 1;
$$;

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
          concat_ws(' - ', v_clean.codart, nullif(btrim(a.descripcion), ''))
        ELSE
          coalesce(v_clean.codart, nullif(btrim(pa.codart), ''), 'Servicio')
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
    CROSS JOIN LATERAL (
      SELECT dunasoft.normalize_planart_codart(pa.codart) AS codart
    ) v_clean
    LEFT JOIN public.articles a
      ON a.id = dunasoft.resolve_article_id_from_style_codart(p_company_id, v_clean.codart)
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
          concat_ws(' - ', v_clean.codart, nullif(btrim(a.descripcion), ''))
        ELSE coalesce(v_clean.codart, nullif(btrim(pa.codart), ''), 'Servicio')
      END,
      CASE WHEN lower(coalesce(a.article_kind, '')) = 'producto' THEN 0 ELSE greatest(coalesce(a.duration_minutes, 30), 0) END,
      CASE WHEN lower(coalesce(a.article_kind, '')) = 'producto' THEN false ELSE true END,
      p_sort_offset + row_number() OVER (
        ORDER BY coalesce(nullif(btrim(pa.hora), ''), '99:99'), nullif(btrim(pa.codart), '')
      ) - 1,
      a.id, 1, greatest(coalesce(a.precio, 0), 0), 'none',
      CASE WHEN lower(coalesce(a.article_kind, '')) = 'producto' THEN NULL ELSE v_recurso_id END
    FROM dunasoft.planart pa
    CROSS JOIN LATERAL (
      SELECT dunasoft.normalize_planart_codart(pa.codart) AS codart
    ) v_clean
    LEFT JOIN public.articles a
      ON a.id = dunasoft.resolve_article_id_from_style_codart(p_company_id, v_clean.codart)
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

-- Backfill: citas Style recientes/futuras sin precio (no fusionadas → sync; fusionadas → bridge)
DO $$
DECLARE
  r record;
  seg record;
  v_sort int;
BEGIN
  -- No fusionadas: un solo idplan
  FOR r IN
    SELECT ap.id, ap.company_id, ap.legacy_idplan, ap.legacy_codrec,
           ap.start_time, ap.end_time, ap.description
    FROM public.agenda_appointments ap
    WHERE ap.legacy_idplan IS NOT NULL
      AND coalesce(ap.merged_from_style, false) = false
      AND ap.appointment_date >= current_date - 14
      AND EXISTS (
        SELECT 1 FROM public.appointment_items ai
        WHERE ai.appointment_id = ap.id
          AND coalesce(ai.unit_price, 0) = 0
      )
  LOOP
    BEGIN
      PERFORM dunasoft.sync_appointment_items_from_style(
        r.id,
        r.company_id,
        r.legacy_idplan::numeric,
        r.legacy_codrec,
        r.start_time,
        r.end_time,
        r.description
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'backfill sync skip %: %', r.id, SQLERRM;
    END;
  END LOOP;

  -- Fusionadas: reconstruir desde segmentos del bridge
  FOR r IN
    SELECT ap.id, ap.company_id
    FROM public.agenda_appointments ap
    WHERE coalesce(ap.merged_from_style, false) = true
      AND ap.appointment_date >= current_date - 14
      AND EXISTS (
        SELECT 1 FROM public.appointment_items ai
        WHERE ai.appointment_id = ap.id
          AND coalesce(ai.unit_price, 0) = 0
      )
  LOOP
    BEGIN
      DELETE FROM public.appointment_items WHERE appointment_id = r.id;
      v_sort := 0;
      FOR seg IN
        SELECT b.legacy_idplan, b.segment_start_time, b.segment_end_time, b.segment_index
        FROM public.agenda_dunasoft_bridge b
        WHERE b.agenda_appointment_id = r.id
        ORDER BY b.segment_index NULLS LAST, b.legacy_idplan
      LOOP
        v_sort := v_sort + dunasoft.append_appointment_items_from_style(
          r.id,
          r.company_id,
          seg.legacy_idplan::numeric,
          (SELECT codrec FROM dunasoft.plan2009 WHERE idplan = seg.legacy_idplan::numeric LIMIT 1),
          seg.segment_start_time,
          seg.segment_end_time,
          (SELECT texto FROM dunasoft.plan2009 WHERE idplan = seg.legacy_idplan::numeric LIMIT 1),
          v_sort
        );
      END LOOP;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'backfill merge skip %: %', r.id, SQLERRM;
    END;
  END LOOP;
END;
$$;
