
-- Eliminar políticas de Storage existentes que pueden estar causando problemas
DROP POLICY IF EXISTS "Authenticated users can view documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete documents" ON storage.objects;

-- Crear políticas de Storage más específicas y funcionales
CREATE POLICY "Users can view documents in documents bucket" 
  ON storage.objects 
  FOR SELECT 
  USING (bucket_id = 'documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can upload documents to documents bucket" 
  ON storage.objects 
  FOR INSERT 
  WITH CHECK (bucket_id = 'documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update documents in documents bucket" 
  ON storage.objects 
  FOR UPDATE 
  USING (bucket_id = 'documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete documents in documents bucket" 
  ON storage.objects 
  FOR DELETE 
  USING (bucket_id = 'documents' AND auth.uid() IS NOT NULL);

-- Asegurar que el bucket 'documents' existe y es público para visualización
UPDATE storage.buckets 
SET public = true 
WHERE id = 'documents';

-- Si el bucket no existe, crearlo
INSERT INTO storage.buckets (id, name, public) 
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO UPDATE SET public = true;
