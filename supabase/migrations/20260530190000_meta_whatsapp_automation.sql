-- Automatización WhatsApp para leads Meta: mensaje inicial + respuestas 1/2
-- ============================================================================

ALTER TABLE public.meta_forms
  ADD COLUMN IF NOT EXISTS whatsapp_automation_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_initial_message TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_reply_1_message TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_reply_2_message TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_reply_invalid_message TEXT;

COMMENT ON COLUMN public.meta_forms.whatsapp_initial_message IS
  'Mensaje WhatsApp automático al crear el lead (presenta la oferta y pide 1 o 2).';
COMMENT ON COLUMN public.meta_forms.whatsapp_reply_1_message IS
  'Mensaje automático si el lead responde 1.';
COMMENT ON COLUMN public.meta_forms.whatsapp_reply_2_message IS
  'Mensaje automático si el lead responde 2.';
COMMENT ON COLUMN public.meta_forms.whatsapp_reply_invalid_message IS
  'Mensaje si responde otra cosa estando en espera (opcional).';

ALTER TABLE public.marketing_leads
  ADD COLUMN IF NOT EXISTS meta_form_id UUID REFERENCES public.meta_forms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS wa_automation_status TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS wa_automation_error TEXT,
  ADD COLUMN IF NOT EXISTS wa_automation_initial_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS wa_automation_completed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.marketing_leads.wa_automation_status IS
  'none | skipped | awaiting_reply | completed | failed';

ALTER TABLE public.marketing_leads
  DROP CONSTRAINT IF EXISTS marketing_leads_wa_automation_status_check;

ALTER TABLE public.marketing_leads
  ADD CONSTRAINT marketing_leads_wa_automation_status_check
  CHECK (
    wa_automation_status IN (
      'none',
      'skipped',
      'awaiting_reply',
      'completed',
      'failed'
    )
  );

CREATE INDEX IF NOT EXISTS marketing_leads_wa_automation_status_idx
  ON public.marketing_leads (company_id, wa_automation_status)
  WHERE wa_automation_status = 'awaiting_reply';

CREATE INDEX IF NOT EXISTS marketing_leads_meta_form_id_idx
  ON public.marketing_leads (meta_form_id)
  WHERE meta_form_id IS NOT NULL;
