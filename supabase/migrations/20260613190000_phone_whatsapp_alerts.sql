-- Alertas WhatsApp por llamadas perdidas y buzón de voz (Issabel)
ALTER TABLE public.whatsapp_automation_settings
  ADD COLUMN IF NOT EXISTS phone_missed_whatsapp_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS phone_missed_whatsapp_phone TEXT NOT NULL DEFAULT '881242909';

COMMENT ON COLUMN public.whatsapp_automation_settings.phone_missed_whatsapp_phone IS
  'WhatsApp destino para avisos de llamada perdida / buzón (sin modo prueba).';

ALTER TABLE public.whatsapp_automation_send_log
  DROP CONSTRAINT IF EXISTS whatsapp_automation_send_log_type_check;

ALTER TABLE public.whatsapp_automation_send_log
  ADD CONSTRAINT whatsapp_automation_send_log_type_check
  CHECK (
    automation_type IN (
      'appointment_day_before',
      'appointment_hour_before',
      'meta_initial',
      'meta_reply_1',
      'meta_reply_2',
      'meta_invalid',
      'meta_payment_success',
      'test_manual',
      'phone_missed',
      'phone_voicemail'
    )
  );
