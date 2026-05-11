-- Marketing: leads de Meta (Facebook/Instagram) + Kanban configurable
-- ============================================================================
-- Tablas:
--   * marketing_lead_stages  → columnas/etapas del tablero (personalizables)
--   * marketing_leads        → leads individuales (con field_data JSONB)
--   * marketing_field_config → configuración de campos visibles en las tarjetas
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.marketing_lead_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#94a3b8',
  position INTEGER NOT NULL DEFAULT 0,
  is_won BOOLEAN NOT NULL DEFAULT false,
  is_lost BOOLEAN NOT NULL DEFAULT false,
  is_default_intake BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);

CREATE INDEX IF NOT EXISTS marketing_lead_stages_company_id_idx
  ON public.marketing_lead_stages(company_id);

CREATE TABLE IF NOT EXISTS public.marketing_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  stage_id UUID REFERENCES public.marketing_lead_stages(id) ON DELETE SET NULL,
  external_id TEXT,
  source TEXT NOT NULL DEFAULT 'meta',
  form_name TEXT,
  campaign TEXT,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  email TEXT,
  value NUMERIC(12,2) NOT NULL DEFAULT 0,
  position_in_stage INTEGER NOT NULL DEFAULT 0,
  field_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  external_created_at TIMESTAMPTZ,
  last_contacted_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, external_id)
);

CREATE INDEX IF NOT EXISTS marketing_leads_company_id_idx
  ON public.marketing_leads(company_id);
CREATE INDEX IF NOT EXISTS marketing_leads_stage_id_idx
  ON public.marketing_leads(stage_id);
CREATE INDEX IF NOT EXISTS marketing_leads_phone_idx
  ON public.marketing_leads(company_id, phone);
CREATE INDEX IF NOT EXISTS marketing_leads_email_idx
  ON public.marketing_leads(company_id, email);

CREATE TABLE IF NOT EXISTS public.marketing_field_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  display_label TEXT NOT NULL,
  visible_in_card BOOLEAN NOT NULL DEFAULT true,
  visible_in_detail BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  field_type TEXT NOT NULL DEFAULT 'string',
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, field_key)
);

CREATE INDEX IF NOT EXISTS marketing_field_config_company_id_idx
  ON public.marketing_field_config(company_id);

-- ============================================================================
-- RLS
-- ============================================================================
ALTER TABLE public.marketing_lead_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_field_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "marketing_lead_stages_company_access" ON public.marketing_lead_stages;
CREATE POLICY "marketing_lead_stages_company_access"
  ON public.marketing_lead_stages FOR ALL TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

DROP POLICY IF EXISTS "marketing_leads_company_access" ON public.marketing_leads;
CREATE POLICY "marketing_leads_company_access"
  ON public.marketing_leads FOR ALL TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

DROP POLICY IF EXISTS "marketing_field_config_company_access" ON public.marketing_field_config;
CREATE POLICY "marketing_field_config_company_access"
  ON public.marketing_field_config FOR ALL TO authenticated
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
    DROP TRIGGER IF EXISTS trg_marketing_lead_stages_updated_at ON public.marketing_lead_stages;
    CREATE TRIGGER trg_marketing_lead_stages_updated_at
      BEFORE UPDATE ON public.marketing_lead_stages
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

    DROP TRIGGER IF EXISTS trg_marketing_leads_updated_at ON public.marketing_leads;
    CREATE TRIGGER trg_marketing_leads_updated_at
      BEFORE UPDATE ON public.marketing_leads
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

    DROP TRIGGER IF EXISTS trg_marketing_field_config_updated_at ON public.marketing_field_config;
    CREATE TRIGGER trg_marketing_field_config_updated_at
      BEFORE UPDATE ON public.marketing_field_config
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- ============================================================================
-- Seeds: etapas por defecto para cada company existente
-- ============================================================================
INSERT INTO public.marketing_lead_stages (company_id, name, position, color, is_default_intake, is_won)
SELECT c.id, st.name, st.position, st.color, st.is_default_intake, st.is_won
FROM public.companies c
CROSS JOIN (VALUES
  ('Nuevo Formulario',              0, '#22c55e', true,  false),
  ('Formulario+Agenda ficticia',    1, '#3b82f6', false, false),
  ('¡Aún no te ha escuchado!',      2, '#f59e0b', false, false),
  ('¡Llamar por la mañana!',        3, '#06b6d4', false, false),
  ('¡Llamar por la tarde!',         4, '#0ea5e9', false, false),
  ('Contactar más adelante',        5, '#a855f7', false, false),
  ('Cita Confirmada (Sin pago)',    6, '#10b981', false, true)
) AS st(name, position, color, is_default_intake, is_won)
ON CONFLICT (company_id, name) DO NOTHING;

-- ============================================================================
-- Seeds: configuración de campos visibles por defecto en las tarjetas
-- ============================================================================
INSERT INTO public.marketing_field_config (
  company_id, field_key, display_label, visible_in_card, visible_in_detail,
  sort_order, field_type, is_system
)
SELECT c.id, f.field_key, f.display_label, f.visible_in_card, f.visible_in_detail,
       f.sort_order, f.field_type, true
FROM public.companies c
CROSS JOIN (VALUES
  ('value',         'Valor del cliente',     true,  true, 0, 'currency'),
  ('phone',         'Teléfono del contacto', true,  true, 1, 'phone'),
  ('first_name',    'Contacto',              true,  true, 2, 'string'),
  ('created_at',    'Creado el',             true,  true, 3, 'datetime'),
  ('email',         'Email',                 false, true, 4, 'email'),
  ('form_name',     'Formulario',            false, true, 5, 'string'),
  ('source',        'Origen',                false, true, 6, 'string')
) AS f(field_key, display_label, visible_in_card, visible_in_detail, sort_order, field_type)
ON CONFLICT (company_id, field_key) DO NOTHING;

-- ============================================================================
-- Permisos del módulo
-- ============================================================================
INSERT INTO public.permissions (resource, action, name) VALUES
  ('marketing', 'read',  'Ver Marketing'),
  ('marketing', 'write', 'Editar Marketing')
ON CONFLICT (resource, action) DO NOTHING;

-- Nota: la asignación del permiso 'marketing:read' a usuarios concretos
-- se hace desde la interfaz de gestión de permisos (Configuración → Usuarios).
