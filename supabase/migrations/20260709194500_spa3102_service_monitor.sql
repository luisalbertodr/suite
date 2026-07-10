-- Monitor SPA3102 (gateway FXO-FXS Linksys) en suite_service_monitor.

INSERT INTO public.suite_service_status (service_key, display_name) VALUES
  ('spa3102', 'FXO-FXS Linksys SPA3102')
ON CONFLICT (service_key) DO NOTHING;

ALTER TABLE public.suite_service_monitor_settings
  ADD COLUMN IF NOT EXISTS spa3102_offhook_minutes INT NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS spa3102_reboot_cooldown_minutes INT NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS spa3102_auto_reboot BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.suite_service_monitor_settings.spa3102_offhook_minutes IS
  'Minutos con PSTN Hook State Off (línea pillada) antes de reiniciar el SPA3102.';
COMMENT ON COLUMN public.suite_service_monitor_settings.spa3102_reboot_cooldown_minutes IS
  'Mínimo entre reinicios automáticos del SPA3102.';
COMMENT ON COLUMN public.suite_service_monitor_settings.spa3102_auto_reboot IS
  'Si true, el monitor reinicia el SPA3102 cuando detecta línea PSTN bloqueada.';
