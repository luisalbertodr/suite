
-- Revertir employee_id a TEXT para usar identificadores fijos como empleado1, empleado2, etc.
ALTER TABLE public.agenda_appointments 
DROP CONSTRAINT IF EXISTS agenda_appointments_employee_id_fkey;

-- Cambiar employee_id de UUID a TEXT
ALTER TABLE public.agenda_appointments 
ALTER COLUMN employee_id TYPE TEXT;

-- No necesitamos foreign key constraint ya que usaremos identificadores fijos
-- Los datos se filtrarán por company_id para mantener la separación por empresa
