
-- Hacer que company_id sea obligatorio y se asigne automáticamente
ALTER TABLE public.agenda_appointments 
ALTER COLUMN company_id SET DEFAULT get_user_company_id();

-- Si hay registros sin company_id, asignarles uno
UPDATE public.agenda_appointments 
SET company_id = get_user_company_id() 
WHERE company_id IS NULL;

-- Hacer company_id obligatorio para futuras inserciones
ALTER TABLE public.agenda_appointments 
ALTER COLUMN company_id SET NOT NULL;
