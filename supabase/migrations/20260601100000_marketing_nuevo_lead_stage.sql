-- Etapa de entrada: "Nuevo lead" (antes "Nuevo Formulario")
-- ============================================================================

-- Si ya existe "Nuevo lead", marcarla como intake y quitar intake de "Nuevo Formulario"
UPDATE public.marketing_lead_stages AS nl
SET is_default_intake = true
WHERE nl.name = 'Nuevo lead'
  AND NOT EXISTS (
    SELECT 1
    FROM public.marketing_lead_stages o
    WHERE o.company_id = nl.company_id
      AND o.is_default_intake = true
      AND o.id <> nl.id
  );

UPDATE public.marketing_lead_stages AS old
SET is_default_intake = false
WHERE old.name = 'Nuevo Formulario'
  AND EXISTS (
    SELECT 1
    FROM public.marketing_lead_stages nl
    WHERE nl.company_id = old.company_id
      AND nl.name = 'Nuevo lead'
  );

-- Renombrar cuando no hay conflicto de nombre
UPDATE public.marketing_lead_stages AS s
SET name = 'Nuevo lead'
WHERE s.name = 'Nuevo Formulario'
  AND NOT EXISTS (
    SELECT 1
    FROM public.marketing_lead_stages nl
    WHERE nl.company_id = s.company_id
      AND nl.name = 'Nuevo lead'
  );

-- Asegurar intake en "Nuevo lead" si no hay ninguna marcada
UPDATE public.marketing_lead_stages AS s
SET is_default_intake = true
WHERE s.name = 'Nuevo lead'
  AND NOT EXISTS (
    SELECT 1
    FROM public.marketing_lead_stages o
    WHERE o.company_id = s.company_id
      AND o.is_default_intake = true
  );
