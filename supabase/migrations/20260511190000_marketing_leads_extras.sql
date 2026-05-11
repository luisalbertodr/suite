-- Datos enriquecidos de leads importados desde otro CRM (citas, asignación, tags, status)

ALTER TABLE public.marketing_leads
  ADD COLUMN IF NOT EXISTS appointment_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS appointment_label TEXT,
  ADD COLUMN IF NOT EXISTS assigned_to TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  ADD COLUMN IF NOT EXISTS win_status TEXT;

CREATE INDEX IF NOT EXISTS marketing_leads_appointment_at_idx
  ON public.marketing_leads(appointment_at);
CREATE INDEX IF NOT EXISTS marketing_leads_win_status_idx
  ON public.marketing_leads(company_id, win_status);
