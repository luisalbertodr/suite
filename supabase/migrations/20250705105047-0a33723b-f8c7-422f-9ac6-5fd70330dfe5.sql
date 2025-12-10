
-- Create article_families table to store families per company
CREATE TABLE public.article_families (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_family_per_company UNIQUE (company_id, name)
);

-- Add Row Level Security
ALTER TABLE public.article_families ENABLE ROW LEVEL SECURITY;

-- Create policies for article_families
CREATE POLICY "Users can access their company's article families" 
  ON public.article_families 
  FOR ALL
  USING (company_id = get_user_company_id());

-- Add trigger for updated_at
CREATE TRIGGER update_article_families_updated_at
  BEFORE UPDATE ON public.article_families
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default families for existing companies
INSERT INTO public.article_families (company_id, name)
SELECT DISTINCT c.id, f.family_name
FROM public.companies c
CROSS JOIN (
  VALUES 
    ('Routers'),
    ('Cables'),
    ('Switches'),
    ('Antenas'),
    ('Repetidores'),
    ('Accesorios')
) AS f(family_name)
ON CONFLICT (company_id, name) DO NOTHING;
