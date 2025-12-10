
-- Agregar campo iva_percentage a la tabla articles
ALTER TABLE public.articles 
ADD COLUMN iva_percentage numeric(5,2) DEFAULT 21.00;

-- Agregar campo iva_percentage a la tabla article_variations
ALTER TABLE public.article_variations 
ADD COLUMN iva_percentage numeric(5,2) DEFAULT 21.00;

-- Actualizar todos los registros existentes para que tengan el valor por defecto
UPDATE public.articles SET iva_percentage = 21.00 WHERE iva_percentage IS NULL;
UPDATE public.article_variations SET iva_percentage = 21.00 WHERE iva_percentage IS NULL;
