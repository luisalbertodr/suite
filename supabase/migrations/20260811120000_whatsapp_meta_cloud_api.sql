-- Meta WhatsApp Cloud API como tercer proveedor (WAHA y OpenWA siguen disponibles).

ALTER TABLE public.whatsapp_config
  DROP CONSTRAINT IF EXISTS whatsapp_config_provider_check;

ALTER TABLE public.whatsapp_config
  ADD CONSTRAINT whatsapp_config_provider_check
  CHECK (provider IN ('waha', 'openwa', 'meta'));

ALTER TABLE public.whatsapp_config
  ADD COLUMN IF NOT EXISTS meta_access_token TEXT,
  ADD COLUMN IF NOT EXISTS meta_phone_number_id TEXT,
  ADD COLUMN IF NOT EXISTS meta_waba_id TEXT,
  ADD COLUMN IF NOT EXISTS meta_app_secret TEXT,
  ADD COLUMN IF NOT EXISTS meta_verify_token TEXT,
  ADD COLUMN IF NOT EXISTS meta_graph_version TEXT DEFAULT 'v21.0';

COMMENT ON COLUMN public.whatsapp_config.meta_access_token IS
  'Token permanente (System User) para Graph WhatsApp Cloud API';
COMMENT ON COLUMN public.whatsapp_config.meta_phone_number_id IS
  'Phone Number ID de Cloud API (no el número E.164)';
COMMENT ON COLUMN public.whatsapp_config.meta_waba_id IS
  'WhatsApp Business Account ID (opcional, diagnóstico)';
COMMENT ON COLUMN public.whatsapp_config.meta_app_secret IS
  'App Secret para validar X-Hub-Signature-256 del webhook';
COMMENT ON COLUMN public.whatsapp_config.meta_verify_token IS
  'Verify token del webhook Meta (hub.verify_token); si null se usa webhook_secret';
COMMENT ON COLUMN public.whatsapp_config.meta_graph_version IS
  'Versión Graph API, p.ej. v21.0';

ALTER TABLE public.whatsapp_messages
  DROP CONSTRAINT IF EXISTS whatsapp_messages_source_provider_check;

ALTER TABLE public.whatsapp_messages
  ADD CONSTRAINT whatsapp_messages_source_provider_check
  CHECK (source_provider IS NULL OR source_provider IN ('waha', 'openwa', 'meta'));
