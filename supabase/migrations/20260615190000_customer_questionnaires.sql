-- Cuestionario facial-corporal: perfil clínico persistente + instancias firmadas.

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS clinical_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS occupation text,
  ADD COLUMN IF NOT EXISTS height_cm numeric(5, 2),
  ADD COLUMN IF NOT EXISTS first_session_date date;

COMMENT ON COLUMN public.customers.clinical_profile IS
  'Perfil clínico reutilizable (hábitos, contraindicaciones, etc.) para precargar cuestionarios.';

CREATE TABLE IF NOT EXISTS public.customer_questionnaires (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.agenda_appointments(id) ON DELETE SET NULL,
  form_key text NOT NULL DEFAULT 'facial_corporal_2026',
  form_version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'patient_editing'
    CHECK (status IN (
      'patient_editing',
      'patient_submitted',
      'technical_editing',
      'completed'
    )),
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  technical_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  profile_snapshot jsonb,
  patient_submitted_at timestamptz,
  technical_started_at timestamptz,
  technical_started_by uuid REFERENCES public.agenda_employees(id) ON DELETE SET NULL,
  completed_at timestamptz,
  completed_by uuid REFERENCES public.agenda_employees(id) ON DELETE SET NULL,
  return_note text,
  firma_url text,
  documento_pdf_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_questionnaires_customer
  ON public.customer_questionnaires (customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_questionnaires_status
  ON public.customer_questionnaires (company_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_questionnaires_appointment
  ON public.customer_questionnaires (appointment_id)
  WHERE appointment_id IS NOT NULL;

ALTER TABLE public.customer_questionnaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_questionnaires FORCE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage customer_questionnaires"
  ON public.customer_questionnaires
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
