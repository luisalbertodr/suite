-- Historial clínico por cita + fecha de nacimiento en cliente.

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS birth_date date;

COMMENT ON COLUMN public.customers.birth_date IS 'Fecha de nacimiento del cliente';

ALTER TABLE public.historial_clinico
  ADD COLUMN IF NOT EXISTS appointment_id uuid REFERENCES public.agenda_appointments(id) ON DELETE SET NULL;

ALTER TABLE public.historial_clinico
  ADD COLUMN IF NOT EXISTS antecedentes_personales text;

ALTER TABLE public.historial_clinico
  ADD COLUMN IF NOT EXISTS motivo_consulta text;

ALTER TABLE public.historial_clinico
  ADD COLUMN IF NOT EXISTS proxima_revision_fecha date;

ALTER TABLE public.historial_clinico
  ADD COLUMN IF NOT EXISTS proxima_revision_descripcion text;

ALTER TABLE public.historial_clinico
  ADD COLUMN IF NOT EXISTS aviso_text text;

CREATE INDEX IF NOT EXISTS idx_historial_clinico_appointment
  ON public.historial_clinico (appointment_id)
  WHERE appointment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_historial_clinico_appointment_unique
  ON public.historial_clinico (appointment_id)
  WHERE appointment_id IS NOT NULL;
