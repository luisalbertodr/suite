-- Cola manual de WhatsApp inicial para leads Meta (throttle 50/día, 10-20h).

CREATE TABLE IF NOT EXISTS public.marketing_whatsapp_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  marketing_lead_id UUID NOT NULL REFERENCES public.marketing_leads(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  queued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  queued_by UUID,
  sent_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT marketing_whatsapp_queue_lead_unique UNIQUE (company_id, marketing_lead_id)
);

CREATE INDEX IF NOT EXISTS marketing_whatsapp_queue_pending_idx
  ON public.marketing_whatsapp_queue (company_id, queued_at)
  WHERE status = 'pending';

COMMENT ON TABLE public.marketing_whatsapp_queue IS
  'Cola manual de envío del mensaje WhatsApp inicial (Meta). Orden: más antiguos primero.';

ALTER TABLE public.whatsapp_automation_settings
  ADD COLUMN IF NOT EXISTS marketing_queue_daily_limit INT NOT NULL DEFAULT 50
    CHECK (marketing_queue_daily_limit >= 1 AND marketing_queue_daily_limit <= 500),
  ADD COLUMN IF NOT EXISTS marketing_queue_hour_start INT NOT NULL DEFAULT 10
    CHECK (marketing_queue_hour_start >= 0 AND marketing_queue_hour_start <= 23),
  ADD COLUMN IF NOT EXISTS marketing_queue_hour_end INT NOT NULL DEFAULT 20
    CHECK (marketing_queue_hour_end >= 1 AND marketing_queue_hour_end <= 24),
  ADD COLUMN IF NOT EXISTS marketing_queue_min_pause_seconds INT NOT NULL DEFAULT 180
    CHECK (marketing_queue_min_pause_seconds >= 30 AND marketing_queue_min_pause_seconds <= 3600),
  ADD COLUMN IF NOT EXISTS marketing_queue_max_pause_seconds INT NOT NULL DEFAULT 900
    CHECK (marketing_queue_max_pause_seconds >= 60 AND marketing_queue_max_pause_seconds <= 7200),
  ADD COLUMN IF NOT EXISTS marketing_queue_last_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS marketing_queue_next_send_at TIMESTAMPTZ;

COMMENT ON COLUMN public.whatsapp_automation_settings.marketing_queue_daily_limit IS
  'Máximo de mensajes iniciales enviados desde la cola cada día (Europe/Madrid).';
COMMENT ON COLUMN public.whatsapp_automation_settings.marketing_queue_hour_start IS
  'Hora local Madrid (inclusive) desde la que puede enviar la cola.';
COMMENT ON COLUMN public.whatsapp_automation_settings.marketing_queue_hour_end IS
  'Hora local Madrid (exclusive) hasta la que puede enviar la cola (20 = hasta 19:59).';

ALTER TABLE public.marketing_whatsapp_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketing_whatsapp_queue_select ON public.marketing_whatsapp_queue;
CREATE POLICY marketing_whatsapp_queue_select
  ON public.marketing_whatsapp_queue FOR SELECT TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND public.current_user_has_marketing_permission('read')
  );

DROP POLICY IF EXISTS marketing_whatsapp_queue_insert ON public.marketing_whatsapp_queue;
CREATE POLICY marketing_whatsapp_queue_insert
  ON public.marketing_whatsapp_queue FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND public.current_user_has_marketing_permission('write')
  );

DROP POLICY IF EXISTS marketing_whatsapp_queue_update ON public.marketing_whatsapp_queue;
CREATE POLICY marketing_whatsapp_queue_update
  ON public.marketing_whatsapp_queue FOR UPDATE TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND public.current_user_has_marketing_permission('write')
  );

DROP POLICY IF EXISTS marketing_whatsapp_queue_delete ON public.marketing_whatsapp_queue;
CREATE POLICY marketing_whatsapp_queue_delete
  ON public.marketing_whatsapp_queue FOR DELETE TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND public.current_user_has_marketing_permission('write')
    AND status = 'pending'
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_whatsapp_queue TO authenticated;
GRANT ALL ON public.marketing_whatsapp_queue TO service_role;

DROP TRIGGER IF EXISTS trg_marketing_whatsapp_queue_updated_at ON public.marketing_whatsapp_queue;
CREATE TRIGGER trg_marketing_whatsapp_queue_updated_at
  BEFORE UPDATE ON public.marketing_whatsapp_queue
  FOR EACH ROW EXECUTE FUNCTION public.set_notifications_updated_at();

ALTER TABLE public.whatsapp_automation_send_log
  DROP CONSTRAINT IF EXISTS whatsapp_automation_send_log_type_check;

ALTER TABLE public.whatsapp_automation_send_log
  ADD CONSTRAINT whatsapp_automation_send_log_type_check
  CHECK (
    automation_type IN (
      'appointment_day_before',
      'appointment_hour_before',
      'meta_initial',
      'meta_queue_initial',
      'meta_reply_1',
      'meta_reply_2',
      'meta_invalid',
      'meta_reminder',
      'meta_payment_success',
      'phone_missed_alert',
      'test_manual'
    )
  );
