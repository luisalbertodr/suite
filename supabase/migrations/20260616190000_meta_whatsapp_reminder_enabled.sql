-- Activar/desactivar el segundo mensaje WA (recordatorio tras N horas sin respuesta).

ALTER TABLE public.meta_forms
  ADD COLUMN IF NOT EXISTS whatsapp_reminder_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.meta_forms.whatsapp_reminder_enabled IS
  'Si false, no se envía el mensaje 2 (recordatorio) aunque haya plantilla configurada.';
