
-- Add precio_compra field to article_variations table
ALTER TABLE public.article_variations ADD COLUMN precio_compra NUMERIC NOT NULL DEFAULT 0;

-- Update existing variations to have a default purchase price of 0
UPDATE public.article_variations SET precio_compra = 0 WHERE precio_compra IS NULL;

-- Add index for better performance on queries
CREATE INDEX IF NOT EXISTS idx_article_variations_precio_compra ON public.article_variations(precio_compra);

-- Add comment to document the new column
COMMENT ON COLUMN public.article_variations.precio_compra IS 'Precio de compra de la variación del artículo';
