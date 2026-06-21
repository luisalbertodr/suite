-- Proveedor WhatsApp: WAHA (existente) u OpenWA.

ALTER TABLE public.whatsapp_config
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'waha';

ALTER TABLE public.whatsapp_config
  DROP CONSTRAINT IF EXISTS whatsapp_config_provider_check;

ALTER TABLE public.whatsapp_config
  ADD CONSTRAINT whatsapp_config_provider_check
  CHECK (provider IN ('waha', 'openwa'));

COMMENT ON COLUMN public.whatsapp_config.provider IS
  'Motor API: waha (devlikeapro) u openwa (open-wa.org). base_url, api_key y session_name se interpretan según el proveedor.';
