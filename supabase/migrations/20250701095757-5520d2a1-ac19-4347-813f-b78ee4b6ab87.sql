
-- Create document_categories table
CREATE TABLE public.document_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add Row Level Security
ALTER TABLE public.document_categories ENABLE ROW LEVEL SECURITY;

-- Create policies for document_categories
CREATE POLICY "Allow read access to document categories" 
  ON public.document_categories 
  FOR SELECT 
  USING (true);

CREATE POLICY "Allow insert access to document categories" 
  ON public.document_categories 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Allow update access to document categories" 
  ON public.document_categories 
  FOR UPDATE 
  USING (true);

CREATE POLICY "Allow delete access to document categories" 
  ON public.document_categories 
  FOR DELETE 
  USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_document_categories_updated_at
  BEFORE UPDATE ON public.document_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some default categories
INSERT INTO public.document_categories (name, description) VALUES
('Contratos', 'Documentos contractuales y acuerdos'),
('Facturas', 'Facturas y documentos de facturación'),
('Certificados', 'Certificados y documentos oficiales'),
('Informes', 'Informes y reportes empresariales'),
('Otros', 'Documentos varios');
