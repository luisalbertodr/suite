-- Meta Conversions API (CAPI) vía n8n: configuración por empresa
-- ============================================================================

ALTER TABLE public.meta_config
  ADD COLUMN IF NOT EXISTS pixel_id TEXT,
  ADD COLUMN IF NOT EXISTS conversions_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS n8n_webhook_url TEXT,
  ADD COLUMN IF NOT EXISTS n8n_webhook_secret TEXT,
  ADD COLUMN IF NOT EXISTS conversions_test_event_code TEXT;

COMMENT ON COLUMN public.meta_config.pixel_id IS
  'Pixel o Dataset ID de Meta donde enviar eventos CAPI (n8n usa este valor).';
COMMENT ON COLUMN public.meta_config.conversions_enabled IS
  'Si true, Suite emite eventos de conversión al webhook n8n configurado.';
COMMENT ON COLUMN public.meta_config.n8n_webhook_url IS
  'URL del webhook n8n (ej. http://192.168.99.110:5678/webhook/suite-meta-conversion).';
COMMENT ON COLUMN public.meta_config.n8n_webhook_secret IS
  'Secreto enviado en header X-Suite-Secret al webhook n8n.';
COMMENT ON COLUMN public.meta_config.conversions_test_event_code IS
  'Opcional: TESTXXXX de Events Manager; solo para pruebas (se incluye en el payload).';

-- Lipoout: pixel y webhook preconfigurados, emisión desactivada hasta validar.
UPDATE public.meta_config
SET
  pixel_id = '291687001692956',
  n8n_webhook_url = 'http://192.168.99.110:5678/webhook/suite-meta-capi-lipoout',
  n8n_webhook_secret = 'suite-meta-lipoout-2026',
  conversions_enabled = false
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';
