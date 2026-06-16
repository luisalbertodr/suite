-- Producción: activar emisión CAPI Meta → n8n (Lipoout)
UPDATE public.meta_config
SET
  pixel_id = '291687001692956',
  n8n_webhook_url = 'http://192.168.99.110:5678/webhook/suite-meta-capi-lipoout',
  conversions_test_event_code = NULL,
  conversions_enabled = true
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';
