-- Mensaje predeterminado para que el empleado envíe el link de señal desde WhatsApp.

ALTER TABLE public.stripe_config
  ADD COLUMN IF NOT EXISTS deposit_request_whatsapp_message TEXT;

COMMENT ON COLUMN public.stripe_config.deposit_request_whatsapp_message IS
  'Plantilla para enviar manualmente el link de señal desde el chat WhatsApp ({nombre}, {link_pago}, {importe_senal}, etc.).';

DROP VIEW IF EXISTS public.stripe_config_safe;

CREATE VIEW public.stripe_config_safe AS
SELECT
  sc.company_id,
  sc.publishable_key,
  sc.enabled,
  sc.currency,
  sc.default_deposit_amount_cents,
  sc.public_app_url,
  sc.confirmed_stage_id,
  sc.payment_success_whatsapp_message,
  sc.deposit_request_whatsapp_message,
  sc.last_webhook_at,
  sc.created_at,
  sc.updated_at,
  (COALESCE(TRIM(sc.secret_key), '') <> '') AS has_secret_key,
  (COALESCE(TRIM(sc.webhook_secret), '') <> '') AS has_webhook_secret
FROM public.stripe_config sc
WHERE sc.company_id = public.get_user_company_id();

GRANT SELECT ON public.stripe_config_safe TO authenticated;
GRANT SELECT ON public.stripe_config_safe TO service_role;
