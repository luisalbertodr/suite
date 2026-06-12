-- Monitorización de servicios externos (WAHA, Supabase, Meta, Issabel, Style…)

CREATE TABLE IF NOT EXISTS public.suite_service_monitor_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled BOOLEAN NOT NULL DEFAULT true,
  check_interval_seconds INT NOT NULL DEFAULT 60,
  monitor_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  alert_email TEXT NOT NULL DEFAULT 'luisadr@gmail.com',
  waha_down_email TEXT NOT NULL DEFAULT 'luisadr@gmail.com',
  waha_up_whatsapp TEXT NOT NULL DEFAULT '34667435503',
  notification_cooldown_minutes INT NOT NULL DEFAULT 15,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.suite_service_monitor_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.suite_service_status (
  service_key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unknown'
    CHECK (status IN ('ok', 'degraded', 'down', 'unknown')),
  last_ok_at TIMESTAMPTZ,
  last_check_at TIMESTAMPTZ,
  last_error TEXT,
  latency_ms INT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  consecutive_failures INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.suite_service_status (service_key, display_name) VALUES
  ('supabase', 'Supabase (API + BD)'),
  ('waha', 'WAHA / WhatsApp'),
  ('meta', 'Meta (Lead Ads)'),
  ('issabel', 'Issabel (telefonía)'),
  ('style_dunasoft', 'Style / Dunasoft (agenda)')
ON CONFLICT (service_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.suite_service_check_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_key TEXT NOT NULL REFERENCES public.suite_service_status(service_key) ON DELETE CASCADE,
  status TEXT NOT NULL,
  latency_ms INT,
  message TEXT,
  recovery_attempted BOOLEAN NOT NULL DEFAULT false,
  recovery_success BOOLEAN,
  recovery_message TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suite_service_check_log_checked_at
  ON public.suite_service_check_log (checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_suite_service_check_log_service_key
  ON public.suite_service_check_log (service_key, checked_at DESC);

CREATE TABLE IF NOT EXISTS public.suite_service_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_key TEXT,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  destination TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  success BOOLEAN NOT NULL DEFAULT false,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suite_service_notifications_created_at
  ON public.suite_service_notifications (created_at DESC);

ALTER TABLE public.suite_service_monitor_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suite_service_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suite_service_check_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suite_service_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS suite_service_monitor_settings_admin ON public.suite_service_monitor_settings;
CREATE POLICY suite_service_monitor_settings_admin
  ON public.suite_service_monitor_settings
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS suite_service_status_read ON public.suite_service_status;
CREATE POLICY suite_service_status_read
  ON public.suite_service_status
  FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS suite_service_check_log_read ON public.suite_service_check_log;
CREATE POLICY suite_service_check_log_read
  ON public.suite_service_check_log
  FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS suite_service_notifications_read ON public.suite_service_notifications;
CREATE POLICY suite_service_notifications_read
  ON public.suite_service_notifications
  FOR SELECT
  USING (public.is_admin());

GRANT SELECT ON public.suite_service_monitor_settings TO authenticated;
GRANT SELECT, UPDATE ON public.suite_service_monitor_settings TO authenticated;
GRANT SELECT ON public.suite_service_status TO authenticated;
GRANT SELECT ON public.suite_service_check_log TO authenticated;
GRANT SELECT ON public.suite_service_notifications TO authenticated;

COMMENT ON TABLE public.suite_service_status IS
  'Estado agregado del último health check por servicio (actualizado por service-health-monitor).';
