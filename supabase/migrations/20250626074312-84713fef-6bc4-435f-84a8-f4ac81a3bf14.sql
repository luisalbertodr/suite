
-- Habilitar RLS en la tabla companies si no está ya habilitado
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Crear políticas que permitan a todos los usuarios autenticados y anónimos gestionar empresas
CREATE POLICY "Allow all users to view companies" 
ON public.companies 
FOR SELECT 
USING (true);

CREATE POLICY "Allow all users to insert companies" 
ON public.companies 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow all users to update companies" 
ON public.companies 
FOR UPDATE 
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow all users to delete companies" 
ON public.companies 
FOR DELETE 
USING (true);
