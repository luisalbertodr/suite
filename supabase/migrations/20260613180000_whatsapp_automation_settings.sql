-- Configuración centralizada de envíos automáticos WhatsApp + log anti-duplicados
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_automation_settings (
  company_id UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  test_mode_enabled BOOLEAN NOT NULL DEFAULT true,
  test_phone TEXT NOT NULL DEFAULT '667435503',
  appointment_reminders_enabled BOOLEAN NOT NULL DEFAULT false,
  appointment_reminder_day_before_enabled BOOLEAN NOT NULL DEFAULT true,
  appointment_reminder_day_before_message TEXT,
  appointment_reminder_hour_before_enabled BOOLEAN NOT NULL DEFAULT true,
  appointment_reminder_hour_before_message TEXT,
  appointment_reminder_send_hour_start INT NOT NULL DEFAULT 9,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_automation_send_hour_start_check
    CHECK (appointment_reminder_send_hour_start >= 0 AND appointment_reminder_send_hour_start <= 23)
);

COMMENT ON TABLE public.whatsapp_automation_settings IS
  'Envíos automáticos WhatsApp: modo prueba, recordatorios de cita, etc.';
COMMENT ON COLUMN public.whatsapp_automation_settings.test_mode_enabled IS
  'Si true, todos los envíos automáticos van a test_phone con prefijo [PRUEBA].';
COMMENT ON COLUMN public.whatsapp_automation_settings.appointment_reminder_day_before_message IS
  'Variables: {nombre}, {fecha_cita}, {hora_cita}, {titulo}, {profesional}';
COMMENT ON COLUMN public.whatsapp_automation_settings.appointment_reminder_hour_before_message IS
  'Variables: {nombre}, {fecha_cita}, {hora_cita}, {titulo}, {profesional}';

CREATE TABLE IF NOT EXISTS public.whatsapp_automation_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  automation_type TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  intended_phone TEXT,
  sent_to_phone TEXT,
  message_preview TEXT,
  success BOOLEAN NOT NULL DEFAULT true,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_automation_send_log_type_check CHECK (
    automation_type IN (
      'appointment_day_before',
      'appointment_hour_before',
      'meta_initial',
      'meta_reply_1',
      'meta_reply_2',
      'meta_invalid',
      'meta_payment_success',
      'test_manual'
    )
  ),
  CONSTRAINT whatsapp_automation_send_log_unique UNIQUE (company_id, automation_type, reference_id)
);

CREATE INDEX IF NOT EXISTS whatsapp_automation_send_log_company_created_idx
  ON public.whatsapp_automation_send_log (company_id, created_at DESC);

ALTER TABLE public.whatsapp_automation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_automation_send_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_automation_settings_admin ON public.whatsapp_automation_settings;
CREATE POLICY whatsapp_automation_settings_admin ON public.whatsapp_automation_settings
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS whatsapp_automation_send_log_admin ON public.whatsapp_automation_send_log;
CREATE POLICY whatsapp_automation_send_log_admin ON public.whatsapp_automation_send_log
  FOR SELECT TO authenticated
  USING (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_automation_settings TO authenticated;
GRANT SELECT ON public.whatsapp_automation_send_log TO authenticated;
GRANT ALL ON public.whatsapp_automation_settings TO service_role;
GRANT ALL ON public.whatsapp_automation_send_log TO service_role;

-- Ampliar estados de automatización Meta (opción 1 → espera pago Stripe)
ALTER TABLE public.marketing_leads
  DROP CONSTRAINT IF EXISTS marketing_leads_wa_automation_status_check;

ALTER TABLE public.marketing_leads
  ADD CONSTRAINT marketing_leads_wa_automation_status_check
  CHECK (
    wa_automation_status IN (
      'none',
      'skipped',
      'awaiting_reply',
      'awaiting_payment',
      'completed',
      'failed'
    )
  );

COMMENT ON COLUMN public.marketing_leads.wa_automation_status IS
  'none | skipped | awaiting_reply | awaiting_payment | completed | failed';

INSERT INTO public.whatsapp_automation_settings (company_id)
SELECT c.id FROM public.companies c
ON CONFLICT (company_id) DO NOTHING;
