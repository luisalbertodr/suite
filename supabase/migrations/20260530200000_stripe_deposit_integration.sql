-- Integración Stripe: señal / depósito para confirmar cita (Marketing + enlace público)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.stripe_config (
  company_id UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  publishable_key TEXT,
  secret_key TEXT,
  webhook_secret TEXT,
  enabled BOOLEAN NOT NULL DEFAULT false,
  currency TEXT NOT NULL DEFAULT 'eur',
  default_deposit_amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (default_deposit_amount_cents >= 0),
  public_app_url TEXT,
  confirmed_stage_id UUID REFERENCES public.marketing_lead_stages(id) ON DELETE SET NULL,
  payment_success_whatsapp_message TEXT,
  last_webhook_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.stripe_config IS
  'Claves Stripe y importe por defecto de la señal para reservar cita.';
COMMENT ON COLUMN public.stripe_config.public_app_url IS
  'URL pública de la app (p. ej. https://suite.tudominio.com) para enlaces /pago/{token}.';
COMMENT ON COLUMN public.stripe_config.payment_success_whatsapp_message IS
  'Mensaje WhatsApp opcional tras confirmar el pago (admite variables como {nombre}).';

CREATE TABLE IF NOT EXISTS public.stripe_deposit_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  marketing_lead_id UUID REFERENCES public.marketing_leads(id) ON DELETE SET NULL,
  public_token TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'eur',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'expired', 'cancelled')),
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  checkout_url TEXT,
  paid_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (public_token),
  UNIQUE (company_id, stripe_checkout_session_id)
);

CREATE INDEX IF NOT EXISTS stripe_deposit_sessions_lead_idx
  ON public.stripe_deposit_sessions (marketing_lead_id, status);

CREATE INDEX IF NOT EXISTS stripe_deposit_sessions_company_status_idx
  ON public.stripe_deposit_sessions (company_id, status);

ALTER TABLE public.meta_forms
  ADD COLUMN IF NOT EXISTS stripe_deposit_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_deposit_amount_cents INTEGER
    CHECK (stripe_deposit_amount_cents IS NULL OR stripe_deposit_amount_cents > 0);

ALTER TABLE public.marketing_leads
  ADD COLUMN IF NOT EXISTS stripe_deposit_paid_at TIMESTAMPTZ;

-- RLS
ALTER TABLE public.stripe_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_deposit_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stripe_config_company_access" ON public.stripe_config;
CREATE POLICY "stripe_config_company_access"
  ON public.stripe_config FOR ALL TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

-- Sesiones de pago: solo backend (service role). Sin acceso directo desde cliente.
DROP POLICY IF EXISTS "stripe_deposit_sessions_deny_all" ON public.stripe_deposit_sessions;
CREATE POLICY "stripe_deposit_sessions_deny_all"
  ON public.stripe_deposit_sessions FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    DROP TRIGGER IF EXISTS trg_stripe_config_updated_at ON public.stripe_config;
    CREATE TRIGGER trg_stripe_config_updated_at
      BEFORE UPDATE ON public.stripe_config
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

    DROP TRIGGER IF EXISTS trg_stripe_deposit_sessions_updated_at ON public.stripe_deposit_sessions;
    CREATE TRIGGER trg_stripe_deposit_sessions_updated_at
      BEFORE UPDATE ON public.stripe_deposit_sessions
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

INSERT INTO public.permissions (resource, action, name) VALUES
  ('stripe_config', 'read',  'Ver configuración Stripe'),
  ('stripe_config', 'write', 'Editar configuración Stripe')
ON CONFLICT (resource, action) DO NOTHING;
