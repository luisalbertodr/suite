-- Permite distinguir audio nativo (WAHA Plus) vs enlace de audio (WAHA Core).

ALTER TABLE public.marketing_whatsapp_queue
  DROP CONSTRAINT IF EXISTS marketing_whatsapp_queue_sent_kind_check;

ALTER TABLE public.marketing_whatsapp_queue
  ADD CONSTRAINT marketing_whatsapp_queue_sent_kind_check
  CHECK (sent_kind IS NULL OR sent_kind IN ('text', 'audio', 'audio_link'));

ALTER TABLE public.marketing_leads
  DROP CONSTRAINT IF EXISTS marketing_leads_wa_initial_sent_kind_check;

ALTER TABLE public.marketing_leads
  ADD CONSTRAINT marketing_leads_wa_initial_sent_kind_check
  CHECK (wa_automation_initial_sent_kind IS NULL OR wa_automation_initial_sent_kind IN ('text', 'audio', 'audio_link'));

COMMENT ON COLUMN public.marketing_leads.wa_automation_initial_sent_kind IS
  'text | audio (adjunto WAHA Plus) | audio_link (enlace firmado sin Plus)';
