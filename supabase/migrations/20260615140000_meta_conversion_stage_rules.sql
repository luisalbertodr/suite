-- Reglas CAPI Meta al mover leads a etapas concretas del tablero Marketing
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.meta_conversion_stage_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES public.marketing_lead_stages(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  value_amount NUMERIC(12, 2),
  currency TEXT NOT NULL DEFAULT 'eur',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, stage_id)
);

CREATE INDEX IF NOT EXISTS meta_conversion_stage_rules_company_idx
  ON public.meta_conversion_stage_rules(company_id);

COMMENT ON TABLE public.meta_conversion_stage_rules IS
  'Evento Meta CAPI a emitir cuando un lead entra en la etapa (vía n8n).';

ALTER TABLE public.meta_conversion_stage_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meta_conversion_stage_rules_company ON public.meta_conversion_stage_rules;
CREATE POLICY meta_conversion_stage_rules_company
  ON public.meta_conversion_stage_rules FOR ALL TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    DROP TRIGGER IF EXISTS trg_meta_conversion_stage_rules_updated_at ON public.meta_conversion_stage_rules;
    CREATE TRIGGER trg_meta_conversion_stage_rules_updated_at
      BEFORE UPDATE ON public.meta_conversion_stage_rules
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Seeds por nombre de etapa (todas las empresas que tengan estas columnas)
INSERT INTO public.meta_conversion_stage_rules (company_id, stage_id, event_name, value_amount, currency)
SELECT s.company_id, s.id, 'Schedule', NULL, 'eur'
FROM public.marketing_lead_stages s
WHERE s.name ILIKE 'Cita Confirmada (Sin pago)'
ON CONFLICT (company_id, stage_id) DO UPDATE
  SET event_name = EXCLUDED.event_name, value_amount = EXCLUDED.value_amount, enabled = true;

INSERT INTO public.meta_conversion_stage_rules (company_id, stage_id, event_name, value_amount, currency)
SELECT s.company_id, s.id, 'Purchase', 10, 'eur'
FROM public.marketing_lead_stages s
WHERE s.name ILIKE 'Cita confirmada (10%pagados)'
   OR s.name ILIKE 'Cita Confirmada (10%pagados)'
   OR s.name ILIKE '%10%pagados%'
ON CONFLICT (company_id, stage_id) DO UPDATE
  SET event_name = EXCLUDED.event_name, value_amount = EXCLUDED.value_amount, enabled = true;

INSERT INTO public.meta_conversion_stage_rules (company_id, stage_id, event_name, value_amount, currency)
SELECT s.company_id, s.id, 'Schedule', NULL, 'eur'
FROM public.marketing_lead_stages s
WHERE s.name ILIKE 'Reagendando'
ON CONFLICT (company_id, stage_id) DO UPDATE
  SET event_name = EXCLUDED.event_name, value_amount = EXCLUDED.value_amount, enabled = true;

INSERT INTO public.meta_conversion_stage_rules (company_id, stage_id, event_name, value_amount, currency)
SELECT s.company_id, s.id, 'SubmitApplication', NULL, 'eur'
FROM public.marketing_lead_stages s
WHERE s.name ILIKE 'Pendiente con Presupuesto'
ON CONFLICT (company_id, stage_id) DO UPDATE
  SET event_name = EXCLUDED.event_name, value_amount = EXCLUDED.value_amount, enabled = true;

INSERT INTO public.meta_conversion_stage_rules (company_id, stage_id, event_name, value_amount, currency)
SELECT s.company_id, s.id, 'CompleteRegistration', NULL, 'eur'
FROM public.marketing_lead_stages s
WHERE s.name ILIKE 'Presentada con %xito'
   OR s.name ILIKE 'Presentada con éxito'
ON CONFLICT (company_id, stage_id) DO UPDATE
  SET event_name = EXCLUDED.event_name, value_amount = EXCLUDED.value_amount, enabled = true;
