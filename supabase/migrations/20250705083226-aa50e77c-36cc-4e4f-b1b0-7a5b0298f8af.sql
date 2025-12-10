
-- Primero, vamos a revisar y arreglar las políticas RLS para documentos
-- Eliminar las políticas existentes que pueden estar causando problemas
DROP POLICY IF EXISTS "Users can view documents from their company" ON public.documents;
DROP POLICY IF EXISTS "Users can insert documents to their company" ON public.documents;
DROP POLICY IF EXISTS "Users can update documents from their company" ON public.documents;
DROP POLICY IF EXISTS "Users can delete documents from their company" ON public.documents;

-- Crear políticas RLS más permisivas para documentos
CREATE POLICY "Users can view company documents" 
  ON public.documents 
  FOR SELECT 
  USING (
    company_id = get_user_company_id() OR 
    company_id IS NULL OR 
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can insert company documents" 
  ON public.documents 
  FOR INSERT 
  WITH CHECK (
    company_id = get_user_company_id() OR 
    company_id IS NULL OR 
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can update company documents" 
  ON public.documents 
  FOR UPDATE 
  USING (
    company_id = get_user_company_id() OR 
    company_id IS NULL OR 
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can delete company documents" 
  ON public.documents 
  FOR DELETE 
  USING (
    company_id = get_user_company_id() OR 
    company_id IS NULL OR 
    auth.uid() IS NOT NULL
  );

-- Revisar y actualizar las políticas de Storage para que sean más permisivas
DROP POLICY IF EXISTS "Users can view documents from their company" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their documents" ON storage.objects;

-- Crear políticas de Storage más permisivas
CREATE POLICY "Authenticated users can view documents" 
  ON storage.objects 
  FOR SELECT 
  USING (bucket_id = 'documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can upload documents" 
  ON storage.objects 
  FOR INSERT 
  WITH CHECK (bucket_id = 'documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update documents" 
  ON storage.objects 
  FOR UPDATE 
  USING (bucket_id = 'documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete documents" 
  ON storage.objects 
  FOR DELETE 
  USING (bucket_id = 'documents' AND auth.uid() IS NOT NULL);

-- Asegurar que los documentos existentes tengan company_id asignado
UPDATE public.documents 
SET company_id = get_user_company_id() 
WHERE company_id IS NULL;
