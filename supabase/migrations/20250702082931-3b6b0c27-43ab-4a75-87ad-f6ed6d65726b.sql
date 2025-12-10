
-- Cambiar el tipo de employee_id de UUID a TEXT y eliminar la foreign key constraint
ALTER TABLE public.agenda_appointments 
DROP CONSTRAINT IF EXISTS agenda_appointments_employee_id_fkey;

ALTER TABLE public.agenda_appointments 
ALTER COLUMN employee_id TYPE TEXT;

-- Actualizar cualquier dato existente que tenga UUIDs por los nuevos identificadores
UPDATE public.agenda_appointments 
SET employee_id = 'empleado1' 
WHERE employee_id IN (SELECT id FROM public.agenda_employees WHERE name LIKE '%1%');

UPDATE public.agenda_appointments 
SET employee_id = 'empleado2' 
WHERE employee_id IN (SELECT id FROM public.agenda_employees WHERE name LIKE '%2%');

UPDATE public.agenda_appointments 
SET employee_id = 'empleado3' 
WHERE employee_id IN (SELECT id FROM public.agenda_employees WHERE name LIKE '%3%');

UPDATE public.agenda_appointments 
SET employee_id = 'empleado4' 
WHERE employee_id IN (SELECT id FROM public.agenda_employees WHERE name LIKE '%4%');

UPDATE public.agenda_appointments 
SET employee_id = 'empleado5' 
WHERE employee_id IN (SELECT id FROM public.agenda_employees WHERE name LIKE '%5%');

UPDATE public.agenda_appointments 
SET employee_id = 'empleado6' 
WHERE employee_id IN (SELECT id FROM public.agenda_employees WHERE name LIKE '%6%');
