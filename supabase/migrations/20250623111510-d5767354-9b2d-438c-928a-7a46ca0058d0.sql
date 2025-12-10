
-- Add purchase price field to articles table
ALTER TABLE public.articles ADD COLUMN precio_compra NUMERIC DEFAULT 0;

-- Update the column to not be null
UPDATE public.articles SET precio_compra = 0 WHERE precio_compra IS NULL;

-- Make the column not null
ALTER TABLE public.articles ALTER COLUMN precio_compra SET NOT NULL;
