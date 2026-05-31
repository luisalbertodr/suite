-- Corrige citas falsas (pregunta «¿quiero agendar?» = sí) y tags de formulario Meta en leads fusionados.

UPDATE public.marketing_leads ml
SET
  appointment_at = NULL,
  appointment_label = NULL,
  stage_id = COALESCE(
    (
      SELECT s.id
      FROM public.marketing_lead_stages s
      WHERE s.company_id = ml.company_id
        AND s.is_default_intake
      ORDER BY s.position
      LIMIT 1
    ),
    ml.stage_id
  )
WHERE ml.archived_at IS NULL
  AND (
    ml.appointment_label ILIKE '%quiero_agendar%'
    OR ml.appointment_label ILIKE '%agendar_mi_cita%'
    OR (
      ml.appointment_at IS NOT NULL
      AND ml.appointment_label IS NOT NULL
      AND ml.appointment_label !~* '\d'
    )
  );

UPDATE public.marketing_leads ml
SET tags = ARRAY[lower(trim(ml.form_name))]
WHERE ml.archived_at IS NULL
  AND ml.form_name IS NOT NULL
  AND trim(ml.form_name) <> ''
  AND ml.external_id IS NOT NULL
  AND (
    ml.tags IS NULL
    OR cardinality(ml.tags) = 0
    OR EXISTS (
      SELECT 1 FROM unnest(ml.tags) t
      WHERE lower(t) IN ('lipoout', 'triple glow', 'triple_glow')
    )
  );
