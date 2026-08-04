-- Roles estables de etapa: el comportamiento no depende del nombre visible.
-- is_appointment_intake → cita / agenda ficticia (Meta creates_appointment, UI de slot)
-- is_presentada        → sync facturación Style → valor + mover lead

ALTER TABLE public.marketing_lead_stages
  ADD COLUMN IF NOT EXISTS is_appointment_intake BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_presentada BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.marketing_lead_stages.is_appointment_intake IS
  'Etapa de cita/agenda (Meta appointment, aviso de slot). Independiente del nombre.';
COMMENT ON COLUMN public.marketing_lead_stages.is_presentada IS
  'Etapa de presentación facturada (sync Style). Independiente del nombre.';

-- Una sola etapa de agenda/cita por empresa (la de menor position)
WITH candidates AS (
  SELECT
    s.id,
    row_number() OVER (PARTITION BY s.company_id ORDER BY s.position ASC, s.created_at ASC) AS rn
  FROM public.marketing_lead_stages s
  WHERE s.is_appointment_intake = false
    AND (
      lower(regexp_replace(s.name, '\s+', ' ', 'g')) LIKE '%formulario%agenda ficticia%'
      OR lower(s.name) LIKE '%cita sin pago%'
      OR lower(s.name) LIKE '%cita confirmada%sin pago%'
    )
)
UPDATE public.marketing_lead_stages s
SET is_appointment_intake = true
FROM candidates c
WHERE s.id = c.id AND c.rn = 1;

-- Una sola etapa Presentada por empresa
WITH candidates AS (
  SELECT
    s.id,
    row_number() OVER (PARTITION BY s.company_id ORDER BY s.position ASC, s.created_at ASC) AS rn
  FROM public.marketing_lead_stages s
  WHERE s.is_presentada = false
    AND lower(s.name) ~ 'presentad[oa]s?'
    AND lower(s.name) !~ '(^|[^a-z])no[[:space:]]+presentad'
)
UPDATE public.marketing_lead_stages s
SET is_presentada = true
FROM candidates c
WHERE s.id = c.id AND c.rn = 1;

-- Desduplicar is_default_intake si hubiera más de una por empresa
WITH ranked AS (
  SELECT
    s.id,
    row_number() OVER (PARTITION BY s.company_id ORDER BY s.position ASC, s.created_at ASC) AS rn
  FROM public.marketing_lead_stages s
  WHERE s.is_default_intake = true
)
UPDATE public.marketing_lead_stages s
SET is_default_intake = false
FROM ranked r
WHERE s.id = r.id AND r.rn > 1;

-- Como máximo una etapa de cada rol por empresa
CREATE UNIQUE INDEX IF NOT EXISTS marketing_lead_stages_one_appointment_intake_per_company
  ON public.marketing_lead_stages (company_id)
  WHERE is_appointment_intake = true;

CREATE UNIQUE INDEX IF NOT EXISTS marketing_lead_stages_one_presentada_per_company
  ON public.marketing_lead_stages (company_id)
  WHERE is_presentada = true;

CREATE UNIQUE INDEX IF NOT EXISTS marketing_lead_stages_one_default_intake_per_company
  ON public.marketing_lead_stages (company_id)
  WHERE is_default_intake = true;
