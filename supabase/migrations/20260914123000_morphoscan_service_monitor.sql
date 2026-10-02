-- MorphoScan / scale-ingest in Suite service monitor
INSERT INTO public.suite_service_status (service_key, display_name) VALUES
  ('morphoscan', 'MorphoScan / básculas')
ON CONFLICT (service_key) DO NOTHING;
