-- Elimina appointment_label / appointment_at falsos (nombre del formulario Meta guardado como “cita”).

UPDATE public.marketing_leads
SET
  appointment_label = NULL,
  appointment_at = NULL
WHERE archived_at IS NULL
  AND (
    appointment_label ILIKE '%lipoout%'
    OR appointment_label ILIKE '%medicina est%tica%'
    OR appointment_label ILIKE '%triple glow%'
    OR (
      appointment_label IS NOT NULL
      AND trim(appointment_label) <> ''
      AND appointment_label !~* '\d'
      AND appointment_at IS NULL
    )
  );

-- assigned_to rellenado con el nombre de la página Meta (no es un usuario asignado).
UPDATE public.marketing_leads
SET assigned_to = NULL
WHERE archived_at IS NULL
  AND assigned_to IS NOT NULL
  AND (
    assigned_to ILIKE '%lipoout%'
    OR assigned_to ILIKE '%medicina est%tica%'
    OR assigned_to ILIKE '%triple glow%'
  );

-- Tags que duplican el nombre del formulario (sin valor en tarjeta).
UPDATE public.marketing_leads
SET tags = '{}'::text[]
WHERE archived_at IS NULL
  AND tags IS NOT NULL
  AND cardinality(tags) > 0
  AND EXISTS (
    SELECT 1
    FROM unnest(tags) AS t(tag)
    WHERE lower(trim(tag)) ~ 'lipoout|triple[\s_]*glow|medicina[\s_]*est'
  );
