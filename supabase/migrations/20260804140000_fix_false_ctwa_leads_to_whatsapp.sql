-- Reclasifica leads CTWA falsos (sin señal Meta verificable) a WhatsApp orgánico
-- y mueve leads source=whatsapp a la etapa de intake («Nuevo lead»).

-- 1) CTWA sin evidencia Meta → whatsapp
WITH false_ctwa AS (
  SELECT ml.id
  FROM public.marketing_leads ml
  WHERE ml.archived_at IS NULL
    AND lower(trim(coalesce(ml.source, ''))) = 'ctwa'
    AND NOT (
      coalesce(ml.external_id, '') ~* '^(ctwa:|ctwa-ad:)'
      OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(ml.field_data) = 'array' THEN ml.field_data
            ELSE '[]'::jsonb
          END
        ) AS elem
        WHERE lower(coalesce(elem->>'name', '')) IN (
            'ctwa_clid',
            'ad_source_id',
            'ad_attribution_confidence'
          )
          AND (
            (
              lower(coalesce(elem->>'name', '')) = 'ad_attribution_confidence'
              AND lower(coalesce(elem->'values'->>0, '')) IN ('verified', 'likely')
            )
            OR (
              lower(coalesce(elem->>'name', '')) IN ('ctwa_clid', 'ad_source_id')
              AND nullif(trim(coalesce(elem->'values'->>0, '')), '') IS NOT NULL
            )
          )
      )
    )
)
UPDATE public.marketing_leads ml
SET
  source = 'whatsapp',
  campaign = CASE
    WHEN ml.campaign IS NULL
      OR trim(ml.campaign) = ''
      OR lower(trim(ml.campaign)) IN (
        'whatsapp meta (ctwa)',
        'whatsapp meta',
        'click to whatsapp',
        'ctwa'
      )
      THEN 'WhatsApp entrante'
    ELSE ml.campaign
  END,
  form_name = CASE
    WHEN ml.form_name IS NOT NULL
      AND lower(trim(ml.form_name)) IN (
        'click to whatsapp',
        'click-to-whatsapp',
        'ctwa',
        'ad',
        'ads'
      )
      THEN NULL
    ELSE ml.form_name
  END,
  ctwa_campaign_id = NULL,
  meta_form_id = NULL,
  tags = ARRAY['WhatsApp']::text[],
  updated_at = now()
FROM false_ctwa f
WHERE ml.id = f.id;

-- 2) Asegurar etiqueta WhatsApp en leads orgánicos
UPDATE public.marketing_leads ml
SET
  tags = CASE
    WHEN ml.tags IS NULL OR cardinality(ml.tags) = 0 THEN ARRAY['WhatsApp']::text[]
    WHEN EXISTS (
      SELECT 1 FROM unnest(ml.tags) AS t(tag)
      WHERE lower(trim(tag)) = 'whatsapp'
    ) THEN (
      -- Quitar CTWA/Meta residuales si quedaran
      SELECT coalesce(array_agg(DISTINCT trim(tag)), ARRAY['WhatsApp']::text[])
      FROM unnest(ml.tags) AS t(tag)
      WHERE trim(tag) <> ''
        AND lower(trim(tag)) NOT IN ('ctwa', 'meta')
    )
    ELSE (
      SELECT coalesce(array_agg(DISTINCT x.tag), ARRAY['WhatsApp']::text[])
      FROM (
        SELECT trim(tag) AS tag
        FROM unnest(ml.tags) AS t(tag)
        WHERE trim(tag) <> ''
          AND lower(trim(tag)) NOT IN ('ctwa', 'meta')
        UNION ALL
        SELECT 'WhatsApp'
      ) x
    )
  END,
  updated_at = now()
WHERE ml.archived_at IS NULL
  AND lower(trim(coalesce(ml.source, ''))) = 'whatsapp'
  AND (
    ml.tags IS NULL
    OR cardinality(ml.tags) = 0
    OR NOT EXISTS (
      SELECT 1 FROM unnest(ml.tags) AS t(tag)
      WHERE lower(trim(tag)) = 'whatsapp'
    )
    OR EXISTS (
      SELECT 1 FROM unnest(ml.tags) AS t(tag)
      WHERE lower(trim(tag)) IN ('ctwa', 'meta')
    )
  );

-- 3) Mover leads WhatsApp a «Nuevo lead» (intake), salvo ganado/perdido/presentada/won
WITH intake AS (
  SELECT DISTINCT ON (s.company_id)
    s.company_id,
    s.id AS stage_id
  FROM public.marketing_lead_stages s
  WHERE s.is_default_intake = true
  ORDER BY s.company_id, s.position ASC, s.created_at ASC
)
UPDATE public.marketing_leads ml
SET
  stage_id = i.stage_id,
  updated_at = now()
FROM intake i
WHERE ml.company_id = i.company_id
  AND ml.archived_at IS NULL
  AND lower(trim(coalesce(ml.source, ''))) = 'whatsapp'
  AND coalesce(upper(trim(ml.win_status)), '') NOT IN ('GANADO', 'PERDIDO')
  AND (
    ml.stage_id IS DISTINCT FROM i.stage_id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.marketing_lead_stages st
    WHERE st.id = ml.stage_id
      AND (
        coalesce(st.is_won, false)
        OR coalesce(st.is_presentada, false)
      )
  );

COMMENT ON TABLE public.marketing_leads IS
  'Leads de marketing. source=ctwa requiere evidencia Meta (ctwa_clid/source_id); whatsapp = entrante orgánico.';
