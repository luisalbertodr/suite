-- Ampliar log de automatización + campañas CTWA (mensaje intro)
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
      'meta_initial_audio_link',
      'meta_queue_initial',
      'meta_reply_1',
      'meta_reply_2',
      'meta_invalid',
      'meta_reminder',
      'meta_payment_success',
      'ctwa_intro',
      'phone_missed',
      'phone_voicemail',
      'phone_missed_alert',
      'test_manual'
    )
  );
