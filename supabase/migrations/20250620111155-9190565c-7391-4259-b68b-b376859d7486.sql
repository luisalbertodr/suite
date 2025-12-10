
-- Create articles table
CREATE TABLE public.articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  descripcion TEXT NOT NULL,
  descripcion_larga TEXT,
  familia TEXT NOT NULL,
  precio NUMERIC(10,2) NOT NULL DEFAULT 0,
  stock_actual INTEGER NOT NULL DEFAULT 0,
  stock_minimo INTEGER NOT NULL DEFAULT 0,
  codigo_barras TEXT,
  codigo_serie TEXT,
  foto_url TEXT,
  estado TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create RLS policies for articles
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

-- Allow all users to perform all operations (similar to customers table)
CREATE POLICY "Allow all users to view articles" 
ON public.articles 
FOR SELECT 
USING (true);

CREATE POLICY "Allow all users to insert articles" 
ON public.articles 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow all users to update articles" 
ON public.articles 
FOR UPDATE 
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow all users to delete articles" 
ON public.articles 
FOR DELETE 
USING (true);

-- Create trigger for updating updated_at column
CREATE TRIGGER update_articles_updated_at
    BEFORE UPDATE ON public.articles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for article photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('article-photos', 'article-photos', true);

-- Create storage policies for article photos
CREATE POLICY "Allow all users to upload article photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'article-photos');

CREATE POLICY "Allow all users to view article photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'article-photos');

CREATE POLICY "Allow all users to update article photos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'article-photos');

CREATE POLICY "Allow all users to delete article photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'article-photos');
