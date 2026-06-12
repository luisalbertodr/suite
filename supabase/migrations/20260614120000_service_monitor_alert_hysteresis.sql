-- Histéresis en alertas del monitor (evitar falsas recuperaciones y spam).
ALTER TABLE public.suite_service_monitor_settings
  ADD COLUMN IF NOT EXISTS failures_before_alert INT NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS successes_before_recovery INT NOT NULL DEFAULT 3;

COMMENT ON COLUMN public.suite_service_monitor_settings.failures_before_alert IS
  'Checks consecutivos en down/degraded antes de avisar caída.';
COMMENT ON COLUMN public.suite_service_monitor_settings.successes_before_recovery IS
  'Checks consecutivos en ok antes de avisar recuperación (solo si alert_active).';
