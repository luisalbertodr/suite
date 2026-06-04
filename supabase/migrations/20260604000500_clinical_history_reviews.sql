-- Revisiones estructuradas dentro del historial clínico.

CREATE TABLE IF NOT EXISTS public.historial_clinico_revisiones (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  historial_clinico_id uuid NOT NULL REFERENCES public.historial_clinico(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.agenda_appointments(id) ON DELETE SET NULL,
  fecha date NOT NULL,
  descripcion text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  source_key text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.historial_clinico_revisiones IS
  'Lineas de revision asociadas a un registro de historial clinico, opcionalmente vinculadas a una cita.';

COMMENT ON COLUMN public.historial_clinico_revisiones.appointment_id IS
  'Cita de agenda vinculada a esta revision, si existe una coincidencia inequivoca por cliente y fecha.';

CREATE INDEX IF NOT EXISTS idx_historial_clinico_revisiones_historial
  ON public.historial_clinico_revisiones (historial_clinico_id, fecha, sort_order);

CREATE INDEX IF NOT EXISTS idx_historial_clinico_revisiones_customer
  ON public.historial_clinico_revisiones (company_id, customer_id, fecha);

CREATE INDEX IF NOT EXISTS idx_historial_clinico_revisiones_appointment
  ON public.historial_clinico_revisiones (appointment_id)
  WHERE appointment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_historial_clinico_revisiones_appointment_unique
  ON public.historial_clinico_revisiones (appointment_id)
  WHERE appointment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_historial_clinico_revisiones_source_unique
  ON public.historial_clinico_revisiones (historial_clinico_id, source_key)
  WHERE source_key IS NOT NULL;

ALTER TABLE public.historial_clinico_revisiones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage historial_clinico_revisiones"
  ON public.historial_clinico_revisiones;

CREATE POLICY "Authenticated users can manage historial_clinico_revisiones"
  ON public.historial_clinico_revisiones
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DO $$
BEGIN
  IF to_regprocedure('public.update_updated_at_column()') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS update_historial_clinico_revisiones_updated_at
      ON public.historial_clinico_revisiones;
    CREATE TRIGGER update_historial_clinico_revisiones_updated_at
      BEFORE UPDATE ON public.historial_clinico_revisiones
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;
