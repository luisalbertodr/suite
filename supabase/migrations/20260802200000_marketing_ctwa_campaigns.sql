-- Campañas de interacción directa (Click to WhatsApp / CTWA) por empresa.
-- Permiten distinguir leads en Marketing y enviar un mensaje introductorio automático.

CREATE TABLE IF NOT EXISTS public.marketing_ctwa_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  match_keywords TEXT NOT NULL DEFAULT '',
  intro_message TEXT,
  intro_enabled BOOLEAN NOT NULL DEFAULT true,
  meta_form_id UUID REFERENCES public.meta_forms(id) ON DELETE SET NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT marketing_ctwa_campaigns_name_not_blank CHECK (length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS marketing_ctwa_campaigns_company_idx
  ON public.marketing_ctwa_campaigns (company_id, sort_order ASC, created_at ASC);

CREATE UNIQUE INDEX IF NOT EXISTS marketing_ctwa_campaigns_one_default_per_company
  ON public.marketing_ctwa_campaigns (company_id)
  WHERE is_default = true;

COMMENT ON TABLE public.marketing_ctwa_campaigns IS
  'Campañas Meta Click to WhatsApp: nombre en embudo, keywords de matching y mensaje intro WA.';
COMMENT ON COLUMN public.marketing_ctwa_campaigns.match_keywords IS
  'Frases (una por línea) para emparejar con texto del anuncio o primer mensaje del contacto.';
COMMENT ON COLUMN public.marketing_ctwa_campaigns.intro_message IS
  'Mensaje WhatsApp automático al crear el lead CTWA. Soporta {nombre}, {campana}, etc.';
COMMENT ON COLUMN public.marketing_ctwa_campaigns.is_default IS
  'Si no hay coincidencia de keywords, se usa esta campaña (como mucho una por empresa).';

ALTER TABLE public.marketing_leads
  ADD COLUMN IF NOT EXISTS ctwa_campaign_id UUID
    REFERENCES public.marketing_ctwa_campaigns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS marketing_leads_ctwa_campaign_id_idx
  ON public.marketing_leads (ctwa_campaign_id)
  WHERE ctwa_campaign_id IS NOT NULL;

ALTER TABLE public.marketing_ctwa_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketing_ctwa_campaigns_company_access ON public.marketing_ctwa_campaigns;
CREATE POLICY marketing_ctwa_campaigns_company_access
  ON public.marketing_ctwa_campaigns FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_ctwa_campaigns TO authenticated;
GRANT ALL ON public.marketing_ctwa_campaigns TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    DROP TRIGGER IF EXISTS trg_marketing_ctwa_campaigns_updated_at ON public.marketing_ctwa_campaigns;
    CREATE TRIGGER trg_marketing_ctwa_campaigns_updated_at
      BEFORE UPDATE ON public.marketing_ctwa_campaigns
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;
