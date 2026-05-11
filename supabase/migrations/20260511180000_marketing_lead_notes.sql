-- Notas/actividad sobre leads de marketing
CREATE TABLE IF NOT EXISTS public.marketing_lead_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.marketing_leads(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'note'
    CHECK (kind IN ('note', 'call', 'whatsapp', 'email', 'rejection', 'reschedule')),
  next_action_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketing_lead_notes_lead_id_idx
  ON public.marketing_lead_notes(lead_id);
CREATE INDEX IF NOT EXISTS marketing_lead_notes_company_id_idx
  ON public.marketing_lead_notes(company_id);

ALTER TABLE public.marketing_lead_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "marketing_lead_notes_company_access" ON public.marketing_lead_notes;
CREATE POLICY "marketing_lead_notes_company_access"
  ON public.marketing_lead_notes FOR ALL TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column'
  ) THEN
    DROP TRIGGER IF EXISTS trg_marketing_lead_notes_updated_at ON public.marketing_lead_notes;
    CREATE TRIGGER trg_marketing_lead_notes_updated_at
      BEFORE UPDATE ON public.marketing_lead_notes
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;
