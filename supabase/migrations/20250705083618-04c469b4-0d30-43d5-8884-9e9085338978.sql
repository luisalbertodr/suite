
-- Corregir las políticas RLS para documentos - hacerlas más restrictivas
DROP POLICY IF EXISTS "Users can view company documents" ON public.documents;
DROP POLICY IF EXISTS "Users can insert company documents" ON public.documents;
DROP POLICY IF EXISTS "Users can update company documents" ON public.documents;
DROP POLICY IF EXISTS "Users can delete company documents" ON public.documents;

-- Crear políticas RLS más restrictivas que solo permitan acceso a documentos de la empresa del usuario
CREATE POLICY "Users can view their company documents only" 
  ON public.documents 
  FOR SELECT 
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can insert their company documents only" 
  ON public.documents 
  FOR INSERT 
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can update their company documents only" 
  ON public.documents 
  FOR UPDATE 
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can delete their company documents only" 
  ON public.documents 
  FOR DELETE 
  USING (company_id = get_user_company_id());

-- Verificar que todos los documentos tengan un company_id válido
UPDATE public.documents 
SET company_id = (
  SELECT up.company_id 
  FROM public.user_profiles up 
  WHERE up.user_id = documents.uploaded_by
  LIMIT 1
)
WHERE company_id IS NULL AND uploaded_by IS NOT NULL;
