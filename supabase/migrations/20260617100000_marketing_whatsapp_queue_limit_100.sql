-- Límite diario cola WA: 100. Prioridad: leads más recientes (lógica en edge).

ALTER TABLE public.whatsapp_automation_settings
  ALTER COLUMN marketing_queue_daily_limit SET DEFAULT 100;

UPDATE public.whatsapp_automation_settings
SET marketing_queue_daily_limit = 100
WHERE marketing_queue_daily_limit < 100;

COMMENT ON TABLE public.marketing_whatsapp_queue IS
  'Cola de envío del mensaje WhatsApp inicial (Meta). Procesado: leads más recientes primero.';
