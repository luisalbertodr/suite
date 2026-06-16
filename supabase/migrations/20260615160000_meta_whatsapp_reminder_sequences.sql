-- Secuencia WhatsApp Meta: mensaje inicial + recordatorio si no responde (2-3 h).

ALTER TABLE public.meta_forms
  ADD COLUMN IF NOT EXISTS whatsapp_reminder_message TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_reminder_delay_hours INT NOT NULL DEFAULT 3
    CHECK (whatsapp_reminder_delay_hours >= 1 AND whatsapp_reminder_delay_hours <= 72);

COMMENT ON COLUMN public.meta_forms.whatsapp_reminder_message IS
  'Segundo mensaje automático si el lead no responde tras whatsapp_reminder_delay_hours.';
COMMENT ON COLUMN public.meta_forms.whatsapp_reminder_delay_hours IS
  'Horas de espera tras el mensaje inicial antes del recordatorio (default 3).';

ALTER TABLE public.marketing_leads
  ADD COLUMN IF NOT EXISTS wa_automation_reminder_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.marketing_leads.wa_automation_reminder_sent_at IS
  'Cuándo se envió el recordatorio automático de WhatsApp (si aplica).';

CREATE INDEX IF NOT EXISTS marketing_leads_wa_reminder_pending_idx
  ON public.marketing_leads (company_id, wa_automation_initial_sent_at)
  WHERE wa_automation_status = 'awaiting_reply'
    AND wa_automation_reminder_sent_at IS NULL;
