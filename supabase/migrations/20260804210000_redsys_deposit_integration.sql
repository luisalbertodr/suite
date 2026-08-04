-- Integración Redsys (TPV Virtual): señal de reserva en convivencia con Stripe
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.redsys_config (
  company_id UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  merchant_code TEXT,
  terminal TEXT NOT NULL DEFAULT '1',
  signature_key TEXT,
  signature_version TEXT NOT NULL DEFAULT 'HMAC_SHA512_V2'
    CHECK (signature_version IN ('HMAC_SHA512_V2', 'HMAC_SHA256_V1')),
  environment TEXT NOT NULL DEFAULT 'live'
    CHECK (environment IN ('live', 'test')),
  enabled BOOLEAN NOT NULL DEFAULT false,
  bizum_enabled BOOLEAN NOT NULL DEFAULT true,
  currency TEXT NOT NULL DEFAULT 'eur',
  default_deposit_amount_cents INTEGER NOT NULL DEFAULT 0
    CHECK (default_deposit_amount_cents >= 0),
  public_app_url TEXT,
  confirmed_stage_id UUID REFERENCES public.marketing_lead_stages(id) ON DELETE SET NULL,
  payment_success_whatsapp_message TEXT,
  product_description TEXT DEFAULT 'Señal reserva cita',
  last_notification_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.redsys_config IS
  'Credenciales TPV Virtual Redsys y opciones de señal (tarjeta/Bizum).';
COMMENT ON COLUMN public.redsys_config.signature_key IS
  'Clave de firma del terminal (sha512 16 chars para V2, o clave sha256/base64 para V1). Nunca exponer al cliente.';
COMMENT ON COLUMN public.redsys_config.public_app_url IS
  'URL pública de la app para /pago/{token}, urlOk/urlKo y merchantUrl.';

CREATE OR REPLACE VIEW public.redsys_config_safe AS
SELECT
  rc.company_id,
  rc.merchant_code,
  rc.terminal,
  rc.signature_version,
  rc.environment,
  rc.enabled,
  rc.bizum_enabled,
  rc.currency,
  rc.default_deposit_amount_cents,
  rc.public_app_url,
  rc.confirmed_stage_id,
  rc.payment_success_whatsapp_message,
  rc.product_description,
  rc.last_notification_at,
  rc.created_at,
  rc.updated_at,
  (COALESCE(TRIM(rc.signature_key), '') <> '') AS has_signature_key
FROM public.redsys_config rc
WHERE rc.company_id = public.get_user_company_id();

COMMENT ON VIEW public.redsys_config_safe IS
  'Vista segura de redsys_config sin exponer signature_key.';

ALTER TABLE public.stripe_deposit_sessions
  ADD COLUMN IF NOT EXISTS payment_provider TEXT
    CHECK (payment_provider IS NULL OR payment_provider IN ('stripe', 'redsys', 'manual')),
  ADD COLUMN IF NOT EXISTS redsys_order TEXT,
  ADD COLUMN IF NOT EXISTS redsys_auth_code TEXT,
  ADD COLUMN IF NOT EXISTS redsys_pay_method TEXT
    CHECK (redsys_pay_method IS NULL OR redsys_pay_method IN ('card', 'bizum'));

CREATE UNIQUE INDEX IF NOT EXISTS stripe_deposit_sessions_redsys_order_uidx
  ON public.stripe_deposit_sessions (company_id, redsys_order)
  WHERE redsys_order IS NOT NULL;

ALTER TABLE public.redsys_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "redsys_config_company_access" ON public.redsys_config;
-- Lectura vía vista; escritura solo vía edge function (service role).
REVOKE ALL ON public.redsys_config FROM authenticated;
REVOKE ALL ON public.redsys_config FROM anon;

GRANT SELECT ON public.redsys_config_safe TO authenticated;
GRANT SELECT ON public.redsys_config_safe TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    DROP TRIGGER IF EXISTS trg_redsys_config_updated_at ON public.redsys_config;
    CREATE TRIGGER trg_redsys_config_updated_at
      BEFORE UPDATE ON public.redsys_config
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

INSERT INTO public.permissions (resource, action, name) VALUES
  ('redsys_config', 'read',  'Ver configuración Redsys'),
  ('redsys_config', 'write', 'Editar configuración Redsys')
ON CONFLICT (resource, action) DO NOTHING;
