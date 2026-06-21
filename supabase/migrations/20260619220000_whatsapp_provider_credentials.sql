-- Credenciales separadas por proveedor (WAHA / OpenWA).

ALTER TABLE public.whatsapp_config
  ADD COLUMN IF NOT EXISTS waha_base_url TEXT,
  ADD COLUMN IF NOT EXISTS waha_api_key TEXT,
  ADD COLUMN IF NOT EXISTS waha_session_name TEXT,
  ADD COLUMN IF NOT EXISTS openwa_base_url TEXT,
  ADD COLUMN IF NOT EXISTS openwa_api_key TEXT,
  ADD COLUMN IF NOT EXISTS openwa_session_name TEXT;

-- Migrar valores activos actuales a columnas del proveedor correspondiente.
UPDATE public.whatsapp_config
SET
  waha_base_url = COALESCE(waha_base_url, CASE WHEN provider = 'waha' OR provider IS NULL THEN base_url END),
  waha_api_key = COALESCE(waha_api_key, CASE WHEN provider = 'waha' OR provider IS NULL THEN api_key END),
  waha_session_name = COALESCE(waha_session_name, CASE WHEN provider = 'waha' OR provider IS NULL THEN session_name END),
  openwa_base_url = COALESCE(openwa_base_url, CASE WHEN provider = 'openwa' THEN base_url END),
  openwa_api_key = COALESCE(openwa_api_key, CASE WHEN provider = 'openwa' THEN api_key END),
  openwa_session_name = COALESCE(openwa_session_name, CASE WHEN provider = 'openwa' THEN session_name END)
WHERE base_url IS NOT NULL OR api_key IS NOT NULL OR session_name IS NOT NULL;

UPDATE public.whatsapp_config
SET waha_session_name = COALESCE(waha_session_name, 'default')
WHERE waha_session_name IS NULL;

UPDATE public.whatsapp_config
SET openwa_session_name = COALESCE(openwa_session_name, 'default')
WHERE openwa_session_name IS NULL;

COMMENT ON COLUMN public.whatsapp_config.waha_base_url IS 'URL base WAHA guardada (independiente del proveedor activo).';
COMMENT ON COLUMN public.whatsapp_config.openwa_base_url IS 'URL base OpenWA guardada (independiente del proveedor activo).';
