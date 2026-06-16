-- Plantillas de consentimiento informado por empresa + extensión de instancias firmadas.

CREATE TABLE IF NOT EXISTS public.consentimiento_plantillas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  contenido TEXT NOT NULL DEFAULT '',
  activo BOOLEAN NOT NULL DEFAULT true,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consentimiento_plantillas_company
  ON public.consentimiento_plantillas (company_id, activo);

ALTER TABLE public.consentimientos
  ADD COLUMN IF NOT EXISTS plantilla_id UUID REFERENCES public.consentimiento_plantillas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS plantilla_version INTEGER,
  ADD COLUMN IF NOT EXISTS documento_pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS datos_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS firmado_por_empleado_id UUID REFERENCES public.agenda_employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES public.agenda_appointments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_consentimientos_customer_firmado
  ON public.consentimientos (customer_id, firmado, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_consentimientos_appointment
  ON public.consentimientos (appointment_id)
  WHERE appointment_id IS NOT NULL;

ALTER TABLE public.consentimiento_plantillas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consentimiento_plantillas FORCE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage consentimiento_plantillas"
  ON public.consentimiento_plantillas
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
