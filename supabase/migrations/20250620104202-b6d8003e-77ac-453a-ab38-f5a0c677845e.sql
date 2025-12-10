
-- Agregar campo de medidas a la tabla quote_items
ALTER TABLE public.quote_items 
ADD COLUMN measurements TEXT;

-- Agregar campo de superficie calculada
ALTER TABLE public.quote_items 
ADD COLUMN surface_area NUMERIC DEFAULT 0;
