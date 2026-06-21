-- Mensaje inicial WhatsApp: modo audio por formulario Meta + seguimiento Audio/Texto

ALTER TABLE public.meta_forms
  ADD COLUMN IF NOT EXISTS whatsapp_initial_audio_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_initial_audio_path TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_initial_audio_filename TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_initial_audio_mime TEXT;

COMMENT ON COLUMN public.meta_forms.whatsapp_initial_audio_enabled IS
  'Si true, el mensaje 1 se envía como audio adjunto y se ignora whatsapp_initial_message.';
COMMENT ON COLUMN public.meta_forms.whatsapp_initial_audio_path IS
  'Ruta en storage (bucket documents) del audio de bienvenida.';

ALTER TABLE public.marketing_whatsapp_queue
  ADD COLUMN IF NOT EXISTS sent_kind TEXT;

ALTER TABLE public.marketing_whatsapp_queue
  DROP CONSTRAINT IF EXISTS marketing_whatsapp_queue_sent_kind_check;

ALTER TABLE public.marketing_whatsapp_queue
  ADD CONSTRAINT marketing_whatsapp_queue_sent_kind_check
  CHECK (sent_kind IS NULL OR sent_kind IN ('text', 'audio'));

COMMENT ON COLUMN public.marketing_whatsapp_queue.sent_kind IS
  'Tipo de bienvenida enviada: text o audio.';

ALTER TABLE public.marketing_leads
  ADD COLUMN IF NOT EXISTS wa_automation_initial_sent_kind TEXT;

ALTER TABLE public.marketing_leads
  DROP CONSTRAINT IF EXISTS marketing_leads_wa_initial_sent_kind_check;

ALTER TABLE public.marketing_leads
  ADD CONSTRAINT marketing_leads_wa_initial_sent_kind_check
  CHECK (wa_automation_initial_sent_kind IS NULL OR wa_automation_initial_sent_kind IN ('text', 'audio'));

COMMENT ON COLUMN public.marketing_leads.wa_automation_initial_sent_kind IS
  'Bienvenida WA enviada como text o audio (seguimiento A/B).';

CREATE INDEX IF NOT EXISTS marketing_whatsapp_queue_sent_kind_idx
  ON public.marketing_whatsapp_queue (company_id, sent_kind, sent_at DESC)
  WHERE status = 'sent';

ALTER TABLE public.whatsapp_automation_send_log
  DROP CONSTRAINT IF EXISTS whatsapp_automation_send_log_type_check;

ALTER TABLE public.whatsapp_automation_send_log
  ADD CONSTRAINT whatsapp_automation_send_log_type_check
  CHECK (
    automation_type IN (
      'appointment_day_before',
      'appointment_hour_before',
      'meta_initial',
      'meta_initial_audio',
      'meta_queue_initial',
      'meta_reply_1',
      'meta_reply_2',
      'meta_invalid',
      'meta_reminder',
      'meta_payment_success',
      'phone_missed',
      'phone_voicemail',
      'phone_missed_alert',
      'test_manual'
    )
  );
