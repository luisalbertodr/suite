
-- Create article_variations table
CREATE TABLE public.article_variations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  talla TEXT NOT NULL,
  color TEXT NOT NULL,
  stock_actual INTEGER NOT NULL DEFAULT 0,
  precio NUMERIC NOT NULL DEFAULT 0,
  codigo_barras TEXT,
  estado TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for better performance
CREATE INDEX idx_article_variations_article_id ON public.article_variations(article_id);
CREATE INDEX idx_article_variations_talla_color ON public.article_variations(talla, color);

-- Enable RLS
ALTER TABLE public.article_variations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view article variations from their company" ON public.article_variations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM articles a 
      WHERE a.id = article_variations.article_id 
      AND a.company_id = get_user_company_id()
    )
  );

CREATE POLICY "Users can insert article variations for their company articles" ON public.article_variations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM articles a 
      WHERE a.id = article_variations.article_id 
      AND a.company_id = get_user_company_id()
    )
  );

CREATE POLICY "Users can update article variations from their company" ON public.article_variations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM articles a 
      WHERE a.id = article_variations.article_id 
      AND a.company_id = get_user_company_id()
    )
  );

CREATE POLICY "Users can delete article variations from their company" ON public.article_variations
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM articles a 
      WHERE a.id = article_variations.article_id 
      AND a.company_id = get_user_company_id()
    )
  );

-- Add trigger for updated_at
CREATE TRIGGER update_article_variations_updated_at
  BEFORE UPDATE ON public.article_variations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
