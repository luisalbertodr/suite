-- Notas rápidas WhatsApp (snippets para enviar desde el chat)
-- + plantillas de recordatorio de cita por categoría de tratamiento

CREATE TABLE IF NOT EXISTS public.whatsapp_quick_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_quick_notes_company_sort_idx
  ON public.whatsapp_quick_notes (company_id, sort_order ASC, created_at ASC);

COMMENT ON TABLE public.whatsapp_quick_notes IS
  'Mensajes predefinidos enviables desde el botón Notas del chat WhatsApp.';

ALTER TABLE public.whatsapp_quick_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_quick_notes_company ON public.whatsapp_quick_notes;
CREATE POLICY whatsapp_quick_notes_company ON public.whatsapp_quick_notes
  FOR ALL TO authenticated
  USING (
    public.is_admin()
    OR company_id = public.get_user_company_id()
    OR EXISTS (
      SELECT 1
      FROM public.get_effective_user_permissions(auth.uid(), company_id) ep
      WHERE (ep.resource = 'whatsapp' AND ep.action IN ('read', 'write'))
         OR (ep.resource = 'marketing' AND ep.action IN ('read', 'write'))
    )
  )
  WITH CHECK (
    public.is_admin()
    OR company_id = public.get_user_company_id()
    OR EXISTS (
      SELECT 1
      FROM public.get_effective_user_permissions(auth.uid(), company_id) ep
      WHERE (ep.resource = 'whatsapp' AND ep.action = 'write')
         OR (ep.resource = 'marketing' AND ep.action = 'write')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_quick_notes TO authenticated;
GRANT ALL ON public.whatsapp_quick_notes TO service_role;

-- Plantillas por tratamiento (JSONB): laser_fotodepilacion | micropigmentacion | medicina | otros
ALTER TABLE public.whatsapp_automation_settings
  ADD COLUMN IF NOT EXISTS appointment_reminder_templates JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.whatsapp_automation_settings.appointment_reminder_templates IS
  'Plantillas day_before/hour_before por categoría: laser_fotodepilacion, micropigmentacion, medicina, otros. Variables: {nombre}, {hora_cita}, {fecha_cita}, {profesional}, {titulo}.';

UPDATE public.whatsapp_automation_settings
SET appointment_reminder_templates = jsonb_build_object(
  'laser_fotodepilacion', jsonb_build_object(
    'day_before',
    E'Hola, {nombre}.\n\nTe recordamos tu cita de mañana en Lipoout a las {hora_cita} h para tu sesión de fotodepilación / láser fraccionado.\n\nSi has estado expuesta al sol o estás tomando algún medicamento, especialmente antibióticos, tendremos que reprogramar tu cita.\n\nRecuerda confirmar tu asistencia respondiendo a este mensaje o la cita será liberada.\n\nUn saludo.',
    'hour_before',
    E'Hola {nombre}, tu sesión de fotodepilación / láser es dentro de 1 hora ({hora_cita}). Te esperamos en Lipoout.'
  ),
  'micropigmentacion', jsonb_build_object(
    'day_before',
    E'Buenos días {nombre}.\nTe recordamos tu cita de mañana en Lipoout a las {hora_cita} para tu sesión de micropigmentación.\nAgradeceríamos que nos confirmaras tu asistencia; en caso de no recibir tu confirmación, la hora será liberada.\nMuchas gracias.',
    'hour_before',
    E'Hola {nombre}, tu cita de micropigmentación es dentro de 1 hora ({hora_cita}). Te esperamos en Lipoout.'
  ),
  'medicina', jsonb_build_object(
    'day_before',
    E'Buenos días {nombre}.\nTe recordamos tu cita de mañana con {profesional} en Lipoout a las {hora_cita}.\nAgradeceríamos que nos confirmaras tu asistencia; en caso de no recibir tu confirmación, la hora será liberada.\nMuchas gracias.',
    'hour_before',
    E'Hola {nombre}, tu cita con {profesional} es dentro de 1 hora ({hora_cita}). Te esperamos en Lipoout.'
  ),
  'otros', jsonb_build_object(
    'day_before',
    E'Buenos días {nombre}.\nTe recordamos tu cita de mañana en Lipoout a las {hora_cita}.\nAgradeceríamos que nos confirmaras tu asistencia; en caso de no recibir tu confirmación, la hora será liberada.\nMuchas gracias.',
    'hour_before',
    E'Hola {nombre}, tu cita es dentro de 1 hora ({hora_cita}). Te esperamos en Lipoout.'
  )
)
WHERE appointment_reminder_templates = '{}'::jsonb
   OR appointment_reminder_templates IS NULL;
