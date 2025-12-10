
-- Corregir la referencia foreign key en agenda_appointments
ALTER TABLE public.agenda_appointments 
DROP CONSTRAINT IF EXISTS agenda_appointments_employee_id_fkey;

-- Cambiar employee_id de TEXT a UUID para que sea una referencia válida
ALTER TABLE public.agenda_appointments 
ALTER COLUMN employee_id TYPE UUID USING employee_id::UUID;

-- Agregar la foreign key constraint correcta
ALTER TABLE public.agenda_appointments 
ADD CONSTRAINT agenda_appointments_employee_id_fkey 
FOREIGN KEY (employee_id) REFERENCES public.agenda_employees(id) ON DELETE CASCADE;

-- Limpiar datos de prueba que pueden estar causando problemas
DELETE FROM public.agenda_appointments WHERE employee_id NOT IN (SELECT id FROM public.agenda_employees);

-- Asegurar que todos los empleados de agenda tengan company_id asignado
UPDATE public.agenda_employees 
SET company_id = (SELECT id FROM public.companies LIMIT 1) 
WHERE company_id IS NULL;

-- Hacer company_id obligatorio en agenda_employees para futuras inserciones
ALTER TABLE public.agenda_employees 
ALTER COLUMN company_id SET NOT NULL;
