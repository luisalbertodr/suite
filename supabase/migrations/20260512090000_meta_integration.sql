-- Integración con Meta (Facebook/Instagram) Lead Ads
-- ============================================================================
-- Tablas:
--   * meta_config → configuración por empresa (business_id, access_token, intervalo)
--   * meta_forms  → formularios concretos a consultar y a qué etapa caen
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.meta_config (
  company_id UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  business_id TEXT,
  access_token TEXT,
  graph_api_version TEXT NOT NULL DEFAULT 'v23.0',
  sync_interval_minutes INTEGER NOT NULL DEFAULT 60 CHECK (sync_interval_minutes >= 5),
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT,
  last_sync_message TEXT,
  last_sync_inserted INTEGER NOT NULL DEFAULT 0,
  last_sync_skipped INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.meta_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  form_id TEXT NOT NULL,
  form_name TEXT,
  creates_appointment BOOLEAN NOT NULL DEFAULT false,
  default_stage_id UUID REFERENCES public.marketing_lead_stages(id) ON DELETE SET NULL,
  appointment_stage_id UUID REFERENCES public.marketing_lead_stages(id) ON DELETE SET NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT,
  last_sync_message TEXT,
  last_lead_external_id TEXT,
  last_lead_created_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, form_id)
);

CREATE INDEX IF NOT EXISTS meta_forms_company_id_idx ON public.meta_forms(company_id);
CREATE INDEX IF NOT EXISTS meta_forms_enabled_idx ON public.meta_forms(company_id, enabled);

-- ============================================================================
-- RLS
-- ============================================================================
ALTER TABLE public.meta_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_forms  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "meta_config_company_access" ON public.meta_config;
CREATE POLICY "meta_config_company_access"
  ON public.meta_config FOR ALL TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

DROP POLICY IF EXISTS "meta_forms_company_access" ON public.meta_forms;
CREATE POLICY "meta_forms_company_access"
  ON public.meta_forms FOR ALL TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

-- ============================================================================
-- Triggers updated_at
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column'
  ) THEN
    DROP TRIGGER IF EXISTS trg_meta_config_updated_at ON public.meta_config;
    CREATE TRIGGER trg_meta_config_updated_at
      BEFORE UPDATE ON public.meta_config
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

    DROP TRIGGER IF EXISTS trg_meta_forms_updated_at ON public.meta_forms;
    CREATE TRIGGER trg_meta_forms_updated_at
      BEFORE UPDATE ON public.meta_forms
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- ============================================================================
-- Permisos del módulo (gestión de Meta requiere permisos de configuración)
-- ============================================================================
INSERT INTO public.permissions (resource, action, name) VALUES
  ('meta_config', 'read',  'Ver configuración Meta'),
  ('meta_config', 'write', 'Editar configuración Meta')
ON CONFLICT (resource, action) DO NOTHING;
