
-- Primero, vamos a verificar y arreglar la función get_user_company_id
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT company_id FROM public.user_profiles WHERE user_id = auth.uid()),
    (SELECT id FROM public.companies LIMIT 1)
  );
$$;

-- Asegurar que company_id tenga un valor por defecto que funcione
ALTER TABLE public.agenda_appointments 
ALTER COLUMN company_id SET DEFAULT get_user_company_id();

-- Actualizar la política RLS para permitir inserciones con company_id correcto
DROP POLICY IF EXISTS "Users can access their company's appointments" ON public.agenda_appointments;

-- Crear políticas más específicas
CREATE POLICY "Users can view their company's appointments" 
  ON public.agenda_appointments 
  FOR SELECT 
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can insert appointments for their company" 
  ON public.agenda_appointments 
  FOR INSERT 
  WITH CHECK (company_id = get_user_company_id() OR company_id IS NULL);

CREATE POLICY "Users can update their company's appointments" 
  ON public.agenda_appointments 
  FOR UPDATE 
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can delete their company's appointments" 
  ON public.agenda_appointments 
  FOR DELETE 
  USING (company_id = get_user_company_id());

-- Limpiar datos existentes sin company_id y asignarles uno
UPDATE public.agenda_appointments 
SET company_id = get_user_company_id() 
WHERE company_id IS NULL;
