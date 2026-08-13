-- Meta Cloud API coexistente con motor QR (OpenWA/WAHA): marcar canal oficial
-- sin forzar provider='meta' (que anula sesión QR).

ALTER TABLE public.whatsapp_config
  ADD COLUMN IF NOT EXISTS meta_linked boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.whatsapp_config.meta_linked IS
  'Canal oficial Meta configurado (credenciales meta_*). El motor de mensajería/QR sigue en provider (openwa/waha) salvo modo Meta exclusivo.';

UPDATE public.whatsapp_config
SET meta_linked = true
WHERE meta_linked = false
  AND (
    nullif(btrim(coalesce(meta_access_token, '')), '') IS NOT NULL
    OR nullif(btrim(coalesce(meta_phone_number_id, '')), '') IS NOT NULL
  );
