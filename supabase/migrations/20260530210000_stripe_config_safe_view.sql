-- Ocultar secret_key y webhook_secret al cliente autenticado.
-- Lectura vía vista stripe_config_safe; escritura solo vía edge function (service role).

DROP POLICY IF EXISTS "stripe_config_company_access" ON public.stripe_config;

CREATE OR REPLACE VIEW public.stripe_config_safe AS
SELECT
  sc.company_id,
  sc.publishable_key,
  sc.enabled,
  sc.currency,
  sc.default_deposit_amount_cents,
  sc.public_app_url,
  sc.confirmed_stage_id,
  sc.payment_success_whatsapp_message,
  sc.last_webhook_at,
  sc.created_at,
  sc.updated_at,
  (COALESCE(TRIM(sc.secret_key), '') <> '') AS has_secret_key,
  (COALESCE(TRIM(sc.webhook_secret), '') <> '') AS has_webhook_secret
FROM public.stripe_config sc
WHERE sc.company_id = public.get_user_company_id();

COMMENT ON VIEW public.stripe_config_safe IS
  'Config Stripe sin exponer secretos; has_secret_key / has_webhook_secret indican si están guardados.';

REVOKE ALL ON public.stripe_config FROM authenticated;
REVOKE ALL ON public.stripe_config FROM anon;

GRANT SELECT ON public.stripe_config_safe TO authenticated;
GRANT SELECT ON public.stripe_config_safe TO service_role;
