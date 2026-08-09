-- Pasarelas de pago (Stripe/Redsys): una config por centro laboral en el hub Style.
-- Marketing/WhatsApp viven en el hub (Estética); si se guarda en Medicina el cobro no la encuentra.

CREATE OR REPLACE FUNCTION public.payment_gateway_company_id(p_company_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, dunasoft
AS $$
  WITH requested AS (
    SELECT coalesce(p_company_id, public.get_user_company_id()) AS id
  ),
  hub AS (
    SELECT dunasoft.style_sync_hub_company_id() AS id
  )
  SELECT CASE
    WHEN (SELECT id FROM requested) IS NULL THEN NULL
    WHEN EXISTS (
      SELECT 1
      FROM public.companies c
      JOIN public.companies h ON h.id = (SELECT id FROM hub)
      WHERE c.id = (SELECT id FROM requested)
        AND c.work_center_id IS NOT NULL
        AND h.work_center_id IS NOT NULL
        AND c.work_center_id = h.work_center_id
    ) THEN (SELECT id FROM hub)
    ELSE (SELECT id FROM requested)
  END;
$$;

COMMENT ON FUNCTION public.payment_gateway_company_id(uuid) IS
  'Empresa anfitriona de Stripe/Redsys: hub Style si p_company_id comparte centro laboral; si no, la propia empresa.';

GRANT EXECUTE ON FUNCTION public.payment_gateway_company_id(uuid) TO authenticated, service_role, anon;

-- Si hubo config Redsys en una hermana del hub y el hub está vacío, consolidar.
INSERT INTO public.redsys_config (
  company_id, merchant_code, terminal, signature_key, signature_version, environment,
  enabled, bizum_enabled, currency, default_deposit_amount_cents, public_app_url,
  confirmed_stage_id, payment_success_whatsapp_message, product_description,
  last_notification_at, created_at, updated_at
)
SELECT
  dunasoft.style_sync_hub_company_id(),
  rc.merchant_code, rc.terminal, rc.signature_key, rc.signature_version, rc.environment,
  rc.enabled, rc.bizum_enabled, rc.currency, rc.default_deposit_amount_cents, rc.public_app_url,
  rc.confirmed_stage_id, rc.payment_success_whatsapp_message, rc.product_description,
  rc.last_notification_at, rc.created_at, now()
FROM public.redsys_config rc
JOIN public.companies c ON c.id = rc.company_id
JOIN public.companies h ON h.id = dunasoft.style_sync_hub_company_id()
WHERE c.id IS DISTINCT FROM h.id
  AND c.work_center_id IS NOT NULL
  AND c.work_center_id = h.work_center_id
  AND NOT EXISTS (
    SELECT 1 FROM public.redsys_config hub_rc
    WHERE hub_rc.company_id = h.id
  )
ORDER BY rc.enabled DESC NULLS LAST, rc.updated_at DESC NULLS LAST
LIMIT 1
ON CONFLICT (company_id) DO NOTHING;

DELETE FROM public.redsys_config rc
USING public.companies c, public.companies h
WHERE h.id = dunasoft.style_sync_hub_company_id()
  AND rc.company_id = c.id
  AND c.id IS DISTINCT FROM h.id
  AND c.work_center_id IS NOT NULL
  AND c.work_center_id = h.work_center_id
  AND EXISTS (
    SELECT 1 FROM public.redsys_config hub_rc WHERE hub_rc.company_id = h.id
  );

DROP VIEW IF EXISTS public.redsys_config_safe;
CREATE VIEW public.redsys_config_safe AS
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
WHERE rc.company_id = public.payment_gateway_company_id(public.get_user_company_id());

COMMENT ON VIEW public.redsys_config_safe IS
  'Vista segura de redsys_config (sin signature_key). Resuelve al hub del centro laboral.';

GRANT SELECT ON public.redsys_config_safe TO authenticated;
GRANT SELECT ON public.redsys_config_safe TO service_role;

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
WHERE sc.company_id = public.payment_gateway_company_id(public.get_user_company_id());

COMMENT ON VIEW public.stripe_config_safe IS
  'Vista segura de stripe_config. Resuelve al hub del centro laboral.';

GRANT SELECT ON public.stripe_config_safe TO authenticated;
GRANT SELECT ON public.stripe_config_safe TO service_role;
